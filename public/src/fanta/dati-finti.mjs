// Dati finti per l'anteprima. Stessa forma che dovrà restituire /fanta-api (vedi docs/FANTA-FRONTEND.md).
// Gli orari sono relativi ad "adesso", così il conto alla rovescia ha sempre senso.
import {AUCTION_TYPES} from '../auction-formats.mjs';
import { TEAMS, MY_TEAM, team } from './squadre-finte.mjs';
import { matchupFor, CURRENT_ROUND } from './dati-finti-giornata.mjs';
import { savedLineupOf } from './dati-finti-squadra.mjs';
import { auctionFor } from './dati-finti-asta.mjs';
import { standingsFor } from './dati-finti-lega.mjs';

const HOUR = 3600000;

export const LEAGUES = [
  { id: 'lega-quasi', name: 'Lega dei Quasi', season: '2026/27', role: 'admin', accent: '#d6f77b', teamName: 'SamBuca Juniors' },
  { id: 'fanta-ufficio', name: 'Fanta Ufficio', season: '2026/27', role: 'member', accent: '#7bc8f7', teamName: 'SamBuca Juniors' },
];

// Gli stati della giornata che la home sa mostrare. In produzione lo decide il server.
export const ROUND_STATES = {
  'da-schierare': 'Formazione da schierare',
  'schierata': 'Formazione salvata',
  'in-corso': 'Giornata in corso',
  'calcolata': 'Giornata calcolata',
};

const outcome = (mine, other) => mine > other ? 'V' : mine < other ? 'P' : 'N';

// Riassunto della sfida dell'utente, preso dagli stessi dati della pagina Giornata.
function result(n, state) {
  const m = matchupFor(n, null, state), [mine, other] = m.home.team.id === MY_TEAM ? [m.home, m.away] : [m.away, m.home];
  const best = [...mine.starters, ...mine.bench].filter(p => p.fantavote != null && (mine.starters.includes(p) || p.enteredFor)).sort((a, b) => b.fantavote - a.fantavote)[0];
  return {
    round: n,
    matchupId: m.id,
    home: team(m.home.team.id, { points: m.home.total, goals: m.home.goals }),
    away: team(m.away.team.id, { points: m.away.total, goals: m.away.goals }),
    outcome: outcome(mine.goals, other.goals),
    topPlayer: best ? { name: best.name, fantavoto: best.fantavote } : null,
    sheets: m,
  };
}

export function homeFor(leagueId,state='da-schierare',now=Date.now(),auction=auctionFor,saved=savedLineupOf(leagueId)) {
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  // Primo fischio dopodomani alle 20:45, formazioni chiuse un quarto d'ora prima.
  const first = new Date(now + 2 * 24 * HOUR);
  first.setHours(20, 45, 0, 0);
  const deadline = new Date(first.getTime()).toISOString();
  const kickoff=['in-corso','calcolata'].includes(state)?new Date(now-(state==='calcolata'?48:2)*HOUR).toISOString():first.toISOString();
  const last = result(CURRENT_ROUND - 1, state);
  const current = state === 'in-corso' || state === 'calcolata' ? result(CURRENT_ROUND, state) : null;
  // Classifica calcolata dagli stessi risultati della pagina Giornata e della pagina Lega.
  const standings = standingsFor(state), mine = standings.find(s => s.team.id === MY_TEAM);
  const form = mine.form;
  const home = {
    league,
    me: { teamId: MY_TEAM, teamName: TEAMS[MY_TEAM].name, manager: TEAMS[MY_TEAM].manager, position: mine.position, points: mine.points, fantapoints: mine.fantapoints, form },
    round: { number: CURRENT_ROUND, state, deadline, firstKickoff: kickoff, matchesTotal: 10, matchesDone:state==='calcolata'?10:state==='in-corso'?4:0 },
    lineup: saved ? { status: 'saved', formation: saved.formation, savedAt: saved.savedAt }
      : state === 'da-schierare' ? { status: 'missing', formation: null, savedAt: null }
      : { status: 'saved', formation: '4-4-2', savedAt: new Date(now - 3 * HOUR).toISOString() },
    match: {
      id: (current?.sheets||matchupFor(CURRENT_ROUND,null,state)).id,
      home: team('sambuca'),
      away: team('realgin'),
      live: state === 'in-corso' ? {
        home: { points: current.sheets.home.total, played: current.sheets.home.withVote },
        away: { points: current.sheets.away.total, played: current.sheets.away.withVote }, of: 11,
      } : null,
      final: state === 'calcolata' ? { home: { points: current.home.points, goals: current.home.goals }, away: { points: current.away.points, goals: current.away.goals } } : null,
    },
    lastResult: (({ sheets, ...r }) => r)(state === 'calcolata' ? current : last),
    standings,
    bar: state === 'calcolata' ? null : { odds: { '1': 2.05, X: 3.4, '2': 3.3 }, bets: 5 },
    // Solo anteprima: l'asta è sempre aperta per poterla provare.
    auction: (() => {
      const a = auction(leagueId, now), me = a.teams.find(t => t.team.id === a.me);
      return { status: a.status, mode: a.mode, startsAt: a.startsAt, title: AUCTION_TYPES[a.type], slotsLeft: me.slotsLeft, credits: me.credits };
    })(),
  };
  return home;
}
