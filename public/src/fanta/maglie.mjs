// Maglie 2026/27 dei club di Serie A (casa e trasferta), disegnate dal nostro codice guardando le foto ufficiali:
// colori, righe, collo, bordini, inserti e trame come quelle vere, ma senza stemmi veri, marchi o sponsor.
// Al posto dello stemma c'è uno scudetto generico nel colore del club; la sigla distingue i club simili.
// La squadra che gioca fuori casa indossa la maglia da trasferta solo se la sua maglia di casa si confonde
// con quella dei padroni di casa (vedi clash).
//
// Campi di una maglia (tutti facoltativi tranne `a`), coordinate su 40×40, busto tra x 9 e 31:
//   a          colore di base
//   pattern    solid | stripes | halves | cross | panels | camo
//     stripes: b = colore delle righe, w = larghezza riga di base, bw = larghezza riga b, center = 'a'|'b' (cosa sta al centro)
//     halves:  b = metà destra (guardando la maglia) · cross: b, edge = [bordo1, bordo2], crossY = altezza del braccio
//     panels:  [[x, larghezza, colore]] bande verticali · camo: b = macchie
//   hoops      [[y, altezza, colore]] fasce orizzontali larghe tutta la maglia
//   band       [[y, altezza, colore]] fasce orizzontali solo sul busto (petto)
//   diag       [colore1, colore2] fascia diagonale sul petto · sash = colore della banda da spalla a fianco
//   yoke       { color, pix: [colori] } spalle di un altro colore, con quadretti se pix c'è
//   raglan     colore di spalle e maniche raglan · raglanEdge = filo lungo la cucitura
//   sleeves    colore delle maniche · sleevesLR = [sinistra, destra]
//   tex        pin | jacq | geo | tri | dash | marble · texColor (per pin e dash: [c1, c2])
//   collar     crew | polo | v ; neck = colore del collo, neck2 = bordino
//   cuffs      [colore, colore2?] · cuffsLR = [[sinistra...], [destra...]]
//   shoulder   { color, style: pipe | chevron } · sides = inserti sui fianchi · crest = scudetto
//   main       colore principale per riconoscere maglie simili (se diverso da `a`)
//   back       campi diversi sul retro (es. Juventus: righe solo in basso con stripesFrom; Parma: senza croce)
//   ink        colore del numero sul retro (di solito si sceglie da solo: scuro su maglie chiare, bianco su scure)
import { esc } from './formato.mjs';

export const KITS = {
  Inter: { code: 'INT',
    home: { a: '#2253d6', main: '#2253d6', pattern: 'stripes', b: '#141414', w: 3.6, bw: 3.6, center: 'b', collar: 'polo', neck: '#141414', neck2: '#2253d6', cuffs: ['#141414'], crest: '#c9a24a' },
    away: { a: '#f7f7f4', tex: 'pin', texColor: ['#1b2a5c'], collar: 'crew', neck: '#1b2a5c', cuffs: ['#1b2a5c'], crest: '#1b2a5c' } },
  Juventus: { code: 'JUV',
    home: { a: '#ffffff', pattern: 'stripes', b: '#141414', w: 4.2, bw: 3, center: 'a', collar: 'crew', neck: '#ffffff', neck2: '#c9a24a', cuffs: ['#141414'], crest: '#c9a24a', back: { stripesFrom: 28 } },
    away: { a: '#f2a7cb', collar: 'polo', neck: '#141414', cuffs: ['#141414'], crest: '#141414' } },
  Milan: { code: 'MIL',
    home: { a: '#d9141f', pattern: 'stripes', b: '#141414', w: 5.4, bw: 5.4, center: 'a', collar: 'crew', neck: '#141414', cuffs: ['#141414'], crest: '#f4f1e8' },
    away: { a: '#f7f7f4', tex: 'geo', collar: 'crew', neck: '#c8102e', cuffs: ['#c8102e', '#141414'], crest: '#c8102e' } },
  Napoli: { code: 'NAP',
    home: { a: '#5aa9e6', tex: 'geo', collar: 'polo', neck: '#4b97d4', cuffs: ['#4b97d4'], crest: '#f4f1e8' },
    away: { a: '#f7f7f4', tex: 'pin', texColor: ['#5aa9e6'], collar: 'v', neck: '#5aa9e6', cuffs: ['#5aa9e6'], crest: '#5aa9e6' } },
  Roma: { code: 'ROM',
    home: { a: '#a3202f', raglan: '#7d1d2a', raglanEdge: '#f2a51f', collar: 'v', neck: '#7d1d2a', neck2: '#f2a51f', cuffs: ['#7d1d2a', '#f2a51f'], crest: '#f2a51f' },
    away: { a: '#f3ebd6', band: [[13.5, 2.4, '#f2b51f'], [15.9, 3.4, '#b5202f'], [19.3, 1.2, '#f2b51f']], back: { band: null }, collar: 'v', neck: '#b5202f', neck2: '#f2b51f', cuffs: ['#f2b51f', '#b5202f'], crest: '#b5202f' } },
  Lazio: { code: 'LAZ',
    home: { a: '#8cc6ec', tex: 'geo', collar: 'polo', neck: '#ffffff', neck2: '#1b2f5c', cuffs: ['#ffffff'], crest: '#1b2f5c' },
    away: { a: '#f7f7f4', tex: 'dash', texColor: ['#8cc6ec', '#1b2f5c'], collar: 'v', neck: '#1b2f5c', cuffs: ['#1b2f5c'], crest: '#8cc6ec' } },
  Atalanta: { code: 'ATA',
    home: { a: '#141414', main: '#2f86e0', pattern: 'stripes', b: '#2f86e0', w: 3.2, bw: 3.2, center: 'a', tex: 'step', raglan: '#141414', collar: 'crew', neck: '#141414', cuffs: ['#2f86e0', '#9fd0ff'], crest: '#2f86e0' },
    away: { a: '#f7f7f4', yoke: { color: '#f7f7f4', pix: ['#2f86e0', '#141414', '#9fd0ff'] }, collar: 'crew', neck: '#141414', cuffs: ['#2f86e0'], crest: '#2f86e0' } },
  Fiorentina: { code: 'FIO',
    home: { a: '#6a2fb0', tex: 'geo', sides: '#ffffff', collar: 'v', neck: '#5a2597', neck2: '#ffffff', cuffs: ['#5a2597'], crest: '#ffffff' },
    away: { a: '#f7f7f4', tex: 'geo', collar: 'crew', neck: '#6a2fb0', cuffs: ['#6a2fb0'], crest: '#6a2fb0' } },
  Bologna: { code: 'BOL',
    home: { a: '#1d2650', main: '#1d2650', pattern: 'panels', panels: [[13.2, 4.6, '#c41e2e'], [22.2, 4.6, '#c41e2e']], sleeves: '#1d2650', collar: 'polo', neck: '#1d2650', neck2: '#c41e2e', cuffs: ['#1d2650', '#c41e2e'], crest: '#f4f1e8' },
    away: { a: '#f7f7f4', raglan: '#f7f7f4', raglanEdge: '#c41e2e', collar: 'polo', neck: '#c41e2e', neck2: '#1d2650', cuffs: ['#1d2650'], crest: '#c41e2e' } },
  Torino: { code: 'TOR',
    home: { a: '#7a1f24', tex: 'geo', collar: 'crew', neck: '#5e171b', cuffs: ['#5e171b'], crest: '#ffffff' },
    away: { a: '#f7f7f4', sash: '#7a1f24', collar: 'v', neck: '#7a1f24', cuffs: ['#7a1f24'], crest: '#7a1f24' } },
  Genoa: { code: 'GEN',
    home: { a: '#1c2a4a', main: '#1c2a4a', pattern: 'halves', b: '#c8102e', collar: 'polo', neck: '#1c2a4a', neck2: '#c8102e', cuffs: ['#1c2a4a', '#c8102e'], crest: '#f4f1e8' },
    away: { a: '#f3ede0', collar: 'v', neck: '#c8102e', neck2: '#1c2a4a', cuffsLR: [['#c8102e'], ['#1c2a4a']], crest: '#c8102e' } },
  Udinese: { code: 'UDI',
    home: { a: '#ffffff', pattern: 'stripes', b: '#141414', w: 4, bw: 3.6, center: 'a', collar: 'v', neck: '#141414', neck2: '#c9a24a', cuffs: ['#141414', '#c9a24a'], crest: '#c9a24a' },
    away: { a: '#2a58c0', tex: 'tri', collar: 'v', neck: '#1b2f5c', neck2: '#f6c811', cuffs: ['#1b2f5c', '#f6c811'], crest: '#f4f1e8' } },
  Como: { code: 'COM',
    home: { a: '#1d3a6b', tex: 'pin', shoulder: { color: '#ffffff', style: 'chevron' }, collar: 'polo', neck: '#1d3a6b', cuffs: ['#d12a4a', '#e8b04a'], crest: '#d12a4a' },
    away: { a: '#f7f7f4', tex: 'jacq', collar: 'crew', neck: '#1d3a6b', cuffs: ['#1d3a6b'], crest: '#1d3a6b' } },
  Parma: { code: 'PAR',
    home: { a: '#f2ecdc', pattern: 'cross', b: '#141414', edge: ['#f6c811', '#1f4f9a'], crossY: 13.6, back: { pattern: 'solid' }, sides: '#141414', collar: 'v', neck: '#141414', cuffs: ['#f6c811', '#1f4f9a'], crest: '#141414' },
    away: { a: '#f6d23a', hoops: [[15, 4.4, '#1f4f9a'], [28.5, 3.6, '#1f4f9a']], collar: 'crew', neck: '#1f4f9a', cuffs: ['#1f4f9a'], crest: '#1f4f9a' } },
  Cagliari: { code: 'CAG',
    home: { a: '#1f2d55', main: '#1f2d55', pattern: 'halves', b: '#b5202f', sleevesLR: ['#b5202f', '#1f2d55'], tex: 'geo', shoulder: { color: '#ffffff', style: 'pipe' }, collar: 'polo', neck: '#1f2d55', neck2: '#b5202f', cuffs: ['#1f2d55'], crest: '#ffffff' },
    away: { a: '#f7f7f4', sleeves: '#f7f7f4', hoopsSleeves: ['#1f2d55', '#b5202f'], collar: 'v', neck: '#1f2d55', neck2: '#b5202f', cuffs: ['#b5202f'], crest: '#b5202f' } },
  Lecce: { code: 'LEC',
    home: { a: '#f6d00c', pattern: 'stripes', b: '#d0102b', w: 4.2, bw: 3, center: 'a', collar: 'crew', neck: '#1b2550', cuffs: ['#1b2550'], crest: '#1b2550' },
    away: { a: '#f7f7f4', band: [[14, 1.6, '#f6c811'], [15.6, 2.6, '#d0102b'], [18.2, 1.6, '#f6c811']], back: { band: null }, collar: 'v', neck: '#f6c811', neck2: '#d0102b', cuffs: ['#f6c811', '#d0102b'], crest: '#d0102b' } },
  Sassuolo: { code: 'SAS',
    home: { a: '#17a24c', pattern: 'stripes', b: '#141414', w: 4.6, bw: 3, center: 'a', tex: 'marble', collar: 'crew', neck: '#141414', cuffs: ['#141414'], crest: '#f4f1e8' },
    away: { a: '#e8ece9', tex: 'marble', sides: '#17a24c', collar: 'crew', neck: '#17a24c', cuffs: ['#17a24c'], crest: '#141414' } },
  Frosinone: { code: 'FRO',
    home: { a: '#f2efa4', pattern: 'camo', b: '#e5d995', sides: '#3f7cc8', collar: 'crew', neck: '#3f7cc8', neck2: '#1d3f78', cuffs: ['#3f7cc8'], crest: '#3f7cc8' },
    away: { a: '#f8f4ec', collar: 'crew', neck: '#3f7cc8', neck2: '#f6d23a', cuffs: ['#f6d23a', '#3f7cc8'], crest: '#3f7cc8' } },
  Venezia: { code: 'VEN',
    home: { a: '#161616', tex: 'jacq', diag: ['#1d8a4e', '#f37021'], back: { diag: null, band: [[32, 2, '#1d8a4e'], [34, 2.4, '#f37021']] }, collar: 'polo', neck: '#161616', neck2: '#f37021', cuffs: ['#f37021', '#1d8a4e'], crest: '#f37021' },
    away: { a: '#f1ead8', yoke: { color: '#161616', flame: ['#f37021', '#1d8a4e'] }, sides: '#1d8a4e', collar: 'crew', neck: '#161616', cuffs: ['#161616'], crest: '#161616' } },
  Monza: { code: 'MON',
    home: { a: '#d0102b', collar: 'polo', neck: '#ffffff', cuffs: ['#ffffff'], crest: '#ffffff' },
    away: { a: '#f7f7f4', tex: 'geo', collar: 'polo', neck: '#d0102b', cuffs: ['#d0102b'], crest: '#d0102b' } },
  // Non in Serie A 2026/27 (secondo API-Football), tenute per le stagioni future: solo colori sociali.
  Verona: { code: 'VER', home: { a: '#1a2c63', collar: 'crew', neck: '#f5d20a', cuffs: ['#f5d20a'], crest: '#f5d20a' }, away: { a: '#f7f7f4', collar: 'crew', neck: '#1a2c63', cuffs: ['#f5d20a'], crest: '#1a2c63' } },
  Cremonese: { code: 'CRE', home: { a: '#c8102e', pattern: 'stripes', b: '#9a9a9a', w: 4, bw: 4, center: 'a', collar: 'crew', neck: '#9a9a9a', cuffs: ['#9a9a9a'], crest: '#f4f1e8' }, away: { a: '#f7f7f4', collar: 'crew', neck: '#c8102e', cuffs: ['#c8102e'], crest: '#c8102e' } },
  Pisa: { code: 'PIS', home: { a: '#141414', pattern: 'stripes', b: '#1a5fb4', w: 4, bw: 4, center: 'a', collar: 'crew', neck: '#1a5fb4', cuffs: ['#1a5fb4'], crest: '#f4f1e8' }, away: { a: '#f7f7f4', collar: 'crew', neck: '#1a5fb4', cuffs: ['#1a5fb4'], crest: '#1a5fb4' } },
};
// Nomi dei club come li scrive API-Football.
const ALIASES = { 'AC Milan': 'Milan', 'AS Roma': 'Roma', 'Hellas Verona': 'Verona', 'Frosinone Calcio': 'Frosinone', 'Internazionale':'Inter', 'Inter Milan':'Inter', 'SSC Napoli':'Napoli', 'SS Lazio':'Lazio' };
const FALLBACK = { code: '', home: { a: '#5d6b62', collar: 'crew', neck: '#2b3c32', cuffs: ['#2b3c32'] } };
const clubKey = name => String(name??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clubs = new Map([
  ...Object.entries(KITS).flatMap(([name,kit])=>[[clubKey(name),kit],[clubKey(kit.code),kit]]),
  ...Object.entries(ALIASES).map(([name,club])=>[clubKey(name),KITS[club]]),
]);
const clubOf = club => clubs.get(clubKey(club)) || FALLBACK;
export function sameClub(a,b){
  const first=clubKey(a),second=clubKey(b);
  return !!first&&!!second&&(first===second||clubs.has(first)&&clubs.get(first)===clubs.get(second));
}

// ---------- Maglie simili: chi gioca fuori casa cambia maglia ----------
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const dist = (x, y) => { const [r1, g1, b1] = rgb(x), [r2, g2, b2] = rgb(y); return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2); };
// I due colori che si vedono di più: il principale e l'altro (righe, metà, bande; o la base se il principale sono le righe).
function colorsOf(k) {
  const main = k.main || k.a;
  const other = main !== k.a ? k.a : ['stripes', 'halves', 'panels', 'cross'].includes(k.pattern) ? k.b || k.panels?.[0][2] : null;
  return [main, other];
}
// Si confondono se il colore principale è vicino (Napoli e Lazio), oppure se sono abbastanza vicini
// sia il principale sia l'altro colore (Inter e Atalanta, entrambe nerazzurre).
export function clash(clubA, clubB) {
  const a=clubOf(clubA),b=clubOf(clubB);
  if(a===FALLBACK||b===FALLBACK)return false;
  const [mx, ox] = colorsOf(a.home), [my, oy] = colorsOf(b.home), d = dist(mx, my);
  return d < 100 || (d < 130 && ox && oy && dist(ox, oy) < 90);
}

// ---------- Disegno ----------
const BODY = 'M15 3.4 Q20 6.2 25 3.4 L32.6 5.4 Q36.2 6.9 37.6 10 L39.3 16.4 L33.6 18.1 L31 14.6 L31 37.4 Q20 38.7 9 37.4 L9 14.6 L6.4 18.1 L0.7 16.4 L2.4 10 Q3.8 6.9 7.4 5.4 Z';
const SLEEVE = 'M7.4 5.4 Q3.8 6.9 2.4 10 L0.7 16.4 L6.4 18.1 L9 14.6 L10.2 6.6 Z';         // manica sinistra
const RAGLAN = 'M15 3.4 L7.4 5.4 Q3.8 6.9 2.4 10 L0.7 16.4 L6.4 18.1 L9 14.6 Z';           // spalla + manica raglan
const CUFF = 'M1.15 14.7 L7.55 16.5 L6.4 18.1 L0.7 16.4 Z';
const MIRROR = 'translate(40 0) scale(-1 1)';
const both = svg => `${svg}<g transform="${MIRROR}">${svg}</g>`;
const right = svg => `<g transform="${MIRROR}">${svg}</g>`;
let uid = 0;

function patternOf(k) {
  const col = (x, w, fill) => `<rect x="${x}" y="0" width="${w}" height="40" fill="${fill}"/>`;
  if (k.pattern === 'stripes') {
    const w = k.w || 4, bw = k.bw || w, p = w + bw, xs = [];
    if (k.center === 'b') for (let n = -6; n <= 6; n++) xs.push(20 - bw / 2 + n * p);
    else for (let n = 0; n < 6; n++) xs.push(20 + w / 2 + n * p, 20 - w / 2 - bw - n * p);
    const y0 = k.stripesFrom || 0; // sul retro alcune maglie hanno le righe solo in basso
    return xs.map(x => `<rect x="${x}" y="${y0}" width="${bw}" height="${40 - y0}" fill="${k.b}"/>`).join('');
  }
  if (k.pattern === 'halves') return col(20, 20, k.b);
  if (k.pattern === 'panels') return k.panels.map(([x, w, c]) => col(x, w, c)).join('');
  if (k.pattern === 'cross') {
    const [e1, e2] = k.edge || [k.b, k.b], y = k.crossY ?? 15.2;
    return [[7.6, e2], [6.2, e1], [4.8, k.b]].map(([t, c]) => `<rect x="${20 - t / 2}" y="5" width="${t}" height="35" fill="${c}"/><rect x="9" y="${y + (7.6 - t) / 2}" width="22" height="${t}" fill="${c}"/>`).join('');
  }
  if (k.pattern === 'camo') {
    const spots = ['M11 9l4-1 2 2-3 2z', 'M21 12l5-2 3 1-2 3-5 0z', 'M12 19l3-1 4 2-1 3-4-1z', 'M24 21l4-2 2 3-3 2z', 'M15 28l5-1 1 3-4 1z', 'M25 30l3-1 2 3-4 1z', 'M10 32l3 0 1 3-3 0z', 'M17 14l2 0 1 2-2 1z', 'M27 15l2-1 1 2-2 0z', 'M19 33l3-1 1 2-3 1z', 'M3 11l3-1 1 3-3 1z', 'M33 11l3 0 0 3-2 0z'];
    return `<path d="${spots.join('')}" fill="${k.b}"/>`;
  }
  return '';
}

function textureOf(k) {
  const lines = (n, x0, step, f) => Array.from({ length: n }, (_, i) => f(x0 + i * step)).join('');
  const [c1 = '#000', c2] = k.texColor || [];
  switch (k.tex) {
    case 'pin': return `<path d="${lines(13, 1.5, 3, x => `M${x} 0V40`)}" stroke="${c1}" stroke-opacity="${k.texColor ? .55 : .2}" stroke-width=".3"/>`;
    case 'jacq': return `<path d="${lines(10, 2, 4, x => `M${x} 0V40`)}" stroke="#fff" stroke-opacity=".09" stroke-width="1.5"/>`;
    case 'geo': return `<path d="${lines(9, -12, 7, x => `M${x} 40L${x + 20} 0M${x} 0L${x + 20} 40`)}" stroke="#000" stroke-opacity=".07" stroke-width=".45"/>`;
    case 'tri': return `<path d="${lines(7, 1, 6, x => lines(7, 2, 6, y => `M${x} ${y}l3 4.5h-6z`))}" fill="#000" fill-opacity=".14"/>`;
    case 'step': return `<path d="${lines(12, 2, 3.2, y => `M9 ${y}h22`)}" stroke="#000" stroke-opacity=".22" stroke-width=".35" stroke-dasharray="1.6 1.6"/>`;
    case 'dash': return `<path d="${lines(8, -6, 5, x => `M${x} 34l4-7M${x + 3} 22l3-5M${x + 1} 14l3-5`)}" stroke="${c1}" stroke-width=".7" stroke-linecap="round"/>${c2 ? `<path d="${lines(6, -2, 7, x => `M${x} 28l3-5M${x + 2} 19l2-4`)}" stroke="${c2}" stroke-width=".5" stroke-linecap="round"/>` : ''}`;
    case 'marble': return `<path d="M10 8q4 3 8 0t9 2M9 16q5 4 10 0t12 1M10 25q6-3 11 1t10-2M9 33q5 3 9 0t13 1M4 12q2 2 4 0M32 12q2 2 4 0" fill="none" stroke="#000" stroke-opacity=".13" stroke-width=".8"/>`;
    default: return '';
  }
}

function extrasOf(k) {
  let s = '';
  if (k.hoops) s += k.hoops.map(([y, h, c]) => `<rect x="0" y="${y}" width="40" height="${h}" fill="${c}"/>`).join('');
  if (k.band) s += k.band.map(([y, h, c]) => `<rect x="9" y="${y}" width="22" height="${h}" fill="${c}"/>`).join('');
  if (k.diag) s += `<path d="M9 18.6 L31 13.4 V17.6 L9 22.8Z" fill="${k.diag[0]}"/><path d="M9 22.8 L31 17.6 V21.6 L9 26.8Z" fill="${k.diag[1]}"/>`;
  if (k.sash) s += `<path d="M24.5 4 L31 6.2 L31 9 L14 38 L8 38 L8 35.4Z" fill="${k.sash}" fill-opacity=".92"/>`;
  if (k.yoke) {
    const y = k.yoke;
    s += `<path d="M0 0H40V11.5Q20 9.6 0 11.5Z" fill="${y.color}"/>`;
    if (y.pix) s += [...Array(14).keys()].map(i => `<rect x="${1 + i * 2.8}" y="${8 + (i % 3)}" width="2.6" height="2.6" fill="${y.pix[i % y.pix.length]}"/><rect x="${2.4 + i * 2.8}" y="${5 + ((i + 1) % 3)}" width="2.2" height="2.2" fill="${y.pix[(i + 1) % y.pix.length]}"/>`).join('');
    if (y.flame) s += both(`<path d="M2 11 Q7 6 13 7 Q9 9 8 12Z" fill="${y.flame[0]}"/><path d="M8 12 Q11 8 16 8 Q12 10 12 12.2Z" fill="${y.flame[1]}"/>`);
  }
  return s;
}

function sleevesOf(k) {
  let s = '';
  if (k.raglan) s += both(`<path d="${RAGLAN}" fill="${k.raglan}"/>`);
  if (k.sleeves) s += both(`<path d="${SLEEVE}" fill="${k.sleeves}"/>`);
  if (k.sleevesLR) s += `<path d="${SLEEVE}" fill="${k.sleevesLR[0]}"/>${right(`<path d="${SLEEVE}" fill="${k.sleevesLR[1]}"/>`)}`;
  if (k.hoopsSleeves) s += both(`<path d="M2.1 11.6 L8.6 13.6 L8.4 15.2 L1.7 13.3Z" fill="${k.hoopsSleeves[0]}"/><path d="M1.7 13.3 L8.4 15.2 L8.2 16.2 L1.45 14.3Z" fill="${k.hoopsSleeves[1]}"/>`);
  if (k.raglanEdge) s += both(`<path d="M15 3.7 L9.2 14.4" stroke="${k.raglanEdge}" stroke-width=".7"/>`);
  return s;
}

function shoulderOf(k) {
  const s = k.shoulder;
  if (!s) return '';
  if (s.style === 'pipe') return both(`<path d="M14.6 4.6 L7.6 6.6 Q4.6 8 3.4 10.6" fill="none" stroke="${s.color}" stroke-width=".9" stroke-linecap="round"/>`);
  if (s.style === 'chevron') return both(`<path d="M14 5.2l-1.4 1.6-1.4-1.1-1.4 1.6-1.4-1.1-1.4 1.6-1.4-1.1-1.3 1.6" fill="none" stroke="${s.color}" stroke-width=".95" stroke-linejoin="round"/>`);
  return '';
}

function collarOf(k) {
  const n = k.neck || '#141414', n2 = k.neck2;
  if (k.collar === 'polo') {
    const flap = `<path d="M15 3.3 L13.4 6.3 L18.7 8.8 L20 6.8 Z" fill="${n}" stroke="#0005" stroke-width=".3"/>${n2 ? `<path d="M13.9 6.1 L18.6 8.3" stroke="${n2}" stroke-width=".55"/>` : ''}`;
    return `<path d="M15 3.4 Q20 6.2 25 3.4 Q20 5.2 15 3.4Z" fill="${n}"/><path d="M20 6.8V11.6" stroke="#0005" stroke-width=".4"/><circle cx="20" cy="9.6" r=".45" fill="#0006"/>${both(flap)}`;
  }
  if (k.collar === 'v') return `<path d="M15 3.4 L20 9.4 L25 3.4 L23.4 3.8 L20 7.6 L16.6 3.8 Z" fill="${n}"/>${n2 ? `<path d="M16.6 3.8 L20 7.6 L23.4 3.8" fill="none" stroke="${n2}" stroke-width=".5"/>` : ''}`;
  return `<path d="M15 3.4 Q20 8 25 3.4 L23.7 3.7 Q20 6.6 16.3 3.7 Z" fill="${n}"/>${n2 ? `<path d="M16.3 3.75 Q20 6.6 23.7 3.75" fill="none" stroke="${n2}" stroke-width=".5"/>` : ''}`;
}

function cuffsOf(k) {
  const one = ([c1, c2] = []) => c1 ? `<path d="${CUFF}" fill="${c1}"/>${c2 ? `<path d="M1.05 15.15 L7.25 16.95" stroke="${c2}" stroke-width=".6"/>` : ''}` : '';
  return k.cuffsLR ? one(k.cuffsLR[0]) + right(one(k.cuffsLR[1])) : both(one(k.cuffs));
}

const lum = h => { const [r, g, b] = rgb(h); return 0.3 * r + 0.59 * g + 0.11 * b; };

// Maglie su cui cognome e numero non si leggerebbero: dietro le scritte va un pannello scuro, come sulle divise vere.
const BUSY = ['stripes', 'halves', 'cross', 'panels', 'camo'];

// Retro: stessa maglia vista da dietro (metà, maniche e bande diagonali specchiate), girocollo basso, niente scudetto.
// Con il cognome (figurine delle formazioni): cognome in alto e numero grande. Senza: solo il numero, o la sigla se manca.
export function shirtSurname(surname, {nameSize = 0, wideName = false, ink = '#fff', edge = '#0c1815'} = {}) {
  const name = String(surname || '').toUpperCase();
  const size = wideName ? 6.4 : nameSize || (name.length > 9 ? 3 : name.length > 6 ? 3.6 : 4.2);
  const fit = wideName ? (name.length >= 9 ? 28 : name.length >= 7 ? 25 : 0) : (name.length * size * 0.58 > 24 ? 24 : 0);
  return `<text x="20" y="${wideName ? 13.3 : 13.6}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="${size}" letter-spacing="${wideName ? '0' : '.25'}" fill="${wideName ? '#fff' : ink}" stroke="${wideName ? '#0c1815' : edge}" stroke-width="${wideName ? '1.15' : '.9'}" paint-order="stroke"${fit ? ` textLength="${fit}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(name)}</text>`;
}

function backOf(k, number, code, club, surname = '', nameSize = 0, wideName = false) {
  const id = 'kit' + (++uid), n = number == null ? '' : String(number).slice(0, 2), s = String(surname || '');
  const busy = BUSY.includes(k.pattern) && (n || s);
  const ink = busy ? '#ffffff' : k.ink || (lum(k.main || k.a) > 150 ? '#141414' : '#ffffff'), edge = ink === '#ffffff' ? '#0c1815' : '#ffffff';
  const label = s
    ? `${shirtSurname(s, { nameSize, wideName, ink, edge })}
    <text x="20" y="31.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" fill="${ink}" stroke="${edge}" stroke-width="1.4" paint-order="stroke">${esc(n)}</text>`
    : n ? `<text x="20" y="29.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" fill="${ink}" stroke="${edge}" stroke-width="1.1" paint-order="stroke">${esc(n)}</text>`
    : code ? `<rect x="11.6" y="19" width="16.8" height="8.6" rx="2.2" fill="#0c1815" fill-opacity=".8"/><text x="20" y="25.6" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="7.6" fill="#ffffff">${esc(code)}</text>` : '';
  const panel = busy ? `<rect x="10.6" y="${s ? 8.2 : 15.5}" width="18.8" height="${s ? 26 : 17}" rx="2.5" fill="#0c1815" fill-opacity=".8"/>` : '';
  const aria = s ? `${esc(surname)}, numero ${esc(n)}` : `Maglia ${esc(club)} da dietro${n ? ', numero ' + esc(n) : ''}`;
  return `<svg class="fanta-shirt fanta-shirt-back is-back" viewBox="0 0 40 40" role="img" aria-label="${aria}">
    <defs><clipPath id="${id}"><path d="${BODY}"/></clipPath></defs>
    <g clip-path="url(#${id})">
      <rect width="40" height="40" fill="${k.a}"/>
      <g transform="${MIRROR}">${patternOf(k)}${textureOf(k)}${extrasOf(k)}${sleevesOf(k)}${shoulderOf(k)}${cuffsOf(k)}</g>
      ${k.sides ? `<path d="M9 16.5h1.6V38.5H9zM29.4 16.5H31V38.5h-1.6z" fill="${k.sides}"/>` : ''}
      <rect x="9" y="14" width="1.6" height="26" fill="#000" fill-opacity=".1"/><rect x="29.4" y="14" width="1.6" height="26" fill="#000" fill-opacity=".1"/>${panel}
    </g>
    <path d="M15 3.4 Q20 5.4 25 3.4 L24 3.3 Q20 4.5 16 3.3Z" fill="${k.neck || '#141414'}"/>
    <path d="${BODY}" fill="none" stroke="#0007" stroke-width=".8" stroke-linejoin="round"/>
    ${label}
  </svg>`;
}

// shirt(club) = maglia di casa vista davanti. Opzioni:
//   code: false  → senza sigla (immagini grandi)
//   kit: 'away'  → maglia da trasferta
//   vs, home     → maglia della partita: chi gioca fuori (home === false) usa la trasferta se si confonde con l'avversario
//   back: true   → vista da dietro, con `number` (numero di maglia) e, per le figurine, `surname` e `nameSize`
export function shirt(club, { code = true, kit, vs, home, back = false, number, surname, nameSize, wideName } = {}) {
  const c = clubOf(club), useAway = kit === 'away' || (kit == null && home === false && vs && c.away && clash(club, vs));
  const front = (useAway && c.away) || c.home;
  if (back) return backOf({ ...front, ...(front.back || {}) }, number, code && c.code, club, surname, nameSize, wideName);
  const k = front, id = 'kit' + (++uid), label = code && c.code;
  const sides = k.sides ? `<path d="M9 16.5h1.6V38.5H9zM29.4 16.5H31V38.5h-1.6z" fill="${k.sides}"/>` : '';
  const crest = k.crest ? `<path d="M24.2 9.6h4.4v2.4q0 2.6-2.2 3.6q-2.2-1-2.2-3.6z" fill="${k.crest}" stroke="#0004" stroke-width=".35"/>` : '';
  return `<svg class="fanta-shirt" viewBox="0 0 40 40" role="img" aria-label="Maglia ${esc(club)}${useAway ? ' (trasferta)' : ''}">
    <defs><clipPath id="${id}"><path d="${BODY}"/></clipPath></defs>
    <g clip-path="url(#${id})">
      <rect width="40" height="40" fill="${k.a}"/>${patternOf(k)}${textureOf(k)}${extrasOf(k)}${sleevesOf(k)}${shoulderOf(k)}${sides}${cuffsOf(k)}
      <rect x="9" y="14" width="1.6" height="26" fill="#000" fill-opacity=".1"/><rect x="29.4" y="14" width="1.6" height="26" fill="#000" fill-opacity=".1"/>
      <path d="M9 35.6 Q20 36.9 31 35.6 V40 H9Z" fill="#000" fill-opacity=".08"/>
      ${k.raglan ? '' : both('<path d="M9 14.6 L10.2 6.6" stroke="#000" stroke-opacity=".14" stroke-width=".5"/>')}
    </g>
    ${collarOf(k)}${crest}
    <path d="${BODY}" fill="none" stroke="#0007" stroke-width=".8" stroke-linejoin="round"/>
    ${label ? `<rect x="11.6" y="21" width="16.8" height="8.6" rx="2.2" fill="#0c1815" fill-opacity=".8"/>
    <text x="20" y="27.6" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="7.6" letter-spacing=".3" fill="#ffffff">${esc(label)}</text>` : ''}
  </svg>`;
}
