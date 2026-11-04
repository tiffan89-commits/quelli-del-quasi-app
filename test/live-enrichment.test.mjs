import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMatchSummary,
  collectLiveDetails,
  loadMatchDetails,
  scoresDue,
} from "../lib/match-data.mjs";
import { applyLive } from "../lib/live-scores.mjs";
import { parseSkyLineups, parseESPNLineups } from "../lib/lineups.mjs";
import { emptyState } from "../lib/db.mjs";
import { ensureCalendar } from "../lib/calendar.mjs";
const now = new Date("2026-10-29T18:15:00Z");
function setup() {
  const s = emptyState();
  ensureCalendar(s);
  const m = s.football.calendar.rounds
    .flatMap((r) => r.matches)
    .find((m) => m.home === "Frosinone" && m.away === "Lecce");
  m.kickoff = "2026-10-29T17:30:00Z";
  m.status = "LIVE";
  m.espnId = "123";
  return { s, m };
}
function summary() {
  return {
    header: {
      competitions: [
        {
          status: {
            displayClock: "41'",
            type: {
              state: "in",
              name: "STATUS_FIRST_HALF",
              description: "First Half",
            },
          },
          competitors: [
            {
              id: "h",
              homeAway: "home",
              team: { displayName: "Frosinone" },
              score: "1",
            },
            {
              id: "a",
              homeAway: "away",
              team: { displayName: "Lecce" },
              score: "0",
            },
          ],
        },
      ],
    },
    keyEvents: [
      {
        id: "g",
        type: { type: "goal" },
        scoringPlay: true,
        team: { id: "h" },
        clock: { value: 1500, displayValue: "25'" },
        participants: [{ athlete: { displayName: "Scorer" } }],
      },
      {
        id: "y",
        type: { type: "yellow-card" },
        team: { id: "a" },
        clock: { value: 2280, displayValue: "38'" },
        participants: [{ athlete: { displayName: "Defender" } }],
      },
    ],
    rosters: ["home", "away"].map((side) => ({
      homeAway: side,
      team: { displayName: side === "home" ? "Frosinone" : "Lecce" },
      formation: "4-3-3",
      roster: Array.from({ length: 11 }, (_, i) => ({
        starter: true,
        jersey: String(i + 1),
        athlete: { displayName: side + " " + i },
      })),
    })),
  };
}
test("summary supplies actual minute, goal and cards plus eleven official starters per team", () => {
  const { s, m } = setup();
  applyMatchSummary(s, m, summary(), now);
  assert.equal(m.clock, "41'");
  assert.equal(m.clockSource, "ESPN");
  assert.equal(m.details.complete, false);
  assert.deepEqual(
    m.details.events.map((e) => e.kind),
    ["goal", "yellow"],
  );
  assert.equal(m.lineups.kind, "official");
  assert.equal(m.lineups.teams[0].players.length, 11);
});
test("SportScore phase-only payload never destroys fresh ESPN clock", () => {
  const { s, m } = setup();
  applyMatchSummary(s, m, summary(), now);
  applyLive(s, {
    at: new Date(+now + 10000).toISOString(),
    matches: [
      {
        competition: "Italian Serie A",
        time: m.kickoff,
        home: m.home,
        away: m.away,
        home_score: 1,
        away_score: 0,
        status: "live",
        status_text: "1st half",
      },
    ],
  });
  assert.equal(m.clock, "41'");
});
test("ESPN live requests run at sixty seconds and discover ids from scoreboard instead of requiring prior clicks", async () => {
  const { s, m } = setup();
  s.football.lastScoresSync = new Date(+now - 59000).toISOString();
  assert.equal(scoresDue(s.football, now), false);
  assert.equal(scoresDue(s.football, new Date(+now + 1000)), true);
  delete m.espnId;
  const c = summary().header.competitions[0];
  let calls = 0;
  const results = await collectLiveDetails(
    s.football,
    [{ id: "new", competitions: [c] }],
    async (p) => {
      calls++;
      assert.equal(p, "summary?event=new");
      return summary();
    },
    now,
  );
  assert.equal(calls, 1);
  assert.equal(results[0].espnId, "new");
});
test("a shared recent detail attempt suppresses per-viewer fetches and invalid summaries never update another match", async () => {
  const { s, m } = setup();
  m.detailCheckedAt = now.toISOString();
  m.lineupCheckedAt = now.toISOString();
  let calls = 0;
  await loadMatchDetails(
    s,
    m.id,
    async () => {
      calls++;
      return summary();
    },
    new Date(+now + 30000),
  );
  assert.equal(calls, 0);
  const wrong = summary();
  wrong.header.competitions[0].competitors[0].team.displayName = "Other";
  assert.throws(() => applyMatchSummary(s, m, wrong, now));
  assert.equal(m.details, undefined);
});
test("halftime is shown explicitly and incomplete rosters are not invented as official lineups", () => {
  const { s, m } = setup(),
    data = summary();
  data.header.competitions[0].status.type.name = "STATUS_HALFTIME";
  applyMatchSummary(s, m, data, now);
  assert.equal(m.clock, "Intervallo");
  data.rosters[0].roster.pop();
  assert.equal(parseESPNLineups(data), null);
});
function sky() {
  const players = Array.from(
    { length: 11 },
    (_, i) =>
      `<span class="ftbl__match-formation-player--jerseyNum">${i + 1}</span><a class="ftbl__match-formation-player--name">Name ${i + 1}</a>`,
  ).join("");
  return `<title>Frosinone Lecce, probabili formazioni</title><span class="ftbl__team__name">Frosinone</span><span class="ftbl__team__name">Lecce</span><span class="ftbl__team-formation-number">4-3-3</span><span class="ftbl__team-formation-number">3-5-2</span><table><td>Titolari</td><tr data-panel-left="true">${players}</tr><td>Riserve</td><tr data-panel-left="true">Bench</tr><td>Titolari</td><tr data-panel-right="true">${players}</tr></table>`;
}
test("probable lineups parser handles separate home/away tables and refuses missing starters or wrong teams", () => {
  const data = parseSkyLineups(sky(), { home: "Frosinone", away: "Lecce" });
  assert.equal(data.kind, "probable");
  assert.equal(data.teams[1].players.length, 11);
  assert.equal(data.teams[1].formation, "3-5-2");
  assert.equal(parseSkyLineups(sky(), { home: "Roma", away: "Lecce" }), null);
  assert.equal(
    parseSkyLineups(sky().replace("Name 1</a>", "</a>"), {
      home: "Frosinone",
      away: "Lecce",
    }),
    null,
  );
});

test("a forecast retry reads five editorial sources once and keeps the result for two hours", async () => {
  const { s, m } = setup();
  m.status = "NS";
  m.kickoff = new Date(+now + 12 * 3600000).toISOString();
  m.detailCheckedAt = new Date(+now - 2 * 3600000).toISOString();
  m.lineupCheckedAt = new Date(+now - 7 * 3600000).toISOString();
  let summaries = 0,
    pages = 0;
  await loadMatchDetails(
    s,
    m.id,
    async () => {
      summaries++;
      return summary();
    },
    now,
    async () => {
      pages++;
      return { ok: true, text: async () => sky() };
    },
  );
  assert.equal(summaries, 0);
  assert.equal(pages, 5);
  assert.equal(m.lineups.kind, "probable");
  await loadMatchDetails(
    s,
    m.id,
    async () => {
      summaries++;
      return summary();
    },
    new Date(+now + 60000),
    async () => {
      pages++;
      return { ok: true, text: async () => sky() };
    },
  );
  assert.equal(pages, 5);
});
