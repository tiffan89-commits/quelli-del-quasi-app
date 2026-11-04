// Dati finti della pagina Lega: classifica calcolata dai risultati delle giornate, calendario,
// partecipanti, regolamento e riepilogo dell'asta. Stessa forma che dovrà restituire GET /fanta-api/league.
import { TEAMS, MY_TEAM, team } from './squadre-finte.mjs';
import { roundFor, schedule, CURRENT_ROUND } from './dati-finti-giornata.mjs';
import { auctionFor, AUCTION_RULES, AUCTION_TYPES } from './dati-finti-asta.mjs';
import { LEAGUES } from './dati-finti.mjs';
import { FORMATIONS } from './dati-finti-squadra.mjs';

export const MAX_MEMBERS = 8;
const LAST_ROUND = 35; // giornate del fantacampionato (da confermare)
const cache = new Map();

// Classifica: 3 punti a vittoria, 1 a pareggio; a parità contano i fantapunti totali.
export function standingsFor(state) {
  const upTo = state === 'calcolata' ? CURRENT_ROUND : CURRENT_ROUND - 1;
  if (cache.has(upTo)) return cache.get(upTo);
  const rows = Object.fromEntries(Object.keys(TEAMS).map(id => [id, { team: team(id), played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, fantapoints: 0, form: [] }]));
  for (let n = 1; n <= upTo; n++) {
    for (const m of roundFor(n, state).matchups) {
      for (const [me, other] of [[m.home, m.away], [m.away, m.home]]) {
        const r = rows[me.team.id], res = me.goals > other.goals ? 'V' : me.goals < other.goals ? 'P' : 'N';
        r.played++; r.goalsFor += me.goals; r.goalsAgainst += other.goals; r.fantapoints += me.points;
        r[{ V: 'won', N: 'drawn', P: 'lost' }[res]]++; r.points += { V: 3, N: 1, P: 0 }[res];
        r.form.push(res);
      }
    }
  }
  const list = Object.values(rows)
    .sort((a, b) => b.points - a.points || b.fantapoints - a.fantapoints)
    .map((r, i) => ({ ...r, position: i + 1, fantapoints: Math.round(r.fantapoints * 10) / 10, form: r.form.slice(-5) }));
  cache.set(upTo, list);
  return list;
}

function calendarFor(state) {
  const rounds = [];
  for (let n = 1; n <= CURRENT_ROUND + 3; n++) {
    if (n <= CURRENT_ROUND) {
      const r = roundFor(n, state);
      rounds.push({ number: n, state: r.round.state, matchups: r.matchups.map(m => ({ id: m.id, isMine: m.isMine, home: m.home, away: m.away })) });
    } else {
      rounds.push({ number: n, state: 'futura', matchups: schedule(n).map(([h, a]) => ({ id: `${n}-${h}-${a}`, isMine: h === MY_TEAM || a === MY_TEAM, home: { team: team(h), points: null, goals: null }, away: { team: team(a), points: null, goals: null } })) });
    }
  }
  return { current: CURRENT_ROUND, last: LAST_ROUND, rounds };
}

const RULES = {
  scoring: [
    ['Gol', '+3'], ['Assist', '+1'], ['Ammonizione', '−0,5'], ['Espulsione', '−1'], ['Autogol', '−3'],
    ['Gol subito (portiere)', '−1'], ['Rigore parato', '+3'], ['Rigore sbagliato', '−3'], ['Imbattibilità del portiere', 'nessun bonus'],
  ],
  vote: 'Il voto statistico considera rendimento, ruolo ed episodi della partita. Reti e rigori incidono sulla prestazione; bonus e malus si sommano al voto base. I voti live sono provvisori.',
  modifier: { rule: 'Media dei voti base (senza bonus e malus) di portiere e 3 migliori difensori, solo con almeno 4 difensori in campo.', bands: [['sotto 6', '0'], ['6 – 6,49', '+1'], ['6,5 – 6,99', '+2'], ['da 7', '+3']] },
  goals: '66 punti valgono 1 gol, poi un gol ogni 6 punti in più.',
  lineup: { formations: FORMATIONS, bench: 'Panchina senza limite', subs: 'Cambi senza limite, solo nello stesso ruolo, nell\'ordine della panchina: il modulo non cambia.', missing: 'La formazione non schierata vale 0 fantapunti e 0 gol.' },
  table: 'Vittoria 3 punti, pareggio 1. A parità di punti vale la somma dei fantapunti.',
  roster: AUCTION_RULES.roster,
  budget: AUCTION_RULES.budget,
};

export function leagueFor(leagueId, state, now=Date.now(),auction=auctionFor) {
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const a = auction(leagueId, now), admin = a.isAdmin;
  // Chi ha creato la lega è entrato per primo; poi gli altri, uno ogni qualche giorno.
  const joined = id => new Date(now - (id === MY_TEAM ? 60 : 50 - Object.keys(TEAMS).indexOf(id) * 3) * 86400000).toISOString();
  const spent = Object.fromEntries(a.teams.map(t => [t.team.id, AUCTION_RULES.budget - t.credits]));
  return {
    league: { ...league, maxMembers: MAX_MEMBERS, inviteCode: 'QUASI-7K2P', inviteUrl: 'https://quellidelquasi.com/invito/QUASI-7K2P' },
    isAdmin: admin,
    members: Object.keys(TEAMS).map(id => ({ team: team(id), isAdmin: id === MY_TEAM && leagueId !== 'fanta-ufficio', isMe: id === MY_TEAM, joinedAt: joined(id) })),
    standings: standingsFor(state),
    calendar: calendarFor(state),
    rules: RULES,
    auction: {
      status: a.status, type: a.type, typeLabel: AUCTION_TYPES[a.type], mode: a.mode, startsAt: a.startsAt,
      types: AUCTION_TYPES,
      teams: a.teams.map(t => ({ team: t.team, spent: spent[t.team.id], credits: t.credits, slotsLeft: t.slotsLeft, roles: t.roles })),
      sales: a.log.length,
    },
  };
}
