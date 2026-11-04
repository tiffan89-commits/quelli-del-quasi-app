// Maglie di casa dei club di Serie A disegnate con i soli colori sociali (niente stemmi o sponsor).
// pattern: solid | stripes (strisce verticali, `w` = larghezza in px su 40) | halves (metà e metà) | cross (croce, Parma).
// trim = colletto e bordi maniche. code = sigla sul petto: distingue i club con gli stessi colori
// (Genoa/Cagliari/Bologna, Inter/Atalanta/Pisa, Juventus/Udinese, Napoli/Lazio, Roma/Torino, Como/Verona).
import { esc } from './formato.mjs';

export const KITS = {
  Inter: { code: 'INT', pattern: 'stripes', w: 3, a: '#0d47a1', b: '#111111', trim: '#111111' },
  Juventus: { code: 'JUV', pattern: 'stripes', w: 5, a: '#ffffff', b: '#111111', trim: '#111111' },
  Milan: { code: 'MIL', pattern: 'stripes', w: 4, a: '#c8102e', b: '#111111', trim: '#111111' },
  Napoli: { code: 'NAP', pattern: 'solid', a: '#1b9ad6', trim: '#0b3a6b' },
  Roma: { code: 'ROM', pattern: 'solid', a: '#8e1f2f', trim: '#f0bc42' },
  Lazio: { code: 'LAZ', pattern: 'solid', a: '#87d3f5', trim: '#ffffff' },
  Atalanta: { code: 'ATA', pattern: 'stripes', w: 6, a: '#1e71b8', b: '#111111', trim: '#111111' },
  Fiorentina: { code: 'FIO', pattern: 'solid', a: '#5b2b82', trim: '#ffffff' },
  Bologna: { code: 'BOL', pattern: 'stripes', w: 5, a: '#a21c26', b: '#1a2f48', trim: '#ffffff' },
  Torino: { code: 'TOR', pattern: 'solid', a: '#7b1e12', trim: '#ffffff' },
  Genoa: { code: 'GEN', pattern: 'halves', a: '#a51e36', b: '#0b2546', trim: '#0b2546' },
  Udinese: { code: 'UDI', pattern: 'stripes', w: 3, a: '#ffffff', b: '#111111', trim: '#111111' },
  Como: { code: 'COM', pattern: 'solid', a: '#1c3f8c', trim: '#ffffff' },
  Parma: { code: 'PAR', pattern: 'cross', a: '#ffffff', b: '#111111', trim: '#111111' },
  Cagliari: { code: 'CAG', pattern: 'halves', a: '#002350', b: '#a00f1e', trim: '#ffffff' },
  Lecce: { code: 'LEC', pattern: 'stripes', w: 5, a: '#f6d00c', b: '#d0102b', trim: '#d0102b' },
  Verona: { code: 'VER', pattern: 'solid', a: '#1a2c63', trim: '#f5d20a' },
  Sassuolo: { code: 'SAS', pattern: 'stripes', w: 4, a: '#00a752', b: '#111111', trim: '#111111' },
  Frosinone: { code: 'FRO', pattern: 'solid', a: '#ffd100', trim: '#1a3b8b' },
  Venezia: { code: 'VEN', pattern: 'solid', a: '#111111', trim: '#f37021' },
  Monza: { code: 'MON', pattern: 'solid', a: '#d0102b', trim: '#ffffff' },
  // Non in Serie A 2026/27 (secondo API-Football), tenute per le stagioni future.
  Cremonese: { code: 'CRE', pattern: 'stripes', w: 5, a: '#c8102e', b: '#9a9a9a', trim: '#9a9a9a' },
  Pisa: { code: 'PIS', pattern: 'stripes', w: 4, a: '#111111', b: '#1a5fb4', trim: '#1a5fb4' },
};
// Nomi dei club come li scrive API-Football.
const ALIASES = { 'AC Milan': 'Milan', 'AS Roma': 'Roma', 'Hellas Verona': 'Verona' };
const FALLBACK = { code: '', pattern: 'solid', a: '#5d6b62', trim: '#2b3c32' };

const BODY = 'M14 4 L8 6 L2 12 L6.5 18 L10 15.5 L10 37 L30 37 L30 15.5 L33.5 18 L38 12 L32 6 L26 4 Q20 9 14 4 Z';
let uid = 0;

export function shirt(club) {
  const k = KITS[ALIASES[club] || club] || FALLBACK, id = 'kit' + (++uid), label = k.code;
  let fill = '';
  if (k.pattern === 'stripes') {
    const w = k.w || 4, xs = [];
    for (let x = 20 - w / 2 - 2 * w; x > -2 * w; x -= 2 * w) xs.push(x);
    for (let x = 20 - w / 2; x < 40; x += 2 * w) xs.push(x);
    fill = xs.map(x => `<rect x="${x}" y="0" width="${w}" height="40" fill="${k.b}"/>`).join('');
  }
  else if (k.pattern === 'halves') fill = `<rect x="20" y="0" width="20" height="40" fill="${k.b}"/>`;
  else if (k.pattern === 'cross') fill = `<rect x="17.5" y="0" width="5" height="40" fill="${k.b}"/><rect x="0" y="16" width="40" height="5" fill="${k.b}"/>`;
  return `<svg class="fanta-shirt" viewBox="0 0 40 40" role="img" aria-label="Maglia ${esc(club)}">
    <defs><clipPath id="${id}"><path d="${BODY}"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="40" height="40" fill="${k.a}"/>${fill}</g>
    <path d="${BODY}" fill="none" stroke="#0007" stroke-width="1"/>
    <path d="M14 4 Q20 9 26 4" fill="none" stroke="${k.trim}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M2 12 L6.5 18 M38 12 L33.5 18" stroke="${k.trim}" stroke-width="2.4" stroke-linecap="round"/>
    ${label ? `<rect x="10.5" y="19" width="19" height="10" rx="2.5" fill="#0c1815" fill-opacity=".82"/>
    <text x="20" y="26.8" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="8.6" letter-spacing=".3" fill="#ffffff">${esc(label)}</text>` : ''}
  </svg>`;
}
