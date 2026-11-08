import {enqueueOperation} from './operations/store.mjs';
import {recipientAllowed,blockedDelivery} from './release-env.mjs';
import webpush from "web-push";
import { id, fail, userFor } from "./game.mjs";

const MAX_MESSAGES = 3000;
const authorized = (s, token, league) => {
  const u = userFor(s, token);
  if (!u || u.adminOnly || (!u.demo && !u.emailVerified))
    fail("Accedi e conferma la tua email", 401);
  const l = s.leagues.find(
    (l) => l.id === league && l.members.some((m) => m.uid === u.id),
  );
  if (!l) fail("Chat non accessibile", 403);
  return { u, l };
};
const room = (s, l) => {
  s.leagueChats ??= {};
  return (s.leagueChats[l.id] ??= { sequence: 0, messages: [] });
};
const reader = (s, l, u) => {
  s.chatReaders ??= {};
  return (s.chatReaders[l.id + ":" + u.id] ??= { read: 0, notify: false });
};
export function welcomeLeagueChat(s,league,now=Date.now()){
  const r=room(s,league);
  if(r.sequence)return;
  r.messages.push({id:"welcome:"+league.id,seq:++r.sequence,system:true,uid:null,created:new Date(now).toISOString(),text:"Benvenuti al Bar! Presentatevi, tirate fuori la prima scusa e fate spazio al prossimo Quasi."});
}
export function chatSummary(s, l, u) {
  const r = s.leagueChats?.[l.id],
    p = s.chatReaders?.[l.id + ":" + u.id];
  return {
    unread: (r?.messages || []).filter(
      (m) => m.seq > (p?.read || 0) && m.uid !== u.id && !m.deleted,
    ).length,
    notify: !!p?.notify,
    latest: r?.sequence || 0,
    revision:r?.revision||0,
    read:p?.read||0,
  };
}
function publicMessage(s, m) {
  return {
    id: m.id,
    seq: m.seq,
    uid: m.uid,
    name: m.system ? "Il Bar" : s.users.find((u) => u.id === m.uid)?.name || "Ex membro",
    ...(m.system?{system:true}:{}),
    text: m.deleted ? "Messaggio eliminato" : m.text,
    created: m.created,
    deleted: !!m.deleted,
  };
}
function keys(s, env) {
  if (env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY)
    return {
      publicKey: env.WEB_PUSH_PUBLIC_KEY,
      privateKey: env.WEB_PUSH_PRIVATE_KEY,
    };
  // Shared database persistence keeps the application identity stable across serverless instances.
  s.chatPushKeys ??= webpush.generateVAPIDKeys();
  return s.chatPushKeys;
}
export function validPushSubscription(input) {
  if (
    !input ||
    typeof input.endpoint !== "string" ||
    input.endpoint.length > 2048
  )
    fail("Dispositivo non valido");
  let url;
  try {
    url = new URL(input.endpoint);
  } catch {
    fail("Dispositivo non valido");
  }
  const h = url.hostname;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    (![
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
      "web.push.apple.com",
    ].includes(h) &&
      !h.endsWith(".push.services.mozilla.com") &&
      !h.endsWith(".notify.windows.com") &&
      !h.endsWith(".push.apple.com"))
  )
    fail("Servizio notifiche non supportato");
  const k = input.keys;
  if (
    !k ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh || "") ||
    !/^[A-Za-z0-9_-]{20,30}$/.test(k.auth || "") ||
    Buffer.from(k.p256dh, "base64url").length !== 65 ||
    Buffer.from(k.auth, "base64url").length !== 16
  )
    fail("Chiavi del dispositivo non valide");
  return { endpoint: url.href, keys: { p256dh: k.p256dh, auth: k.auth } };
}
export async function chatAction({
  route,
  input,
  token,
  transact,
  env = process.env,
  sendPush,
  onUpdate,
  read,
}) {
  if(route==='chat-config'&&read){
    const cached=await read(s=>{const{u,l}=authorized(s,token,input.league),k=env.WEB_PUSH_PUBLIC_KEY||s.chatPushKeys?.publicKey,p=s.chatReaders?.[l.id+':'+u.id];return k?{publicKey:k,notify:!!p?.notify,preference:p?.preference||null,unread:chatSummary(s,l,u).unread}:null;});
    return cached||{publicKey:null,notify:false,preference:null,unread:0};
  }
  let update;
  const result = await (route==='chat-messages'&&read?fn=>read(s=>fn(structuredClone(s))):transact)((s) => {
    const { u, l } = authorized(s, token, input.league),
      r = room(s, l),
      p = reader(s, l, u);
    const collect=(members,changed)=>{if(onUpdate)update={league:l.id,changed,recipients:members.map(m=>({uid:m.uid,...chatSummary(s,l,{id:m.uid})}))};};
    if (route === "chat-config")
      return {
        publicKey: keys(s, env).publicKey,
        notify: p.notify,
        preference:p.preference||(p.notify?'enabled':null),
        unread: chatSummary(s, l, u).unread,
      };
    if (route === "chat-messages") {
      const before =
        input.before === undefined ? Infinity : Number(input.before);
      if (!(
        before === Infinity ||
        (Number.isSafeInteger(before) && before > 0)
      ))
        fail("Pagina non valida");
      const messages = r.messages.filter((m) => m.seq < before).slice(-50);
      if(input.since!==undefined&&!input.before&&Number(input.since)===r.sequence&&Number(input.revision)===(r.revision||0))
        return {unchanged:true,messages:[],latest:r.sequence,read:p.read,notify:p.notify};
      return {
        messages: messages.map((m) => publicMessage(s, m)),
        hasOlder: !!messages.length && r.messages[0]?.seq < messages[0].seq,
        read: p.read,
        latest: r.sequence,
        revision:r.revision||0,
        notify: p.notify,
        retention: MAX_MESSAGES,
      };
    }
    if (route === "chat-read") {
      if (
        !Number.isSafeInteger(input.through) ||
        input.through < 0 ||
        input.through > r.sequence
      )
        fail("Lettura non valida");
      p.read = Math.max(p.read, input.through);
      collect([{uid:u.id}],false);
      return { ok: true, ...chatSummary(s, l, u) };
    }
    if (route === "chat-preferences") {
      if (typeof input.notify !== "boolean") fail("Preferenza non valida");
      p.notify = input.notify;
      p.preference=input.notify?'enabled':'muted';
      return { ok: true, notify: p.notify };
    }
    if (route === "chat-subscribe") {
      const subscription = validPushSubscription(input.subscription);
      s.chatSubscriptions ??= [];
      // A device belongs to its currently authenticated account only, including on shared phones.
      s.chatSubscriptions = s.chatSubscriptions.filter(
        (d) =>
          d.subscription.endpoint !== subscription.endpoint || d.uid === u.id,
      );
      let d = s.chatSubscriptions.find(
        (d) => d.subscription.endpoint === subscription.endpoint,
      );
      if (!d) {
        if (s.chatSubscriptions.filter((d) => d.uid === u.id).length >= 10)
          fail("Limite di dieci dispositivi raggiunto");
        d = { id: id(), uid: u.id };
        s.chatSubscriptions.push(d);
      }
      d.subscription = subscription;
      d.updated = Date.now();
      if(input.notifyChat!==false){p.notify=true;p.preference='enabled';}
      keys(s, env);
      return { ok: true, notify: p.notify };
    }
    if (route === "chat-unsubscribe") {
      s.chatSubscriptions = (s.chatSubscriptions || []).filter(
        (d) => d.uid !== u.id || d.subscription.endpoint !== input.endpoint,
      );
      return { ok: true };
    }
    if(route==='chat-test-push'){
      const device=s.chatSubscriptions?.find(d=>d.uid===u.id&&d.subscription.endpoint===input.endpoint);
      if(!device||!p.notify)fail('Attiva prima le notifiche su questo dispositivo',409);
      const previous=(s.chatPushOutbox||[]).find(j=>j.testUser===u.id&&j.created>Date.now()-60000);
      if(previous)fail('Notifica di prova già richiesta: attendi un minuto',429);
      keys(s,env);(s.chatPushOutbox??=[]).push({id:id(),league:l.id,testUser:u.id,author:u.id,recipients:[device.id],created:Date.now(),expires:Date.now()+300000,attempts:0,next:Date.now()});
      return {ok:true,queued:true};
    }
    if (route === "chat-delete") {
      const m = r.messages.find((m) => m.id === input.message);
      if (!m||m.system) fail("Messaggio non trovato", 404);
      if (m.uid !== u.id && l.admin !== u.id)
        fail("Puoi eliminare soltanto i tuoi messaggi", 403);
      m.deleted = true;
      r.revision=(r.revision||0)+1;
      delete m.text;
      s.chatPushOutbox = (s.chatPushOutbox || []).filter(
        (j) => j.message !== m.id,
      );
      collect(l.members,true);
      return { ok: true };
    }
    if (route !== "chat-send") fail("Operazione chat sconosciuta", 404);
    if (
      typeof input.text !== "string" ||
      typeof input.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{12,80}$/.test(input.nonce)
    )
      fail("Messaggio non valido");
    const text = input.text
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim();
    if (!text || text.length > 1200)
      fail("Scrivi un messaggio da 1 a 1200 caratteri");
    const existing = r.messages.find(
      (m) => m.uid === u.id && m.nonce === input.nonce,
    );
    if (existing) return { ok: true, message: publicMessage(s, existing) };
    if (
      r.messages.filter(
        (m) => m.uid === u.id && Date.parse(m.created) > Date.now() - 60000,
      ).length >= 12
    )
      fail("Un attimo di pausa: massimo 12 messaggi al minuto", 429);
    const m = {
      id: id(),
      seq: ++r.sequence,
      uid: u.id,
      text,
      nonce: input.nonce,
      created: new Date().toISOString(),
    };
    r.messages.push(m);
    p.read=m.seq;
    r.messages = r.messages.slice(-MAX_MESSAGES);
    s.chatPushOutbox = (s.chatPushOutbox || []).filter(
      (j) => j.expires > Date.now() && j.attempts < 5,
    );
    const recipients = (s.chatSubscriptions || [])
      .filter(
        (d) =>
          d.uid !== u.id &&
          l.members.some((m) => m.uid === d.uid) &&
          s.chatReaders?.[l.id + ":" + d.uid]?.notify,
      )
      .map((d) => d.id);
    // One pending activity alert per league avoids a notification backlog during a lively conversation.
    s.chatPushOutbox = s.chatPushOutbox.filter(
      (j) => !!j.testUser || j.league !== l.id || j.lease > Date.now(),
    );
    if (recipients.length) {
      keys(s, env);
      s.chatPushOutbox.push({
        id: m.id,
        message: m.id,
        league: l.id,
        author: u.id,
        recipients,
        attempts: 0,
        next: 0,
        expires: Date.now() + 6 * 3600000,
      });
    }
    collect(l.members,true);
    return { ok: true, message: publicMessage(s, m), job: m.id };
  });
  if(update)try{onUpdate(update);}catch{console.warn("CHAT_LIVE_UPDATE_FAILED");}
  if (result.job) {
    // Delivery happens after the message commits, outside the game state lock.
    // The scheduled worker handles delivery independently of the HTTP request.
    // Tests can inject a transport to verify the full pipeline without sending real notifications.
    if (sendPush)
      try {
        await deliverChatPush({ transact, env, sendPush, jobId: result.job });
      } catch {}
    else await enqueueOperation({id:'chat:'+result.job,kind:'chat-push',jobId:result.job,at:new Date().toISOString()}).catch(()=>console.warn('CHAT_PUSH_INDEX_FAILED'));
    delete result.job;
  }
  return result;
}
export async function deliverChatPush({
  transact,
  env = process.env,
  sendPush = (sub, payload, options) =>
    webpush.sendNotification(sub, payload, options),
  jobId,
} = {}) {
  const jobs = await transact((s) => {
    s.chatPushOutbox = (s.chatPushOutbox || []).filter(
      (j) => j.expires > Date.now() && j.attempts < 5,
    );
    return s.chatPushOutbox
      .filter(
        (j) =>
          (!jobId || j.id === jobId) &&
          j.next <= Date.now() &&
          !(j.lease > Date.now()),
      )
      .slice(0, 1)
      .map((j) => {
        j.lease = Date.now() + 90000;
        j.attempts++;
        return { ...structuredClone(j), keys: keys(s, env) };
      });
  });
  for (const j of jobs) {
    const completed = [],
      expired = [];
    for (const device of j.recipients.slice(0, 5)) {
      const target = await transact((s) => {
        const live = s.chatPushOutbox?.find(
            (x) => x.id === j.id && x.lease === j.lease,
          ),
          l = s.leagues.find((l) => l.id === j.league),
          m = s.leagueChats?.[j.league]?.messages.find(
            (m) => m.id === j.message,
          ),
          d = s.chatSubscriptions?.find((d) => d.id === device);
        if (
          !live ||
          !l ||
          (!j.testUser && (!m || m.deleted)) ||
          !d ||
          (j.testUser ? d.uid !== j.testUser : d.uid === j.author) ||
          !l.members.some((m) => m.uid === d.uid) ||
          !s.chatReaders?.[l.id + ":" + d.uid]?.notify ||
          (!j.testUser && s.chatReaders[l.id + ":" + d.uid].read >= m.seq)
        )
          return null;
        if(!recipientAllowed(s.users.find(u=>u.id===d.uid)?.email,env)){blockedDelivery('chat-push',env);return null;}
        return {
          subscription: d.subscription,
          payload: {
            title: j.testUser ? "Notifica di prova · "+l.name : l.name,
            body:
              j.testUser ? 'Questo dispositivo può ricevere gli avvisi della tua lega.' : `${s.users.find(u=>u.id===j.author)?.name||'Un membro'}: ${m.text}`,
            kind: "chat",
            tag: "chat-" + l.id,
            url: "/?chat=" + encodeURIComponent(l.id),
            league: l.id,
            message: m?.id || null,
          },
        };
      });
      if (!target) {
        completed.push(device);
        continue;
      }
      try {
        await sendPush(target.subscription, JSON.stringify(target.payload), {
          TTL: 21600,
          timeout: 5000,
          vapidDetails: {
            subject: env.WEB_PUSH_SUBJECT || "https://quellidelquasi.com",
            ...j.keys,
          },
        });
        completed.push(device);
      } catch (e) {
        if ([404, 410].includes(e.statusCode)) {
          completed.push(device);
          expired.push(device);
        }
      }
    }
    await transact((s) => {
      const live = s.chatPushOutbox?.find(
        (x) => x.id === j.id && x.lease === j.lease,
      );
      if (!live) return;
      live.recipients = live.recipients.filter((id) => !completed.includes(id));
      live.lease = 0;
      const failed = j.recipients
        .slice(0, 5)
        .filter((id) => !completed.includes(id));
      // Remaining recipients get their turn on the next tick; failed deliveries move to the back.
      live.recipients = [
        ...live.recipients.filter((id) => !failed.includes(id)),
        ...failed,
      ];
      if (!failed.length) live.attempts = 0;
      live.next =
        Date.now() +
        (failed.length === j.recipients.length
          ? Math.min(3600000, 60000 * 2 ** live.attempts)
          : 0);
      s.chatSubscriptions = (s.chatSubscriptions || []).filter(
        (d) => !expired.includes(d.id),
      );
      if (!live.recipients.length)
        s.chatPushOutbox = s.chatPushOutbox.filter((x) => x.id !== live.id);
    });
  }
  if(jobId){const retry=await transact(s=>{const j=s.chatPushOutbox?.find(j=>j.id===jobId);return j&&j.recipients?.length&&j.attempts<6&&j.expires>Date.now()?{id:'chat:'+j.id+':'+j.attempts+':'+j.next,kind:'chat-push',jobId:j.id,at:new Date(Math.max(j.next,Date.now()+1000)).toISOString(),expires:new Date(j.expires).toISOString()}:null;});if(retry)await enqueueOperation(retry).catch(()=>console.warn('CHAT_PUSH_RETRY_INDEX_FAILED'));}
  return jobs.length;
}
