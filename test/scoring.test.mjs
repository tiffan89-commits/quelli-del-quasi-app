import test from "node:test";
import assert from "node:assert/strict";
import {
  pointTerms,
  marketProbability,
  migrateScoring,
} from "../lib/scoring.mjs";
import {
  DEFAULT_RULES,
  newLeague,
  placeSlip,
  settle,
  stateFor,
} from "../lib/game.mjs";
import { emptyState } from "../lib/db.mjs";
test("normalized market probabilities remove the bookmaker margin and use numeric frozen prices", () => {
  const odds = {
    1: 2,
    X: 4,
    2: 4,
    Goal: 1.5,
    "No Goal": 3,
    "Under 2.5": 2,
    "Over 2.5": 2,
  };
  assert.equal(marketProbability({ odds }, "1X").probability, 0.75);
  const frozen = Object.fromEntries(
    Object.entries(odds).map(([p, v]) => [p, { value: v * 0.9 }]),
  );
  assert.ok(
    Math.abs(marketProbability({ frozen }, "1X").probability - 0.75) < 0.000001,
  );
  assert.equal(marketProbability({ odds }, "Goal").probability, 2 / 3);
});
test("more probable alternatives reward less and penalize more, with exact quarter increments up to minus two", () => {
  let previousReward = Infinity,
    previousPenalty = 0;
  for (const p of [0.1, 0.25, 0.4, 0.5, 0.65, 0.8, 0.95]) {
    const terms = pointTerms(
      { odds: { Goal: 1 / p, "No Goal": 1 / (1 - p) } },
      "Goal",
      DEFAULT_RULES,
    );
    assert.ok(terms.correct <= previousReward);
    assert.ok(-terms.wrong >= previousPenalty);
    assert.equal((terms.correct * 4) % 1, 0);
    assert.ok(Number.isInteger(terms.wrong * 4));
    assert.ok(terms.correct >= 0.25 && terms.wrong >= -2);
    previousReward = terms.correct;
    previousPenalty = -terms.wrong;
  }
  assert.equal(previousPenalty, 2);
  for (const p of ["1", "X", "2"])
    assert.deepEqual(pointTerms({ odds: {} }, p, DEFAULT_RULES), {
      pick: p,
      correct: 1,
      wrong: -0.5,
      source: "esito secco",
    });
});
test("confirmed points are immutable when later odds change and settlement is idempotent", () => {
  const s = emptyState(),
    u = { id: "u", name: "Mister" };
  s.users.push(u);
  const l = newLeague(s, u, "Test", true),
    r = {
      id: "r",
      league: l.id,
      kickoff: new Date(Date.now() + 86400000).toISOString(),
      rules: structuredClone(DEFAULT_RULES),
      matches: [
        {
          id: "m",
          home: "A",
          away: "B",
          odds: { 1: 1.25, X: 6, 2: 12 },
          status: "NS",
        },
      ],
      slips: [],
    };
  s.rounds.push(r);
  placeSlip(s, l, r, u, { picks: { m: "1X" }, stake: 10 });
  const penalty = r.slips[0].pointTerms.m.wrong;
  r.matches[0].odds = { 1: 12, X: 6, 2: 1.25 };
  r.kickoff = new Date(Date.now() - 1000).toISOString();
  r.matches[0].status = "FT";
  r.matches[0].score = [0, 1];
  settle(s, l, r);
  assert.equal(l.members[0].points, penalty);
  settle(s, l, r);
  assert.equal(l.members[0].points, penalty);
});
test("all existing league defaults and open rounds migrate once while closed history and balances stay intact", () => {
  const now = Date.now(),
    s = emptyState(),
    u = { id: "u", name: "Mister" };
  s.users.push(u);
  const l = newLeague(s, u, "Old", true);
  l.rules = { ...l.rules, mode: "classic", correct: 4, maxStake: 33 };
  l.members[0].points = 7;
  s.rounds = [
    {
      id: "open",
      league: l.id,
      rules: structuredClone(l.rules),
      kickoff: new Date(now + 3600000).toISOString(),
      matches: [{ id: "m", odds: {} }],
      slips: [],
    },
    {
      id: "closed",
      league: l.id,
      rules: structuredClone(l.rules),
      kickoff: new Date(now - 3600000).toISOString(),
      matches: [],
      slips: [],
    },
    {
      id: "final",
      league: l.id,
      rules: structuredClone(l.rules),
      settled: true,
      matches: [],
      slips: [],
    },
  ];
  assert.equal(migrateScoring(s, now), true);
  assert.equal(l.rules.scoring, "difficulty-v1");
  assert.equal(l.rules.maxStake, 33);
  assert.equal(s.rounds[0].rules.scoring, "difficulty-v1");
  assert.equal(s.rounds[1].rules.correct, 4);
  assert.equal(s.rounds[2].rules.correct, 4);
  assert.equal(l.members[0].points, 7);
  assert.equal(l.members[0].credits, 500);
  assert.equal(migrateScoring(s, now + 1), false);
});
test("league members can invite but outsiders cannot read league invite codes", () => {
  const s = emptyState(),
    a = { id: "a", name: "Admin", emailVerified: true },
    b = { id: "b", name: "Member", emailVerified: true };
  s.users.push(a, b);
  const l = newLeague(s, a, "Test", true);
  l.members.push({ uid: b.id, credits: 500, points: 0 });
  assert.equal(stateFor(s, b).leagues[0].code, l.code);
  const outsider={id:"outside",name:"Outside",emailVerified:true};s.users.push(outsider);assert.equal(JSON.stringify(stateFor(s, outsider)).includes(l.code),false);
  assert.equal(stateFor(s, a).leagues[0].code, l.code);
});
