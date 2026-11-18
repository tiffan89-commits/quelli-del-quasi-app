// Sala d'asta: giocatore sul tavolo con offerta e timer, rilanci rapidi, chiamata dal listone,
// partecipanti con crediti e posti, ultimi acquisti e la propria rosa. Funzioni pure: dati → HTML.
// Il timer si aggiorna da solo (tickAuction) senza ridisegnare la pagina.
import { esc, pts } from './formato.mjs';
import { shirt } from './maglie.mjs';
import {auctionWhen} from './auction-wizard.mjs';
import {renderReleases} from './mercato.mjs';
import {avatarSvg} from '../avatar.mjs';
import {LAMPO,lampoShownSeconds} from '../auction-formats.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const RING = 2 * Math.PI * 26;

const teamOf = (a, id) => a.teams.find(t => t.team.id === id);
const memberOf=(ui,t)=>ui.members?.find(m=>t?.team.userId&&m.uid===t.team.userId);
const fm = n => n == null ? '–' : pts(n, 2);

const ROLE_PLURAL = { P: 'portieri', D: 'difensori', C: 'centrocampisti', A: 'attaccanti' };


// Cosa può fare l'utente sul giocatore in tavola, e perché no.
export function bidState(a) {
  const me = teamOf(a, a.me), lot = a.lot;
  if (!lot) return { can: false };
  if(!me)return {can:false,why:'Puoi seguire l’asta: non hai una squadra associata.',min:lot.bid+a.rules.minRaise,max:0};
  const min = lot.bid + a.rules.minRaise, auto = lot.autoPassed?.[a.me];
  if (lot.leader === a.me) return { can: false, why: lot.closing ? 'Hanno passato tutti: è tuo!' : 'Sei in testa tu', min, max: me.maxBid, leading: true };
  if (lot.passed?.includes(a.me)) return { can: false, why: 'Hai passato: non puoi più rientrare su questo giocatore', min, max: me.maxBid, passed: true };
  if (auto === 'role') return { can: false, why: `Passo automatico: hai già tutti i ${ROLE_PLURAL[lot.player.role]}`, min, max: me.maxBid, passed: true };
  if (auto === 'credits') return { can: false, why: `Passo automatico: puoi offrire al massimo ${me.maxBid}`, min, max: me.maxBid, passed: true };
  if(me.maxBid<min)return {can:false,min,max:me.maxBid,why:'Non hai crediti sufficienti per rilanciare'};
  return { can: true, min, max: me.maxBid };
}

export const bidAmount=(selected,min,max)=>Math.min(max,Math.max(min,Number.isInteger(selected)?selected:min));

// Il timer mostra `total` secondi ma gli ultimi `final` durano `stretch` secondi veri.
export function shownSeconds(leftMs, final, stretch, total=60) {
  const s = leftMs / 1000;
  return s > stretch ? final+(total-final)*(s-stretch)/Math.max(1,total-stretch) : s * final / stretch;
}

function myBar(a) {
  const me = teamOf(a, a.me);
  if(!me)return '<p class="fanta-note">Segui l’asta come spettatore.</p>';
  return `<div class="fanta-a-me">
    <div><span>Crediti</span><strong>${me.credits}</strong></div>
    <div><span>Puntata max</span><strong>${me.maxBid}</strong></div>
    <div class="fanta-a-roles">${Object.entries(me.roles).map(([r, x]) =>
      `<span class="${x.have >= x.max ? 'is-full' : ''}"><i class="fanta-role is-${r}">${r}</i>${x.have}/${x.max}</span>`).join('')}</div>
  </div>`;
}
const adminControls=a=>a.isAdmin?`<div class="fanta-a-admin-controls">${a.lot||a.table?'<button type="button" class="secondary" data-asta-cancel="1">Annulla giocatore sul tavolo</button>':''}<button type="button" class="secondary" data-asta-close="1">Chiudi asta</button></div>`:'';

function ring(endsAt,total,label,rules,{compact=false,main=false,lampo=false}={}) {
  return `<div class="fanta-a-timer${compact?' auction-compact-clock':''}" role="timer" aria-label="Tempo residuo" ${main?'data-auction-main-clock':''} data-ends="${esc(endsAt)}" data-total="${total}" ${lampo?'data-lampo-clock':''} data-final="${rules.finalSeconds}" data-stretch="${rules.finalStretch}">
    <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" class="track"/><circle cx="30" cy="30" r="26" class="bar" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
    <b data-seconds>–</b><small>${label}</small>
  </div>`;
}

function bidderCard(row,ui,{credits=row.credits,projected=false,leading=false}={}){
  const member=memberOf(ui,row),name=row.computer?'Computer':member?.name||row.team.manager||row.team.name;
  return `<div class="auction-bidder auction-bidder-card${leading?' is-leading':''}">
    <span class="auction-bidder-avatar" aria-hidden="true">${row.computer?'🤖':avatarSvg(member?.avatar)}</span>
    <span class="auction-bidder-name"><b>${esc(name)}</b><small>${esc(row.team.name)}</small></span>
    <span class="auction-bidder-credits${projected?' is-projected':''}" aria-label="${credits} crediti${projected?' se si aggiudica il calciatore':' residui'}" ${projected?'title="Crediti se si aggiudica il calciatore"':''}><b>${credits}</b><small>cr</small></span>
  </div>`;
}

function offerControls(lot,st,ui){
  const amount=bidAmount(ui.amount,st.min,st.max),busy=!!ui.bidPending;
  return `<form class="auction-offer-controls" data-bid-form data-lot="${esc(lot.id)}" data-best="${lot.bid}" aria-label="Scegli il rilancio">
    <div class="auction-offer-amount">
      <button type="button" class="secondary auction-offer-step" data-bid-step="-1" aria-label="Diminuisci di un credito" ${busy||amount<=st.min?'disabled':''}>−</button>
      <div class="auction-offer-slider">
        <input id="fanta-a-amount" name="amount" data-auction-bid-range type="range" min="${st.min}" max="${st.max}" step="1" value="${amount}" style="--offer-fill:${100*(amount-st.min)/Math.max(1,st.max-st.min)}%" aria-label="Importo del rilancio" aria-valuetext="${amount} crediti" ${busy||st.min===st.max?'disabled':''}>
        <div class="auction-offer-bounds"><span>Min <b>${st.min}</b></span><span>Max <b>${st.max}</b></span></div>
      </div>
      <button type="button" class="secondary auction-offer-step" data-bid-step="1" aria-label="Aumenta di un credito" ${busy||amount>=st.max?'disabled':''}>+</button>
    </div>
    <div class="auction-offer-actions">
      <button type="button" class="secondary auction-offer-pass" data-asta-pass="1" ${busy?'disabled':''}>${ui.bidPending==='pass'?'Invio…':'Passo'}</button>
      <button type="submit" class="primary auction-offer-confirm" ${busy?'disabled':''}><span>${ui.bidPending==='bid'?'Invio…':'Rilancia'}</span><output for="fanta-a-amount">${amount} cr</output><span data-auction-bid-delta>(+${amount-lot.bid})</span></button>
    </div>
  </form>`;
}

function lotCard(a, ui, timer) {
  const lot = a.lot, p = lot.player, leader = teamOf(a, lot.leader), st = bidState(a);
  const outbid=ui.outbid&&ui.offerUntil>Date.now();
  return `<section class="fanta-a-lot${lot.leader === a.me ? ' is-mine' : ''}" aria-live="polite">
    <div class="fanta-a-player">
      <span class="fanta-a-shirt">${shirt(p.club)}</span>
      <div><span class="fanta-role is-${p.role}">${p.role}</span>
        <h2>${esc(p.name)}</h2>
        <small>${esc(p.club)} · valore ${p.value??'–'} · FM ${fm(p.fm)} · ${p.played??'–'} pres.</small></div>${timer}
    </div>
    <div class="fanta-a-bidrow">
      <div class="fanta-a-bid${ui.offerUntil>Date.now()?' is-new-offer':''}${outbid?' is-outbid':''}"><span class="auction-best-label">${outbid?'Ti hanno<br>superato!':'Offerta<br>migliore'}</span><strong class="auction-best-value">${lot.bid}</strong>
        ${leader?bidderCard(leader,ui,{credits:leader.credits-lot.bid,projected:true,leading:true}):'<em>Prima offerta libera</em>'}</div>
    </div>
    <p class="fanta-a-final" aria-hidden="true">Sta per scadere!</p>
    ${st.can?offerControls(lot,st,ui):''}
    ${st.why||ui.error?`<p class="fanta-a-why${st.leading?' is-ok':st.passed?' is-passed':''}">${esc(st.why||'')}${ui.error?` <b role="alert">${esc(ui.error)}</b>`:''}</p>`:''}
  </section>`;
}

const human=t=>t.human??(!t.computer&&!!t.team.userId);
const orderedTeams=a=>(a.order||[]).map(id=>teamOf(a,id)).filter(t=>t&&(a.mode==='manual'||human(t)||t.computer));

function activeBidders(a,ui){
  const order=orderedTeams(a),turn=Math.max(0,order.findIndex(t=>t.team.id===a.caller)),lot=a.lot;
  const remaining=[...order.slice(turn),...order.slice(0,turn)].filter(t=>!lot.passed?.includes(t.team.id)&&!lot.autoPassed?.[t.team.id]);
  return `<section class="auction-active-bidders" aria-label="Ancora in asta"><h2>Ancora in asta <span>${remaining.length}</span></h2>
    <ol aria-label="Partecipanti in ordine di chiamata">${remaining.map(t=>`<li data-active-auction-team="${esc(t.team.id)}">${bidderCard(t,ui,{leading:t.team.id===lot.leader})}</li>`).join('')}</ol></section>`;
}

function orderStrip(a) {
  const current=teamOf(a,a.caller);
  if(!current||a.config?.nomination==='random')return '';
  const teams=orderedTeams(a),index=teams.indexOf(current);
  const next=[...teams.slice(index+1),...teams.slice(0,Math.max(0,index))]
    .find(t=>t!==current&&t.slotsLeft>0&&t.maxBid>0&&(!a.currentRole||t.roles[a.currentRole]?.have<t.roles[a.currentRole]?.max));
  const name=t=>t?.team.id===a.me?'Tu':t?.team.name||'—';
  return `<div class="fanta-a-order auction-current-next" aria-label="Ordine di chiamata">
    <span><small>Chiama ora</small><b>${esc(name(current))}</b></span><span><small>Prossimo</small><b>${esc(name(next))}</b></span></div>`;
}

function lobbyCard(a,ui){
  const people=a.teams.filter(human);
  const connected=new Set(ui.presence??people.filter(t=>t.online).map(t=>t.team.id));
  const allHere=people.length>0&&people.every(t=>connected.has(t.team.id));
  return `<section class="auction-lobby"><h2>${a.lobbyEndsAt?'Si parte!':'Sala d’attesa'}</h2>
    <p>${people.filter(t=>connected.has(t.team.id)).length}/${people.length} allenatori in sala</p>
    <ul class="auction-lobby-members">${people.map(t=>{
      const here=connected.has(t.team.id),member=memberOf(ui,t);
      return `<li><i class="${here?'is-online':''}"></i><span class="auction-bidder-avatar" aria-hidden="true">${avatarSvg(member?.avatar)}</span><span><b>${esc(member?.name||t.team.manager||t.team.name)}</b><small>${esc(t.team.name)}</small></span><small>${here?'Connesso':'Disconnesso'}</small></li>`;
    }).join('')}</ul>
    ${allHere||a.lobbyEndsAt?a.config?.nomination==='random'?'<p>Chiamata automatica a estrazione.</p>':`<h3>Ordine di chiamata</h3><ol class="auction-lobby-order">${orderedTeams(a).map(t=>`<li>${esc(t.team.name)}</li>`).join('')}</ol>`:''}
    ${ui.error?`<p class="fanta-note is-alert" role="alert">${esc(ui.error)}</p>`:''}
    ${a.isAdmin&&!a.lobbyEndsAt?`<button type="button" class="primary" data-auction-lobby-start="1" ${ui.startingLobby?'disabled':''}>${ui.startingLobby?'Avvio…':'Start · 10 secondi'}</button>`:''}</section>`;
}

function waitingCard(a,timer='') {
  if (a.status === 'ended') return `<section class="fanta-a-lot is-idle"><h2>Asta finita</h2><p>Tutte le rose sono complete. Buon campionato!</p></section>`;
  const sale = a.lastSale;
  if (a.pausedUntil && sale && !a.skipped) {
    const t = teamOf(a, sale.team);
    return `<section class="fanta-a-lot is-sold" aria-live="polite">
      <span class="eyebrow">Aggiudicato</span>
      <div class="fanta-a-player"><span class="fanta-a-shirt">${shirt(sale.player.club)}</span>
        <div><h2>${esc(sale.player.name)}</h2><small>${sale.team === a.me ? 'È tuo!' : 'a ' + esc(t.team.name)} per <b>${sale.price}</b> crediti</small></div></div>
    </section>`;
  }
  if (a.pausedUntil && a.skipped) {
    if(a.skipped.player)return `<section class="fanta-a-lot is-idle"><span class="eyebrow">Nessuna offerta</span><h2>${esc(a.skipped.player)}</h2><p>Tra poco il prossimo giocatore.</p></section>`;
    const t = teamOf(a, a.skipped.team);
    return `<section class="fanta-a-lot is-idle" aria-live="polite"><span class="eyebrow">Turno saltato</span>
      <h2>${a.skipped.team === a.me ? 'Non hai chiamato in tempo' : `${esc(t.team.name)} non ha chiamato`}</h2><p>Il turno passa alla squadra successiva.</p></section>`;
  }
  if (a.caller && a.caller === a.me) {
    return `<section class="fanta-a-lot is-call" aria-live="polite">
      <div class="fanta-a-bidrow"><div><span class="eyebrow">Tocca a te</span><h2>Chiama un giocatore</h2>
        <p>Scegli dal listone e fai la prima offerta. Se il tempo scade, salti il turno.</p></div>${timer}</div>
      <button type="button" class="primary fanta-a-callbtn" data-asta-listone="1">Apri il listone</button>
    </section>`;
  }
  const c = teamOf(a, a.caller);
  if(!c)return '<section class="fanta-a-lot is-idle"><h2>Prepariamo il prossimo giocatore…</h2></section>';
  return `<section class="fanta-a-lot is-idle"><div class="fanta-a-bidrow"><div><span class="eyebrow">In attesa</span><h2>Sta chiamando ${esc(c.team.manager)}</h2>
    <p>${esc(c.team.name)} sceglie il prossimo giocatore dal listone…</p></div>${timer}</div></section>`;
}

// Stato di ogni squadra sul giocatore in tavola.
function lotTag(a, id) {
  const lot = a.lot;
  if (!lot) return a.mode !== 'manual' && id === a.caller ? ' <em>chiama</em>' : '';
  if (lot.leader === id) return ' <em>in testa</em>';
  if (lot.passed.includes(id)) return ' <em class="is-pass auction-passed">Passa</em>';
  if (lot.autoPassed[id]) return ` <em class="is-pass">${lot.autoPassed[id] === 'role' ? 'ruolo pieno' : 'senza crediti'}</em>`;
  return '';
}

function teamsList(a,ui,timer='') {
  const order=a.order?.length&&a.config?.nomination!=='random'?a.order.map(id=>teamOf(a,id)).filter(Boolean):a.teams;
  const connected=new Set(ui.presence??a.teams.filter(t=>t.online).map(t=>t.team.id));
  return `<section class="fanta-block"><div class="dash-section-head auction-clock-heading"><div><h2>Partecipanti</h2><small>crediti · puntata max · posti da riempire</small></div>${timer}</div>
    <ul class="fanta-a-teams">${order.map((t, i) => `<li class="${t.team.id === a.me ? 'is-me' : ''}${t.team.id === a.caller ? ' is-caller' : ''}">
      <i class="fanta-dot" style="background:${esc(t.team.color)}"></i>
      <span class="fanta-p-name"><b><button type="button" class="auction-team-name" data-auction-team="${esc(t.team.id)}" aria-haspopup="dialog">${a.mode === 'manual' ? '' : `${i + 1}. `}${esc(t.team.name)}</button>${lotTag(a, t.team.id)}</b><small>${t.computer?'Computer':human(t)?esc(t.team.manager)+(connected.has(t.team.id)?' · connesso':' · disconnesso'):'Senza allenatore'}</small></span>
      <span class="fanta-a-num"><b>${t.credits}</b><small>cr</small></span>
      <span class="fanta-a-num"><b>${t.maxBid}</b><small>max</small></span>
      <span class="fanta-a-num"><b>${t.slotsLeft}</b><small>posti</small></span>
    </li>`).join('')}</ul></section>`;
}

function logList(a) {
  if (!a.log.length) return '';
  const undo = a.isAdmin && a.mode === 'manual';
  return `<section class="fanta-block"><div class="dash-section-head"><div><h2>Ultimi acquisti</h2>${undo ? '<small>Hai sbagliato? Annulla e il giocatore torna nel listone.</small>' : ''}</div></div>
    <ul class="fanta-a-log${undo ? ' has-undo' : ''}">${a.log.slice(0,5).map(s => {
      const t = teamOf(a, s.team);
      return `<li><span class="fanta-mini-shirt">${shirt(s.player.club)}</span><span class="fanta-role is-${s.player.role}">${s.player.role}</span>
        <span class="fanta-p-name"><b>${esc(s.player.name)}</b><small><i class="fanta-dot" style="background:${esc(t.team.color)}"></i>${s.team === a.me ? 'Tu' : esc(t.team.name)}</small></span><b class="fanta-a-price">${s.price}</b>
        ${undo&&!s.released ? `<button type="button" class="fanta-a-undo" data-m-undo="${esc(s.id)}" aria-label="Annulla ${esc(s.player.name)}">×</button>` : ''}</li>`;
    }).join('')}</ul></section>`;
}

function myRoster(a,timer='') {
  const by = r => a.myRoster.filter(p => p.role === r);
  return `<section class="fanta-block"><div class="dash-section-head auction-clock-heading"><div><h2>La tua rosa</h2><small>${a.myRoster.length} di ${Object.values(a.rules.roster).reduce((x, y) => x + y, 0)}</small></div>${timer}</div>
    ${'PDCA'.split('').map(r => `<div class="fanta-a-myrole"><span class="fanta-role is-${r}">${r}</span><span>${by(r).map(p => `${esc(p.name)} <b>${p.price}</b>`).join(' · ') || '<i>nessuno</i>'}</span></div>`).join('')}
  </section>`;
}

// L'admin sceglie la modalità: online a tempo, oppure dal vivo con banditore.
function modeSwitch(a) {
  if (!a.isAdmin||a.config) return '';
  const b = (m, label, sub) => `<button type="button" class="${a.mode === m ? 'is-active' : ''}" data-asta-mode="${m}" aria-pressed="${a.mode === m}"><b>${label}</b><small>${sub}</small></button>`;
  return `<div class="fanta-a-modes" role="group" aria-label="Modalità asta">${b('live', 'Online', 'a turni, con timer')}${b('manual', 'Dal vivo', 'a voce, registra il banditore')}</div>`;
}

// ---------- Asta dal vivo (manuale) ----------

// Tap sulla squadra = assegna (dopo una conferma). Spente se ruolo pieno o prezzo oltre la loro puntata massima.
function teamPicker(a, p, price) {
  return `<div class="fanta-m-teams">${a.teams.map(t => {
    const r = t.roles[p.role], full = r.have >= r.max, over = price > t.maxBid, off = full || !(price >= 1) || over;
    const note = full ? `${p.role} completi` : over ? `max ${t.maxBid}: non basta` : `${t.credits} cr · max ${t.maxBid} · ${p.role} ${r.have}/${r.max}`;
    return `<button type="button" class="fanta-m-team${over || full ? ' is-blocked' : ''}" data-m-team="${esc(t.team.id)}" ${off ? 'disabled' : ''}>
      <i style="background:${esc(t.team.color)}"></i><b>${esc(t.team.name)}</b><small>${note}</small></button>`;
  }).join('')}</div>`;
}

// Pop-up di conferma dell'assegnazione (asta dal vivo).
export function renderAssignConfirm(a, teamId, price) {
  const p = a.table, t = teamOf(a, teamId);
  if (!p || !t) return '';
  return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div>
    <div class="fanta-confirm" role="alertdialog" aria-modal="true" aria-labelledby="fanta-confirm-title">
      <span class="fanta-a-shirt">${shirt(p.club)}</span>
      <h2 id="fanta-confirm-title">${esc(p.name)}</h2>
      <p>a <b style="--c:${esc(t.team.color)}">${esc(t.team.name)}</b> per <strong>${price}</strong> crediti</p>
      <div class="fanta-confirm-actions">
        <button type="button" class="secondary" data-action="close-sheet">Annulla</button>
        <button type="button" class="primary" data-m-confirm="${esc(teamId)}">Assegna</button>
      </div>
    </div>`;
}

function manualConsole(a, ui, players) {
  const p = a.table;
  if (!p) {
    if(a.config?.nomination==='random')return '<section class="fanta-m-console"><h2>Estrazione dal listone</h2><button type="button" class="primary" data-asta-draw="1">Estrai un giocatore</button></section>';
    const q = (ui.mq || '').trim().toLowerCase(), role = ui.mrole || 'tutti';
    const list = (players || []).filter(x => (!a.currentRole||x.role===a.currentRole) && (a.currentRole||role === 'tutti' || x.role === role) && (!q || x.name.toLowerCase().includes(q) || x.club.toLowerCase().includes(q))).slice(0, 8);
    const chips = [['tutti', 'Tutti'], ['P', 'P'], ['D', 'D'], ['C', 'C'], ['A', 'A']].map(([k, l]) => `<button type="button" class="v2-chip${role === k ? ' is-active' : ''}" data-m-role="${k}">${l}</button>`).join('');
    return `<section class="fanta-m-console">
      <span class="eyebrow">1 · Chi si chiama?</span><h2>Scegli il giocatore</h2>
      <p>Quando qualcuno lo chiama a voce, cercalo e mettilo sul tavolo: lo vedranno tutti sul telefono.</p>
      <input id="fanta-m-q" class="fanta-a-search" type="search" placeholder="Cerca per nome o squadra" value="${esc(ui.mq || '')}" aria-label="Cerca giocatore">
      ${a.currentRole?'':`<div class="v2-chips fanta-filter">${chips}</div>`}
      <div class="fanta-pick-list">${players ? list.map(x => `<button type="button" class="fanta-pick-row" data-m-table="${esc(x.id)}">
        <span class="fanta-mini-shirt">${shirt(x.club)}</span><span class="fanta-role is-${x.role}">${x.role}</span>
        <span class="fanta-p-name"><b>${esc(x.name)}</b><small>${esc(x.club)} · FM ${fm(x.fm)}</small></span>
        <span class="fanta-roster-stats"><b>${x.value}</b><small>valore</small></span></button>`).join('') || '<p class="fanta-note">Nessun giocatore trovato.</p>' : '<p class="fanta-note">Carichiamo il listone…</p>'}</div>
    </section>`;
  }
  const price = Number(ui.mprice);
  return `<section class="fanta-m-console">
    <div class="fanta-m-table">
      <span class="fanta-a-shirt">${shirt(p.club)}</span>
      <div class="fanta-m-who"><span class="eyebrow">Sul tavolo</span><h2>${esc(p.name)}</h2>
        <small>${p.role} · ${esc(p.club)} · val ${p.value??'–'}</small>
        <button type="button" class="fanta-link is-muted" data-m-clear="1">Cambia giocatore</button></div>
      <label class="fanta-m-price"><span>Prezzo</span>
        <input id="fanta-m-price" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0" value="${esc(ui.mprice ?? '')}" aria-label="Prezzo di aggiudicazione"></label>
    </div>
    <span class="eyebrow">${price >= 1 ? `Tocca la squadra che lo prende per ${price}` : 'Scrivi il prezzo, poi tocca la squadra'}</span>
    ${teamPicker(a, p, price)}
    ${ui.error ? `<p class="fanta-note is-alert">${esc(ui.error)}</p>` : ''}
  </section>`;
}

// Quello che vedono tutti gli altri durante l'asta dal vivo.
function manualTable(a) {
  const p = a.table;
  if (!p) return `<section class="fanta-a-lot is-idle"><span class="eyebrow">Asta dal vivo</span><h2>Si chiama a voce</h2>
    <p>Il banditore (${esc(a.auctioneer)}) mette sul tavolo il giocatore chiamato e registra chi lo prende e a quanto.</p></section>`;
  return `<section class="fanta-a-lot" aria-live="polite"><span class="eyebrow">Sul tavolo adesso</span>
    <div class="fanta-a-player"><span class="fanta-a-shirt">${shirt(p.club)}</span>
      <div><span class="fanta-role is-${p.role}">${p.role}</span><h2>${esc(p.name)}</h2><small>${esc(p.club)} · valore ${p.value??'–'} · FM ${fm(p.fm)} · ${p.played??'–'} pres.</small></div></div>
    <p>Rilanciate a voce: quando il banditore assegna, lo vedete qui.</p></section>`;
}

function lastSaleBanner(a) {
  const s = a.log[0];
  if (!s) return '';
  const t = teamOf(a, s.team);
  return `<div class="fanta-m-last"><span class="fanta-mini-shirt">${shirt(s.player.club)}</span>
    <span class="fanta-p-name"><b>Ultimo: ${esc(s.player.name)}</b><small><i class="fanta-dot" style="background:${esc(t.team.color)}"></i>${s.team === a.me ? 'a te' : 'a ' + esc(t.team.name)} per ${s.price}</small></span>
    ${a.isAdmin&&!s.released ? `<button type="button" class="fanta-link" data-m-undo="${esc(s.id)}">Annulla</button>` : ''}</div>`;
}

const roomPanels=['Tavolo','Partecipanti','La tua rosa'];
export function renderAsta(a, ui = {}, players = null) {
  const phase=a?.phase==='releases'&&a.status==='running';
  const lobby=a?.phase==='lobby'&&a.status==='running';
  const online=a?.status==='running'&&a.mode==='live'&&!phase;
  const compact=online&&!lobby,deadline=compact&&(a.lot?.endsAt||a.callDeadline);
  const compactClock=(main=false)=>deadline?ring(deadline,a.lot?.timerSeconds||a.rules.callSeconds,'sec',a.rules,{compact:true,main,lampo:a.type==='lampo'&&!!a.lot}):'';
  const timer=lobby?(a.lobbyEndsAt?ring(a.lobbyEndsAt,10,'sec',{finalSeconds:3,finalStretch:3},{main:true}):'<span class="auction-clock-label">In attesa</span>'):a?.status==='scheduled'?`<span class="auction-clock-label" data-countdown="${esc(a.startsAt)}">In attesa</span>`:a?.status==='running'?`<span class="auction-clock-label">${phase?'Svincoli':'Dal vivo'}</span>`:'';
  const label=a?.status==='scheduled'?'Asta programmata':a?.status==='ended'?'Asta chiusa':phase?'Svincoli':a?.mode==='manual'?'Asta dal vivo':'Sala d’asta';
  let center;
  if(!a)center='<p class="fanta-loading" role="status">Entriamo nella sala d’asta…</p>';
  else if(phase)center=renderReleases(a,ui);
  else if(lobby)center=lobbyCard(a,ui)+adminControls(a);
  else if(a.status==='running')center=`${adminControls(a)}${a.mode==='manual'?modeSwitch(a):''}${myBar(a)}
    ${a.mode==='manual'?`${a.config&&a.caller?orderStrip(a):''}${a.isAdmin?manualConsole(a,ui,players):manualTable(a)}`:`${orderStrip(a)}${a.lot?lotCard(a,ui,compactClock(true))+activeBidders(a,ui):waitingCard(a,compactClock(true))}`}
    ${a.mode==='manual'?lastSaleBanner(a):''}`;
  else center=`<section class="fanta-a-lot is-idle"><h2>${a.status==='scheduled'?esc(auctionWhen(a.startsAt)):a.status==='ended'?'L’asta è finita':'Nessuna asta in programma'}</h2>
    ${a.status==='scheduled'?'<p>La sala si apre automaticamente all’orario programmato.</p>':''}
    ${a.status==='ended'&&(a.competition?.status==='active'||a.competitionActivation?.status==='active')?'<p>La competizione è avviata.</p><button type="button" class="primary" data-go="formazione">Schiera la formazione →</button>':''}
    ${a.isAdmin?'<button type="button" class="primary" data-auction-manage="1">Gestisci asta →</button>':''}</section>`;
  const panes=[center,a?teamsList(a,ui,compactClock())+logList(a):'',a?myRoster(a,compactClock()):''];
  const panel=ui.panel||0;
  return `<section class="fanta-asta auction-room${compact?' is-compact':''}" aria-label="Sala d’asta">
    ${compact?'<p class="auction-compact-connection" data-auction-connection role="status" hidden></p>':`<header class="auction-page-head"><button type="button" class="secondary" data-auction-exit="1">Esci ×</button><div><span class="eyebrow">${a?.currentRole?esc(ROLE_PLURAL[a.currentRole]):a?.config?.nomination==='random'?'Estrazione casuale':a?.computerTeamsActive?'Con squadre del computer':'Asta'}</span><h1>${label}</h1><p data-auction-connection role="status"></p></div>${timer}</header>`}
    <nav class="auction-room-tabs" aria-label="Schede dell’asta">${roomPanels.map((text,i)=>`<button type="button" class="v2-chip${i===panel?' is-active':''}" aria-pressed="${i===panel}" data-auction-panel="${i}">${text}</button>`).join('')}</nav>
    <div class="auction-panels" data-auction-panels>${panes.map((html,i)=>`<section class="auction-pane" aria-label="${roomPanels[i]}">${html}</section>`).join('')}</div>
    ${online?`<div class="auction-countdown-overlay${lobby?' is-start':''}" data-auction-countdown-overlay hidden><div><small>${lobby?'L’asta inizia tra':'Tempo in scadenza'}</small><strong data-overlay-seconds>–</strong></div></div>`:''}
  </section>`;
}
// ---------- Listone per la chiamata ----------

export function renderListoneRows(players, a, { query = '', role = 'tutti', picking } = {}) {
  const me = teamOf(a, a.me), q = query.trim().toLowerCase();
  const list = players.filter(p => (a.currentRole?p.role===a.currentRole:role === 'tutti' || p.role === role) && (!q || [p.name,p.club].some(value=>String(value??'').toLowerCase().includes(q)))).slice(0, 80);
  if (!list.length) return '<p class="fanta-note">Nessun giocatore trovato.</p>';
  return list.map(p => {
    const full = me.roles[p.role].have >= me.roles[p.role].max;
    return `<button type="button" class="fanta-pick-row${picking === p.id ? ' is-picked' : ''}" data-asta-pick="${esc(p.id)}" ${full ? 'disabled' : ''}>
      <span class="fanta-mini-shirt">${shirt(p.club)}</span><span class="fanta-role is-${p.role}">${p.role}</span>
      <span class="fanta-p-name"><b>${esc(p.name)}</b><small>${esc(p.club)} · FM ${fm(p.fm)}${full ? ' · ruolo completo' : ''}</small></span>
      <span class="fanta-roster-stats"><b>${p.value??'–'}</b><small>valore</small></span>
    </button>`;
  }).join('');
}

export function renderListoneSheet(players, a, ui) {
  const me = teamOf(a, a.me), picked = ui.picking && players.find(p => p.id === ui.picking);
  const roles = [['tutti', 'Tutti'], ['P', 'P'], ['D', 'D'], ['C', 'C'], ['A', 'A']].map(([k, l]) =>
    `<button type="button" class="v2-chip${(ui.role || 'tutti') === k ? ' is-active' : ''}" data-asta-role="${k}">${l}</button>`).join('');
  const amount = ui.callAmount ?? (picked ? Math.max(1, Math.min(me.maxBid, Math.round((picked.value||1) * 0.3))) : 1);
  return `<div class="fanta-ps-head"><div><h2 id="fanta-sheet-title">Il listone</h2><small>${players.length} giocatori liberi · ordinati per valore</small></div>
      ${a.callDeadline ? `<div class="fanta-a-timer is-small" data-ends="${esc(a.callDeadline)}" data-total="${a.rules.callSeconds}" data-final="${a.rules.finalSeconds}" data-stretch="${a.rules.finalStretch}" title="Tempo per chiamare">
        <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" class="track"/><circle cx="30" cy="30" r="26" class="bar" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg><b data-seconds>–</b></div>` : ''}
      <button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>
    ${picked ? `<div class="fanta-a-confirm">
      <span class="fanta-mini-shirt">${shirt(picked.club)}</span>
      <span class="fanta-p-name"><b>${esc(picked.name)}</b><small>${ROLE_NAMES[picked.role]} · valore ${picked.value}</small></span>
      <div class="fanta-a-stepper">
        <button type="button" data-asta-amount="${Math.max(1, amount - 1)}" aria-label="Meno">−</button>
        <b>${amount}</b>
        <button type="button" data-asta-amount="${Math.min(me.maxBid, amount + 1)}" aria-label="Più">+</button>
      </div>
      <button type="button" class="primary" data-asta-call="${esc(picked.id)}" data-amount="${amount}">Chiama a ${amount}</button>
      ${ui.error ? `<p class="fanta-note is-alert">${esc(ui.error)}</p>` : ''}
    </div>` : ''}
    <input class="fanta-a-search" data-asta-q type="search" placeholder="Cerca per nome o squadra" value="${esc(ui.query || '')}" aria-label="Cerca nel listone">
    ${a.currentRole?'':`<div class="v2-chips fanta-filter">${roles}</div>`}
    <div class="fanta-pick-list" id="fanta-listone-rows">${renderListoneRows(players, a, ui)}</div>`;
}

// Aggiorna i cerchi del timer (chiamato più volte al secondo, senza ridisegnare).
// Negli ultimi secondi (rallentati) il timer e la card del giocatore vanno in "allarme".
export function tickAuction(root, offset = 0, onFinal) {
  const now = Date.now() + offset;
  const overlay=root.querySelector('[data-auction-countdown-overlay]');
  let overlaySeconds=null;
  for (const el of root.querySelectorAll('[data-ends]')) {
    const lobby=overlay?.classList.contains('is-start'),total=Number(el.dataset.total),left=Math.max(0,Date.parse(el.dataset.ends)-now);
    const lampo=el.hasAttribute('data-lampo-clock');
    const shown=lampo?lampoShownSeconds(left):lobby||total<=5?left/1000:shownSeconds(left,5,3,total);
    const inFinal=left>0&&left<=(lampo?LAMPO.stretch*1000:3000);
    el.querySelector('[data-seconds]').textContent = Math.ceil(shown);
    el.querySelector('.bar')?.setAttribute('stroke-dashoffset', String(RING * (1 - Math.min(1, shown / total))));
    el.classList.toggle('is-final', inFinal);
    el.closest('.fanta-a-lot')?.classList.toggle('is-final', inFinal);
    if(left>0&&el.hasAttribute('data-auction-main-clock')&&(lobby||inFinal))overlaySeconds=Math.ceil(shown);
    if(inFinal)onFinal?.(el.dataset.ends,Math.ceil(lampo?shown:left/1000));
    // Una volta sola per timer, e solo dopo che l'utente ha toccato la pagina (il browser lo richiede).
    if (inFinal && vibratedFor !== el.dataset.ends) { vibratedFor = el.dataset.ends; if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([40, 60, 40]); }
  }
  if(overlay){overlay.hidden=overlaySeconds===null;if(overlaySeconds!==null)overlay.querySelector('[data-overlay-seconds]').textContent=overlaySeconds;}
}
let vibratedFor = null;

export function auctionAudio(win){
  let context, enabled=false, playedFor;
  function play(frequency,next,duration){
    if(!enabled||context?.state!=='running')return;
    const tone=context.createOscillator(),volume=context.createGain(),at=context.currentTime;
    tone.frequency.setValueAtTime(frequency,at);tone.frequency.setValueAtTime(next,at+duration/2);
    volume.gain.setValueAtTime(.12,at);volume.gain.exponentialRampToValueAtTime(.001,at+duration);
    tone.connect(volume);volume.connect(context.destination);tone.start(at);tone.stop(at+duration+.02);
  }
  return {
    get enabled(){return enabled;},
    async set(value){
      enabled=value;
      if(!value)return;
      const Audio=win.AudioContext||win.webkitAudioContext;
      if(!Audio){enabled=false;return;}
      try{context??=new Audio();await context.resume();}catch{enabled=false;}
    },
    alert(deadline,second=1){
      const key=deadline+':'+second;
      if(!enabled||context?.state!=='running'||playedFor===key)return;
      playedFor=key;
      play(740,980,.28);
    },
    offer(){play(420,630,.18);},
    close(){if(context&&context.state!=='closed')void context.close().catch(()=>{});}
  };
}
