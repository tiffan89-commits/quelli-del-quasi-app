import {visibleBarRounds} from './bar-fanta-access.mjs';
import { hit, roundClosed } from "./game.mjs";
export {updateLeagueProfile} from './league-profile.mjs';
import { chatSummary } from "./league-chat.mjs";
import { cachedFantasyRankings } from "./bar-fanta-rankings.mjs";
import { slipPointTerms } from "./scoring.mjs";
import {progressionFor} from './progression.mjs';

const source = (r) => (r.source === "fantacalcio" ? "fantacalcio" : "seriea");
const cents = (n) => Math.round(n * 100) / 100;
export function accountTotals(s, l, member) {
  const rounds = s.rounds.filter(
    (r) => r.league === l.id && !r.pointsOnly && r.source !== "fantacalcio",
  );
  const committed = rounds
    .flatMap((r) => r.slips || [])
    .filter((x) => x.uid === member.uid && !x.creditsSettled)
    .reduce((n, x) => n + x.stake, 0);
  return {
    committedCredits: cents(committed),
    capital: cents(member.credits + committed),
  };
}
function metrics(r, slip) {
  const valid = r.matches.filter((m) => !m.void);
  if (
    !valid.length ||
    valid.some(
      (m) =>
        !Array.isArray(m.score) ||
        (m.status && m.status !== "FT") ||
        (r.requiresOfficialScores && !m.officialConfirmed),
    )
  )
    return null;
  const correct = valid.filter((m) => hit(slip.picks[m.id], m.score)).length;
  return {
    uid: slip.uid,
    correct,
    total: valid.length,
    wrong: valid.length - correct,
    points:
      slip.points ??
      valid.reduce(
        (n,m)=>{
          const terms=slipPointTerms(r,m,slip);
          return n+(hit(slip.picks[m.id],m.score)?terms.correct:terms.wrong);
        },
        0,
      ),
    prize: slip.prize ?? 0,
    stake: slip.stake || 0,
    odds: slip.odds || null,
    picks: slip.picks,
  };
}
export function communityFor(s, l, scope = "seriea", competitionKey = null) {
  const rounds = s.rounds
    .filter(
      (r) =>
        r.league === l.id &&
        source(r) === scope &&
        (!competitionKey || r.competitionKey === competitionKey) &&
        r.settled &&
        roundClosed(r),
    )
    .sort(
      (a, b) =>
        Date.parse(a.kickoff) - Date.parse(b.kickoff) ||
        a.number - b.number ||
        a.id.localeCompare(b.id),
    );
  const history = rounds.map((r) => ({
    id: r.id,
    title: r.title,
    number: r.number,
    kickoff: r.kickoff,
    players: (r.slips || []).map((x) => metrics(r, x)).filter(Boolean),
  }));
  const latest = rounds.at(-1),
    last = history.at(-1);
  if (!latest || !last?.players.length)
    return { history, recap: null, honours: [] };
  const best = Math.max(...last.players.map((x) => x.points));
  const almost = last.players
    .filter((x) => x.wrong === 1)
    .map((x) => {
      const match = latest.matches.find(
        (m) => !m.void && !hit(x.picks[m.id], m.score),
      );
      return {
        uid: x.uid,
        match: match.home + " – " + match.away,
        pick: x.picks[match.id],
        potential: x.odds ? cents(x.odds * x.stake) : null,
        correct: x.correct,
        total: x.total,
      };
    });
  const surprises = latest.matches
    .filter((m) => !m.void)
    .map((m) => {
      const successful = last.players.filter((x) =>
        hit(x.picks[m.id], m.score),
      );
      return {
        match: m.home + " – " + m.away,
        score: m.score,
        correct: successful.length,
        total: last.players.length,
        heroes: successful.map((x) => x.uid),
      };
    })
    .sort((a, b) => a.correct - b.correct);
  const honours = l.members
    .map((member) => {
      const days = history.flatMap((r) =>
        r.players.filter((p) => p.uid === member.uid),
      );
      return {
        uid: member.uid,
        days: days.length,
        correct: days.reduce((n, p) => n + p.correct, 0),
        total: days.reduce((n, p) => n + p.total, 0),
        perfect: days.filter((p) => p.wrong === 0).length,
        almost: days.filter((p) => p.wrong === 1).length,
      };
    })
    .filter((x) => x.days);
  return {
    history,
    recap: {
      round: last.id,
      title: last.title,
      winners: last.players.filter((x) => x.points === best).map((x) => x.uid),
      points: best,
      almost,
      surprise: surprises[0] || null,
      participants: last.players.length,
    },
    honours,
  };
}
export function rivalryFor(community, a, b) {
  const rounds = community.history
    .map((r) => ({
      round: r.title,
      a: r.players.find((x) => x.uid === a),
      b: r.players.find((x) => x.uid === b),
    }))
    .filter((r) => r.a && r.b);
  return {
    days: rounds.length,
    aWins: rounds.filter((r) => r.a.points > r.b.points).length,
    bWins: rounds.filter((r) => r.b.points > r.a.points).length,
    draws: rounds.filter((r) => r.a.points === r.b.points).length,
    aPoints: cents(rounds.reduce((n, r) => n + r.a.points, 0)),
    bPoints: cents(rounds.reduce((n, r) => n + r.b.points, 0)),
    rounds: rounds.slice(-12),
  };
}
export function enhanceState(s, u, view) {
  if (!u || (!u.demo && !u.emailVerified)) return view;
  for (const league of view.leagues) {
    const original = s.leagues.find((l) => l.id === league.id);
    const fantasyCache = cachedFantasyRankings(s.fantaAccessPolicy?{...s,rounds:visibleBarRounds(s,original,u)}:s, original);
    league.fantasyWalletScopes = { ...original.fantasyWalletScopes };
    league.members = league.members.map((m) => ({
      ...m,
      fantasyWallets: structuredClone(original.members.find(member => member.uid === m.uid)?.fantasyWallets || {}),
      ...accountTotals(s, original, m),
      fantasyCommitted: Object.fromEntries(
        [
          ...new Set(
            s.rounds
              .filter((r) => r.league === league.id && r.virtualBookmaker)
              .map((r) => r.competitionKey),
          ),
        ].map((key) => [
          key,
          s.rounds
            .filter((r) => r.league === league.id && r.competitionKey === key)
            .flatMap((r) => r.slips || [])
            .filter((x) => x.uid === m.uid && !x.creditsSettled)
            .reduce((n, x) => n + x.stake, 0),
        ]),
      ),
    }));
    league.nativeFanta=!!original.nativeFantaLink||league.rounds.some(r=>r.nativeFanta);
    league.fantaCompetitions=[...new Map(league.rounds.filter(r=>r.nativeFanta).map(r=>[r.competitionKey,{competitionKey:r.competitionKey,competitionName:r.competitionName,leagueName:r.fantasyLeagueName}])).values()];
    league.fantasyTeams=original.nativeFantaTeams||{};
    league.fantasyRanking = fantasyCache.ranking;
    league.fantasyTables = fantasyCache.tables;
    league.chat = chatSummary(s, original, u);
    league.progression = progressionFor(s,original,u.id);
    league.notifications=(s.leagueAlerts||[]).filter(a=>a.league===original.id&&a.uid===u.id&&a.expires>Date.now()).map(({id,title,body,url,created})=>({id,title,body,url,created}));
    const keys = [
      ...new Set(
        league.rounds
          .filter((r) => r.source === "fantacalcio")
          .map((r) => r.competitionKey),
      ),
    ];
    league.community = {
      seriea: communityFor(s, original, "seriea"),
      competitions: Object.fromEntries(
        keys.map((key) => [key, communityFor(s, original, "fantacalcio", key)]),
      ),
    };
  }
  return view;
}
