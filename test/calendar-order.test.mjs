import test from "node:test";
import assert from "node:assert/strict";
import { calendarSections } from "../public/src/calendar-order.mjs";
const rounds = [
  {
    number: 1,
    date: "2026-10-25",
    matches: [{ kickoff: "2026-10-25T19:45:00Z" }],
  },
  {
    number: 2,
    date: "2026-10-31",
    matches: [{ kickoff: "2026-10-31T19:45:00Z" }],
  },
  { number: 3, date: "2026-11-07", matches: [] },
];
test("calendar keeps the round through its last game’s local day and promotes the next at Rome midnight", () => {
  assert.equal(
    calendarSections(rounds, null, new Date("2026-10-25T22:59:59Z"))[0]
      .rounds[0].number,
    1,
  );
  assert.equal(
    calendarSections(rounds, null, new Date("2026-10-25T23:00:00Z"))[0]
      .rounds[0].number,
    2,
  );
  const parts = calendarSections(
    rounds,
    null,
    new Date("2026-10-30T12:00:00Z"),
  );
  assert.deepEqual(
    parts.map((x) => [x.kind, x.rounds.map((r) => r.number)]),
    [
      ["current", [2]],
      ["future", [3]],
      ["past", [1]],
    ],
  );
});
test("fantasy rounds use their linked Serie A window, not their calculation date", () => {
  const fantasy = rounds.map((r, i) => ({
    number: i + 10,
    serieARound: r.number,
    source: "fantacalcio",
    matches: [],
  }));
  assert.equal(
    calendarSections(fantasy, { rounds }, new Date("2026-10-30T12:00:00Z"))[0]
      .rounds[0].number,
    11,
  );
});
