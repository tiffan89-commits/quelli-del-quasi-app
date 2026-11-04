// Lega pilota: scelta della squadra da allenare (le altre le guida il computer) e spiegazione.
// Funzioni pure: risposta di GET /fanta-api/pilot/teams → HTML.
import { esc } from './formato.mjs';
import { shirt } from './maglie.mjs';

// Stemma generato: scudo nei due colori della squadra con il monogramma (niente marchi esistenti).
export function emblem(t, size = 48) {
  const [a, b] = t.colors, id = 'em-' + t.id;
  return `<svg class="fanta-emblem" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="Stemma ${esc(t.name)}">
    <defs><clipPath id="${id}"><path d="M20 2 L36 7 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V7 Z"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="40" height="40" fill="${a}"/><path d="M0 26 L40 14 V40 H0 Z" fill="${b}" opacity=".9"/></g>
    <path d="M20 2 L36 7 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V7 Z" fill="none" stroke="#0007" stroke-width="1.2"/>
    <text x="20" y="22" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="13" fill="#fff" stroke="#0006" stroke-width=".8" paint-order="stroke">${esc(t.monogram)}</text>
  </svg>`;
}

function teamCard(t) {
  const taken = t.coach.human;
  return `<li class="fanta-pl-team${taken ? ' is-taken' : ''}" style="--c1:${esc(t.colors[0])};--c2:${esc(t.colors[1])}">
    <div class="fanta-pl-head">${emblem(t)}
      <div><b>${esc(t.name)}</b><small>${t.position}° in classifica · ${t.points} punti</small></div></div>
    <ul class="fanta-pl-stars">${t.stars.map(p => `<li><span class="fanta-mini-shirt">${shirt(p.club)}</span><span class="fanta-role is-${p.role}">${p.role}</span>${esc(p.name)}<b>${p.value}</b></li>`).join('')}</ul>
    <div class="fanta-pl-foot">
      <span>${taken ? `Allenata da <b>${esc(t.coach.name)}</b>${t.coach.isAdmin ? ' (admin)' : ''}` : `Ora la guida <b>${esc(t.coach.name)}</b>`}</span>
      ${taken ? '' : `<button type="button" class="primary" data-pilot-pick="${esc(t.id)}">Allena questa squadra</button>`}
    </div>
  </li>`;
}

export function renderPilotPicker(p) {
  if (!p) return '<div class="fanta-loading" role="status">Carichiamo la lega pilota…</div>';
  const free = p.teams.filter(t => !t.coach.human);
  return `<div class="fanta-pilot">
    <header class="fanta-sq-head"><span class="eyebrow">${esc(p.league.name)} · ${esc(p.league.season)} · giornata ${p.league.round}</span>
      <h1>Scegli la tua squadra</h1>
      <p>Rose vere, voti veri, partite vere di Serie A. Le squadre senza allenatore le guida il computer: ogni giornata schiera la formazione in base a forma e disponibilità. Tu ne prendi una e la porti avanti da qui: <b>le formazioni che salvi restano davvero</b>.</p></header>
    <div class="fanta-pl-count"><strong>${p.coached}<small>/${p.league.maxTeams}</small></strong><span>squadre con un allenatore in carne e ossa · ${free.length} libere</span></div>
    ${free.length ? '<button type="button" class="secondary fanta-pl-random" data-pilot-pick="random">Scegli tu per me</button>' : ''}
    <ul class="fanta-pl-grid">${[...free, ...p.teams.filter(t => t.coach.human)].map(teamCard).join('')}</ul>
    <p class="fanta-note">Una squadra a testa. La rosa non si può cambiare: niente asta e niente mercato nella lega pilota.</p>
  </div>`;
}

export function renderPilotConfirm(p, teamId) {
  const random = teamId === 'random', t = !random && p?.teams.find(x => x.id === teamId);
  if (!random && !t) return '';
  return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div>
    <div class="fanta-confirm" role="alertdialog" aria-modal="true" aria-labelledby="fanta-confirm-title">
      ${t ? emblem(t, 64) : '<span class="fanta-pl-dice" aria-hidden="true">🎲</span>'}
      <h2 id="fanta-confirm-title">${t ? esc(t.name) : 'Una squadra a sorpresa'}</h2>
      <p>${t ? 'Sarà la tua squadra in questa lega. Non potrai cambiarla.' : 'Ti diamo una delle squadre libere. Non potrai cambiarla.'}</p>
      <div class="fanta-confirm-actions">
        <button type="button" class="secondary" data-action="close-sheet">Annulla</button>
        <button type="button" class="primary" data-pilot-claim="${esc(teamId)}">${t ? 'La alleno io' : 'Vai'}</button>
      </div>
    </div>`;
}

export function renderPilotInfo() {
  return `<div class="fanta-ps-head"><div><span class="eyebrow">Lega pilota</span><h2 id="fanta-sheet-title">Come funziona</h2></div>
      <button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>
    <div class="fanta-demo-info">
      <p>Stai giocando nella <b>lega pilota</b> del Fanta di Quelli del Quasi.</p>
      <ul>
        <li><b>È tutto vero</b>: giocatori, partite di Serie A, voti e classifica. <b>Le formazioni che salvi restano.</b></li>
        <li><b>Le squadre senza allenatore le guida il computer</b>, che ogni giornata schiera in base a forma e disponibilità. Se un amico entra, può prendere una di quelle squadre.</li>
        <li>Sei un partecipante: <b>la rosa non si cambia</b>, niente asta e niente mercato.</li>
        <li>Quando le 10 squadre hanno tutte un allenatore, si apre una nuova lega pilota.</li>
      </ul>
      <button type="button" class="primary" data-action="demo-ok">Ho capito</button>
    </div>`;
}
