import { shirtBack } from './maglie-portieri.mjs';
// Studio formazione: schermo intero come lo studio del Quasi.
// Campo verticale su smartphone e orizzontale sugli schermi più larghi.
import {presenceProbability} from './presence-probability.mjs';
import { esc, pts, countdown } from './formato.mjs';
import { assign, unassign, quickAdd, missingOf, countsOf, surname, nextLabel } from './squadra.mjs';

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
  if (p.play?.source!=='official'&&s === 'injured') return `<i class="fs-badge is-inj" title="Infortunato${note}" aria-label="Infortunato">✚</i>`;
  if (p.play?.source!=='official'&&s === 'suspended') return `<i class="fs-badge is-sq" title="Squalificato${note}" aria-label="Squalificato"></i>`;
  const play=presenceProbability(p);if(!play)return '';
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

function reserveTile(p,d,index,{complete,blocked,sideBench}) {
  return `<article class="fs-reserve" data-drop="bench:${index}" aria-label="${esc(surname(p))}, riserva ${index+1}">
    <button type="button" class="fs-tile${p.status?.type==='injured'||p.status?.type==='suspended'?' is-out':''}" data-st-player="${esc(p.id)}" data-drag-id="${esc(p.id)}" data-drag-from="bench" data-drag-axis="${sideBench?'side':'up'}" ${sideBench?`aria-label="Schiera ${esc(p.name)}"`:''} ${blocked?'disabled':''}>
      <span class="fs-shirt" title="${esc(p.name)}">${studioShirt(p)}</span>${playBadge(p)}
      ${sideBench?`<strong class="fs-reserve-name">${esc(surname(p))}</strong>`:''}
      <span class="fs-tile-foot">${fantamedia(p)}${!sideBench||p.next?`<small class="fs-tile-next">${esc(nextLabel(p.next))}</small>`:''}</span>
      <em class="fanta-role is-${p.role}">${p.role}</em>
    </button>
    ${sideBench?`<button type="button" class="fs-bench-grip" data-bench-grip="${esc(p.id)}" data-drag-handle aria-label="Ordina ${esc(p.name)} in panchina con le frecce" ${blocked?'disabled':''}><span aria-hidden="true">⠿</span> ${index+1}ª riserva</button>`:''}
    ${complete?`<div class="fs-reserve-order" aria-label="Ordine in panchina">
      <button type="button" data-no-drag data-bench-move="${esc(p.id)}" data-step="-1" ${blocked||index===0?'disabled':''} aria-label="Anticipa ${esc(surname(p))} in panchina">←</button>
      <span aria-label="Posizione ${index+1}">${index+1}</span>
      <button type="button" data-no-drag data-bench-move="${esc(p.id)}" data-step="1" ${blocked||index===d.bench.length-1?'disabled':''} aria-label="Posticipa ${esc(surname(p))} in panchina">→</button>
    </div>`:''}
  </article>`;
}

// ---------- Studio ----------
export function renderStudio(sq, st, now = Date.now()) {
  const { data } = sq, d=studioDraft(sq.draft,data.roster), byId = new Map(data.roster.map(p => [p.id, p])), r = data.round;
  const sideBench=Boolean(st.sideBench), benchOpen=sideBench&&Boolean(st.benchOpen);
  const sel = st.slot && d.slots[st.slot] !== undefined ? st.slot : null;
  const tab = sel ? sel[0] : st.role==='panchina'?'tutti':st.role || 'tutti', counts = countsOf(d.formation), missing = missingOf(d);
  const filled = role => Object.keys(d.slots).filter(s => s[0] === role && d.slots[s]).length;
  const tabs = TABS.map(([k, label]) => {
    const n = k === 'tutti' ? '' : `${filled(k)}/${counts[k]}`;
    return `<button type="button" class="fs-tab${tab === k ? ' is-active' : ''}" data-st-role="${k}" aria-pressed="${tab === k}">${label}${n !== '' ? ` <small>${n}</small>` : ''}</button>`;
  }).join('');
  const complete=missing===0,blocked=!!sq.saving||r.locked;
  const available=d.bench.map(id=>byId.get(id)).filter(p=>tab==='tutti'||p.role===tab);
  const cur = sel && byId.get(d.slots[sel]);
  const hint = sel ? `<div class="fs-hint is-pick"><span>${cur ? `Al posto di <b>${esc(surname(cur))}</b>:` : `Scegli il <b>${ROLE_NAMES[sel[0]].toLowerCase()}</b>:`}</span>
      <span>${cur ? `<button type="button" class="fanta-link" data-st-clear="${sel}">Lascia vuoto</button>` : ''}<button type="button" class="fanta-link is-muted" data-st-slot="${sel}">Annulla</button></span></div>`
    : sideBench?'<p class="fs-hint">Trascina dalla maniglia per ordinare. Supera il bordo sinistro per schierare.</p>'
    : complete?'<p class="fs-hint">Panchina · Usa le frecce per l’ordine. Tocca due volte un titolare per spostarlo qui.</p>':'<p class="fs-hint">Tocca o trascina per schierare. Tocca due volte un titolare per rimuoverlo.</p>';
  const left = countdown(r.deadline, now);

  return `<div class="fs${complete?' is-complete':''}${sideBench?' is-side-bench':''}${benchOpen?' is-bench-open':''}" role="dialog" aria-modal="true" aria-label="Studio formazione">
    <header class="fs-head">
      <button type="button" class="fs-close" data-studio="close" aria-label="Chiudi lo studio">×</button>
      <div class="fs-title"><b>Formazione <span>· Giornata ${r.number}</span></b><small>Chiude tra <span data-countdown="${esc(r.deadline)}">${left || 'chiusa'}</span></small></div>
      <div class="fs-actions"><button type="button" class="fs-quick fs-restore" data-lineup="restore" aria-label="Annulla modifiche e ripristina la formazione salvata" ${!data.lineup||!sq.dirty||sq.saving||r.locked?'disabled':''}>↶ Annulla</button><button type="button" class="fs-quick is-danger" data-lineup="clear" aria-label="Svuota tutto" ${sq.saving||r.locked||!Object.values(d.slots).some(Boolean) ? 'disabled' : ''}>Svuota</button><button type="button" class="fs-quick" data-lineup="best" ${sq.saving||r.locked ? 'disabled' : ''}>⚡ Migliori</button></div>
    </header>
    <div class="fs-stage">
      <div class="fs-top">
        <div class="fs-formations" role="group" aria-label="Modulo">${data.rules.formations.map(f => `<button type="button" class="fs-mod${f === d.formation ? ' is-active' : ''}" data-formation="${f}" aria-pressed="${f === d.formation}">${f}</button>`).join('')}
          ${data.previous ? `<button type="button" class="fs-mod is-soft" data-lineup="repeat">↺ Come la ${data.previous.round}ª</button>` : ''}</div>
        ${pitch(d, byId, sel)}

      </div>
      ${sideBench?`<button type="button" class="fs-bench-launch" data-st-bench-panel="open" aria-controls="fs-bench-panel" aria-expanded="${benchOpen}"><span aria-hidden="true">‹</span> Panchina <b>${d.bench.length}</b></button>`:''}
      <section class="fs-dock" data-drop="out" ${sideBench?`id="fs-bench-panel" aria-label="Panchina e riserve" ${benchOpen?'':'inert'}`:'aria-label="Giocatori disponibili: rilascia qui per togliere dal campo"'}>
        ${sideBench?`<div class="fs-bench-head"><h2>Panchina <small>${d.bench.length}</small></h2><button type="button" data-st-bench-panel="close" aria-label="Chiudi panchina">›</button></div>`:''}
        <div class="fs-tabs" role="group" aria-label="Ruolo">${tabs}</div>
        ${hint}
        <div class="fs-grid${complete?' is-reserve-list':''}" data-st-list="${tab}" aria-label="${complete||sideBench?'Panchina, ordine di ingresso':'Giocatori da schierare'}">${available.length ? available.map(p=>reserveTile(p,d,d.bench.indexOf(p.id),{complete,blocked,sideBench})).join('') : '<p class="fs-all-picked">Tutti i giocatori di questo ruolo sono in campo. Scegli un altro reparto.</p>'}</div>
        <p class="fs-legend"><span><i class="fs-badge is-pct is-actual">%</i> Probabilità effettiva</span><span><i class="fs-badge is-pct is-estimated">%</i> Stimata</span><span><i class="fs-badge is-inj">✚</i> INF</span><span><i class="fs-badge is-sq"></i> SQ</span></p>
      </section>
    </div>
    <div class="fs-bar">
      <p class="v2-state ${missing ? 'is-todo' : sq.dirty ? 'is-warn' : 'is-ok'}">${missing ? `Mancano ${missing} ${missing === 1 ? 'titolare' : 'titolari'}` : sq.dirty ? 'Pronta da salvare' : 'Formazione salvata'} · panchina ${d.bench.length}</p>
      <button type="button" class="v2-save${!missing && !sq.dirty ? ' is-done' : ''}" data-lineup="save" aria-busy="${!!sq.saving}" ${missing || !sq.dirty || sq.saving ? 'disabled' : ''}>${sq.saving ? 'Salvataggio…' : !missing && !sq.dirty ? 'Salvata ✓' : 'Salva formazione'}</button>
    </div>
  </div>`;
}
