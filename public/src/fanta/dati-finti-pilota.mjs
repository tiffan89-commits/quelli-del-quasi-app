// Dati finti della lega pilota (solo anteprima). Nell'app vera le 10 rose le genera il server dal listone
// vero (giocatori reali di API-Football); qui i nomi dei giocatori sono inventati, i club veri.
// Stessa forma che dovrà restituire GET /fanta-api/pilot/teams.

const CLUBS = ['Inter', 'Juventus', 'Milan', 'Napoli', 'AS Roma', 'Lazio', 'Atalanta', 'Fiorentina', 'Bologna', 'Torino', 'Genoa', 'Udinese', 'Como', 'Parma', 'Cagliari', 'Lecce', 'Monza', 'Sassuolo', 'Frosinone', 'Venezia'];
const SURNAMES = ['Rinaldi', 'Ferretti', 'Colombo', 'Marchetti', 'Galli', 'Bellini', 'Testa', 'Fabbri', 'Moretti', 'Barbieri', 'Lombardi', 'Rizzo', 'Pellegrini', 'Santoro', 'Gatti', 'Caruso', 'Ferrara', 'Monti', 'Leone', 'Valentini', 'Serra', 'Fontana', 'Conte', 'Vitale', 'Grasso', 'Sala', 'Neri', 'Bassi', 'Orlando', 'Ricci', 'Martini', 'Gentile', 'Longo', 'Cattaneo', 'Farina', 'Riva', 'Benedetti', 'Palumbo', 'Sartori', 'Messina', 'Donati', 'Silvestri', 'Guerra', 'Bianco', 'Parisi', 'Villa', 'Ruggiero', 'Mariani', 'Amato', 'Piras', 'Costa', 'Greco', 'Bruno', 'Esposito', 'Marino', 'Romano', 'De Luca', 'Mancuso', 'Giordano', 'Rossetti'];
const INITIALS = 'ABCDEFGLMNPRSTV';

// 10 squadre di fantasia, con colori e allenatore automatico.
const TEAMS = [
  ['tramonto', 'Tramonto Rossonero', '#c8102e', '#1b1b1b'], ['bocce', 'Bocciofila United', '#3a7bd5', '#f2c94c'],
  ['caffe', 'Caffè Corretto FC', '#6f4e37', '#f1e3c8'], ['nebbia', 'Nebbia Padana', '#9aa5b1', '#2c3e50'],
  ['panchina', 'Panchina d\'Oro', '#d4a017', '#0c1815'], ['tiro', 'Tiro a Giro', '#00a676', '#ffffff'],
  ['vespa', 'Vespa Sport', '#a3d9ff', '#0b3a6b'], ['spritz', 'Spritz & Contropiede', '#ff7f32', '#5b2b82'],
  ['lampione', 'Lampione Calcio', '#ffd166', '#264653'], ['ultimo', 'Ultimo Minuto', '#e63946', '#f1faee'],
];
const BOT_NAMES = ['Il Computer di Bordo', 'Il Navigatore', 'Mister Algoritmo', 'Il Tablet Tattico', 'Il Simulatore', 'Il Pilota Automatico', 'La Calcolatrice', 'Il Robot in Panchina', 'Il Server Stanco', 'L\'Assistente Virtuale'];
const ROLE = { P: 3, D: 8, C: 8, A: 6 };

function rng(seed) { let a = 0; for (const c of seed) a = (a * 31 + c.charCodeAt(0)) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Listone finto e rose "a serpentina" per ruolo, in ordine di valore: 10 rose equilibrate.
const POOL = (() => {
  const r = rng('pilota-listone'), used = new Set(), out = [];
  for (const [role, per] of Object.entries(ROLE)) for (let i = 0; i < per * 10; i++) {
    let name; do name = INITIALS[Math.floor(r() * INITIALS.length)] + '. ' + SURNAMES[Math.floor(r() * SURNAMES.length)]; while (used.has(name));
    used.add(name);
    const top = { P: 26, D: 32, C: 48, A: 95 }[role], u = r();
    out.push({ id: `pil-${role}${i}`, name, role, club: CLUBS[Math.floor(r() * CLUBS.length)], value: 1 + Math.round(top * u * u), fm: Math.round((5.6 + u * 2.2) * 100) / 100 });
  }
  return out;
})();

const ROSTERS = (() => {
  const rosters = TEAMS.map(() => []);
  for (const role of Object.keys(ROLE)) {
    const list = POOL.filter(p => p.role === role).sort((a, b) => b.value - a.value);
    list.forEach((p, i) => { const round = Math.floor(i / 10), k = i % 10; rosters[round % 2 ? 9 - k : k].push(p); });
  }
  return rosters;
})();

// Chi allena chi, nell'anteprima: Francesco ha già la sua squadra, altri due utenti pure.
const coaches = { tramonto: { user: 'frakwood', name: 'Francesco', isAdmin: true }, vespa: { user: 'ilprofeta', name: 'Il Profeta' }, caffe: { user: 'lavale', name: 'La Vale' } };
let mine = null;

function teamView(i) {
  const [id, name, color, color2] = TEAMS[i], roster = ROSTERS[i], c = coaches[id];
  return {
    id, name, colors: [color, color2], monogram: name.split(/\s+/).filter(w => /^[A-ZÀ-Ú]/.test(w)).slice(0, 2).map(w => w[0]).join(''),
    coach: c ? { name: c.name, human: true, isAdmin: !!c.isAdmin, isMe: c.user === mine?.user } : { name: BOT_NAMES[i], human: false },
    position: [3, 7, 1, 5, 9, 2, 8, 4, 10, 6][i], points: [16, 9, 22, 12, 5, 19, 7, 14, 3, 10][i],
    value: roster.reduce((t, p) => t + p.value, 0),
    // Il migliore per ruolo: si capisce subito com'è fatta la squadra.
    stars: ['P', 'D', 'C', 'A'].map(role => roster.filter(p => p.role === role).sort((a, b) => b.value - a.value)[0]).map(p => ({ name: p.name, role: p.role, club: p.club, value: p.value })),
    roster: roster.length,
  };
}

export function pilotTeamsFor(user, now = Date.now()) {
  const teams = TEAMS.map((_, i) => teamView(i));
  return {
    league: { id: 'pilota-1', name: 'Lega pilota 1', season: '2026/27', round: 11, maxTeams: 10 },
    coached: teams.filter(t => t.coach.human).length,
    mine: mine?.teamId || null,
    teams,
  };
}

export function claimPilotFake(user, { teamId, random }) {
  if (mine) throw Error('Hai già una squadra in questa lega');
  const free = TEAMS.map(t => t[0]).filter(id => !coaches[id]);
  if (!free.length) throw Error('Tutte le squadre hanno già un allenatore');
  const id = random ? free[Math.floor(Math.random() * free.length)] : teamId;
  if (coaches[id]) throw Error('Qualcuno ha appena preso questa squadra: scegline un\'altra');
  if (!TEAMS.some(t => t[0] === id)) throw Error('Squadra non trovata');
  coaches[id] = { user: user.username, name: user.name };
  mine = { user: user.username, teamId: id };
  return { league: 'pilota-1', team: teamView(TEAMS.findIndex(t => t[0] === id)) };
}
