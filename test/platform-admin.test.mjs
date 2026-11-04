import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../lib/db.mjs";
import { session } from "../lib/game.mjs";
import {
  isPlatformOwner,
  platformData,
  recordApiActivity,
  recordExternal,
  flushExternalActivity,
} from "../lib/platform-admin.mjs";
import { createApi } from "../netlify/functions/api.mjs";
test('anonymous platform requests are rejected before any game-state transaction',async()=>{
 let calls=0;const api=createApi({transact:async()=>{calls++;throw Error('must not load the game blob');}});
 for(const route of ['platform','platform-leagues','platform-probe'])assert.equal((await api(new Request('https://example.test/api/'+route))).status,403);
 assert.equal(calls,0);
});
test("only the dedicated system administrator has platform access; frankwood is an ordinary player", async () => {
  const s = emptyState(),
    owner = { id: "o", username: "tiffano", adminOnly:true,role:'system-admin' },
    other = { id: "x", username: "someone", emailVerified: true };
  s.users.push(owner, other);
  s.systemAdminId=owner.id;
  assert.equal(isPlatformOwner(s, other), false);
  assert.equal(isPlatformOwner(s, owner), true);
  owner.username = "renamed";
  other.username = "frankwood";
  assert.equal(isPlatformOwner(s, other), false);
  const token = session(s, other.id),
    api = createApi({ transact: async (fn) => fn(s) });
  assert.equal(
    (
      await api(
        new Request("https://example.test/api/platform", {
          headers: { cookie: "sid=" + token },
        }),
      )
    ).status,
    403,
  );
});
test("full database inspector paginates entities and never exposes credentials, password hashes or session tokens", () => {
  const s = emptyState(),
    owner = {
      id: "o",
      username: "tiffano",
      adminOnly:true,role:'system-admin',
      password: "TOP-SECRET",
      salt: "SALT",
    };
  s.users.push(owner);
  s.systemAdminId=owner.id;
  s.fantasyConnections = [
    {
      id: "c",
      session: "SESSION",
      credentialsCipher: "PASSWORD-CIPHER",
      teamAssets: { 1: { logo: { data: "a".repeat(2000) } } },
    },
  ];
  const user = JSON.stringify(
    platformData(s, owner, new URLSearchParams({ entity: "users" })),
  );
  assert.ok(!user.includes("TOP-SECRET"));
  assert.ok(!user.includes("SALT"));
  const c = JSON.stringify(
    platformData(
      s,
      owner,
      new URLSearchParams({ entity: "fantasyConnections" }),
    ),
  );
  assert.ok(!c.includes("PASSWORD-CIPHER"));
  assert.ok(!c.includes("SESSION"));
  assert.ok(!c.includes("a".repeat(2000)));
  assert.throws(
    () => platformData(s, { id: "x" }, new URLSearchParams()),
    (e) => e.status === 403,
  );
});
test("request counters and service calls are recorded without credential-bearing query strings", () => {
  flushExternalActivity(emptyState()); // isolate this fixture from buffered read errors in preceding API tests
  const s = emptyState();
  recordApiActivity(s, { route: "state", uid: "x" });
  recordApiActivity(s, { route: "login", status: 401 });
  recordExternal("ESPN", "summary?secret=PRIVATE", 200);
  flushExternalActivity(s);
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(s.platformStats.days[day].requests, 2);
  assert.equal(s.platformStats.days[day].errors, 1);
  assert.equal(s.externalStats[day].ESPN.calls, 1);
  assert.ok(!JSON.stringify(s.externalStats).includes("PRIVATE"));
});
