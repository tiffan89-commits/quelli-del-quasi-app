// Maglie dei portieri e retro maglia per le figurine, nello stesso stile di maglie.mjs.
// Portiere: maniche lunghe, colore unico che non si confonde con i compagni, colletto e polsini
// nel colore principale del club, stessa sigla nel riquadro scuro.
import { esc } from './formato.mjs';
import { KITS } from './maglie.mjs';

// Colore della maglia del portiere per club (scelto per staccare dai colori sociali).
const GK = { giallo: '#f2c230', arancio: '#f28c28', lime: '#8cc63f', grafite: '#4b5563', acqua: '#2bb3a3', nero: '#1c1c1c', rosa: '#e86fa2' };
export const GOALKEEPER_KITS = {
  Inter: { a: GK.giallo, trim: '#0d47a1' },
  Juventus: { a: GK.arancio, trim: '#111111' },
  Milan: { a: GK.lime, trim: '#111111' },
  Napoli: { a: GK.grafite, trim: '#1b9ad6' },
  Roma: { a: GK.acqua, trim: '#8e1f2f' },
  Lazio: { a: GK.nero, trim: '#87d3f5' },
  Atalanta: { a: GK.arancio, trim: '#1e71b8' },
  Fiorentina: { a: GK.lime, trim: '#5b2b82' },
  Bologna: { a: GK.giallo, trim: '#1a2f48' },
  Torino: { a: GK.grafite, trim: '#7b1e12' },
  Genoa: { a: GK.lime, trim: '#0b2546' },
  Udinese: { a: GK.arancio, trim: '#111111' },
  Como: { a: GK.giallo, trim: '#1c3f8c' },
  Parma: { a: GK.acqua, trim: '#111111' },
  Cagliari: { a: GK.grafite, trim: '#a00f1e' },
  Lecce: { a: GK.acqua, trim: '#d0102b' },
  Verona: { a: GK.arancio, trim: '#1a2c63' },
  Sassuolo: { a: GK.rosa, trim: '#111111' },
  Frosinone: { a: GK.grafite, trim: '#1a3b8b' },
  Venezia: { a: GK.giallo, trim: '#111111' },
  Monza: { a: GK.acqua, trim: '#d0102b' },
  Cremonese: { a: GK.lime, trim: '#c8102e' },
  Pisa: { a: GK.arancio, trim: '#1a5fb4' },
};
const ALIASES = { 'AC Milan': 'Milan', 'AS Roma': 'Roma', 'Hellas Verona': 'Verona' };
const FALLBACK = { a: GK.grafite, trim: '#2b3c32' };

// Stessa sagoma di maglie.mjs, con le maniche lunghe.
const GK_BODY = 'M14 4 L8 6 L2 13 L2.5 28 L7.5 28 L10 18 L10 37 L30 37 L30 18 L32.5 28 L37.5 28 L38 13 L32 6 L26 4 Q20 9 14 4 Z';
let uid = 0;

export function goalkeeperShirt(club) {
  const name = ALIASES[club] || club, k = GOALKEEPER_KITS[name] || FALLBACK, code = KITS[name]?.code || '', id = 'gk' + (++uid);
  return `<svg class="fanta-shirt fanta-shirt-gk" viewBox="0 0 40 40" role="img" aria-label="Maglia portiere ${esc(club)}">
    <defs><clipPath id="${id}"><path d="${GK_BODY}"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="40" height="40" fill="${k.a}"/><rect x="0" y="9" width="40" height="2.2" fill="${k.trim}" fill-opacity=".55"/></g>
    <path d="${GK_BODY}" fill="none" stroke="#0007" stroke-width="1"/>
    <path d="M14 4 Q20 9 26 4" fill="none" stroke="${k.trim}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M2.6 26.6 L7.6 26.6 M32.4 26.6 L37.4 26.6" stroke="${k.trim}" stroke-width="2.4" stroke-linecap="round"/>
    ${code ? `<rect x="10.5" y="19" width="19" height="10" rx="2.5" fill="#0c1815" fill-opacity=".82"/>
    <text x="20" y="26.8" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="8.6" letter-spacing=".3" fill="#ffffff">${esc(code)}</text>` : ''}
  </svg>`;
}

// Retro della maglia per le figurine: cognome e numero grandi, niente sigla davanti.
// Sulle maglie a righe, metà o croce, cognome e numero stanno su un pannello scuro, come sulle divise vere.
const BACK = 'M14 4 L8 6 L2 12 L6.5 18 L10 15.5 L10 37 L30 37 L30 15.5 L33.5 18 L38 12 L32 6 L26 4 Q20 5.5 14 4 Z';
export function shirtBack(club, number, surname, { goalkeeper = false, nameSize = 0 } = {}) {
  const name = ALIASES[club] || club, k = KITS[name] || { pattern: 'solid', a: '#5d6b62', trim: '#2b3c32' };
  const gk = goalkeeper ? (GOALKEEPER_KITS[name] || FALLBACK) : null, body = gk ? GK_BODY.replace('Q20 9 14 4', 'Q20 5.5 14 4') : BACK, id = 'bk' + (++uid);
  let fill = '';
  if (!gk && k.pattern === 'stripes') {
    const w = k.w || 4, xs = [];
    for (let x = 20 - w / 2 - 2 * w; x > -2 * w; x -= 2 * w) xs.push(x);
    for (let x = 20 - w / 2; x < 40; x += 2 * w) xs.push(x);
    fill = xs.map(x => `<rect x="${x}" y="0" width="${w}" height="40" fill="${k.b}"/>`).join('');
  } else if (!gk && k.pattern === 'halves') fill = `<rect x="0" y="0" width="20" height="40" fill="${k.b}"/>`;
  else if (!gk && k.pattern === 'cross') fill = `<rect x="17.5" y="0" width="5" height="40" fill="${k.b}"/><rect x="0" y="16" width="40" height="5" fill="${k.b}"/>`;
  const base = gk ? gk.a : k.a, trim = gk ? gk.trim : k.trim, n = String(number ?? '').slice(0, 2), s = String(surname || '').toUpperCase().slice(0, 12);
  const size = nameSize || (s.length > 9 ? 3 : s.length > 6 ? 3.6 : 4.2);
  // Cognomi lunghi: stretti per stare tra le spalle (circa 24 unità su 40).
  const fit = s.length * size * 0.58 > 24 ? ' textLength="24" lengthAdjust="spacingAndGlyphs"' : '';
  return `<svg class="fanta-shirt fanta-shirt-back" viewBox="0 0 40 40" role="img" aria-label="${esc(surname)}, numero ${esc(n)}">
    <defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="40" height="40" fill="${base}"/>${fill}${fill ? `<rect x="10.6" y="8.2" width="18.8" height="26" rx="2.5" fill="#0c1815" fill-opacity=".8"/>` : ''}</g>
    <path d="${body}" fill="none" stroke="#0007" stroke-width="1"/>
    <path d="M14 4 Q20 5.5 26 4" fill="none" stroke="${trim}" stroke-width="2.2" stroke-linecap="round"/>
    ${gk ? `<path d="M2.6 26.6 L7.6 26.6 M32.4 26.6 L37.4 26.6" stroke="${trim}" stroke-width="2.4" stroke-linecap="round"/>` : `<path d="M2 12 L6.5 18 M38 12 L33.5 18" stroke="${trim}" stroke-width="2.4" stroke-linecap="round"/>`}
    <text x="20" y="13.6" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="${size}" letter-spacing=".25" fill="#ffffff" stroke="#0c1815" stroke-width=".9" paint-order="stroke"${fit}>${esc(s)}</text>
    <text x="20" y="31.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" fill="#ffffff" stroke="#0c1815" stroke-width="1.4" paint-order="stroke">${esc(n)}</text>
  </svg>`;
}
