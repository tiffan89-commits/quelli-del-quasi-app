// Premi indossabili del Quasi in stile avventura grafica anni '90: contorno scuro caldo, ombre piatte, riflessi.
// Coordinate nello spazio dell'avatar (280×350). Stessi motivi di prima: i premi già vinti restano validi.
export const INK = '#2a1d17';
const hex = c => /^#[0-9a-f]{6}$/i.test(c || '');
export function mix(a, b, t) {
  if (!hex(a)) return a;
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
}
export const dark = (c, t = .3) => mix(c, '#2c1a1e', t);
export const light = (c, t = .32) => mix(c, '#fff3d2', t);
export const lum = c => hex(c) ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [.3, .59, .11][i], 0) : 128;
// Forma piena senza bordo (ombre e riflessi).
export const flat = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra.includes(' stroke=')?extra:' stroke="none"'+extra}/>`;

export function hatArt(r) {
  if (!r) return '';
  const c = r.color, d = r.secondary || dark(c, .45), hi = light(c, .45), sh = dark(c);
  const gem = (x, y, f, s = 4) => `<path d="M${x} ${y - s}l${s} ${s}-${s} ${s}-${s}-${s}Z" fill="${f}" stroke-width="2"/>`;
  const leaf = (x, y, rot) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="4.2" transform="rotate(${rot} ${x} ${y})"/><ellipse cx="${280 - x}" cy="${y}" rx="9" ry="4.2" transform="rotate(${-rot} ${280 - x} ${y})"/>`;
  const shapes = [
    // 0 Corona del bancone
    `<path d="M100 64 94 26l22 16 24-26 24 26 22-16-6 38Z"/>${flat('M140 22 162 44 166 60H150Z', sh)}${flat('M100 34l12 10 2 14H102Z', hi)}<path d="M100 64 94 26l22 16 24-26 24 26 22-16-6 38Z" fill="none"/><path d="M97 54h86v14H97Z" fill="${d}"/>${gem(140, 61, '#c94f45')}${gem(118, 61, '#5d9bc7', 3)}${gem(162, 61, '#6db37a', 3)}<circle cx="94" cy="26" r="4" fill="${hi}" stroke-width="2.5"/><circle cx="140" cy="16" r="4" fill="${hi}" stroke-width="2.5"/><circle cx="186" cy="26" r="4" fill="${hi}" stroke-width="2.5"/>`,
    // 1 Alloro del quasi
    `<path d="M104 80Q100 48 134 38M176 80Q180 48 146 38" fill="none" stroke="${d}" stroke-width="4"/><g stroke-width="2.5">${leaf(105, 72, -70)}${leaf(107, 60, -55)}${leaf(113, 50, -38)}${leaf(122, 43, -20)}${leaf(132, 39, -5)}</g>${flat('M122 41q5-3 10-3', 'none', ` stroke="${hi}" stroke-width="2"`)}`,
    // 2 Berretto del mister
    `<path d="M100 64Q96 22 140 20q44 2 40 44Z"/>${flat('M150 22q30 8 30 42h-18q2-26-12-42Z', sh)}${flat('M108 50q2-20 22-26-14 12-14 28Z', hi)}<path d="M100 64Q96 22 140 20q44 2 40 44Z" fill="none"/><path d="M140 21v41M118 26q-6 18-6 36m50-36q6 18 6 36" fill="none" stroke-width="2"/><path d="M94 60q46-12 92 0 8 12-8 15-38-9-76 0-16-3-8-15Z" fill="${d}"/><circle cx="140" cy="20" r="5" fill="${d}" stroke-width="2.5"/>`,
    // 3 Visiera del recupero
    `<path d="M100 50q40-10 80 0v14q-40-9-80 0Z"/><path d="M96 60q44-12 88 0 12 20-44 22-56-2-44-22Z" fill="${d}"/>${flat('M106 66q34-8 68 0-34-3-68 0Z', light(d, .4))}`,
    // 4 Basco del tattico
    `<path d="M96 60q-12-30 36-37 56-5 56 24 0 12-16 14-36-10-68 4Z"/>${flat('M150 24q36 4 36 24-2 10-14 12 4-20-22-36Z', sh)}${flat('M104 44q8-14 26-18-14 8-18 20Z', hi)}<path d="M96 60q-12-30 36-37 56-5 56 24 0 12-16 14-36-10-68 4Z" fill="none"/><path d="M137 24l2-10" stroke-width="4"/><path d="M98 60q42-12 76 0" fill="none" stroke="${d}" stroke-width="5"/>`,
    // 5 Cappello da festa
    `<path d="M112 54 150-2l22 52q-30 12-60 4Z"/><path d="M125 35l30-9m-38 23 50-14m-27-21 13-4" fill="none" stroke="${d}" stroke-width="6"/>${flat('M150 2l18 46q-8 3-14 3Z', sh, ' opacity=".55"')}<path d="M112 54 150-2l22 52q-30 12-60 4Z" fill="none"/><circle cx="150" cy="-2" r="8" fill="#f3ead2"/><path d="M114 56q-8 30-6 44M170 52q10 30 8 46" fill="none" stroke-width="1.6"/>`,
    // 6 Fascia della curva
    `<path d="M100 70q40-12 80 0v13q-40-11-80 0Z"/><path d="M100 75q40-11 80 0" fill="none" stroke="${d}" stroke-width="4"/><path d="M178 72l24-8-4 15Zm0 6 20 12-15 5Z" fill="${d}"/>`,
    // 7 Cilindro del pronostico
    `<path d="M110 54 106 2q34-7 68 0l-4 52Z"/>${flat('M150 0q24 0 24 2l-4 52h-18Z', sh)}${flat('M112 8l4 40h6l-2-41Z', hi)}<path d="M110 54 106 2q34-7 68 0l-4 52Z" fill="none"/><path d="M108 36q32-5 64 0l-1 13q-31-5-62 0Z" fill="${d}"/><path d="M88 57q52-14 104 0 8 10-4 12-48-12-96 0-12-2-4-12Z" fill="${sh}"/><ellipse cx="140" cy="2" rx="34" ry="5" fill="${hi}" stroke-width="3"/>`,
    // 8 Diadema del derby
    `<path d="M104 64q36-14 72 0l-4-10-12-8-8 6-12-20-12 20-8-6-12 8Z"/>${flat('M140 34l10 17 8-6 10 7-26-6Z', sh)}${gem(140, 50, d, 6)}<circle cx="122" cy="55" r="3" fill="${hi}" stroke-width="2"/><circle cx="158" cy="55" r="3" fill="${hi}" stroke-width="2"/>`,
    // 9 Coppola del bar
    `<path d="M98 64q-6-32 42-35 46-2 44 25l12 12q-40-10-92 2Z"/>${flat('M150 30q32 0 34 24l10 10q-12-4-26-5 2-18-18-29Z', sh)}<path d="M98 64q-6-32 42-35 46-2 44 25l12 12q-40-10-92 2Z" fill="none"/><path d="M100 62q44-10 88-2 6 12-12 13-36-8-70 1-10-1-6-12Z" fill="${d}"/><path d="M112 42h2m10-6h2m14 2h2m14-4h2m12 6h2m-58 10h2m22-2h2m24 0h2" stroke="${d}" stroke-width="3"/>`,
    // 10 Corona del King del betting
    `<path d="M86 60 78 18l30 18 32-34 32 34 30-18-8 42Z"/>${flat('M140 6l30 32 22-12-6 34h-22Z', sh)}${flat('M86 26l16 10 4 18H90Z', hi)}<path d="M86 60 78 18l30 18 32-34 32 34 30-18-8 42Z" fill="none"/><path d="M88 52h104v16H88Z" fill="${d}"/>${flat('M92 56h96', 'none', ` stroke="${light(d, .35)}" stroke-width="2"`)}${gem(140, 42, '#c94f45', 8)}${gem(112, 60, '#5d9bc7', 4)}${gem(168, 60, '#6db37a', 4)}${gem(140, 60, '#c94f45', 4)}<circle cx="78" cy="18" r="5" fill="${hi}" stroke-width="2.5"/><circle cx="140" cy="2" r="6" fill="${hi}" stroke-width="2.5"/><circle cx="202" cy="18" r="5" fill="${hi}" stroke-width="2.5"/>`,
  ];
  return `<g fill="${c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${shapes[r.motif] || shapes[0]}</g>`;
}

// Portafortuna: tenuto accanto alla mano destra del Quasi.
export function charmArt(r) {
  if (!r) return '';
  const c = r.color, hi = light(c, .5), sh = dark(c), gold = '#d8b25a', cream = '#f3ead2';
  const shapes = [
    // 0 Cornetto anti-palo
    `<path d="M199 231q38 4 23 47-4-25-27-34Z"/>${flat('M213 238q12 14 9 40-3-14-9-22Z', sh)}${flat('M206 236q7 2 10 6', 'none', ` stroke="${hi}" stroke-width="3"`)}<path d="M199 231q38 4 23 47-4-25-27-34Z" fill="none"/><path d="M195 244q-6-8 4-13l7 3q-7 4-3 12Z" fill="${gold}"/>`,
    // 1 Quadrifoglio del recupero
    `<path d="M213 256q4 12 13 20" fill="none" stroke="#4f7d48" stroke-width="5"/><g stroke-width="3"><path d="M212 248q-22 2-20-12 2-12 18-2Z"/><path d="M212 248q-2-22 12-20 12 2 2 18Z"/><path d="M212 248q22-2 20 12-2 12-18 2Z"/><path d="M212 248q2 22-12 20-12-2-2-18Z"/></g>${flat('M199 232q4-2 8 2', 'none', ` stroke="${hi}" stroke-width="2.5"`)}<circle cx="212" cy="248" r="3" fill="${sh}" stroke="none"/>`,
    // 2 Pallone dei miracoli
    `<circle cx="212" cy="250" r="21" fill="${cream}"/>${flat('M222 233a21 21 0 0 1-10 38 21 21 0 0 0 10-38Z', '#c9bc98')}<path d="m212 240 9 7-3 11h-12l-3-11Z"/><path d="M212 240v-11m9 18 11-4m-14 15 7 9m-19-9-7 9m-3-15-11-4" fill="none" stroke-width="2.5"/><circle cx="212" cy="250" r="21" fill="none"/><path d="M199 240q4-6 10-8" fill="none" stroke="#fff" stroke-width="3"/>`,
    // 3 Tazzina del mister
    `<path d="M226 247q14-1 12 10-2 8-12 6" fill="none" stroke-width="5"/><path d="M226 247q14-1 12 10-2 8-12 6" fill="none" stroke="${c}" stroke-width="1.6"/><ellipse cx="210" cy="272" rx="24" ry="5" fill="${cream}"/><path d="M193 243h34v12q0 16-17 16t-17-16Z"/>${flat('M214 244h13v11q0 14-13 16 6-6 6-16Z', sh)}${flat('M197 247v9q0 6 3 9', 'none', ` stroke="${hi}" stroke-width="3"`)}<path d="M193 243h34v12q0 16-17 16t-17-16Z" fill="none"/><ellipse cx="210" cy="243" rx="17" ry="3.5" fill="#5b3a26"/><path d="M204 234q-6-6 0-12m10 12q-6-6 0-12" fill="none" stroke="#e8e2d0" stroke-width="2.5" opacity=".8"/>`,
    // 4 Ferro del pareggio
    `<path d="M193 230v22q0 26 20 26t20-26v-22h-12v22q0 14-8 14t-8-14v-22Z"/>${flat('M221 232h10v20q0 20-14 24 4-8 4-24Z', sh)}${flat('M196 234v18q0 10 4 16', 'none', ` stroke="${hi}" stroke-width="3"`)}<path d="M193 230v22q0 26 20 26t20-26v-22h-12v22q0 14-8 14t-8-14v-22Z" fill="none"/><g fill="${INK}" stroke="none"><circle cx="199" cy="240" r="1.8"/><circle cx="199" cy="252" r="1.8"/><circle cx="227" cy="240" r="1.8"/><circle cx="227" cy="252" r="1.8"/></g>`,
    // 5 Schedina benedetta
    `<path d="m196 225 38 6-7 49-38-6Z"/>${flat('m224 230 10 1-7 49-9-1Z', sh, ' opacity=".7"')}<path d="m196 225 38 6-7 49-38-6Z" fill="none"/><path d="m200 238 26 4m-27 5 26 4m-27 5 12 2" fill="none" stroke="#6f7f6c" stroke-width="2.5"/><path d="m203 265 5 6 12-13" fill="none" stroke="#b5483c" stroke-width="4"/>`,
    // 6 Fischietto del destino
    `<path d="M213 222 206 244" fill="none" stroke="#b5483c" stroke-width="4"/><path d="M197 244 230 242l3 13-14 1a14 14 0 1 1-22-12Z"/>${flat('M212 262q8-2 8-8l12 0-1-8 2 9-14 1q-2 6-7 6Z', sh)}${flat('M201 249q2-3 7-3', 'none', ` stroke="${hi}" stroke-width="3"`)}<path d="M197 244 230 242l3 13-14 1a14 14 0 1 1-22-12Z" fill="none"/><circle cx="207" cy="257" r="4" fill="${INK}" stroke="none"/>`,
    // 7 Moneta del novantesimo
    `<circle cx="212" cy="251" r="22"/>${flat('M224 233a22 22 0 0 1-12 40 22 22 0 0 0 12-40Z', sh)}<circle cx="212" cy="251" r="22" fill="none"/><circle cx="212" cy="251" r="15" fill="none" stroke="${sh}" stroke-width="2.5"/><path d="M212 241l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7Z" fill="${hi}" stroke-width="2"/><path d="M197 241q4-8 12-10" fill="none" stroke="#fff6dc" stroke-width="3"/>`,
    // 8 Scarpino della gloria
    `<path d="M198 230h17l4 21 18 9q4 13-6 14h-35l-1-14Z"/>${flat('M215 252l20 9q3 10-4 11h-14Z', sh)}<path d="M198 230h17l4 21 18 9q4 13-6 14h-35l-1-14Z" fill="none"/><path d="m202 240 12-2m-11 8 12-2" fill="none" stroke="${cream}" stroke-width="3"/><path d="M196 274h39" fill="none" stroke-width="5"/><path d="M200 278v4m10-4v4m12-4v4m10-4v4" fill="none" stroke-width="3"/>`,
    // 9 Matita del pronostico
    `<path d="m196 272 25-48 12 6-25 49Z"/>${flat('m227 227 6 3-25 49-6-3Z', sh)}<path d="m196 272 25-48 12 6-25 49Z" fill="none"/><path d="m196 272 12 7-15 9Z" fill="#e8c89a"/><path d="m193 284 4 2-5 3Z" fill="${INK}"/><path d="m221 224 4-8 12 6-4 8Z" fill="#e39aa8"/><path d="m219 228 12 6" fill="none" stroke="#b9b3a3" stroke-width="4"/>`,
  ];
  return `<g fill="${c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${shapes[r.motif] || shapes[0]}</g>`;
}

// Motivi della maglia: disegnati sopra il busto, già ritagliati sulla sagoma dal renderer.
export function outfitArt(r) {
  if (!r) return '';
  const c = r.secondary || '#eee7d0', cream = '#efe5c9';
  const checks = [];
  for (let y = 184, row = 0; y < 264; y += 12, row++) for (let x = 84 + (row % 2) * 12; x < 196; x += 24) checks.push(`M${x} ${y}h12v12h-12Z`);
  const paths = [
    `<path d="M84 254 176 178l22 16-92 74Z"/><path d="M90 250 180 184" fill="none" stroke="${light(c, .35)}" stroke-width="2.5"/>`,
    `<path d="M104 180h16v84h-16Zm56 0h16v84h-16Z"/>`,
    `<path d="M86 186q10-8 32-10l14 86H86Zm108 0q-10-8-32-10l-14 86h46Z"/><path d="M118 176l14 86m30-86-14 86" fill="none" stroke="${light(c, .3)}" stroke-width="2.5"/>`,
    `<path d="m140 202 7 15 17 2-12 11 3 17-15-8-15 8 3-17-12-11 17-2Z"/>`,
    `<path d="M80 200h120v12H80Zm0 24h120v12H80Zm0 24h120v12H80Z"/>`,
    `<path d="${checks.join('')}" opacity=".85"/>`,
    `<path d="m84 214 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12v12l-14 12-14-12-14 12-14-12-14 12-14-12-14 12-14-12-14 12Z"/>`,
    `<path d="M114 176q26 22 52 0 8 8 2 16-28 18-56 0-6-8 2-16Z"/><path d="M148 196l20-2 4 60-20 2Z"/><path d="M150 214l20-2m-18 20 20-2" fill="none" stroke="${cream}" stroke-width="6"/>`,
    `<path d="M106 180v84m12-84v84m12-84v84m20-84v84m12-84v84m12-84v84" fill="none" stroke="${c}" stroke-width="3"/>`,
    `<path d="M114 212h52v52h-52Z" fill="${cream}"/><path d="M114 212q-6-16 4-30m44 30q6-16-4-30" fill="none" stroke="${cream}" stroke-width="3"/><path d="M128 232h24v14h-24Z" fill="${c}"/>`,
  ];
  return `<g fill="${c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round">${paths[r.motif] || paths[0]}</g>`;
}
