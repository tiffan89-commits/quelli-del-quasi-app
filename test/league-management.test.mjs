import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../lib/db.mjs";
import {
  newLeague,
  session,
  placeSlip,
  creditAccount,
  settle,
} from "../lib/game.mjs";
import { ensureFantasyWallet } from "../lib/bar-fanta-wallet.mjs";
import {
  removeLeagueMember,
  restoreLeagueMember,
} from "../lib/league-management.mjs";
import { createApi } from "../netlify/functions/api.mjs";
function fixture() {
  const s = emptyState(),
    u = { id: "a", username: "admin", name: "Admin", emailVerified: true },
    v = { id: "b", username: "member", name: "Member", emailVerified: true };
  s.users.push(u, v);
  const l = newLeague(s, u, "Test", true);
  l.members.push({ uid: v.id, initial: 500, credits: 500, points: 0 });
  return { s, l, u, v };
}
test("legacy shared wallet evidence is retained while a new league has its own credits", () => {
  const { l, u } = fixture(),
    m = l.members[0];
  m.fantasyBalances = {
    one: { initial: 500, credits: 480 },
    two: { initial: 500, credits: 600 },
  };
  const wallet = ensureFantasyWallet(l, m);
  assert.deepEqual(wallet, { initial: 500, credits: 580 });
  assert.equal(m.credits, 500);
  assert.notStrictEqual(
    creditAccount(l, { virtualBookmaker: true, competitionKey: "three" }, u.id),
    wallet,
  );
  assert.equal(wallet.credits, 580);
  assert.deepEqual(
    m.fantasyWalletMigration.previousBalances,
    m.fantasyBalances,
  );
});
test("separate fantasy leagues cannot spend each other’s credits", () => {
  const { s, l, u } = fixture();
  const round = (id) => ({
    id,
    virtualBookmaker: true,
    source: "fantacalcio",
    competitionKey: id,
    kickoff: new Date(Date.now() + 86400000).toISOString(),
    rules: {
      initial: 500,
      maxStake: 500,
      correct: 1,
      wrong: -1,
      mode: "classic",
    },
    matches: [{ id: "m", odds: { 1: 2 }, home: "A", away: "B" }],
    slips: [],
  });
  const a = round("one"),
    b = round("two");
  placeSlip(s, l, a, u, { stake: 400, picks: { m: "1" } });
  placeSlip(s,l,b,u,{stake:200,picks:{m:'1'}});
  assert.equal(creditAccount(l,a,u.id).credits,100);
  assert.equal(creditAccount(l,b,u.id).credits,300);
  assert.equal(l.members[0].credits, 500);
});
test("president removes access without destroying past slips and can restore the same balances and points", () => {
  const { l, u, v } = fixture();
  l.members[1].points = 7;
  l.prizeWinners = [v.id];
  assert.throws(() => removeLeagueMember(l, u.id, u.id));
  assert.throws(
    () => removeLeagueMember(l, v.id, v.id),
    (e) => e.status === 403,
  );
  removeLeagueMember(l, v.id, u.id);
  assert.equal(l.members.length, 1);
  assert.equal(l.removedMembers[0].points, 7);
  assert.deepEqual(l.prizeWinners, []);
  restoreLeagueMember(l, v.id, u.id);
  assert.equal(l.members[1].points, 7);
  assert.equal(l.members[1].credits, 500);
});
test("removed member loses league state, chat and mutation access; president cannot submit manual scores", async () => {
  const { s, l, u, v } = fixture(),
    admin = session(s, u.id),
    member = session(s, v.id),
    api = createApi({ transact: async (fn) => fn(s) });
  const post = (token, route, body) =>
    api(
      new Request("https://example.test/api/" + route, {
        method: "POST",
        headers: { cookie: "sid=" + token },
        body: JSON.stringify(body),
      }),
    );
  assert.equal(
    (await post(member, "member-remove", { league: l.id, uid: u.id })).status,
    403,
  );
  assert.equal(
    (await post(admin, "member-remove", { league: l.id, uid: v.id })).status,
    200,
  );
  const state = await (
    await api(
      new Request("https://example.test/api/state", {
        headers: { cookie: "sid=" + member },
      }),
    )
  ).json();
  assert.equal(state.leagues.length, 0);
  assert.equal(
    (await post(member, "league-prizes", { league: l.id, winners: [] })).status,
    403,
  );
  assert.equal((await post(admin, "results", { league: l.id })).status, 403);
  assert.equal((await post(admin, "demo-close", { league: l.id })).status, 403);
});
