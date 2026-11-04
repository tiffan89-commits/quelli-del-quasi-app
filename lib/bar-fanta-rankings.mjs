import { ensureFantasyWallet,migrateFantasyWallets,fantasyWalletKey } from "./bar-fanta-wallet.mjs";
import { createHash } from "node:crypto";
const cents = (n) => Math.round(n * 100) / 100;
const finite = (n) => (Number.isFinite(n) ? n : 0);
export function fantasyRanking(s, l) {
  migrateFantasyWallets(s,l.id);
  const season = s.football.calendar?.season;
  const rounds = s.rounds.filter(
    (r) =>
      r.league === l.id &&
      r.source === "fantacalcio" &&
      (!season || !r.season || r.season === season),
  );
  const keys = [...new Set(rounds.map((r) => r.competitionKey))];
  const books = keys.filter((key) =>
    rounds.some((r) => r.competitionKey === key && r.virtualBookmaker),
  );
  const competitions = keys.map((key) => {
    const r = rounds.find((r) => r.competitionKey === key),
      c = s.rounds.find(r=>r.competitionKey===key&&r.league===l.id);
    return {
      key,
      walletKey:fantasyWalletKey(r,l),
      leagueName: c?.fantasyLeagueName || r.fantasyLeagueName || r.competitionName,
      competitionName: r.competitionName,
    };
  });
  const groups=[...new Set(competitions.map(c=>c.walletKey))].map(key=>{
    const own=competitions.filter(c=>c.walletKey===key),keys=own.map(c=>c.key),selected=rounds.filter(r=>keys.includes(r.competitionKey));
    return {key,leagueName:own[0]?.leagueName||own[0]?.competitionName,competitionKeys:keys,competitions:own,
      active:selected.some(r=>r.nativeFanta),bookmakerCompetitions:own.filter(c=>books.includes(c.key)).length,
      members:l.members.map(m=>{const committed=selected.flatMap(r=>r.virtualBookmaker?r.slips||[]:[]).filter(x=>x.uid===m.uid&&!x.creditsSettled).reduce((n,x)=>n+finite(x.stake),0),wallet=books.some(k=>keys.includes(k))?ensureFantasyWallet(l,m,key):{initial:0,credits:0};
        return {uid:m.uid,points:cents(keys.reduce((n,k)=>n+finite(m.competitionPoints?.[k]),0)),credits:cents(wallet.credits),initial:cents(wallet.initial),committed:cents(committed),capital:cents(wallet.credits+committed),balance:cents(wallet.credits+committed-wallet.initial)};
      })};
  }).sort((a,b)=>Number(b.active)-Number(a.active)||String(a.leagueName).localeCompare(String(b.leagueName),'it'));
  return {
    season,
    competitions,
    bookmakerCompetitions: books.length,
    groups,
    members:groups[0]?.members||[],
  };
}
export function fantasyTables(s, l) {
  const ranking = fantasyRanking(s, l);
  return ranking.competitions.map((comp) => {
    const rounds = s.rounds.filter(
        (r) =>
          r.league === l.id &&
          r.source === "fantacalcio" &&
          r.competitionKey === comp.key,
      ),
      teams = new Map();
    let played = 0;
    const team = (id, name) => {
      if (!teams.has(id))
        teams.set(id, {
          id,
          name,
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          fantasyPoints: 0,
          fantasyAppearances: 0,
        });
      const t = teams.get(id);
      t.name = name;
      return t;
    };
    for (const r of rounds)
      for (const m of r.matches) {
        const home = team(m.homeId, m.home),
          away = team(m.awayId, m.away);
        if (
          r.sourceConflict ||
          m.void ||
          m.scoreConflict ||
          !m.officialConfirmed ||
          m.status !== "FT" ||
          !Array.isArray(m.score) ||
          m.score.length !== 2 ||
          !m.score.every((n) => Number.isInteger(n) && n >= 0)
        )
          continue;
        played++;
        const [h, a] = m.score;
        home.played++;
        away.played++;
        home.goalsFor += h;
        home.goalsAgainst += a;
        away.goalsFor += a;
        away.goalsAgainst += h;
        if (h > a) {
          home.won++;
          away.lost++;
          home.points += 3;
        } else if (h < a) {
          away.won++;
          home.lost++;
          away.points += 3;
        } else {
          home.drawn++;
          away.drawn++;
          home.points++;
          away.points++;
        }
        if (
          Array.isArray(m.fantasyPoints) &&
          m.fantasyPoints.length === 2 &&
          m.fantasyPoints.every((n) => Number.isFinite(n))
        ) {
          home.fantasyPoints += m.fantasyPoints[0];
          away.fantasyPoints += m.fantasyPoints[1];
          home.fantasyAppearances++;
          away.fantasyAppearances++;
        }
      }
    const rows = [...teams.values()]
      .map((t) => ({
        ...t,
        fantasyPoints: cents(t.fantasyPoints),
        goalDifference: t.goalsFor - t.goalsAgainst,
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.fantasyPoints - a.fantasyPoints ||
          b.goalDifference - a.goalDifference ||
          b.goalsFor - a.goalsFor ||
          a.name.localeCompare(b.name, "it"),
      );
    const equal = (a, b) =>
      a.points === b.points &&
      a.fantasyPoints === b.fantasyPoints &&
      a.goalDifference === b.goalDifference &&
      a.goalsFor === b.goalsFor;
    return {
      ...comp,
      season: ranking.season,
      method: "calendar",
      played,
      updatedAt:
        rounds
          .map((r) => r.sourceUpdatedAt)
          .filter(Boolean)
          .sort()
          .at(-1) || null,
      rows: rows.map((t, i) => ({
        ...t,
        position: rows.findIndex((x) => equal(t, x)) + 1,
      })),
    };
  });
}
export function cachedFantasyRankings(s, l) {
  migrateFantasyWallets(s,l.id);
  const rounds = s.rounds.filter(
    (r) => r.league === l.id && r.source === "fantacalcio",
  );
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        season: s.football.calendar?.season,
        rounds: rounds.map((r) => [
          r.id,
          r.competitionKey,
          r.competitionName,
          r.season,
          r.sourceConflict,
          r.virtualBookmaker,
          r.rules?.initial,
          r.sourceUpdatedAt,
          r.matches.map((m) => [
            m.homeId,
            m.awayId,
            m.home,
            m.away,
            m.score,
            m.officialConfirmed,
            m.status,
            m.void,
            m.scoreConflict,
            m.fantasyPoints,
          ]),
          (r.slips || []).map((x) => [x.uid, x.stake, x.creditsSettled]),
        ]),
        members: l.members.map((m) => [
          m.uid,
          m.competitionPoints,
          m.fantasyWallets,
        ]),

      }),
    )
    .digest("hex");
  s.fantasyRankingCache ??= {};
  let cache = s.fantasyRankingCache[l.id];
  if (!cache || cache.digest !== digest) {
    cache = {
      digest,
      ranking: fantasyRanking(s, l),
      tables: fantasyTables(s, l),
      generatedAt: new Date().toISOString(),
    };
    s.fantasyRankingCache[l.id] = cache;
  }
  return cache;
}
