import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../lib/db.mjs";
import { ensureCalendar } from "../lib/calendar.mjs";
import {
  runMatchCache,
  planMatchCache,
  matchCacheTicket,
  validMatchCacheTicket,
} from "../lib/match-cache.mjs";
import { probableLineupsDue, loadProbableLineups } from "../lib/lineups.mjs";
const now = new Date("2026-10-30T12:00:00Z");
test("backend archives a final tabellino once, retains goals/cards, and a restored DB needs no source request", async () => {
  const s = emptyState(),
    cal = ensureCalendar(s),
    m = cal.rounds[0].matches[0];
  for (const x of cal.rounds.flatMap((r) => r.matches)) {
    x.status = "FT";
    x.details = { complete: true, events: [] };
  }
  m.espnId = "123";
  m.details = null;
  m.status = "FT";
  m.score = [1, 0];
  m.kickoff = "2026-10-29T19:00:00Z";
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return {
      header: {
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { displayName: m.home } },
              { homeAway: "away", team: { displayName: m.away } },
            ],
            status: { type: { completed: true } },
          },
        ],
      },
      keyEvents: [
        {
          scoringPlay: true,
          team: { displayName: m.home },
          participants: [{ athlete: { displayName: "Goal scorer" } }],
        },
        {
          yellowCard: true,
          participants: [{ athlete: { displayName: "Yellow" } }],
        },
        { redCard: true, participants: [{ athlete: { displayName: "Red" } }] },
      ],
    };
  };
  let db = s;
  const transact = async (fn) => fn(db);
  assert.equal(planMatchCache(db, now).length, 1);
  const result = await runMatchCache({ transact, fetcher, now: () => now });
  assert.equal(calls, 1);
  assert.equal(result.complete, 1);
  db = structuredClone(db);
  await runMatchCache({
    transact,
    fetcher: () => {
      throw Error("must not fetch");
    },
    now: () => new Date(+now + 86400000),
  });
  const saved = db.football.calendar.rounds[0].matches[0];
  assert.deepEqual(
    saved.details.events.map((e) => e.kind),
    ["goal", "yellow", "red"],
  );
  assert.equal(saved.details.events[0].players[0], "Goal scorer");
  assert.equal(calls, 1);
});
test("stored predictions refresh every hour until an official lineup replaces them", async () => {
  const m = {
    kickoff: "2026-10-30T15:00:00Z",
    lineups: { kind: "probable" },
    lineupCheckedAt: "2026-10-28T12:00:00Z",
  };
  assert.equal(probableLineupsDue(m, now), true);
  m.lineupCheckedAt='2026-10-30T13:30:00Z';m.lineups.enrichmentVersion=6;
  assert.equal(probableLineupsDue(m, new Date("2026-10-30T14:29:59Z")), false);
  assert.equal(probableLineupsDue(m, new Date("2026-10-30T14:30:00Z")), true);
  m.lineupCheckedAt = "2026-10-30T14:31:00Z";
  assert.equal(probableLineupsDue(m, new Date("2026-10-30T14:55:00Z")), false);
  m.lineups.kind = "official";
  assert.equal(probableLineupsDue(m, new Date("2026-10-30T14:55:00Z")), false);
  let calls = 0;
  await loadProbableLineups(
    {},
    m,
    () => {
      calls++;
    },
    now,
  );
  assert.equal(calls, 0);
});
test("cache leases prevent concurrent work and internal tickets are scoped and expire", async () => {
  const s = emptyState();
  ensureCalendar(s);
  s.football.matchCacheLease = { until: +now + 60000 };
  assert.equal(
    (await runMatchCache({ transact: async (fn) => fn(s), now: () => now }))
      .busy,
    true,
  );
  const env = { MAIL_ENCRYPTION_KEY: "test-only" },
    ticket = matchCacheTicket(env, +now);
  assert.equal(validMatchCacheTicket(ticket, env, +now + 60000), true);
  assert.equal(validMatchCacheTicket(ticket, env, +now + 120001), false);
  assert.equal(
    validMatchCacheTicket(
      ticket,
      { MAIL_ENCRYPTION_KEY: "wrong" },
      +now,
    ),
    false,
  );
});
