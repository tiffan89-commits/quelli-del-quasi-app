// Shared scoring terms: the display and settlement use the same calculation.
const quarter = (n) => Math.round(n * 4) / 4,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const families = [
  ["1", "X", "2"],
  ["Goal", "No Goal"],
  ["Under 2.5", "Over 2.5"],
];
export function marketProbability(match, pick) {
  const odds = {
    ...match.odds,
    ...Object.fromEntries(
      Object.entries(match.frozen || {}).map(([p, v]) => [
        p,
        typeof v === "number" ? v : v.value,
      ]),
    ),
  };
  let family = families.find((f) => f.includes(pick));
  const double = { "1X": ["1", "X"], 12: ["1", "2"], X2: ["X", "2"] }[pick];
  if (double) family = families[0];
  if (family && family.every((p) => Number.isFinite(odds[p]) && odds[p] > 1)) {
    const total = family.reduce((n, p) => n + 1 / odds[p], 0),
      selected = double || [pick];
    return {
      probability: clamp(
        selected.reduce((n, p) => n + 1 / odds[p], 0) / total,
        0.01,
        0.99,
      ),
      source: "quote normalizzate",
    };
  }
  return {
    probability: double ? 2 / 3 : family === families[0] ? 1 / 3 : 0.5,
    source: "probabilità di base · quote non disponibili",
  };
}
export function pointTerms(match,pick,rules){
  if(rules.scoring==='difficulty-v2'&&['1','X','2'].includes(pick))return {pick,correct:1,wrong:-0.5,source:'esito secco'};
  if (rules.mode === "classic")
    return { pick, correct: rules.correct, wrong: rules.wrong };
  if (!["difficulty-v1","difficulty-v2"].includes(rules.scoring))
    return {
      pick,
      correct:
        rules.marketPoints?.[pick] ??
        (["1X", "12", "X2"].includes(pick) ? 0.25 : 1),
      wrong: rules.wrong,
    };
  if (["1", "X", "2"].includes(pick))
    return { pick, correct: 1, wrong: -1, source: "esito secco" };
  const { probability: p, source } = marketProbability(match, pick);
  // At the 1/3 reference probability the reward is 1. A more probable choice
  // gives fewer points and costs more on failure. Every amount is a quarter.
  return {
    pick,
    correct: clamp(quarter((1 - p) / (2 * p)), 0.25, 1.5),
    wrong: -clamp(quarter(2 * p), 0.25, 2),
    probability: Math.round(p * 10000) / 10000,
    source,
  };
}
export function pointOffers(match, rules) {
  return Object.fromEntries(
    [
      "1",
      "X",
      "2",
      "1X",
      "12",
      "X2",
      "Goal",
      "No Goal",
      "Under 2.5",
      "Over 2.5",
    ].map((p) => [p, pointTerms(match, p, rules)]),
  );
}
