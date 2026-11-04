// Dati finti della pagina Squadra: rosa con medie e stato, formazione della giornata, salvataggio in memoria.
import { MY_TEAM, team } from './squadre-finte.mjs';
import { rosterOf, defaultFormation, nextMatchOf, seasonOf, setSavedLineup, CURRENT_ROUND } from './dati-finti-giornata.mjs';

const HOUR = 3600000;
export const FORMATIONS = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
// Regole di base (ogni lega potrà cambiarle): panchina senza limite, cambi senza limite,
// i cambi avvengono solo nello stesso ruolo e il modulo non cambia mai.
const BENCH_MAX = null;
const saved = new Map(); // lega → formazione salvata durante l'anteprima

function hashNum(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0); }

// Formazione "di default" della squadra: i primi per ruolo secondo il modulo, poi 7 in panchina.
export function standardLineup(teamId) {
  const formation = defaultFormation(teamId), [d, c, a] = formation.split('-').map(Number), counts = { P: 1, D: d, C: c, A: a };
  const roster = rosterOf(teamId), starters = [], bench = [];
  for (const role of 'PDCA') {
    const of = roster.filter(p => p.role === role);
    starters.push(...of.slice(0, counts[role]).map(p => p.id));
    bench.push(...of.slice(counts[role], counts[role] + (role === 'P' ? 1 : 2)).map(p => p.id));
  }
  return { formation, starters, bench };
}

export function teamFor(leagueId, state, now = Date.now(),teamId=MY_TEAM,stored=saved.get(leagueId)) {
  const first = new Date(now + 2 * 24 * HOUR);
  first.setHours(20, 45, 0, 0);
  const deadline = new Date(first.getTime()).toISOString();
  const locked = state === 'in-corso' || state === 'calcolata';
  // Prezzi d'asta finti, riportati a un totale di 480 crediti su 500.
  const raw = rosterOf(teamId).map(p => 1 + hashNum('prezzo:' + p.id) % ({ P: 20, D: 25, C: 40, A: 80 }[p.role]));
  const scale = 480 / raw.reduce((t, x) => t + x, 0);
  const roster = rosterOf(teamId).map((p, i) => {
    const s = seasonOf(p), price = Math.max(1, Math.round(raw[i] * scale));
    return { id: p.id, name: p.name, role: p.role, club: p.club, price, next: nextMatchOf(p.club), stats: { minutes: Math.min(990, s.played * (45 + i%4*15)), teamMatches: 11, played: s.played, avgVote: s.avgVote, avgFanta: s.avgFanta, goals: s.goals, assists: s.assists }, status:s.status,play:['injured','suspended'].includes(s.status?.type)||i%5===4?null:{pct:[90,80,60,25][i%5],source:i%3?'probabili':'giornata-precedente'} };
  });
  const previous = { round: CURRENT_ROUND - 1, ...standardLineup(teamId) };
  const mine = stored || (state === 'da-schierare' ? null : { ...standardLineup(teamId), savedAt: new Date(now - 3 * HOUR).toISOString() });
  return {
    team: team(teamId),canEdit:teamId===MY_TEAM&&!locked,canManageRoster:leagueId!=='fanta-ufficio',rosterLocked:false,
    budget: { total: 500, spent: roster.reduce((t, p) => t + p.price, 0) },
    round: { number: CURRENT_ROUND, state, deadline, locked },
    rules: { formations: FORMATIONS, benchMax: BENCH_MAX, maxSubstitutions: null, substitutionsSameRoleOnly: true },
    roster,
    lineup: mine,
    previous,
  };
}

export const savedLineupOf = leagueId => saved.get(leagueId) || null;

// Il server vero controlla scadenza, modulo e giocatori; qui solo il minimo per l'anteprima.
export function saveLineupFake(leagueId, { formation, starters, bench }) {
  validateDemoLineup({formation,starters,bench});
  const lineup = { formation, starters: [...starters], bench: [...bench], savedAt: new Date().toISOString() };
  saved.set(leagueId, lineup);
  if (leagueId === 'lega-quasi') setSavedLineup(MY_TEAM, lineup); // la pagina Giornata mostra la formazione appena salvata
  return lineup;
}

export function validateDemoLineup({formation,starters,bench},roster=rosterOf(MY_TEAM)){
 if(!FORMATIONS.includes(formation)||!Array.isArray(starters)||starters.length!==11||!Array.isArray(bench))throw Error('Formazione non valida');
 const ids=[...starters,...bench],by=new Map(roster.map(p=>[p.id,p]));if(new Set(ids).size!==ids.length||ids.some(id=>!by.has(id)))throw Error('Giocatori duplicati o non presenti nella rosa');
 const [D,C,A]=formation.split('-').map(Number),counts={P:1,D,C,A};for(const role of 'PDCA')if(starters.filter(id=>by.get(id).role===role).length!==counts[role])throw Error('I titolari non rispettano il modulo');
}
