import {playerVisual} from './player-visual.mjs';
import {teamLogo} from './team-logo.mjs';
// Pagina "Squadra": formazione della giornata sul campo (modulo, titolari, panchina, salvataggio) e rosa.
// La bozza della formazione vive solo nel browser finché non si salva; il server controlla scadenza e regole.
import { esc, pts, countdown, timeAgo, fixtureTime, orderRounds } from './formato.mjs';
import { shirt, KITS } from './maglie.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const ROLE_PLURAL = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };
const PICK_TITLE = { P: 'Scegli il portiere', D: 'Scegli il difensore', C: 'Scegli il centrocampista', A: "Scegli l'attaccante" };
const STATUS = { injured: ['INF', 'Infortunato'], doubtful: ['?', 'In dubbio'], suspended: ['SQ', 'Squalificato'] };

// ---------- Bozza della formazione (funzioni pure) ----------

// The bench is optional and may contain any subset of the remaining roster.
const hasRoom = () => true;
const benchCount = bench => String(bench.length);

export const countsOf = formation => { const [d, c, a] = formation.split('-').map(Number); return { P: 1, D: d, C: c, A: a }; };
const slotsOf = formation => Object.entries(countsOf(formation)).flatMap(([role, n]) => Array.from({ length: n }, (_, i) => role + i));

export function draftFrom(lineup, roster, formation = lineup?.formation || '4-4-2') {
  const byId = new Map(roster.map(p => [p.id, p])), slots = Object.fromEntries(slotsOf(formation).map(s => [s, null]));
  for (const id of lineup?.starters || []) {
    const p = byId.get(id), free = p && Object.keys(slots).find(s => s[0] === p.role && !slots[s]);
    if (free) slots[free] = id;
  }
  return { formation, slots, bench: (lineup?.bench || []).filter(id => byId.has(id)) };
}

export const lineupOf = draft => ({ formation: draft.formation, starters: Object.values(draft.slots).filter(Boolean), bench: [...draft.bench] });

export function sameLineup(a, b) {
  if (!a || !b) return false;
  const x = lineupOf(a), y = b.starters ? b : lineupOf(b);
  return x.formation === y.formation && [...x.starters].sort().join() === [...y.starters].sort().join() && x.bench.join() === y.bench.join();
}

// Cambio modulo: i posti nuovi si riempiono con i primi panchinari di quel ruolo,
// chi non entra più nel reparto va in testa alla panchina.
export function withFormation(draft, formation, roster, benchMax) {
  const byId = new Map(roster.map(p => [p.id, p])), kept = draftFrom({ formation, starters: Object.values(draft.slots).filter(Boolean) }, roster, formation);
  const out = Object.values(draft.slots).filter(id => id && !Object.values(kept.slots).includes(id));
  let bench = [...draft.bench];
  const promoted = [];
  for (const slot of Object.keys(kept.slots)) {
    if (kept.slots[slot]) continue;
    const id = bench.find(b => byId.get(b)?.role === slot[0]);
    if (id) { kept.slots[slot] = id; bench = bench.filter(b => b !== id); promoted.push(id); }
  }
  bench = [...out, ...bench];
  return { draft: { ...kept, bench }, moved: out.map(id => byId.get(id)?.name), promoted: promoted.map(id => byId.get(id)?.name) };
}

export function assign(draft, slot, id) {
  const slots = { ...draft.slots }, bench = [...draft.bench];
  const from = Object.keys(slots).find(s => slots[s] === id), benchAt = bench.indexOf(id), occupant = slots[slot];
  if (from) slots[from] = occupant || null; // scambio tra due posti dello stesso reparto
  if (benchAt >= 0) { if (occupant) bench[benchAt] = occupant; else bench.splice(benchAt, 1); } // scambio con la panchina
  slots[slot] = id;
  return { ...draft, slots, bench };
}

export const unassign = (draft, slot) => ({ ...draft, slots: { ...draft.slots, [slot]: null } });
export const benchAdd = (draft, id) => ({ ...draft, bench: [...draft.bench.filter(x => x !== id), id] });
export const benchRemove = (draft, id) => ({ ...draft, bench: draft.bench.filter(x => x !== id) });
export function benchMove(draft, id, step) {
  const bench = [...draft.bench], i = bench.indexOf(id), j = i + step;
  if (i < 0 || j < 0 || j >= bench.length) return draft;
  [bench[i], bench[j]] = [bench[j], bench[i]];
  return { ...draft, bench };
}
export const missingOf = draft => Object.values(draft.slots).filter(v => !v).length;

// ---------- Trascinamento: cosa si può lasciare dove, e cosa succede ----------
// target: "slot:D1" | "bench" (in coda) | "bench:2" (in quella posizione) | "out" (torna in rosa)

const slotOfId = (draft, id) => Object.keys(draft.slots).find(s => draft.slots[s] === id);

export function canDropOn(draft, roster, { id, from }, target, benchMax) {
  const p = roster.find(x => x.id === id);
  if (!p) return false;
  if (target.startsWith('slot:')) return target.slice(5)[0] === p.role && from !== target;
  const inBench = draft.bench.includes(id);
  if (target === 'out') return from !== 'list' || !!slotOfId(draft, id) || inBench;
  if (target.startsWith('bench:') && slotOfId(draft, id)) {
    const other = roster.find(x => x.id === draft.bench[Number(target.slice(6))]);
    if (other?.role === p.role) return true; // scambio titolare ↔ panchinaro
  }
  if (target.startsWith('bench')) return inBench || hasRoom(draft.bench, benchMax);
  return false;
}

export function dropOn(draft, { id }, target, benchMax, roster = []) {
  if (target.startsWith('slot:')) return assign(draft, target.slice(5), id);
  const slot = slotOfId(draft, id);
  // Titolare lasciato su un panchinaro dello stesso ruolo: si scambiano di posto.
  if (slot && target.startsWith('bench:')) {
    const i = Number(target.slice(6)), otherId = draft.bench[i], role = id => roster.find(x => x.id === id)?.role;
    if (otherId && role(otherId) === role(id)) {
      const bench = [...draft.bench];
      bench[i] = id;
      return { ...draft, slots: { ...draft.slots, [slot]: otherId }, bench };
    }
  }
  let next = slot ? unassign(draft, slot) : draft;
  if (target === 'out') return benchRemove(next, id);
  const bench = next.bench.filter(x => x !== id);
  if (!hasRoom(bench, benchMax)) return draft;
  const at = target === 'bench' ? bench.length : Math.min(Number(target.slice(6)), bench.length);
  bench.splice(at, 0, id);
  return { ...next, bench };
}

// Tocco su un giocatore della lista: primo posto libero del suo ruolo, altrimenti in panchina.
export function quickAdd(draft, roster, id, benchMax) {
  const p = roster.find(x => x.id === id);
  if (!p || slotOfId(draft, id)) return null;
  const free = Object.keys(draft.slots).find(s => s[0] === p.role && !draft.slots[s]);
  if (free) return assign(draft, free, id);
  if (!draft.bench.includes(id) && hasRoom(draft.bench, benchMax)) return benchAdd(draft, id);
  return null;
}

// ---------- Rendering ----------

export function surname(player) {
  const explicit=typeof player==='object'&&(player?.surname||player?.lastName||player?.lastname);
  if(explicit)return String(explicit).trim();
  const name=String(typeof player==='object'?player?.name||'':player||'').trim().replace(/\s+/g,' ');
  // Abbreviated provider names already identify the surname, including compound names.
  const abbreviated=name.replace(/^(?:\p{L}\.\s*)+/u,'').replace(/\s+\p{Lu}\.$/u,'');
  if(abbreviated!==name)return abbreviated;
  const parts=name.split(' ');if(parts.length<2)return name;
  // Preserve registered compound surnames when only a display name is available.
  if(/^(?:Juan Jesus|Carlos Augusto|Kolo Muani|Zambo Anguissa)$/i.test(name))return name;
  let start=parts.length-1;
  while(start>0&&/^(?:de|del|della|di|da|do|dos|das|van|von|der|den|el|le|la|kolo|zambo)$/i.test(parts[start-1]))start--;
  return parts.slice(start).join(' ');
}
const codeOf = club => KITS[club]?.code || String(club||'').slice(0, 3).toUpperCase();
export const nextLabel = n => n?.opponent ? `${n.home ? '' : '@ '}${codeOf(n.opponent)}` : '–';
const statusBadge = s => STATUS[s?.type] ? `<i class="fanta-st is-${s.type}" title="${esc(s.note)}">${STATUS[s.type][0]}</i>` : '';
const avg = n => n == null ? '–' : pts(n, 2);

function slotToken(slot, p, locked) {
  if (!p) {
    return `<div class="fanta-slot" aria-label="${ROLE_NAMES[slot[0]]}: posto vuoto"><span class="fanta-slot-ring"><b>–</b></span><small>${ROLE_NAMES[slot[0]]}</small></div>`;
  }
  return `<div class="fanta-token${p.status?.type && p.status.type !== 'ok' ? ' is-warn' : ''}" title="${esc(p.name)}">
    <span class="fanta-token-shirt">${playerVisual(p,{back:true})}<span class="fanta-role is-${p.role}">${p.role}</span></span>
    ${statusBadge(p.status)}<b>${esc(surname(p))}</b><em class="is-when">${esc(nextLabel(p.next))}</em><small class="fanta-view-fm">${avg(p.stats?.avgFanta)} FM</small>
  </div>`;
}

function pitchEditor(d, byId, locked) {
  const rows = 'ACDP'.split('').map(role => `<div class="fanta-pitch-row">${Object.keys(d.slots).filter(s => s[0] === role)
    .map(s => slotToken(s, byId.get(d.slots[s]), locked)).join('')}</div>`).join('');
  return `<div class="fanta-pitch is-editor" aria-label="Formazione ${esc(d.formation)}"><div class="fanta-pitch-lines" aria-hidden="true"></div>${rows}</div>`;
}

function benchList(d, byId, max, locked) {
  const rows = d.bench.map((id, i) => {
    const p = byId.get(id);
    return `<li class="fanta-bench-row" data-drop="bench:${i}"${locked ? '' : ` data-drag-id="${esc(id)}" data-drag-from="bench"`}>
      <span class="fanta-bench-n">${locked ? i + 1 : `<i class="fanta-handle" data-drag-handle aria-hidden="true">⠿</i>${i + 1}`}</span>
      <span class="fanta-mini-shirt">${playerVisual(p)}</span>
      <span class="fanta-role is-${p.role}">${p.role}</span>
      <span class="fanta-p-name"><b>${esc(surname(p))}</b><small>${esc(p.club)} · ${esc(nextLabel(p.next))}</small></span><span class="fanta-roster-stats"><b>${avg(p.stats?.avgFanta)}</b><small>FM</small></span>
      ${statusBadge(p.status)}
      ${locked ? '' : `<span class="fanta-bench-actions">
        <button type="button" data-bench-move="${esc(id)}" data-step="-1" ${i ? '' : 'disabled'} aria-label="Sposta su">↑</button>
        <button type="button" data-bench-move="${esc(id)}" data-step="1" ${i < d.bench.length - 1 ? '' : 'disabled'} aria-label="Sposta giù">↓</button>
        <button type="button" data-bench-remove="${esc(id)}" aria-label="Togli dalla panchina">×</button></span>`}
    </li>`;
  }).join('');
  return `<section class="fanta-bench-edit" data-drop="bench">
    <div class="dash-section-head"><div><h2>Panchina</h2><small>${benchCount(d.bench, max)} · entrano in quest'ordine, solo nello stesso ruolo</small></div></div>
    ${rows ? `<ol>${rows}</ol>` : '<p class="fanta-note is-wait">Panchina vuota: chi resta senza voto non potrà essere sostituito.</p>'}
    ${!locked && hasRoom(d.bench, max) ? '<button type="button" class="secondary fanta-add" data-bench-add="1">+ Aggiungi in panchina</button>' : ''}
  </section>`;
}

// Panchina compatta sotto il campo, tutta in vista (righe da 7) mentre si trascina.
// Tutta la fascia accetta i giocatori; il "+" compare solo a panchina vuota, come invito.
function benchStrip(d, byId, max, locked) {
  const cells = d.bench.map((id, i) => {
    const p = byId.get(id);
    return `<div class="fanta-bench-cell" data-drop="bench:${i}"${locked ? '' : ` data-drag-id="${esc(id)}" data-drag-from="bench"`} title="${esc(p.name)}">
      <span class="fanta-token-shirt">${playerVisual(p,{back:true})}<span class="fanta-role is-${p.role}">${p.role}</span></span>
      <b>${i + 1}. ${esc(surname(p.name))}</b>
      ${locked ? '' : `<button type="button" class="fanta-bench-x" data-bench-remove="${esc(id)}" aria-label="Togli ${esc(p.name)} dalla panchina">×</button>`}
    </div>`;
  }).join('');
  const add = !locked && !d.bench.length ? `<div class="fanta-bench-cell is-empty" data-drop="bench"><span class="fanta-bench-ring">+</span></div>` : '';
  return `<div class="fanta-bench-strip" data-drop="bench" aria-label="Panchina">
    <span class="fanta-bench-label">Panchina <small>${benchCount(d.bench, max)}</small>
      ${locked ? '' : '<button type="button" class="fanta-link fanta-bench-all" data-lineup="bench-all">Tutti in panchina</button>'}</span>
    <div class="fanta-bench-cells">${cells}${add}</div>
  </div>`;
}

// "Tutti in panchina": chi non è titolare va in coda, per ruolo e fantamedia.
export function benchAll(draft, roster,max=null) {
  const used = new Set([...Object.values(draft.slots), ...draft.bench]);
  const rest = roster.filter(p => !used.has(p.id))
    .sort((a, b) => 'PDCA'.indexOf(a.role) - 'PDCA'.indexOf(b.role) || (b.stats.avgFanta ?? 0) - (a.stats.avgFanta ?? 0)).map(p => p.id);
  return { ...draft, bench: [...draft.bench, ...rest] };
}

// Lista di tutta la rosa da cui trascinare (o toccare per aggiungere al primo posto libero).
function playerList(data, d, filter, locked) {
  const where = id => Object.values(d.slots).includes(id) ? 'campo' : d.bench.includes(id) ? 'panchina' : '';
  const chips = [['tutti', 'Tutti'], ['P', 'P'], ['D', 'D'], ['C', 'C'], ['A', 'A']].map(([k, label]) =>
    `<button type="button" class="v2-chip${filter === k ? ' is-active' : ''}" data-sq-filter="${k}" aria-pressed="${filter === k}">${label}</button>`).join('');
  const list = data.roster.filter(p => !where(p.id) && (filter === 'tutti' || p.role === filter))
    .sort((a, b) => 'PDCA'.indexOf(a.role) - 'PDCA'.indexOf(b.role) || (where(a.id) ? 1 : 0) - (where(b.id) ? 1 : 0) || (b.stats.avgFanta ?? 0) - (a.stats.avgFanta ?? 0));
  return `<section class="fanta-players" data-drop="out">
    <div class="dash-section-head"><div><h2>Giocatori</h2><small>Trascinali sul campo o in panchina · col dito tieni premuto un attimo</small></div></div>
    <div class="v2-chips fanta-filter">${chips}</div>
    <ul>${list.map(p => {
      const at = where(p.id);
      return `<li class="fanta-player-row${at ? ' is-' + at : ''}"${locked ? '' : ` data-drag-id="${esc(p.id)}" data-drag-from="list" data-list-add="${esc(p.id)}"`}>
        ${locked ? '' : '<i class="fanta-handle" data-drag-handle aria-hidden="true">⠿</i>'}
        <span class="fanta-mini-shirt">${playerVisual(p)}</span>
        <span class="fanta-role is-${p.role}">${p.role}</span>
        <span class="fanta-p-name"><b>${esc(p.name)} ${statusBadge(p.status)}</b><small>${esc(nextLabel(p.next))}${at ? ` · <em>in ${at}</em>` : ''}</small></span>
        <span class="fanta-roster-stats"><b>${avg(p.stats.avgFanta)}</b><small>FM</small></span>
      </li>`;
    }).join('')}</ul>
  </section>`;
}

function deadlineCard(data, draft, sq, now) {
  const r = data.round;
  if (r.locked) return `<div class="fanta-deadline is-locked"><b>Giornata ${r.number} iniziata</b><span>${data.lineup?"La formazione è bloccata: la vedi qui sotto come l'hai salvata.":'Formazione non schierata: 0 fantapunti e 0 gol.'}</span></div>`;
  const left = countdown(r.deadline, now);
  const state = sq.dirty ? '<span class="v2-state is-warn">Modifiche da salvare</span>'
    : data.lineup ? `<span class="v2-state is-ok">Salvata ${esc(timeAgo(data.lineup.savedAt, now))} · la vede tutta la lega</span>`
    : '<span class="v2-state is-todo">Non ancora schierata</span>';
  return `<div class="fanta-deadline"><div><b>Giornata ${r.number}</b>${state}</div>
    <div class="dash-clock"><span>Chiude tra</span><strong data-countdown="${esc(r.deadline)}">${left || 'chiusa'}</strong></div></div>`;
}

function formationView(data, sq, now) {
  const d=draftFrom(data.lineup||{formation:data.previous?.formation||'4-4-2'},data.roster),byId=new Map(data.roster.map(p=>[p.id,p]));
  const studio=data.round.locked?'':'<button type="button" class="fanta-studio-open" data-studio="open">'+(sq.dirty?'Riprendi lo studio formazione →':data.lineup?'Modifica nello studio formazione →':'Apri lo studio formazione →')+'</button>';
  const note=sq.dirty?'<p class="fanta-note is-info">Hai modifiche nello studio ancora da salvare. Qui vedi la formazione salvata.</p>':'';
  return studio+deadlineCard(data,d,{...sq,dirty:false},now)+note+'<p class="fanta-view-module">Modulo <b>'+esc(d.formation)+'</b></p><div class="fanta-board is-readonly"><div class="fanta-board-pitch">'+pitchEditor(d,byId,true)+'</div><div class="fanta-board-side">'+benchList(d,byId,data.rules.benchMax,true)+'</div></div>';
}

function rosterView(data, d) {
  const where = id => Object.values(d.slots).includes(id) ? 'campo' : d.bench.includes(id) ? 'panchina' : '';
  return `<div class="fanta-roster">
    <div class="fanta-roster-legend"><span>FM fantamedia</span><span>MV media voto</span><span>Pr presenze</span></div>
    ${'PDCA'.split('').map(role => {
      const list = data.roster.filter(p => p.role === role);
      return `<section class="fanta-group"><h4>${ROLE_PLURAL[role]} <span>${list.length}</span></h4>${list.map(p => `
        <div class="fanta-roster-row">
          <span class="fanta-mini-shirt">${playerVisual(p)}</span>
          <span class="fanta-p-name"><b>${esc(p.name)} ${statusBadge(p.status)}</b><small>${esc(p.club)} · ${esc(nextLabel(p.next))}${where(p.id) ? ` · <em class="is-${where(p.id)}">in ${where(p.id)}</em>` : ''}</small>
            ${p.status?.type && p.status.type !== 'ok' ? `<small class="fanta-st-note">${esc(p.status.note)}</small>` : ''}</span>
          <span class="fanta-roster-stats"><b>${avg(p.stats.avgFanta)}</b><small>FM</small></span>
          <span class="fanta-roster-stats"><b>${avg(p.stats.avgVote)}</b><small>MV</small></span>
          <span class="fanta-roster-stats"><b>${p.stats.played??'–'}</b><small>Pr</small></span>
          <span class="fanta-roster-price">${p.price}<small>cr</small></span>
        </div>`).join('')}</section>`;
    }).join('')}
  </div>`;
}

export function renderTeamCalendar(data){return `<section class="fanta-team-calendar"><h2>Calendario e risultati</h2>${data.calendar?.length?orderRounds(data.calendar,data.round.number,'round').map(m=>`<button type="button" class="fanta-team-fixture ${m.round===data.round.number?'is-current':''}" data-go="giornata" data-round="${m.round}" data-mu="${esc(m.id)}"><small>Giornata ${m.round}${m.round===data.round.number?' · attuale':''} · ${esc(m.kickoff?new Date(m.kickoff).toLocaleDateString('it-IT',{day:'numeric',month:'short'}):'Da definire')}</small><span>${teamLogo(m.home.team)}<b>${esc(m.home.team.name)}</b><strong>${m.home.goals==null?'–':m.home.goals} : ${m.away.goals==null?'–':m.away.goals}</strong><b>${esc(m.away.team.name)}</b>${teamLogo(m.away.team)}</span><small>${m.home.points==null?'Da giocare':pts(m.home.points)+' · '+pts(m.away.points)+' FP'+(m.official?' · Finale':' · Provvisorio')}</small></button>`).join(''):'<p class="fanta-note">Il calendario arriva con l’avvio della competizione.</p>'}</section>`;}
export function renderTeamRoster(data,tools=''){return `<div class="fanta-ps-head"><div><h2 id="fanta-sheet-title">${esc(data.team.name)}</h2><small>Rosa · ${data.roster.length} giocatori</small></div><button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>${tools}${rosterView(data,{slots:{},bench:[]})}`;}
export function renderSquadra(sq, now = Date.now()) {
  if (!sq?.data) return '<div class="fanta-loading" role="status">Carichiamo la tua squadra…</div>';
  const { data } = sq;
  return `<div class="fanta-squadra">
    <header class="fanta-sq-head">
      <button type="button" class="fanta-edit-crest" data-action="edit-logo" aria-label="Modifica il logo di ${esc(data.team.name)}">${teamLogo(data.team,{eager:true})}<span>Modifica logo ✎</span></button><div class="fanta-team-heading"><span class="eyebrow">La tua squadra</span>
      <h1>${esc(data.team.name)}</h1>
      <p>${data.roster.length} giocatori · crediti spesi ${data.budget.spent??'–'}/${data.budget.total}</p>${data.budget.unrefunded?`<small>${data.budget.unrefunded} crediti non rimborsati dagli svincoli.</small>`:''}</div>
    </header>
    <div class="v2-chips" role="tablist">
      <button type="button" role="tab" class="v2-chip${sq.sub === 'formazione' ? ' is-active' : ''}" data-sq-sub="formazione" aria-selected="${sq.sub === 'formazione'}">Formazione</button>
      <button type="button" role="tab" class="v2-chip${sq.sub === 'rosa' ? ' is-active' : ''}" data-sq-sub="rosa" aria-selected="${sq.sub === 'rosa'}">Rosa</button>
      <button type="button" role="tab" class="v2-chip${sq.sub === 'calendario' ? ' is-active' : ''}" data-sq-sub="calendario" aria-selected="${sq.sub === 'calendario'}">Calendario e risultati</button>
    </div>
    ${sq.sub === 'calendario'?renderTeamCalendar(data):sq.sub === 'rosa' ? rosterView(data, draftFrom(data.lineup||{formation:data.previous?.formation||'4-4-2'},data.roster)) : formationView(data, sq, now)}
  </div>`;
}

// ---------- Fogli di scelta ----------

function pickRow(p, d, attr) {
  const inSlot = Object.values(d.slots).includes(p.id), inBench = d.bench.includes(p.id);
  return `<button type="button" class="fanta-pick-row${p.status?.type && p.status.type !== 'ok' ? ' is-warn' : ''}" ${attr}="${esc(p.id)}">
    <span class="fanta-mini-shirt">${playerVisual(p)}</span>
    <span class="fanta-role is-${p.role}">${p.role}</span>
    <span class="fanta-p-name"><b>${esc(p.name)} ${statusBadge(p.status)}</b>
      <small>${esc(p.club)} · ${esc(nextLabel(p.next))}${inSlot ? ' · in campo' : inBench ? ' · in panchina' : ''}</small>
      ${p.status?.type && p.status.type !== 'ok' ? `<small class="fanta-st-note">${esc(p.status.note)}</small>` : ''}</span>
    <span class="fanta-roster-stats"><b>${avg(p.stats.avgFanta)}</b><small>FM</small></span>
  </button>`;
}

// Resa attesa: fantamedia pesata per la probabilità di giocare (infortunati e squalificati valgono zero).
// Senza dato sulla probabilità si conta 70%, per non scavalcare chi ha probabili formazioni buone.
const expected = p => p.status?.type === 'injured' || p.status?.type === 'suspended' ? 0 : ((p.play?.pct ?? 70) / 100) * (p.stats?.avgFanta ?? 5.5);
export const byExpected = (a, b) => expected(b) - expected(a);

// Primo posto vuoto in ordine di campo (portiere, difesa, centrocampo, attacco).
export const nextEmptySlot = draft => Object.keys(draft.slots).sort((a, b) => 'PDCA'.indexOf(a[0]) - 'PDCA'.indexOf(b[0])).find(s => !draft.slots[s]) || null;

// "Schiera i migliori": nel modulo scelto mette chi rende di più tra chi gioca davvero; tutti gli altri in panchina.
export function bestLineup(draft, roster,benchMax=null) {
  const slots = Object.fromEntries(Object.keys(draft.slots).map(s => [s, null])), used = new Set(), sorted = [...roster].sort(byExpected);
  for (const s of Object.keys(slots)) {
    const p = sorted.find(x => x.role === s[0] && !used.has(x.id));
    if (p) { slots[s] = p.id; used.add(p.id); }
  }
  return benchAll({ formation: draft.formation, slots, bench: [] }, roster,benchMax);
}


const byFanta = (a, b) => (a.status?.type === 'ok' ? 0 : 1) - (b.status?.type === 'ok' ? 0 : 1) || (b.stats.avgFanta ?? 0) - (a.stats.avgFanta ?? 0);

function pickProgress(d){const all=Object.keys(d.slots).length,done=all-missingOf(d);return `<div class="fanta-ps-progress" aria-label="${done} titolari su ${all}"><i style="width:${Math.round(done/all*100)}%"></i></div>`;}
export function renderPickSheet(sq, slot, guided = false) {
  const { data, draft: d } = sq, role = slot[0], current = d.slots[slot];
  // Chi è già in campo: escluso nella scelta guidata, in fondo quando si cambia un posto (si scambiano).
  const onPitch = new Set(Object.values(d.slots));
  const list = data.roster.filter(p => p.role === role && p.id !== current && !d.bench.includes(p.id) && !(guided && onPitch.has(p.id)))
    .sort((a, b) => onPitch.has(a.id) - onPitch.has(b.id) || byFanta(a, b));
  const cur = current && data.roster.find(p => p.id === current), all = Object.keys(d.slots).length;
  return `<div class="fanta-ps-head"><span class="fanta-role is-${role} lg">${role}</span>
      <div><h2 id="fanta-sheet-title">${PICK_TITLE[role]}</h2><small>${cur ? `Ora c'è ${esc(cur.name)}` : guided ? `Titolare ${all - missingOf(d) + 1} di ${all}` : 'Posto libero'} · i disponibili per primi</small></div>
      <button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>
    ${guided ? pickProgress(d) : ''}
    <div class="fanta-pick-roles" role="group" aria-label="Scegli il reparto">${Object.entries(countsOf(d.formation)).map(([r,total])=>`<button type="button" class="v2-chip${r===role?' is-active':''}" data-pick-role="${r}" aria-pressed="${r===role}">${ROLE_PLURAL[r]} <small>${Object.entries(d.slots).filter(([s,id])=>s[0]===r&&id).length}/${total}</small></button>`).join('')}<button type="button" class="v2-chip" data-bench-add="1">Panchina</button></div>
    <div class="fanta-pick-list">${list.map(p => pickRow(p, d, 'data-pick')).join('')}</div>
    ${cur ? '<button type="button" class="secondary fanta-add" data-unpick="1">Lascia il posto vuoto</button>' : guided ? '<button type="button" class="secondary fanta-add" data-action="close-sheet">Basta così, continuo dal campo</button>' : ''}`;
}

// Panchina: il foglio resta aperto, si tocca nell'ordine in cui devono entrare.
export function renderBenchSheet(sq) {
  const { data, draft: d } = sq, used = new Set([...Object.values(d.slots), ...d.bench]);
  const groups = 'PDCA'.split('').map(role => {
    const list = data.roster.filter(p => p.role === role && !used.has(p.id)).sort(byFanta);
    return list.length ? `<h4 class="fanta-pick-group">${ROLE_PLURAL[role]}</h4>${list.map(p => pickRow(p, d, 'data-bench-pick')).join('')}` : '';
  }).join('');
  const byId = new Map(data.roster.map(p => [p.id, p]));
  const order = d.bench.length ? `<p class="fanta-ps-order">${d.bench.map((id, i) => `<span><b>${i + 1}</b> ${esc(surname(byId.get(id)?.name || ''))}</span>`).join('')}</p>` : '';
  return `<div class="fanta-ps-head"><div><h2 id="fanta-sheet-title">${d.bench.length ? 'Panchina' : 'Ora la panchina'}</h2><small>Tocca nell'ordine in cui devono entrare · posto ${d.bench.length + 1}${data.rules.benchMax == null ? '' : ` di ${data.rules.benchMax}`}</small></div>
      <button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>
    ${order}
    ${groups ? `<div class="fanta-ps-actions"><button type="button" class="secondary" data-lineup="bench-all">Tutti gli altri, per ruolo</button><button type="button" data-action="close-sheet">Fatto</button></div>` : ''}
    <div class="fanta-pick-list">${groups || '<p class="fanta-note">Tutta la rosa è già in campo o in panchina.</p>'}</div>`;
}
