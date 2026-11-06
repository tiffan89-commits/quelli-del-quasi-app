// Dati finti di una giornata: formazioni, voti, bonus/malus, spiegazioni, modificatore difesa.
// Tutto deterministico (stesso seme → stessi numeri). Nell'app vera questi calcoli li fa il server
// con il motore regole e il motore voti: il frontend mostra solo ciò che riceve.
import { TEAMS, MY_TEAM, team } from './squadre-finte.mjs';
import {demoFixtures,demoRoster,demoPerformance,demoSeason} from './demo-football.mjs';

export const CURRENT_ROUND = 11;

const CLUB_PAIRS = demoFixtures(CURRENT_ROUND).map(f=>[f.teams.home.name,f.teams.away.name]);
const CLUBS = CLUB_PAIRS.flat();
const KICKOFFS = ['sab 15:00', 'sab 18:00', 'sab 20:45', 'dom 12:30', 'dom 15:00', 'dom 15:00', 'dom 18:00', 'dom 20:45', 'lun 18:30', 'lun 20:45'];
const FORMATIONS = { sambuca: '4-4-2', realgin: '3-4-3', fly: '4-3-3', perfetta: '3-5-2', bis: '4-4-2', falcone: '3-4-3', ciaccola: '4-3-3', united: '3-5-2' };
const ROLE_COUNTS = { P: 3, D: 8, C: 8, A: 6 };
const BENCH = { P: 1, D: 2, C: 2, A: 2 };
export const MODIFIER_BANDS = [{ from: null, to: 6, bonus: 0 }, { from: 6, to: 6.5, bonus: 1 }, { from: 6.5, to: 7, bonus: 2 }, { from: 7, to: null, bonus: 3 }];

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) {
  let a = hash(seed);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, min, max) => min + Math.floor(r() * (max - min + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
const sum = list => list.reduce((t, x) => t + x, 0);
const andList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a.at(-1) : a[0];

const ROSTERS=Object.fromEntries(Object.keys(TEAMS).map((id,i)=>[id,demoRoster(i,ROLE_COUNTS).map(({slot,...p})=>({...p,id:id+'-'+slot}))]));

// Calendario della lega: giornate 10 e 11 fisse (le usa la home), le altre a rotazione.
export function schedule(n) {
  if (n === 10) return [['sambuca', 'falcone'], ['fly', 'united'], ['perfetta', 'bis'], ['realgin', 'ciaccola']];
  if (n === 11) return [['sambuca', 'realgin'], ['fly', 'ciaccola'], ['perfetta', 'united'], ['bis', 'falcone']];
  const ids = Object.keys(TEAMS), fixed = ids[0], rest = ids.slice(1), k = (n - 1) % rest.length;
  const rot = [...rest.slice(k), ...rest.slice(0, k)], all = [fixed, ...rot];
  return [0, 1, 2, 3].map(i => n % 2 ? [all[i], all[7 - i]] : [all[7 - i], all[i]]);
}

export function roundState(n, currentState) { return n<CURRENT_ROUND?'calcolata':n>CURRENT_ROUND?'da-schierare':currentState; }

// Minuto della partita in diretta: avanza con l'orologio (un giro ogni 90 minuti), così l'anteprima "si muove".
export const liveMinute = (now = Date.now()) => 1 + Math.floor(now / 60000) % 90;

// Stato delle partite di Serie A della giornata: 4 finite, 1 in corso e 5 da giocare quando la giornata è in corso.
function clubMatch(n, state, clubIndex) {
  const pair = Math.floor(clubIndex / 2), home = clubIndex % 2 === 0, r = rng(`serie-a:${n}:${pair}`);
  const goals = () => [0, 0, 1, 1, 1, 2, 2, 3][int(r, 0, 7)];
  const score = [goals(), goals()];
  const base = { opponent: CLUB_PAIRS[pair][home ? 1 : 0], home, kickoff: KICKOFFS[pair] };
  if (state === 'da-schierare' || state === 'schierata' || (state === 'in-corso' && pair > 4)) return { ...base, status: 'to-play' };
  const live = state === 'in-corso' && pair === 4, minute = live ? liveMinute() : 90;
  const s = live ? score.map(g => Math.floor(g * minute / 90)) : score;
  return { ...base, status: live ? 'live' : 'done', minute, gf: s[home ? 0 : 1], ga: s[home ? 1 : 0] };
}

const historicalPerformances=new Map();
function performance(p,n,state,starter){
 if(state!=='calcolata')return calculatePerformance(p,n,state,starter);
 const key=[p.id,p.apiId,n,starter].join(':');if(!historicalPerformances.has(key))historicalPerformances.set(key,calculatePerformance(p,n,state,starter));
 return structuredClone(historicalPerformances.get(key));
}
function calculatePerformance(p, n, state, starter) {
  const archived=demoPerformance(p,n,state);if(archived)return archived;
  const clubIndex = CLUBS.indexOf(p.club), match = clubMatch(n, state, clubIndex);
  const base = { id: p.id, apiId:p.apiId,jersey:p.jersey,name: p.name, role: p.role, club: p.club, opponent: match.opponent, home: match.home };
  if (match.status === 'to-play') return { ...base, status: 'to-play', kickoff: match.kickoff, vote: null, fantavote: null };
  const r = rng(`voto:${p.id}:${n}`), roll = r();
  const planned = starter ? (roll < 0.07 ? 0 : roll < 0.3 ? int(r, 55, 80) : 90) : (roll < 0.55 ? 0 : int(r, 8, 35));
  // I titolari escono al minuto `planned`, i panchinari entrano negli ultimi `planned` minuti.
  const minutes = starter ? Math.min(planned, match.minute) : Math.max(0, match.minute - (90 - planned));
  const live = match.status === 'live';
  if (live && minutes === 0) return { ...base, status: 'to-play', kickoff: `non in campo · ${match.minute}'`, vote: null, fantavote: null };
  if (minutes < 15 && !(live && planned >= 15)) {
    return { ...base, status: 'sv', minutes, vote: null, fantavote: null, why: minutes ? `Ha giocato solo ${minutes} minuti: troppo pochi per avere un voto.` : 'Non è sceso in campo.' };
  }
  const { gf, ga } = match, scale = minutes / 90;
  let goals = 0;
  while (goals < 3 && r() < { P: 0, D: 0.06, C: 0.13, A: 0.32 }[p.role] * scale) goals++;
  const assists = r() < { P: 0.01, D: 0.07, C: 0.15, A: 0.14 }[p.role] * scale ? 1 : 0;
  const yellow = r() < 0.16 ? 1 : 0, red = !yellow && r() < 0.02 ? 1 : 0;
  const ownGoals = p.role === 'D' && r() < 0.02 ? 1 : 0;
  const conceded = p.role === 'P' ? ga : 0;
  const penSaved = p.role === 'P' && r() < 0.05 ? 1 : 0, penMissed = p.role === 'A' && r() < 0.04 ? 1 : 0;

  // In diretta i numeri crescono con i minuti giocati: il voto parte da 6 e si sposta man mano.
  const s = {}, stats = [], lines = [];
  const stat = (label, value, avg, unit = '') => {
    const v = live && !unit ? Math.round(value * scale) : value;
    s[label] = v; stats.push({ label, value: v, avg, unit });
  };
  // In diretta, nei primi 25 minuti giocati, i numeri sono troppo pochi: il voto resta 6.
  const early = live && minutes < 25;
  const line = (delta, label, why, kind = 'stat') => { if (!early || kind === 'context') lines.push({ kind, delta, label, why }); };
  if (p.role === 'P') {
    stat('Parate', int(r, 0, 7), 2.8); stat('Uscite', int(r, 0, 3), 1.2);
    if (s.Parate >= 5) line(0.5, `${s.Parate} parate`, `${s.Parate} parate (la media del ruolo è 2,8)`);
    if (s.Parate <= 1 && conceded >= 2) line(-0.5, 'Poche parate, molti gol presi', `${s.Parate} ${s.Parate === 1 ? 'parata' : 'parate'} con ${conceded} gol presi`);
  } else if (p.role === 'D') {
    stat('Contrasti vinti', int(r, 0, 6), 2.1); stat('Intercetti', int(r, 0, 5), 1.6); stat('Duelli vinti', int(r, 32, 78), 52, '%'); stat('Passaggi riusciti', int(r, 70, 95), 86, '%');
    const def = s['Contrasti vinti'] + s.Intercetti;
    if (def >= 7) line(0.5, `${def} palloni recuperati`, `${s['Contrasti vinti']} contrasti vinti e ${s.Intercetti} intercetti (media del ruolo 3,7 in tutto)`);
    if (def <= 1) line(-0.5, 'Quasi mai in partita', `solo ${def} ${def === 1 ? 'pallone recuperato' : 'palloni recuperati'}`);
    if (s['Duelli vinti'] < 40) line(-0.5, `Duelli vinti al ${s['Duelli vinti']}%`, `duelli vinti al ${s['Duelli vinti']}% (media 52%)`);
    if (s['Duelli vinti'] > 68) line(0.5, `Duelli vinti al ${s['Duelli vinti']}%`, `duelli vinti al ${s['Duelli vinti']}% (media 52%)`);
  } else if (p.role === 'C') {
    stat('Passaggi chiave', int(r, 0, 5), 1.1); stat('Recuperi', int(r, 0, 9), 4.2); stat('Passaggi riusciti', int(r, 68, 95), 84, '%'); stat('Duelli vinti', int(r, 30, 75), 50, '%');
    if (s['Passaggi chiave'] >= 3) line(0.5, `${s['Passaggi chiave']} passaggi chiave`, `${s['Passaggi chiave']} passaggi chiave (media del ruolo 1,1)`);
    if (s.Recuperi >= 7) line(0.5, `${s.Recuperi} recuperi`, `${s.Recuperi} recuperi (media 4,2)`);
    if (s['Passaggi riusciti'] < 74) line(-0.5, `Passaggi riusciti al ${s['Passaggi riusciti']}%`, `appena il ${s['Passaggi riusciti']}% di passaggi riusciti (media 84%)`);
  } else {
    const shots = int(r, 0, 6);
    stat('Tiri', shots, 2.3); stat('Tiri in porta', Math.min(shots, int(r, 0, 4)), 1); stat('Occasioni create', int(r, 0, 4), 0.9); stat('Duelli vinti', int(r, 25, 70), 45, '%');
    if (s['Tiri in porta'] >= 3) line(0.5, `${s['Tiri in porta']} tiri in porta`, `${s['Tiri in porta']} tiri in porta (media del ruolo 1,0)`);
    if (s.Tiri === 0) line(-0.5, 'Nessun tiro', 'nessun tiro in tutta la partita');
    if (s['Duelli vinti'] < 33) line(-0.5, `Duelli vinti al ${s['Duelli vinti']}%`, `duelli vinti al ${s['Duelli vinti']}% (media 45%)`);
  }
  if (gf - ga >= 2) line(0.5, `Squadra vincente ${gf}–${ga}`, `la vittoria ${gf}–${ga} della squadra`, 'context');
  if (ga - gf >= 2) line(-0.5, `Squadra sconfitta ${gf}–${ga}`, `la sconfitta ${gf}–${ga} della squadra`, 'context');

  if(goals)line(0.5,'Incisività sotto porta','Trova la rete e lascia il segno nella partita.','context');
  if(penMissed)line(-0.5,'Rigore sbagliato','Dal dischetto spreca una grande occasione.','context');
  const raw=6+sum(lines.map(l=>l.delta));
  const floor=penSaved?6.5:goals?6:4,vote=Math.min(8.5,Math.max(floor,raw));
  if(vote!==raw)line(vote-raw,'Valutazione complessiva','Incisività negli episodi e rendimento complessivo.','context');

  const bonus = [];
  const b = (count, each, label) => { if (count) bonus.push({ label: count > 1 ? `${label} ×${count}` : label, delta: count * each }); };
  b(goals, 3, 'Gol'); b(assists, 1, 'Assist'); b(penSaved, 3, 'Rigore parato'); b(penMissed, -3, 'Rigore sbagliato');
  b(yellow, -0.5, 'Ammonizione'); b(red, -1, 'Espulsione'); b(ownGoals, -3, 'Autogol'); b(conceded, -1, 'Gol subito');

  const quality=vote>=7?'Una delle prove migliori':vote>=6.5?'Una prova convincente':vote>=6?'Una prova ordinata':'Una serata complicata';
  const roleText={P:'Tra i pali risponde quando viene chiamato in causa',D:'Lavora nei duelli e prova a tenere compatto il reparto',C:'Cerca di dare ordine alla manovra e di collegare i reparti',A:'Attacca gli spazi e cerca il varco nella difesa avversaria'}[p.role];
  let why=quality+' per '+p.name+' con il '+p.club+' contro '+match.opponent+'. '+roleText+'.';
  if(goals)why+=' La rete dà sostanza alla sua prestazione.';
  if(assists)why+=' L’ultimo passaggio mette un compagno nelle condizioni di colpire.';
  if(penSaved)why+=' Il rigore parato è il suo intervento più importante.';
  if(penMissed)why+=' Il rigore sbagliato pesa sul giudizio.';
  if(red)why+=' L’espulsione complica la partita dei compagni.';
  if(live)why+=' Il giudizio è ancora provvisorio.';

  return {
    ...base, status: live ? 'playing' : 'voted', minutes, score: [gf, ga],
    vote, fantavote: vote + sum(bonus.map(x => x.delta)),
    events: { goals, assists, yellow, red, ownGoals, conceded, penSaved, penMissed },
    breakdown: { start: 6, lines, bonus }, stats, why, model:'demo-statistico',ai:null,
  };
}

// --- Per la pagina Squadra ---
export const rosterOf = teamId => ROSTERS[teamId];
export const defaultFormation = teamId => FORMATIONS[teamId];

// Prossima partita di Serie A del club nella giornata n (avversario, casa/trasferta, orario).
export function nextMatchOf(club, n = CURRENT_ROUND) {
  const fixture=demoFixtures(n).find(f=>[f.teams.home.name,f.teams.away.name].includes(club));
  if(fixture){const home=fixture.teams.home.name===club;return {opponent:fixture.teams[home?'away':'home'].name,home,kickoff:fixture.kickoff,round:n};}
  const i = CLUB_PAIRS.findIndex(p => p.includes(club));if(i<0)return {opponent:'',home:true,round:n};const home=CLUB_PAIRS[i][0]===club;
  return {opponent:CLUB_PAIRS[i][home?1:0],home,kickoff:KICKOFFS[i],round:n};
}

// Medie della stagione (giornate già calcolate) e stato fisico finto ma stabile.
export function seasonOf(p) {
  const archived=demoSeason(p);if(archived)return archived;
  const done = [];
  for (let n = 1; n < CURRENT_ROUND; n++) {
    const x = performance(p, n, 'calcolata', true);
    if (x.vote != null) done.push(x);
  }
  const avg = list => list.length ? Math.round(sum(list) / list.length * 100) / 100 : null;
  const r = hash('stato:' + p.id) % 100;
  const status = r < 4 ? { type: 'injured', note: 'Infortunato · rientro tra 2 settimane' } : r < 7 ? { type: 'doubtful', note: 'In dubbio · affaticamento' } : r < 9 ? { type: 'suspended', note: 'Squalificato · 1 giornata' } : { type: 'ok' };
  return {
    played: done.length, avgVote: avg(done.map(x => x.vote)), avgFanta: avg(done.map(x => x.fantavote)),
    goals: sum(done.map(x => x.events.goals)), assists: sum(done.map(x => x.events.assists)), status,
  };
}

export const goalsFrom = total => total < 66 ? 0 : Math.floor((total - 66) / 6) + 1;

function modifier(formation, counted, pending) {
  const defenders = Number(formation.split('-')[0]);
  const rule = 'Media dei voti base di portiere e dei 3 migliori difensori, senza bonus né malus. Vale solo con almeno 4 difensori schierati.';
  if (defenders < 4) return { applies: false, bonus: 0, rule, reason: `Non si applica: in campo ${defenders} difensori, ne servono almeno 4.` };
  if (pending) return { applies: false, pending: true, bonus: 0, rule, reason: 'Si calcola quando tutti i difensori e il portiere hanno il voto.' };
  const gk = counted.find(p => p.role === 'P'), ds = counted.filter(p => p.role === 'D').sort((x, y) => y.vote - x.vote).slice(0, 3);
  if (!gk || ds.length < 3) return { applies: false, bonus: 0, rule, reason: 'Non si applica: mancano voti di portiere o difensori.' };
  const players = [gk, ...ds].map(p => ({ id: p.id, name: p.name, role: p.role, vote: p.vote }));
  const average = Math.round(sum(players.map(p => p.vote)) / 4 * 100) / 100;
  const band = MODIFIER_BANDS.find(x => (x.from === null || average >= x.from) && (x.to === null || average < x.to));
  return { applies: true, bonus: band.bonus, rule, players, average, bands: MODIFIER_BANDS };
}

// Formazioni salvate nell'anteprima (pagina Squadra) per la giornata corrente.
const SAVED = new Map();
export const setSavedLineup = (teamId, lineup) => SAVED.set(teamId, lineup);

function teamSheet(teamId, n, state, visible, saved=SAVED) {
  const own = n === CURRENT_ROUND ? saved.get(teamId) : null;
  const formation = own?.formation || FORMATIONS[teamId], [d, c, a] = formation.split('-').map(Number), counts = { P: 1, D: d, C: c, A: a };
  if (!visible.show) return { team: team(teamId), formation: null, hidden: true, hiddenReason: visible.reason, total: null, goals: null };
  const roster = ROSTERS[teamId], startersP = [], benchP = [];
  if (own) {
    const byId = new Map(roster.map(p => [p.id, p]));
    startersP.push(...'PDCA'.split('').flatMap(role => own.starters.map(id => byId.get(id)).filter(p => p?.role === role)));
    benchP.push(...own.bench.map(id => byId.get(id)).filter(Boolean));
    visible = { ...visible, savedAt: own.savedAt };
  } else for (const role of 'PDCA') {
    const of = roster.filter(p => p.role === role);
    startersP.push(...of.slice(0, counts[role]));
    benchP.push(...of.slice(counts[role], counts[role] + BENCH[role]));
  }
  const starters = startersP.map(p => performance(p, n, state, true)), bench = benchP.map(p => performance(p, n, state, false));
  const substitutions = [];
  for (const out of starters) {
    if (out.status !== 'sv') continue; // cambi senza limite, solo nello stesso ruolo: il modulo non cambia
    const inn = bench.find(b => b.role === out.role && b.status === 'voted' && !b.enteredFor);
    if (inn) { inn.enteredFor = out.name; out.replacedBy = inn.name; substitutions.push({ out: out.id, in: inn.id }); }
  }
  const counted = [...starters.filter(p => p.vote != null), ...bench.filter(p => p.enteredFor)];
  const unfinished = [...starters, ...bench].some(p => p.status === 'to-play' || p.status === 'playing');
  const fantapoints = sum(counted.map(p => p.fantavote));
  const mod = modifier(formation, counted, unfinished);
  const total = fantapoints + mod.bonus;
  const savedAt = visible.savedAt || new Date(Date.now() - (visible.savedHoursAgo ?? 30) * 3600000).toISOString();
  // Prima del calcio d'inizio non c'è nessun punteggio, nemmeno 0.
  const started = [...starters, ...bench].some(p => p.status !== 'to-play');
  return { team: team(teamId), formation, savedAt, starters, bench, substitutions, fantapoints: started ? fantapoints : null, modifier: mod, total: started ? total : null, goals: started ? goalsFrom(total) : null, withVote: counted.length };
}

// Una formazione salvata è visibile a tutti subito. Nei dati finti Quasi United non ha ancora schierato.
const NOT_SAVED = ['united'];
function visibility(teamId, n, state) {
  if (n < CURRENT_ROUND || state === 'in-corso' || state === 'calcolata') return { show: true };
  if (teamId === MY_TEAM && state === 'da-schierare') return { show: false, reason: 'Non hai ancora schierato la formazione.' };
  if (NOT_SAVED.includes(teamId)) return { show: false, reason: 'Non ha ancora schierato la formazione.' };
  return { show: true, savedHoursAgo: 1 + hash('salvata:' + teamId) % 20 };
}

export function matchupFor(n, id, state,saved=SAVED) {
  const pair = schedule(n).find(([h, a]) => `${n}-${h}-${a}` === id) || schedule(n)[0];
  const rs = roundState(n, state);
  const [home, away] = pair.map(t => ({ ...teamSheet(t, n, rs, visibility(t, n, rs),saved), ...(t === MY_TEAM && rs === 'da-schierare' ? { needsLineup: true } : {}) }));
  return { id: `${n}-${pair[0]}-${pair[1]}`, round: n, state: rs, official: rs === 'calcolata', home, away };
}

export function roundFor(n, state,saved=SAVED) {
  const number = Math.min(Math.max(1, n || CURRENT_ROUND), CURRENT_ROUND+3), rs=number>CURRENT_ROUND?'da-schierare':roundState(number,state);
  const matchups = schedule(number).map(([h, a]) => {
    const notStarted = rs === 'da-schierare' || rs === 'schierata';
    const m = matchupFor(number, `${number}-${h}-${a}`, rs,saved), side = s => ({ team: s.team, lineupSaved: !s.hidden, points: s.hidden || notStarted ? null : s.total, goals: s.hidden || notStarted ? null : s.goals });
    return { id: m.id, home: side(m.home), away: side(m.away), isMine: h === MY_TEAM || a === MY_TEAM };
  });
  return {
    round: { number, state: rs, official: rs === 'calcolata', updatedAt: new Date().toISOString(), matchesDone: rs === 'in-corso' ? 4 : rs === 'calcolata' ? 10 : 0, matchesTotal: 10 },
    rounds: Array.from({ length: CURRENT_ROUND+3 }, (_, i) => ({ number: i + 1, state:i+1>CURRENT_ROUND?'da-schierare':roundState(i+1,state) })),
    matchups: matchups.sort((x, y) => y.isMine - x.isMine),
  };
}
