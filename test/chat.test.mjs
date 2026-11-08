import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../lib/db.mjs";
import { session, newLeague, stateFor } from "../lib/game.mjs";
import {
  chatAction,
  chatSummary,
  welcomeLeagueChat,
  deliverChatPush,
  validPushSubscription,
} from "../lib/league-chat.mjs";
import { enhanceState } from "../lib/community.mjs";
test('chat polling uses a read snapshot with no write transaction and detects moderation even when no new message arrives',async()=>{const {s,l,call}=fixture();await call('a','chat-send',{text:'First',nonce:'read_snapshot_nonce'});let writes=0,reads=0;const request=input=>call('b','chat-messages',input,{transact:()=>{writes++;throw Error('unexpected write');},read:async fn=>{reads++;return fn(structuredClone(s));}});const first=await request({}),same=await request({since:first.latest,revision:first.revision});assert.equal(same.unchanged,true);assert.equal(writes,0);assert.equal(reads,2);await call('a','chat-delete',{message:first.messages[0].id});const changed=await request({since:first.latest,revision:first.revision});assert.equal(changed.unchanged,undefined);assert.equal(changed.messages[0].deleted,true);assert.equal(changed.messages[0].text,'Messaggio eliminato');});
function fixture() {
  const s = emptyState(),
    a = { id: "a", name: "Mister", username: "mister", emailVerified: true },
    b = { id: "b", name: "Amico", username: "amico", emailVerified: true },
    other = {
      id: "other",
      name: "Fuori",
      username: "fuori",
      emailVerified: true,
    };
  s.users.push(a, b, other);
  const l = newLeague(s, a, "Bar");
  l.members.push({ uid: b.id, credits: 500, points: 0 });
  const tokens = {
    a: session(s, a.id),
    b: session(s, b.id),
    other: session(s, other.id),
  };
  const transact = async (fn) => {
    const draft = structuredClone(s),
      r = await fn(draft);
    Object.assign(s, draft);
    return r;
  };
  const call = (uid, route, input = {}, extra = {}) =>
    chatAction({
      route,
      input: { league: l.id, ...input },
      token: tokens[uid],
      transact,
      ...extra,
    });
  return { s, a, b, l, transact, call };
}
const sub = (n) => ({
  endpoint: "https://fcm.googleapis.com/fcm/send/device-" + n,
  keys: {
    p256dh: Buffer.alloc(65, 4).toString("base64url"),
    auth: Buffer.alloc(16, 2).toString("base64url"),
  },
});
test("persistent chat is restricted to verified league members, escapes no storage content and never leaks through state", async () => {
  const { s, a, l, call } = fixture();
  await assert.rejects(call("other", "chat-messages"), /non accessibile/);
  await call("a", "chat-send", {
    text: "<img onerror=alert(1)> Ciao",
    nonce: "unique_nonce_123",
  });
  const restored = structuredClone(s);
  assert.equal(
    restored.leagueChats[l.id].messages[0].text,
    "<img onerror=alert(1)> Ciao",
  );
  assert.equal((await call("b", "chat-messages")).messages.length, 1);
  const view = JSON.stringify(enhanceState(s, a, stateFor(s, a)));
  assert.equal(view.includes("onerror"), false);
  assert.equal(view.includes("chatPushKeys"), false);
});
test("a retried send is idempotent; non-read counts are per member and read markers are monotonic", async () => {
  const { s, a, b, l, call } = fixture();
  const input = { text: "Ciao bar", nonce: "unique_nonce_123" };
  const first = await call("a", "chat-send", input),
    again = await call("a", "chat-send", input);
  assert.equal(first.message.id, again.message.id);
  assert.equal(s.leagueChats[l.id].messages.length, 1);
  assert.equal(chatSummary(s, l, a).unread, 0);
  assert.equal(chatSummary(s, l, b).unread, 1);
  await call("b", "chat-read", { through: 1 });
  await call("b", "chat-read", { through: 0 });
  assert.equal(chatSummary(s, l, b).unread, 0);
  await assert.rejects(call("b", "chat-read", { through: 2 }));
});
test("chat validation, throttling, pagination and author/president moderation are enforced on the server", async () => {
  const { s, l, call } = fixture();
  await assert.rejects(
    call("a", "chat-send", { text: " ", nonce: "unique_nonce_123" }),
  );
  await assert.rejects(
    call("a", "chat-send", {
      text: "x".repeat(1201),
      nonce: "unique_nonce_123",
    }),
  );
  const m = await call("a", "chat-send", {
    text: "Certezze",
    nonce: "unique_nonce_123",
  });
  await assert.rejects(
    call("b", "chat-delete", { message: m.message.id }),
    /soltanto/,
  );
  await call("a", "chat-delete", { message: m.message.id });
  assert.equal(
    (await call("b", "chat-messages")).messages[0].text,
    "Messaggio eliminato",
  );
  for (let i = 1; i < 12; i++)
    await call("a", "chat-send", {
      text: "Messaggio " + i,
      nonce: "unique_nonce_" + i,
    });
  await assert.rejects(
    call("a", "chat-send", { text: "Troppi", nonce: "unique_nonce_999" }),
    /pausa/,
  );
  s.leagueChats[l.id].messages.forEach(
    (m) => (m.created = "2020-01-01T00:00:00Z"),
  );
  for (let i = 12; i < 64; i++) {
    await call("a", "chat-send", {
      text: "Messaggio " + i,
      nonce: "unique_nonce_" + i,
    });
    s.leagueChats[l.id].messages.at(-1).created = "2020-01-01T00:00:00Z";
  }
  const page = await call("b", "chat-messages");
  assert.equal(page.messages.length, 50);
  assert.equal(page.hasOlder, true);
  const old = await call("b", "chat-messages", {
    before: page.messages[0].seq,
  });
  assert.equal(old.messages.length, 14);
  assert.equal(old.hasOlder, false);
});
test("push requires opt in, targets only current league members, omits chat text and removes expired subscriptions", async () => {
  const { s, l, transact, call } = fixture();
  await call("b", "chat-subscribe", { subscription: sub(1) });
  const sent = [];
  await call("a", "chat-send", {
    text: "Segreto della chat",
    nonce: "unique_nonce_123",
  });
  assert.equal(s.chatPushOutbox.length, 1);
  await deliverChatPush({
    transact,
    sendPush: async (subscription, body) => sent.push({ subscription, body }),
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.includes("Segreto"), false);
  assert.equal(JSON.parse(sent[0].body).league, l.id);
  assert.equal(s.chatPushOutbox.length, 0);
  await call("b", "chat-preferences", { notify: false });
  await call("a", "chat-send", { text: "Silenzio", nonce: "unique_nonce_456" });
  assert.equal(s.chatPushOutbox.length, 0);
  await call("b", "chat-preferences", { notify: true });
  await call("a", "chat-send", { text: "Scaduto", nonce: "unique_nonce_789" });
  await deliverChatPush({
    transact,
    sendPush: async () => {
      throw Object.assign(Error("Gone"), { statusCode: 410 });
    },
  });
  assert.equal(s.chatSubscriptions.length, 0);
  assert.equal(s.chatPushOutbox.length, 0);
});
test("queued pushes are suppressed after a message is read, deleted, or the recipient leaves the league", async () => {
  for (const variant of ["read", "delete", "leave"]) {
    const { s, l, call, transact } = fixture();
    await call("b", "chat-subscribe", { subscription: sub(1) });
    const m = await call("a", "chat-send", {
      text: "Non notificare",
      nonce: "unique_nonce_123",
    });
    if (variant === "read")
      await call("b", "chat-read", { through: m.message.seq });
    if (variant === "delete")
      await call("a", "chat-delete", { message: m.message.id });
    if (variant === "leave")
      s.leagues.find((x) => x.id === l.id).members = s.leagues
        .find((x) => x.id === l.id)
        .members.filter((m) => m.uid !== "b");
    let calls = 0;
    await deliverChatPush({ transact, sendPush: async () => calls++ });
    assert.equal(calls, 0);
  }
});
test("push endpoints cannot address local/internal hosts, and device reassignment does not keep another account subscribed", async () => {
  for (const endpoint of [
    "http://127.0.0.1",
    "https://127.0.0.1",
    "https://example.com",
    "https://fcm.googleapis.com.evil.test",
    "https://user@fcm.googleapis.com/",
    "https://fcm.googleapis.com:8443/",
  ])
    assert.throws(() => validPushSubscription({ ...sub(1), endpoint }));
  const { s, call } = fixture();
  await call("a", "chat-subscribe", { subscription: sub(1) });
  await call("b", "chat-subscribe", { subscription: sub(1) });
  assert.equal(s.chatSubscriptions.length, 1);
  assert.equal(s.chatSubscriptions[0].uid, "b");
});
test("failed push is queued with bounded retry while the message remains committed and VAPID identity remains stable", async () => {
  const { s, call, transact } = fixture();
  const key = (await call("a", "chat-config")).publicKey;
  await call("b", "chat-subscribe", { subscription: sub(1) });
  await call("a", "chat-send", { text: "Persiste", nonce: "unique_nonce_123" });
  await deliverChatPush({
    transact,
    sendPush: async () => {
      throw Error("offline");
    },
  });
  assert.equal(s.chatPushOutbox.length, 1);
  assert.ok(s.chatPushOutbox[0].next > Date.now());
  assert.equal((await call("b", "chat-messages")).messages[0].text, "Persiste");
  assert.equal((await call("b", "chat-config")).publicKey, key);
});

test('a device test notification is private to the requested own device and creates no league message',async()=>{const {s,l,call,transact}=fixture();await call('a','chat-subscribe',{subscription:sub('a')});await call('b','chat-subscribe',{subscription:sub('b')});await assert.rejects(call('a','chat-test-push',{endpoint:sub('b').endpoint}),/Attiva/);await call('a','chat-test-push',{endpoint:sub('a').endpoint});assert.equal(s.leagueChats[l.id].messages.length,0);const sent=[];await deliverChatPush({transact,sendPush:async(subscription,payload)=>sent.push({subscription,payload:JSON.parse(payload)})});assert.equal(sent.length,1);assert.equal(sent[0].subscription.endpoint,sub('a').endpoint);assert.match(sent[0].payload.title,/Notifica di prova/);});

test('new league chat welcomes both members, and committed updates carry only private counts',async()=>{
 const {s,l,call}=fixture(),updates=[],onUpdate=update=>updates.push(update);
 welcomeLeagueChat(s,l);welcomeLeagueChat(s,l);
 const first=await call('b','chat-messages');
 assert.equal(first.messages.length,1);assert.equal(first.messages[0].name,'Il Bar');assert.equal(first.messages[0].system,true);
 await assert.rejects(call('a','chat-delete',{message:first.messages[0].id}),/non trovato/);
 await call('b','chat-read',{through:1},{onUpdate});
 assert.deepEqual(updates.at(-1).recipients.map(x=>[x.uid,x.unread]),[['b',0]]);
 const data={text:'Un messaggio privato',nonce:'committed_chat_message'};
 await call('a','chat-send',data,{onUpdate});await call('a','chat-send',data,{onUpdate});
 assert.equal(updates.length,2);
 assert.deepEqual(updates.at(-1).recipients.map(x=>[x.uid,x.unread]),[['a',0],['b',1]]);
 assert.doesNotMatch(JSON.stringify(updates.at(-1)),/Un messaggio privato/);
});
