import {goalkeeperShirt} from './maglie-portieri.mjs';
// Studio formazione: schermo intero come lo studio del Quasi.
// In alto il campo in orizzontale (portiere a sinistra, attacco a destra) e la panchina;
// sotto, i giocatori per ruolo da toccare. Ogni maglia porta un'iconcina: infortunato, squalificato
// o probabilità di giocare (dalle probabili formazioni, altrimenti stimata dai minuti).
import {presenceProbability} from './presence-probability.mjs';
import { esc, pts, countdown } from './formato.mjs';
import { shirt } from './maglie.mjs';
import { assign, unassign, benchRemove, quickAdd, missingOf, countsOf, byExpected, surname, nextLabel } from './squadra.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const TABS = [['tutti', 'Tutti'], ['P', 'Portieri'], ['D', 'Difensori'], ['C', 'Centrocampisti'], ['A', 'Attaccanti'], ['panchina', 'Panchina']];
const ROLE_SHORT = { P: 'P', D: 'D', C: 'C', A: 'A' };

// ---------- Logica del tocco (pura) ----------
// Con un posto selezionato sul campo: il giocatore toccato va lì (se il ruolo è giusto).
// Senza: libero → primo posto del suo ruolo o in panchina; in campo → esce; in panchina → esce dalla panchina.
export function studioTap(draft, roster, id, slot, benchMax) {
  const p = roster.find(x => x.id === id);
  if (!p) return draft;
  if (slot) return slot[0] === p.role ? assign(draft, slot, id) : draft;
  const at = Object.keys(draft.slots).find(s => draft.slots[s] === id);
  if (at) return unassign(draft, at);
  if (draft.bench.includes(id)) return benchRemove(draft, id);
  return quickAdd(draft, roster, id, benchMax) || draft;
}

// ---------- Iconcina sulla maglia ----------
export function playBadge(p) {
  const s = p.status?.type, note = p.status?.note ? ': ' + esc(p.status.note) : '';
  if (p.play?.source!=='official'&&s === 'injured') return `<i class="fs-badge is-inj" title="Infortunato${note}" aria-label="Infortunato">✚</i>`;
  if (p.play?.source!=='official'&&s === 'suspended') return `<i class="fs-badge is-sq" title="Squalificato${note}" aria-label="Squalificato"></i>`;
  const play=presenceProbability(p);if(!play)return '';
  const estimated=play.source!=='official',label=estimated?'Stimata':'Probabilità effettiva';
  return `<i class="fs-badge is-pct ${estimated?'is-estimated':'is-actual'}" title="${label}: ${play.pct}%" aria-label="${label}: ${play.pct}%">${play.pct}%</i>`;

}

// ---------- Pezzi ----------
function token(slot, p, selected) {
  const cls = `fs-token${selected ? ' is-selected' : ''}${p ? '' : ' is-empty'}`;
  if (!p) return `<button type="button" class="${cls}" data-st-slot="${slot}" data-drop="slot:${slot}" aria-label="Scegli ${ROLE_NAMES[slot[0]].toLowerCase()}">
    <span class="fs-ring">${ROLE_SHORT[slot[0]]}</span></button>`;
  return `<button type="button" class="${cls}" data-st-slot="${slot}" data-drop="slot:${slot}" data-drag-id="${esc(p.id)}" data-drag-from="slot:${slot}" title="${esc(p.name)}">
    <span class="fs-shirt">${p.role==='P'?goalkeeperShirt(p.club):shirt(p.club)}${playBadge(p)}</span><b>${esc(surname(p.name))}</b></button>`;
}

function pitch(d, byId, sel) {
  const cols = 'PDCA'.split('').map(role => `<div class="fs-col is-${role}">${Object.keys(d.slots).filter(s => s[0] === role)
    .map(s => token(s, byId.get(d.slots[s]), sel === s)).join('')}</div>`).join('');
  return `<div class="fs-pitch" aria-label="Campo, ${esc(d.formation)}: portiere a sinistra, attacco a destra"><div class="fs-lines" aria-hidden="true"><i></i></div>${cols}</div>`;
}

function benchStrip(d, byId, blocked) {
  const cells = d.bench.map((id, i) => {
    const p = byId.get(id);
    return `<button type="button" class="fs-bcell" data-st-player="${esc(id)}" data-drag-id="${esc(id)}" data-drag-from="bench" data-drag-axis="up" data-drop="bench:${i}" title="${esc(p.name)} · tocca per toglierlo"><span class="fs-shirt sm">${p.role==='P'?goalkeeperShirt(p.club):shirt(p.club)}${playBadge(p)}</span><b>${i + 1}. ${esc(surname(p.name))}</b></button>`;
  }).join('');
  return `<div class="fs-bench" data-drop="bench"><span class="fs-bench-label"><span>Panchina <b>${d.bench.length}</b></span><button type="button" class="fs-bench-clear" data-lineup="clear-bench" aria-label="Svuota panchina" ${blocked||!d.bench.length ? 'disabled' : ''}>Svuota</button></span>
    <div class="fs-bench-row">${cells || '<small>Vuota: tocca un giocatore libero qui sotto per mandarlo in panchina.</small>'}</div></div>`;
}

function tile(p, d) {
  const slot = Object.keys(d.slots).find(s => d.slots[s] === p.id), bi = d.bench.indexOf(p.id);
  const at = slot ? 'campo' : bi >= 0 ? 'panchina' : '', out = p.status?.type === 'injured' || p.status?.type === 'suspended';
  return `<button type="button" class="fs-tile${at ? ' is-' + at : ''}${out ? ' is-out' : ''}" data-st-player="${esc(p.id)}" data-drag-id="${esc(p.id)}" data-drag-from="${slot ? 'slot:'+slot : bi>=0 ? 'bench' : 'list'}" data-drag-axis="up">
    <span class="fs-shirt">${p.role==='P'?goalkeeperShirt(p.club):shirt(p.club)}${playBadge(p)}</span>
    <b>${esc(surname(p.name))}</b>
    <small>${esc(nextLabel(p.next))}</small>
    <span class="fs-tile-foot"><em class="fanta-role is-${p.role}">${p.role}</em><span>${p.stats.avgFanta == null ? '–' : pts(p.stats.avgFanta, 2)} <small>FM</small></span></span>
    ${at === 'campo' ? '<span class="fs-flag">in campo</span>' : at === 'panchina' ? `<span class="fs-flag is-bench">panchina ${bi + 1}</span>` : ''}
  </button>`;
}

function benchList(d, byId) {
  if (!d.bench.length) return '<p class="fs-empty">Panchina vuota. Tocca i giocatori liberi negli altri elenchi per aggiungerli, nell\'ordine in cui devono entrare.</p>';
  return `<ol class="fs-blist" data-st-list="panchina">${d.bench.map((id, i) => {
    const p = byId.get(id);
    return `<li data-drag-id="${esc(id)}" data-drag-from="bench" data-drag-axis="up" data-drop="bench:${i}"><span class="fs-bn">${i + 1}</span><span class="fs-shirt sm">${p.role==='P'?goalkeeperShirt(p.club):shirt(p.club)}${playBadge(p)}</span>
      <span class="fs-bname"><b>${esc(p.name)}</b><small>${p.role} · ${esc(nextLabel(p.next))}</small></span>
      <button type="button" data-no-drag data-bench-move="${esc(id)}" data-step="-1" ${i ? '' : 'disabled'} aria-label="Anticipa in panchina">←</button>
      <button type="button" data-no-drag data-bench-move="${esc(id)}" data-step="1" ${i < d.bench.length - 1 ? '' : 'disabled'} aria-label="Posticipa in panchina">→</button>
      <button type="button" data-no-drag data-bench-remove="${esc(id)}" aria-label="Togli dalla panchina">×</button></li>`;
  }).join('')}</ol>`;
}

// ---------- Studio ----------
export function renderStudio(sq, st, now = Date.now()) {
  const { data, draft: d } = sq, byId = new Map(data.roster.map(p => [p.id, p])), r = data.round;
  const sel = st.slot && d.slots[st.slot] !== undefined ? st.slot : null;
  const tab = sel ? sel[0] : st.role || 'tutti', counts = countsOf(d.formation), missing = missingOf(d);
  const filled = role => Object.keys(d.slots).filter(s => s[0] === role && d.slots[s]).length;
  const tabs = TABS.map(([k, label]) => {
    const n = k === 'panchina' ? d.bench.length : k === 'tutti' ? '' : `${filled(k)}/${counts[k]}`;
    return `<button type="button" class="fs-tab${tab === k ? ' is-active' : ''}" data-st-role="${k}" aria-pressed="${tab === k}">${label}${n !== '' ? ` <small>${n}</small>` : ''}</button>`;
  }).join('');
  const list = data.roster.filter(p => tab === 'tutti' || p.role === tab)
    .sort((a, b) => 'PDCA'.indexOf(a.role) - 'PDCA'.indexOf(b.role) || byExpected(a, b)); // per ruolo, poi chi gioca e rende di più
  const available=list.filter(p=>!Object.values(d.slots).includes(p.id)&&!d.bench.includes(p.id));
  const cur = sel && byId.get(d.slots[sel]);
  const hint = sel ? `<div class="fs-hint is-pick"><span>${cur ? `Al posto di <b>${esc(surname(cur.name))}</b>:` : `Scegli il <b>${ROLE_NAMES[sel[0]].toLowerCase()}</b>:`}</span>
      <span>${cur ? `<button type="button" class="fanta-link" data-st-clear="${sel}">Lascia vuoto</button>` : ''}<button type="button" class="fanta-link is-muted" data-st-slot="${sel}">Annulla</button></span></div>`
    : '<p class="fs-hint">Scorri di lato · Trascina in alto sul campo o tocca per schierare.</p>';
  const left = countdown(r.deadline, now);
  return `<div class="fs" role="dialog" aria-modal="true" aria-label="Studio formazione">
    <header class="fs-head">
      <button type="button" class="fs-close" data-studio="close" aria-label="Chiudi lo studio">×</button>
      <div class="fs-title"><b>Formazione <span>· Giornata ${r.number}</span></b><small>Chiude tra <span data-countdown="${esc(r.deadline)}">${left || 'chiusa'}</span></small></div>
      <div class="fs-actions"><button type="button" class="fs-quick fs-restore" data-lineup="restore" aria-label="Annulla modifiche e ripristina la formazione salvata" ${!data.lineup||!sq.dirty||sq.saving||r.locked?'disabled':''}>↶ Annulla</button><button type="button" class="fs-quick is-danger" data-lineup="clear" aria-label="Svuota tutto" ${sq.saving||r.locked||!Object.values(d.slots).some(Boolean)&&!d.bench.length ? 'disabled' : ''}>Svuota</button><button type="button" class="fs-quick" data-lineup="best" ${sq.saving||r.locked ? 'disabled' : ''}>⚡ Migliori</button></div>
    </header>
    <div class="fs-stage">
      <div class="fs-top">
        <div class="fs-formations" role="group" aria-label="Modulo">${data.rules.formations.map(f => `<button type="button" class="fs-mod${f === d.formation ? ' is-active' : ''}" data-formation="${f}" aria-pressed="${f === d.formation}">${f}</button>`).join('')}
          ${data.previous ? `<button type="button" class="fs-mod is-soft" data-lineup="repeat">↺ Come la ${data.previous.round}ª</button>` : ''}</div>
        ${pitch(d, byId, sel)}
        ${benchStrip(d, byId, sq.saving||r.locked)}
      </div>
      <section class="fs-dock" data-drop="out" aria-label="Giocatori disponibili: rilascia qui per togliere dal campo">
        <div class="fs-tabs" role="group" aria-label="Ruolo">${tabs}</div>
        ${hint}
        ${tab === 'panchina' ? benchList(d, byId) : `<div class="fs-grid" data-st-list="${tab}">${available.length ? available.map(p => tile(p, d)).join('') : '<p class="fs-all-picked">Tutti schierati in questo reparto. Tocca una maglia sul campo o apri Panchina per cambiare.</p>'}</div>`}
        <p class="fs-legend"><span><i class="fs-badge is-pct is-actual">%</i> Probabilità effettiva</span><span><i class="fs-badge is-pct is-estimated">%</i> Stimata</span><span><i class="fs-badge is-inj">✚</i> INF</span><span><i class="fs-badge is-sq"></i> SQ</span></p>
      </section>
    </div>
    <div class="fs-bar">
      <p class="v2-state ${missing ? 'is-todo' : sq.dirty ? 'is-warn' : 'is-ok'}">${missing ? `Mancano ${missing} ${missing === 1 ? 'titolare' : 'titolari'}` : sq.dirty ? 'Pronta da salvare' : 'Formazione salvata'} · panchina ${d.bench.length}</p>
      <button type="button" class="v2-save${!missing && !sq.dirty ? ' is-done' : ''}" data-lineup="save" aria-busy="${!!sq.saving}" ${missing || !sq.dirty || sq.saving ? 'disabled' : ''}>${sq.saving ? 'Salvataggio…' : !missing && !sq.dirty ? 'Salvata ✓' : 'Salva formazione'}</button>
    </div>
  </div>`;
}
