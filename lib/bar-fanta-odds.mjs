const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = (a, fallback) =>
  a.length ? a.reduce((n, x) => n + x, 0) / a.length : fallback;
const goodScore = (m) => m.officialConfirmed && Array.isArray(m.score);
function projection(rounds, team, number, lineup) {
  const samples = rounds
    .filter((r) => r.number < number)
    .flatMap((r) =>
      r.matches
        .filter(goodScore)
        .flatMap((m) =>
          m.homeId === team
            ? [
                {
                  goals: m.score[0],
                  against: m.score[1],
                  fp: m.fantasyPoints?.[0],
                },
              ]
            : m.awayId === team
              ? [
                  {
                    goals: m.score[1],
                    against: m.score[0],
                    fp: m.fantasyPoints?.[1],
                  },
                ]
              : [],
        ),
    )
    .slice(-12);
  const n = samples.length,
    weight = n / (n + 5),
    goals =
      weight *
        avg(
          samples.map((s) => s.goals),
          1.5,
        ) +
      (1 - weight) * 1.5,
    against =
      weight *
        avg(
          samples.map((s) => s.against),
          1.5,
        ) +
      (1 - weight) * 1.5;
  const fp = samples
      .map((s) => s.fp)
      .filter((x) => typeof x === "number" && x > 0),
    mean = avg(fp, 69);
  let factor = 1,
    playersKnown = 0;
  if (lineup?.players?.filter((p) => p.starter).length === 11) {
    const history = new Map();
    for (const r of rounds.filter((r) => r.number < number))
      for (const m of r.matches.filter(goodScore))
        for (const side of m.details?.teams || [])
          for (const p of side.players || []) {
            if (typeof p.fantagrade === "number") {
              const a = history.get(p.id) || [];
              a.push(p.fantagrade);
              history.set(p.id, a);
            }
          }
    const expected = lineup.players
      .filter((p) => p.starter)
      .map((p) => {
        const h = history.get(p.id);
        if (h?.length) {
          playersKnown++;
          return avg(h.slice(-8), 6.3);
        }
        return 6.3;
      });
    // Only previously observed player grades influence the estimate; current/live grades never enter it.
    if (playersKnown)
      factor = clamp(expected.reduce((a, b) => a + b, 0) / 11 / 6.3, 0.8, 1.2);
  }
  return {
    goals: clamp(
      (0.75 * goals + 0.25 * clamp((mean - 60) / 6, 0.2, 5)) * factor,
      0.2,
      5.5,
    ),
    against,
    samples: n,
    fantasyPoints: fp.length ? Math.round(mean * 10) / 10 : null,
    lineup: !!lineup,
    playersKnown,
  };
}
export function fantasyQuote(rounds, round, match) {
  const a = projection(
    rounds,
    match.homeId,
    round.number,
    match.details?.teams?.find((t) => t.id === match.homeId),
  );
  const b = projection(
    rounds,
    match.awayId,
    round.number,
    match.details?.teams?.find((t) => t.id === match.awayId),
  );
  const home = clamp(a.goals * 0.75 + b.against * 0.25, 0.2, 5.5),
    away = clamp(b.goals * 0.75 + a.against * 0.25, 0.2, 5.5);
  return {
    odds: poissonOdds(home, away),
    model: {
      version: 1,
      kind: "virtual-bookmaker",
      margin: 0.05,
      expectedGoals: [
        Math.round(home * 100) / 100,
        Math.round(away * 100) / 100,
      ],
      samples: [a.samples, b.samples],
      meanFantasyPoints: [a.fantasyPoints, b.fantasyPoints],
      lineups: [a.lineup, b.lineup],
      knownPlayers: [a.playersKnown, b.playersKnown],
      note: "Stima virtuale: gol e fantapunti precedenti, modello di Poisson e margine 5%. Le formazioni incidono solo per i giocatori con storico osservato. Nessuna quota ufficiale.",
    },
  };
}
export function poissonOdds(home, away) {
  function poisson(lambda) {
    const p = [Math.exp(-lambda)];
    for (let i = 1; i <= 24; i++) p.push((p[i - 1] * lambda) / i);
    const sum = p.reduce((a, b) => a + b, 0);
    return p.map((x) => x / sum);
  }
  const h = poisson(home),
    v = poisson(away),
    probabilities = {
      1: 0,
      X: 0,
      2: 0,
      Goal: 0,
      "No Goal": 0,
      "Under 2.5": 0,
      "Over 2.5": 0,
    };
  for (let i = 0; i < h.length; i++)
    for (let j = 0; j < v.length; j++) {
      const p = h[i] * v[j];
      probabilities[i > j ? "1" : i === j ? "X" : "2"] += p;
      probabilities[i && j ? "Goal" : "No Goal"] += p;
      probabilities[i + j < 2.5 ? "Under 2.5" : "Over 2.5"] += p;
    }
  probabilities["1X"] = probabilities["1"] + probabilities.X;
  probabilities["12"] = probabilities["1"] + probabilities["2"];
  probabilities.X2 = probabilities.X + probabilities["2"];
  return Object.fromEntries(
    Object.entries(probabilities).map(([p, x]) => [
      p,
      Math.round(clamp(1 / (x * 1.05), 1.01, 100) * 100) / 100,
    ]),
  );
}
export function updateFantasyQuotes(s, c) {
  for (const r of s.rounds.filter(
    (r) => r.source === "fantacalcio" && r.competitionKey === c.competitionKey,
  )) {
    // No retroactive odds, and submitted slips retain the prices they accepted.
    if (r.calculated || !r.kickoff || Date.parse(r.kickoff) <= Date.now())
      continue;
    for (const m of r.matches) {
      const quote = fantasyQuote(c.rounds, r, m);
      m.odds = quote.odds;
      m.oddsModel = quote.model;
    }
  }
}
