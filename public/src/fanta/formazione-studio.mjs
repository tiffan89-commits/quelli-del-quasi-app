import { shirtBack } from './maglie-portieri.mjs';
// Studio formazione: schermo intero come lo studio del Quasi.
// Campo verticale su smartphone e orizzontale sugli schermi più larghi.
import {availabilityLabel,presenceProbability} from './presence-probability.mjs';
import { esc, pts, countdown } from './formato.mjs';
import { assign, unassign, quickAdd, missingOf, countsOf, surname, nextLabel } from './squadra.mjs';
import {PITCH_FLIP_ICON} from '../lineup-pitch.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const TABS = [['tutti', 'Tutti'], ['P', 'Portieri'], ['D', 'Difensori'], ['C', 'Centrocampisti'], ['A', 'Attaccanti']];
const ROLE_SHORT = { P: 'P', D: 'D', C: 'C', A: 'A' };

// ---------- Logica del tocco (pura) ----------
// Con un posto selezionato sul campo: il giocatore toccato va lì (se il ruolo è giusto).
// Every player outside the XI is a reserve. Preserve the saved reserve order,
// append newly available players, and never duplicate a player across areas.
export function studioDraft(draft,roster){
  const starters=new Set(Object.values(draft.slots).filter(Boolean)),valid=new Set(roster.map(p=>p.id)),seen=new Set(),bench=[];
  for(const id of [...draft.bench,...roster.map(p=>p.id)])if(valid.has(id)&&!starters.has(id)&&!seen.has(id)){seen.add(id);bench.push(id);}
  return {...draft,bench};
}

// Without a selected slot: fill an empty slot of the player's role, or return
// the player to the reserves. A reserve is never removed from the lineup pool.
export function studioTap(draft, roster, id, slot, benchMax) {
  const p = roster.find(x => x.id === id);
  if (!p) return draft;
  if (slot) return slot[0] === p.role ? studioDraft(assign(draft, slot, id),roster) : draft;
  const at = Object.keys(draft.slots).find(s => draft.slots[s] === id);
  if (at) return studioDraft(unassign(draft, at),roster);
  return studioDraft(quickAdd(draft, roster, id, benchMax) || draft,roster);
}

// ---------- Iconcina sulla maglia ----------
export function playBadge(p) {
  const s = p.status?.type, note = p.status?.note ? ': ' + esc(p.status.note) : '';
  const play=presenceProbability(p);if(!play)return '';
  if(play.source==='unavailable'){
    const label=availabilityLabel[s]||availabilityLabel.unavailable;
    const icon=s==='injured'?'<i class="fs-badge is-inj" aria-hidden="true">✚</i>':s==='suspended'?'<i class="fs-badge is-sq" aria-hidden="true"></i>':'';
    return `<span class="fs-availability" title="${label} · 0%${note}" aria-label="${label} · 0%${note}">${icon}<i class="fs-badge is-pct is-out" aria-hidden="true">0%</i></span>`;
  }
  const estimated=play.source!=='official',label=estimated?'Stimata':'Probabilità effettiva';
  return `<i class="fs-badge is-pct ${estimated?'is-estimated':'is-actual'}" title="${label}: ${play.pct}%" aria-label="${label}: ${play.pct}%">${play.pct}%</i>`;

}

// ---------- Pezzi ----------
function fantamedia(p){const n=p.stats?.avgFanta;return `<small class="fs-fm" aria-label="${n==null?'Fantamedia non disponibile':'Fantamedia '+pts(n,2)}"><span>${pts(n,2)}</span> <span>FM</span></small>`;}
function studioShirt(p) {
  return shirtBack(p.club, p.jersey, surname(p), { goalkeeper: p.role === 'P', wideName: true, vs: p.next?.opponent, home: p.next?.home });
}
function token(slot, p, selected) {
  const cls = `fs-token${selected ? ' is-selected' : ''}${p ? '' : ' is-empty'}`;
  if (!p) return `<button type="button" class="${cls}" data-st-slot="${slot}" data-drop="slot:${slot}" aria-pressed="${selected}" aria-label="Scegli ${ROLE_NAMES[slot[0]].toLowerCase()}">
    <span class="fs-ring" aria-hidden="true">${ROLE_SHORT[slot[0]]}</span></button>`;
  return `<button type="button" class="${cls}" data-st-slot="${slot}" data-drop="slot:${slot}" data-drag-id="${esc(p.id)}" data-drag-from="slot:${slot}" title="${esc(p.name)}">
    <span class="fs-shirt">${studioShirt(p)}</span><span class="fs-stats">${fantamedia(p)}${playBadge(p)}</span></button>`;
}

function pitch(d, byId, sel) {
  const counts = countsOf(d.formation), maxLine = Math.max(...Object.values(counts));
  const cols = 'PDCA'.split('').map(role => `<div class="fs-col is-${role}" data-count="${counts[role]}" style="--fs-count:${counts[role]}">${Object.keys(d.slots).filter(s => s[0] === role)
    .map(s => token(s, byId.get(d.slots[s]), sel === s)).join('')}</div>`).join('');
  return `<div class="fs-pitch" style="--fs-max-line:${maxLine}" role="group" aria-label="Campo, modulo ${esc(d.formation)}"><div class="fs-lines" aria-hidden="true"><i></i></div>${cols}</div>`;
}

function reserveTile(p,index,{blocked,tab}) {
  return `<article class="fs-reserve" data-st-reserve-role="${esc(p.role)}" data-drop="bench:${index}" aria-label="${esc(surname(p))}, riserva ${index+1}" ${tab==='tutti'||p.role===tab?'':'hidden'}>
    <button type="button" class="fs-tile${p.status?.type==='injured'||p.status?.type==='suspended'?' is-out':''}" data-st-player="${esc(p.id)}" data-drag-id="${esc(p.id)}" data-drag-from="bench" aria-label="Schiera ${esc(p.name)}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" ${blocked?'disabled':''}>
      <span class="fs-shirt" title="${esc(p.name)}">${studioShirt(p)}</span>${playBadge(p)}
      <strong class="fs-reserve-name">${esc(surname(p))}</strong>
      <span class="fs-tile-foot">${fantamedia(p)}${p.next?`<small class="fs-tile-next">${esc(nextLabel(p.next))}</small>`:''}</span>
      <em class="fanta-role is-${p.role}">${p.role}</em>
    </button>
  </article>`;
}

// Mutate only the faces and their targets, preserving the captured pointer.
export function flipStudio(studio,benchOpen){
  studio.classList.toggle('is-bench-open',benchOpen);
  for(const [face,show] of [['field',!benchOpen],['bench',benchOpen]]){
    const panel=studio.querySelector(`[data-st-face="${face}"]`);
    panel.toggleAttribute('inert',!show);
    panel.setAttribute('aria-hidden',String(!show));
  }
  studio.querySelector('[data-st-bench-panel="open"]').hidden=benchOpen;
  studio.querySelector('.fs-flip-button[data-st-bench-panel="close"]').hidden=!benchOpen;
}

export function filterStudioBench(studio,role){
  const list=studio.querySelector('.fs-grid');
  list.dataset.stList=role;
  let found=false;
  for(const card of list.querySelectorAll('[data-st-reserve-role]')){
    card.hidden=role!=='tutti'&&card.dataset.stReserveRole!==role;
    found||=!card.hidden;
  }
  list.querySelector('.fs-all-picked').hidden=found;
  for(const tab of studio.querySelectorAll('[data-st-role]')){
    const selected=tab.dataset.stRole===role;
    tab.classList.toggle('is-active',selected);
    tab.setAttribute('aria-pressed',String(selected));
  }
}

// ---------- Studio ----------
export function renderStudio(sq, st, now = Date.now()) {
  const { data } = sq, d=studioDraft(sq.draft,data.roster), byId = new Map(data.roster.map(p => [p.id, p])), r = data.round;
  const benchOpen=Boolean(st.benchOpen);
  const sel = st.slot && d.slots[st.slot] !== undefined ? st.slot : null;
  const tab = sel ? sel[0] : st.role==='panchina'?'tutti':st.role || 'tutti', counts = countsOf(d.formation), missing = missingOf(d);
  const filled = role => Object.keys(d.slots).filter(s => s[0] === role && d.slots[s]).length;
  const tabs = TABS.map(([k, label]) => {
    const n = k === 'tutti' ? '' : `${filled(k)}/${counts[k]}`;
    return `<button type="button" class="fs-tab${tab === k ? ' is-active' : ''}" data-st-role="${k}" aria-pressed="${tab === k}">${label}${n !== '' ? ` <small>${n}</small>` : ''}</button>`;
  }).join('');
  const complete=missing===0,blocked=!!sq.saving||r.locked;
  const available=d.bench.map(id=>byId.get(id));
  const cur = sel && byId.get(d.slots[sel]);
  const hint = sel ? `<div class="fs-hint is-pick"><span>${cur ? `Al posto di <b>${esc(surname(cur))}</b>:` : `Scegli il <b>${ROLE_NAMES[sel[0]].toLowerCase()}</b>:`}</span>
      <span>${cur ? `<button type="button" class="fanta-link" data-st-clear="${sel}">Lascia vuoto</button>` : ''}<button type="button" class="fanta-link is-muted" data-st-bench-panel="close">Annulla</button></span></div>`:'';
  const left = countdown(r.deadline, now);

  return `<div class="fs${complete?' is-complete':''}${benchOpen?' is-bench-open':''}" role="dialog" aria-modal="true" aria-label="Studio formazione">
    <header class="fs-head">
      <button type="button" class="fs-close" data-studio="close" aria-label="Chiudi lo studio">×</button>
      <div class="fs-title"><b>Formazione <span>· Giornata ${r.number}</span></b><small>Chiude tra <span data-countdown="${esc(r.deadline)}">${left || 'chiusa'}</span></small></div>
      <div class="fs-actions"><button type="button" class="fs-quick fs-restore" data-lineup="restore" aria-label="Annulla modifiche e ripristina la formazione salvata" ${!data.lineup||!sq.dirty||sq.saving||r.locked?'disabled':''}>↶ Annulla</button><button type="button" class="fs-quick is-danger" data-lineup="clear" aria-label="Svuota tutto" ${sq.saving||r.locked||!Object.values(d.slots).some(Boolean) ? 'disabled' : ''}>Svuota</button><button type="button" class="fs-quick" data-lineup="best" ${sq.saving||r.locked ? 'disabled' : ''}>⚡ Migliori</button></div>
    </header>
    <div class="fs-stage">
      <div class="fs-top">
        <div class="fs-formations" role="group" aria-label="Modulo">${data.rules.formations.map(f => `<button type="button" class="fs-mod${f === d.formation ? ' is-active' : ''}" data-formation="${f}" aria-pressed="${f === d.formation}">${f}</button>`).join('')}
          ${data.previous ? `<button type="button" class="fs-mod is-soft" data-lineup="repeat">↺ Come la ${data.previous.round}ª</button>` : ''}</div>
        <div class="fs-flip-stage">
          <div class="fs-faces">
            <section class="fs-face fs-field-face" id="fs-field-panel" data-st-face="field" aria-hidden="${benchOpen}" ${benchOpen?'inert':''}>${pitch(d, byId, sel)}</section>
            <section class="fs-face fs-dock" id="fs-bench-panel" data-st-face="bench" aria-hidden="${!benchOpen}" aria-label="Panchina" ${benchOpen?'':'inert'}>
              <div class="fs-bench-head"><h2>Panchina</h2><span>${d.bench.length} giocatori</span></div>
              <div class="fs-tabs" role="group" aria-label="Ruolo">${tabs}</div>
              ${hint}
              <div class="fs-grid" data-st-list="${tab}" aria-label="Panchina, ordine di ingresso">
                ${available.map((p,index)=>reserveTile(p,index,{blocked,tab})).join('')}
                <p class="fs-all-picked" ${available.some(p=>tab==='tutti'||p.role===tab)?'hidden':''}>Nessuna riserva per questo ruolo.</p>
              </div>
              <div class="fs-bench-drop" data-drop="bench">Sposta in panchina</div>
              <p class="fs-legend"><span><i class="fs-badge is-pct is-actual">%</i> Probabilità effettiva</span><span><i class="fs-badge is-pct is-estimated">%</i> Stimata</span><span><i class="fs-badge is-inj">✚</i> Infortunato</span><span><i class="fs-badge is-sq"></i> Squalificato</span></p>
            </section>
          </div>
          <div class="fs-flip-control" data-drop="flip">
            <span class="fs-flip-watermark" aria-hidden="true">${PITCH_FLIP_ICON}</span>
            <button type="button" class="fs-flip-button" data-st-bench-panel="open" aria-controls="fs-bench-panel" ${benchOpen?'hidden':''}>${PITCH_FLIP_ICON} Panchina</button>
            <button type="button" class="fs-flip-button" data-st-bench-panel="close" aria-controls="fs-field-panel" ${benchOpen?'':'hidden'}>${PITCH_FLIP_ICON} Titolari</button>
          </div>
        </div>
      </div>
    </div>
    <div class="fs-bar">
      <p class="v2-state ${missing ? 'is-todo' : sq.dirty ? 'is-warn' : 'is-ok'}">${missing ? `Mancano ${missing} ${missing === 1 ? 'titolare' : 'titolari'}` : sq.dirty ? 'Pronta da salvare' : 'Formazione salvata'} · panchina ${d.bench.length}</p>
      <button type="button" class="v2-save${!missing && !sq.dirty ? ' is-done' : ''}" data-lineup="save" aria-busy="${!!sq.saving}" ${missing || !sq.dirty || sq.saving ? 'disabled' : ''}>${sq.saving ? 'Salvataggio…' : !missing && !sq.dirty ? 'Salvata ✓' : 'Salva formazione'}</button>
    </div>
  </div>`;
}
