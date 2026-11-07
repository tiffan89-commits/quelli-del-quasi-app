// Sala d'asta: giocatore sul tavolo con offerta e timer, rilanci rapidi, chiamata dal listone,
// partecipanti con crediti e posti, ultimi acquisti e la propria rosa. Funzioni pure: dati → HTML.
// Il timer si aggiorna da solo (tickAuction) senza ridisegnare la pagina.
import { esc, pts } from './formato.mjs';
import { shirt } from './maglie.mjs';
import {auctionWhen} from './auction-wizard.mjs';
import {renderReleases} from './mercato.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const RAISES = [1, 5, 10];
const RING = 2 * Math.PI * 26;

const teamOf = (a, id) => a.teams.find(t => t.team.id === id);
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
  return { can: true, min, max: me.maxBid };
}

// Il timer mostra `total` secondi ma gli ultimi `final` durano `stretch` secondi veri.
export function shownSeconds(leftMs, final, stretch) {
  const s = leftMs / 1000;
  return s > stretch ? s - (stretch - final) : s * final / stretch;
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

function ring(endsAt, total, label, rules) {
  return `<div class="fanta-a-timer" data-ends="${esc(endsAt)}" data-total="${total}" data-final="${rules.finalSeconds}" data-stretch="${rules.finalStretch}">
    <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" class="track"/><circle cx="30" cy="30" r="26" class="bar" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
    <b data-seconds>–</b><small>${label}</small>
  </div>`;
}

function lotCard(a, ui) {
  const lot = a.lot, p = lot.player, leader = teamOf(a, lot.leader), st = bidState(a);
  const raise = RAISES.map(n => {
    const amount = lot.bid + n;
    const ok = st.can && amount <= st.max;
    return `<button type="button" class="fanta-a-raise" data-bid="${amount}" ${ok ? '' : 'disabled'}><small>+${n}</small><b>${amount}</b></button>`;
  }).join('');
  return `<section class="fanta-a-lot${lot.leader === a.me ? ' is-mine' : ''}" aria-live="polite">
    <div class="fanta-a-player">
      <span class="fanta-a-shirt">${shirt(p.club)}</span>
      <div><span class="fanta-role is-${p.role}">${p.role}</span>
        <h2>${esc(p.name)}</h2>
        <small>${esc(p.club)} · valore ${p.value??'–'} · FM ${fm(p.fm)} · ${p.played??'–'} pres.</small></div>
    </div>
    <div class="fanta-a-bidrow">
      <div class="fanta-a-bid"><span>Offerta</span><strong>${lot.bid}</strong>
        ${leader?`<em style="--c:${esc(leader.team.color)}">${lot.leader === a.me ? 'Tu' : esc(leader.team.name)}</em>`:'<em>Prima offerta libera</em>'}</div>
    </div>
    <p class="fanta-a-final" aria-hidden="true">Sta per scadere!</p>
    <div class="fanta-a-raises">${raise}</div>
    <form class="fanta-a-custom" data-bid-form>
      <input id="fanta-a-amount" name="amount" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Altra cifra" value="${esc(ui.amount ?? '')}" ${st.can ? '' : 'disabled'} aria-label="Offerta libera">
      <button type="submit" class="primary" ${st.can ? '' : 'disabled'}>Offri</button>
    </form>
    ${st.can ? '<button type="button" class="secondary fanta-a-pass" data-asta-pass="1">Passo <small>non mi interessa, esco da questo giocatore</small></button>' : ''}
    <p class="fanta-a-why${st.leading ? ' is-ok' : st.passed ? ' is-passed' : ''}">${st.why ? esc(st.why) : `Minimo ${st.min} · massimo ${st.max}`}${ui.error ? ` · <b>${esc(ui.error)}</b>` : ''}</p>
    ${lot.history.length ? `<small class="auction-history-label">Ultime offerte</small><ol class="fanta-a-history" aria-label="Ultime offerte">${lot.history.filter(h=>!h.pass).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,5).map(h => {
      const t = teamOf(a, h.team), who = h.team === a.me ? 'Tu' : esc(t.team.name);
      return `<li><i style="background:${esc(t.team.color)}"></i>${who}<span>${h.call ? 'chiama a' : 'rilancia a'}</span><b>${h.amount}</b></li>`;
    }).join('')}</ol>` : ''}
  </section>`;
}

// Ordine di chiamata deciso a caso dall'app: chi tocca adesso e quando tocca a me.
function orderStrip(a) {
  if(!a.order?.length||a.config?.nomination==='random')return '';
  const pos = a.order.indexOf(a.caller), mine = a.order.indexOf(a.me), wait = (mine - pos + a.order.length) % a.order.length;
  return `<div class="fanta-a-order" aria-label="Ordine di chiamata">
    <span class="fanta-a-order-label">Ordine di chiamata · ${mine<0?'segui i turni':wait === 0 ? 'tocca a te' : wait === 1 ? 'tu sei il prossimo' : `tocca a te tra ${wait} turni`}</span>
    <ol>${a.order.map((id, i) => {
      const t = teamOf(a, id);
      return `<li class="${id === a.caller ? 'is-now' : ''}${id === a.me ? ' is-me' : ''}${t.slotsLeft === 0 ? ' is-done' : ''}" title="${esc(t.team.name)}">
        <b>${i + 1}</b><i style="background:${esc(t.team.color)}"></i><span>${id === a.me ? 'Tu' : esc(t.team.name)}</span></li>`;
    }).join('')}</ol>
  </div>`;
}

function waitingCard(a) {
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
        <p>Scegli dal listone e fai la prima offerta. Se il tempo scade, salti il turno.</p></div></div>
      <button type="button" class="primary fanta-a-callbtn" data-asta-listone="1">Apri il listone</button>
    </section>`;
  }
  const c = teamOf(a, a.caller);
  if(!c)return '<section class="fanta-a-lot is-idle"><h2>Prepariamo il prossimo giocatore…</h2></section>';
  return `<section class="fanta-a-lot is-idle"><div class="fanta-a-bidrow"><div><span class="eyebrow">In attesa</span><h2>Sta chiamando ${esc(c.team.manager)}</h2>
    <p>${esc(c.team.name)} sceglie il prossimo giocatore dal listone…</p></div></div></section>`;
}

// Stato di ogni squadra sul giocatore in tavola.
function lotTag(a, id) {
  const lot = a.lot;
  if (!lot) return a.mode !== 'manual' && id === a.caller ? ' <em>chiama</em>' : '';
  if (lot.leader === id) return ' <em>in testa</em>';
  if (lot.passed.includes(id)) return ' <em class="is-pass">passa</em>';
  if (lot.autoPassed[id]) return ` <em class="is-pass">${lot.autoPassed[id] === 'role' ? 'ruolo pieno' : 'senza crediti'}</em>`;
  return '';
}

function teamsList(a) {
  const order=a.order?.length&&a.config?.nomination!=='random'?a.order.map(id=>teamOf(a,id)).filter(Boolean):a.teams;
  return `<section class="fanta-block"><div class="dash-section-head"><div><h2>Partecipanti</h2><small>crediti · puntata max · posti da riempire</small></div></div>
    <ul class="fanta-a-teams">${order.map((t, i) => `<li class="${t.team.id === a.me ? 'is-me' : ''}${t.team.id === a.caller ? ' is-caller' : ''}">
      <i class="fanta-dot" style="background:${esc(t.team.color)}"></i>
      <span class="fanta-p-name"><b>${a.mode === 'manual' ? '' : `${i + 1}. `}${esc(t.team.name)}${lotTag(a, t.team.id)}</b><small>${t.computer?'Computer':esc(t.team.manager)+(t.online?'':' · non collegato')}</small></span>
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

function myRoster(a) {
  const by = r => a.myRoster.filter(p => p.role === r);
  return `<section class="fanta-block"><div class="dash-section-head"><div><h2>La tua rosa</h2><small>${a.myRoster.length} di ${Object.values(a.rules.roster).reduce((x, y) => x + y, 0)}</small></div></div>
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
  const online=a?.status==='running'&&a.mode==='live'&&!phase;
  const timer=online?(a.lot?ring(a.lot.endsAt,a.lot.timerSeconds,'sec',a.rules):a.callDeadline?ring(a.callDeadline,a.rules.callSeconds,'sec',a.rules):'<span class="auction-clock-label">Prossimo lotto</span>'):a?.status==='scheduled'?`<span class="auction-clock-label" data-countdown="${esc(a.startsAt)}">In attesa</span>`:a?.status==='running'?`<span class="auction-clock-label">${phase?'Svincoli':'Dal vivo'}</span>`:'';
  const label=a?.status==='scheduled'?'Asta programmata':a?.status==='ended'?'Asta chiusa':phase?'Svincoli':a?.mode==='manual'?'Asta dal vivo':'Sala d’asta';
  let center;
  if(!a)center='<p class="fanta-loading" role="status">Entriamo nella sala d’asta…</p>';
  else if(phase)center=renderReleases(a,ui);
  else if(a.status==='running')center=`${adminControls(a)}${a.mode==='manual'?modeSwitch(a):''}${myBar(a)}
    ${a.mode==='manual'?`${a.config&&a.caller?orderStrip(a):''}${a.isAdmin?manualConsole(a,ui,players):manualTable(a)}`:`${orderStrip(a)}${a.lot?lotCard(a,ui):waitingCard(a)}`}
    ${a.mode==='manual'?lastSaleBanner(a):''}`;
  else center=`<section class="fanta-a-lot is-idle"><h2>${a.status==='scheduled'?esc(auctionWhen(a.startsAt)):a.status==='ended'?'L’asta è finita':'Nessuna asta in programma'}</h2>
    ${a.status==='scheduled'?'<p>La sala si apre automaticamente all’orario programmato.</p>':''}
    ${a.status==='ended'&&(a.competition?.status==='active'||a.competitionActivation?.status==='active')?'<p>La competizione è avviata.</p><button type="button" class="primary" data-go="formazione">Schiera la formazione →</button>':''}
    ${a.isAdmin?'<button type="button" class="primary" data-auction-manage="1">Gestisci asta →</button>':''}</section>`;
  const panes=[center,a?teamsList(a)+logList(a):'',a?myRoster(a):''];
  const panel=ui.panel||0;
  return `<section class="fanta-asta auction-room" aria-label="Sala d’asta">
    <header class="auction-page-head"><button type="button" class="secondary" data-auction-exit="1">Esci ×</button><div><span class="eyebrow">${a?.currentRole?esc(ROLE_PLURAL[a.currentRole]):a?.config?.nomination==='random'?'Estrazione casuale':a?.computerTeamsActive?'Con squadre del computer':'Asta'}</span><h1>${label}</h1><p data-auction-connection role="status"></p></div>${timer}${online?`<button type="button" class="auction-sound secondary" data-auction-sound="1" aria-pressed="${!!ui.sound}" aria-label="${ui.sound?'Disattiva audio':'Attiva audio'}">${ui.sound?'♫':'♪'}</button>`:''}</header>
    <nav class="auction-room-tabs" aria-label="Schede dell’asta">${roomPanels.map((text,i)=>`<button type="button" class="v2-chip${i===panel?' is-active':''}" aria-pressed="${i===panel}" data-auction-panel="${i}">${text}</button>`).join('')}</nav>
    <div class="auction-panels" data-auction-panels>${panes.map((html,i)=>`<section class="auction-pane" aria-label="${roomPanels[i]}">${html}</section>`).join('')}</div>
  </section>`;
}
// ---------- Listone per la chiamata ----------

export function renderListoneRows(players, a, { query = '', role = 'tutti', picking } = {}) {
  const me = teamOf(a, a.me), q = query.trim().toLowerCase();
  const list = players.filter(p => (a.currentRole?p.role===a.currentRole:role === 'tutti' || p.role === role) && (!q || p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q))).slice(0, 80);
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
  const amount = ui.callAmount ?? (picked ? Math.max(1, Math.min(me.maxBid, Math.round(picked.value * 0.3))) : 1);
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
  for (const el of root.querySelectorAll('[data-ends]')) {
    const final = Number(el.dataset.final || 3), stretch = Number(el.dataset.stretch || 3), total = Number(el.dataset.total);
    const shown = Math.max(0, shownSeconds(Math.max(0, Date.parse(el.dataset.ends) - now), final, stretch));
    const inFinal = shown > 0 && shown <= final;
    el.querySelector('[data-seconds]').textContent = Math.ceil(shown);
    el.querySelector('.bar')?.setAttribute('stroke-dashoffset', String(RING * (1 - Math.min(1, shown / total))));
    el.classList.toggle('is-final', inFinal);
    el.closest('.fanta-a-lot')?.classList.toggle('is-final', inFinal);
    if(inFinal)onFinal?.(el.dataset.ends);
    // Una volta sola per timer, e solo dopo che l'utente ha toccato la pagina (il browser lo richiede).
    if (inFinal && vibratedFor !== el.dataset.ends) { vibratedFor = el.dataset.ends; if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([40, 60, 40]); }
  }
}
let vibratedFor = null;

export function auctionAudio(win){
  let context, enabled=false, playedFor;
  return {
    get enabled(){return enabled;},
    async set(value){
      enabled=value;
      if(!value)return;
      const Audio=win.AudioContext||win.webkitAudioContext;
      if(!Audio){enabled=false;return;}
      try{context??=new Audio();await context.resume();}catch{enabled=false;}
    },
    alert(deadline){
      if(!enabled||context?.state!=='running'||playedFor===deadline)return;
      playedFor=deadline;
      const tone=context.createOscillator(),volume=context.createGain(),at=context.currentTime;
      tone.frequency.setValueAtTime(740,at);tone.frequency.setValueAtTime(980,at+.12);
      volume.gain.setValueAtTime(.12,at);volume.gain.exponentialRampToValueAtTime(.001,at+.28);
      tone.connect(volume);volume.connect(context.destination);tone.start(at);tone.stop(at+.3);
    },
    close(){if(context&&context.state!=='closed')void context.close().catch(()=>{});}
  };
}
