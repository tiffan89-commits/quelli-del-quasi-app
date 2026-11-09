import {slipTeamLabel} from '../club-crest.mjs';
import {patchRegion} from '../live-channel.mjs';
import {pointTerms,QUOTA_SCORING,roundPointRules,slipPointTerms} from '../../scoring.mjs';
// 0.26: righe compatibili con patchSlipResults (data-match-card, data-inline-result, data-match-status, data-pick-feedback).
// Schedina v2: 1/X/2 al primo livello, altri mercati espandibili, barra fissa con puntata e quota totale.
// Usa lo stesso modello dati di app.mjs: picks[match.id] = valore (es. "1", "X2", "Over 2.5").
import {eventDeadline,eventCountdown} from '../../slip-events.mjs';
import { slipSummary, editingClosed,editingEventLocked,sourceOf,roundAvailability } from '../slip-state.mjs';
import { barKickoff,inlineResultView,slipNotice } from '../slip-results.mjs';
import {orderSlipMatches} from '../../match-layout.mjs';
import {teamCode,pickCode} from '../bar-slips.mjs';

export const MAIN = ['1', 'X', '2'];
export const EXTRA = ['1X', '12', 'X2', 'Under 2.5', 'Over 2.5', 'Goal', 'No Goal'];
const show = (p) => p.replace(' 2.5', ' 2,5');
const ticketQuote=new Intl.NumberFormat('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});

export function totalOdds(round, picks) {
  let t = 1, n = 0;
  for (const m of round?.matches || []) {
    const p = picks[m.id];
    if (typeof p === 'string' && Number.isFinite(m.odds?.[p])) { t *= m.odds[p]; n++; }
  }
  return n ? t : null;
}

function optionPrice(m,p,closed,round){
  const saved=round.slip?.picks?.[m.id]===p?round.slip:null;
  const rules=roundPointRules(round);
  const accepted=closed&&saved&&rules?.scoring===QUOTA_SCORING?slipPointTerms(round,m,saved).correct:null;
  const odd=accepted??(round.eventBetting?saved?.acceptedOdds?.[m.id]:null)??m.odds?.[p];
  return {odd,saved,rules};
}

function option(m, p, picks, closed, esc, fmt, pointsOnly,round,barTicket=false) {
  const on = picks[m.id] === p;
  const {odd,saved,rules}=optionPrice(m,p,closed,round);
  if(barTicket){
    const quote=Number.isFinite(odd)?ticketQuote.format(odd):'—';
    return `<button type="button" class="v2-odd${on?' is-on':''}" data-pick="${esc(m.id)}" data-value="${esc(p)}"
      ${closed||round.virtualBookmaker&&!Number.isFinite(odd)?'disabled':''} aria-pressed="${on}"
      aria-label="${esc(m.home+' – '+m.away+': '+show(p)+' · '+(Number.isFinite(odd)?'quota '+quote:'quota non disponibile'))}">
      <b>${esc(pickCode(p))}</b><span>${quote}</span></button>`;
  }
  const quote=Number.isFinite(odd)?fmt(odd)+(m.oddsEstimated?.[p]?'*':''):null;
  let label=quote?'Quota '+quote:'Quota in arrivo', points='';
  if(pointsOnly){
    const terms=(closed&&saved?.pointTerms?.[m.id])||m.pointOffers?.[p]||pointTerms(m,p,{mode:'weighted',scoring:'difficulty-v2',correct:1,wrong:-1,...rules});
    const amount=n=>Number.isFinite(n)?(n>0?'+':n<0?'−':'')+Number(Math.abs(n).toFixed(2)).toLocaleString('it-IT'):'—';
    const gain=terms.correct===null?'?':amount(terms.correct),loss=amount(terms.wrong);
    label=(terms.correct===null?'punti in attesa della quota':gain+' punti se corretto')+', '+loss+' punti se sbagliato';
    points='<small class="v2-odd-points"><em class="points-gain">'+esc(gain)+'</em><span aria-hidden="true"> / </span><em class="points-loss">'+esc(loss)+'</em> pt</small>';
  }
  return '<button type="button" class="v2-odd' + (on ? ' is-on' : '') + '" data-pick="' + esc(m.id) + '" data-value="' + esc(p) + '"' +
    (closed ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + esc(m.home + ' – ' + m.away + ': ' + show(p)+'; '+label) + '">' +
    '<b>' + esc(show(p)) + '</b><span' + (!pointsOnly&&quote?' data-odd="'+esc(quote)+'"':'') + '>' + esc(pointsOnly?'Solo punti':quote?label:'?') + '</span>'+points+'</button>';
}

export function renderSlipV2({ round, picks = {}, stake = 10, credits = 500, openMatch = null, esc, fmt, date, fantasyMeta, teamLabel=slipTeamLabel,barTicket=false,roundPicker='',conflictNotice='' }) {
  if (!round) return '<section class="card empty"><h1>La prossima è quella buona.</h1><p>La prossima schedina sarà disponibile a breve.</p></section>';
  const partial=round.eventBetting===true,closed=editingClosed(round),preview=round.preview===true&&!closed,ready=(partial?!closed:roundAvailability(round)==='aperta')||preview, fanta = sourceOf(round) === 'fantacalcio', pointsOnly = round.pointsOnly === true;
  const sum = slipSummary(round, picks, stake, credits);
  if(partial)picks=sum.picks;
  const missingOdds=!pointsOnly&&(sum.missing>0||(round.matches||[]).some(m=>(openMatch===m.id?[...MAIN,...EXTRA]:MAIN).some(p=>!Number.isFinite(m.odds?.[p]))));
  const rows = orderSlipMatches(round.matches || []).map(m => {
    const extraOn=EXTRA.includes(picks[m.id]),open=openMatch===m.id,locked=editingEventLocked(round,m);
    const kickoff=m.officialKickoff||m.kickoff;
    const barTime=fanta?null:barKickoff(m);
    const at=fanta&&partial&&!locked?eventDeadline(round,m):NaN;
    const timing=barTime?`<time class="slip-match-kickoff${barTicket?' ticket-time':''}" datetime="${esc(barTime.kickoff)}"${barTime.label?'':' hidden'}>${esc(barTicket?barTime.timeLabel:barTime.label)}</time>`:
      Number.isFinite(at)?`<small class="slip-event-clock" data-slip-event-at="${at}" title="Tempo per giocare">${eventCountdown(at)}</small>`:'';
    const live=m.status==='LIVE',status=fanta?(live?'In corso':m.score?'Risultato finale':fantasyMeta?.(m)||(kickoff?date(kickoff):'')):'';
    if(barTicket){
      const pick=picks[m.id],price=extraOn?optionPrice(m,pick,locked||!ready,round).odd:null;
      const teams=teamLabel(m.home,{home:true,vs:m.away})+teamLabel(m.away,{home:false,vs:m.home});
      return `<div class="v2-match-row" data-ticket-picked="${!!pick}">
        <h2 class="ticket-day">${esc(barTime.dayLabel||'DATA DA DEFINIRE')}</h2>
        <article class="v2-match ticket-match" data-match-card="${esc(m.id)}" data-result-score="${esc(JSON.stringify((live?m.liveScore:m.score)||null))}">
          <button type="button" class="v2-match-head match-link" data-detail="${esc(m.id)}" aria-label="${esc(barTime.matchLabel)}">
            <span class="slip-teams">${teams}</span><span class="slip-match-indicator">${timing}<span class="inline-result" data-inline-result aria-live="polite">${inlineResultView(m)}</span></span>
          </button>
          <div class="v2-odds-main">${MAIN.map(p=>option(m,p,picks,locked||!ready,esc,fmt,pointsOnly,round,true)).join('')}
            ${pointsOnly?'':`<button type="button" class="v2-more${extraOn?' is-on':''}" data-v2-more="${esc(m.id)}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="${esc('Altri esiti · '+m.home+' – '+m.away+(extraOn?' · '+show(pick):''))}">${extraOn?`<b>${esc(pickCode(pick))}</b><span>${Number.isFinite(price)?ticketQuote.format(price):'—'}</span>`:'+'}</button>`}
          </div><div class="sr-only" data-pick-feedback></div>
        </article></div>`;
    }
    return '<div class="v2-match-row"><article class="v2-match" data-match-card="' + esc(m.id) + '" data-result-score="' + esc(JSON.stringify(live ? m.liveScore || null : m.score || null)) + '"><button type="button" class="v2-match-head match-link" data-detail="' + esc(m.id) + '" aria-label="' + esc(barTime?.matchLabel??(m.home+' – '+m.away)) + '"><div><b class="slip-teams">' + teamLabel(m.home,{home:true,vs:m.away,short:teamCode(m.home)}) + '<span class="slip-versus">–</span>' + teamLabel(m.away,{home:false,vs:m.home,short:teamCode(m.away)}) + '</b>' + (fanta?'<small data-match-status>'+esc(status)+'</small>':'') + '</div><span class="slip-match-indicator">'+timing+'<span class="inline-result" data-inline-result aria-live="polite">' + inlineResultView(m) + '</span></span></button>' +
      '<div class="v2-odds-main">' + MAIN.map(p => option(m, p, picks, locked||!ready, esc, fmt, pointsOnly,round)).join('') +
      (pointsOnly ? '' : '<button type="button" class="v2-more' + (extraOn ? ' is-on' : '') + '" data-v2-more="' + esc(m.id) + '" data-short-pick="' + esc(open?'−':extraOn?pickCode(picks[m.id]):'+') + '" aria-expanded="' + open + '" aria-label="' + esc(extraOn?'Altri mercati · '+show(picks[m.id]):'Altri mercati') + '">' + (open ? '–' : '+') + '</button>') + '</div>' +
      (open && !pointsOnly ? '<div class="v2-odds-extra">' + EXTRA.map(p => option(m, p, picks, locked||!ready, esc, fmt, pointsOnly,round)).join('') + '</div>' : '') +
      '<div class="sr-only" data-pick-feedback></div></article></div>';
  }).join('');
  if(barTicket){
    const match=round.matches.find(m=>m.id===openMatch);
    return `<section class="v2-slip bar-ticket" data-slip-source="seriea" data-slip-round="${esc(round.id||'')}">
      <div class="ticket-round">${roundPicker}<button type="button" data-ticket-count ${sum.count===sum.total?'disabled':''}
        aria-label="${sum.count} di ${sum.total} scelte. Vai alla prima partita senza scelta">${sum.count} di ${sum.total} scelte</button></div>
      ${conflictNotice}<div class="ticket-matches" data-slip-match-list>${rows}</div>
      ${renderTicketBar({round,picks,stake,credits,fmt})}
      ${match&&!pointsOnly?`<dialog class="ticket-markets" data-ticket-markets="${esc(match.id)}" aria-labelledby="ticket-markets-title">
        <div class="ticket-sheet"><div class="ticket-sheet-head"><h2 id="ticket-markets-title">${esc(match.home+' – '+match.away)}</h2>
          <button type="button" data-ticket-dismiss aria-label="Chiudi altri esiti">×</button></div>
          <div class="ticket-extra">${EXTRA.map(p=>option(match,p,picks,editingEventLocked(round,match)||!ready,esc,fmt,false,round,true)).join('')}</div>
        </div></dialog>`:''}
    </section>`;
  }
  return '<section class="v2-slip" data-slip-source="'+(fanta?'fantacalcio':'seriea')+'" data-slip-round="'+esc(round.id||'')+'"><div class="v2-eyebrow">' + (fanta ? 'IL FANTA DEL TUO BAR' : 'SERIE A') + ' · ' + esc(round.title || ('Giornata ' + round.number)) + '</div>' +
    '<h1 class="v2-title">La schedina</h1><div data-os-content data-os-slip data-slip-match-list>' + rows + '</div>'+slipNotice(missingOdds)+'</section>' +
    (ready ? renderSlipBar({round,picks,stake,credits,esc,fmt,date}) : '');
}

function renderSlipBar({round,picks,stake,credits=500,esc,fmt,date}){
  const sum=slipSummary(round,picks,stake,credits),partial=round.eventBetting===true,preview=round.preview===true;
  const saved=!!round.slip&&!sum.dirty,missing=partial?!sum.count:sum.total-sum.count;
  const status=preview?'Anteprima':saved?'Confermata ✓':missing?partial?'Scegli una partita':'Mancano '+missing+(missing===1?' partita':' partite'):!sum.validStake?'Controlla puntata e saldo':round.slip?'Modifiche da salvare':'Non ancora confermata';
  const title=saved&&!partial?'Confermata · modificabile fino a '+date(round.deadline||round.kickoff):status;
  const total=sum.missing?'?':sum.odds?'Quota '+fmt(sum.odds)+' · '+fmt(Math.round(stake*sum.odds))+' cr':'Quota –';
  const label=saved?'Confermata ✓':round.slip?'Salva':'Conferma';
  const state=saved?'is-ok':round.slip?'is-warn':'is-todo';
  const hint=!sum.validStake&&!preview?sum.fixedStake?'La puntata è bloccata.':sum.reserve?'Tieni da parte un credito per ogni giornata rimanente.':'Crediti insufficienti.':null;
  const stakeText=sum.fixedStake?'Puntata bloccata':'Puntata';
  return `<div class="v2-slipbar">${sum.pointsOnly||sum.fixedStake?'':renderStakeRange(sum,stake,fmt,preview)}
    <div class="v2-slip-summary"><p class="v2-state ${state}" role="status" title="${esc(title)}">${esc(status)}</p>
      ${sum.pointsOnly?'':`<div class="v2-slip-meta"><b data-v2-stake-current title="${stakeText}">${fmt(stake)} cr</b><span data-v2-slip-total>${total}</span></div>`}</div>
    <button type="button" class="v2-save${saved?' is-done':''}" id="save-slip" ${sum.canSave&&!saved?'':'disabled'}><span>${label}</span></button>
    ${hint||missing&&!preview?`<p class="v2-error sr-only" role="${hint?'alert':'status'}">${hint||status}</p>`:''}</div>`;
}

function stakeBounds(sum,stake){
  const step=Number.isInteger(stake)?1:0.01,max=step===1?Math.floor(sum.maxStake):sum.maxStake;
  return {step,max,value:Math.max(1,Math.min(stake,max))};
}

function renderTicketBar({round,picks,stake,credits,fmt}){
  const sum=slipSummary(round,picks,stake,credits);
  const {max,value}=stakeBounds(sum,stake);
  const saved=!!round.slip&&!sum.dirty;
  const unavailable=sum.status==='Non ancora aperta',preview=round.preview===true;
  const adjust=!sum.closed&&!sum.fixedStake&&!preview;
  const quick=[10,25,50,'Max'];
  return `<div class="v2-slipbar ticket-summary">
    <div class="ticket-totals"><span>${sum.count} ${sum.count===1?'selezione':'selezioni'}${sum.odds===null?'':' · quota '+ticketQuote.format(sum.odds)}</span>
      ${sum.closed?'':`<span>Punti max <b>${sum.maximumPoints===null?'—':fmt(sum.maximumPoints)}</b></span>
      ${sum.pointsOnly?'':`<strong class="${sum.potential===null?'ticket-pending':''}">Vinci ${sum.potential===null?'—':fmt(sum.potential)} cr</strong>`}`}</div>
    ${!sum.closed&&sum.missing?`<small class="ticket-reserve">In attesa di quote per le selezioni</small>`:''}
    ${sum.pointsOnly||sum.closed?'':`<div class="ticket-stake${adjust?'':' ticket-stake-fixed'}" role="group" aria-label="Puntata in crediti">
      ${adjust?`<button type="button" data-stake-step="-1" aria-label="Diminuisci di un credito" ${value<=1?'disabled':''}>−</button>`:''}
      <b data-v2-stake-current>${fmt(stake)} cr</b>
      ${adjust?`<button type="button" data-stake-step="1" aria-label="Aumenta di un credito" ${value>=max?'disabled':''}>+</button>
        ${quick.map(n=>`<button type="button" data-ticket-stake="${n}" ${n==='Max'?max<1?'disabled':'':n>max?'disabled':''}>${n}</button>`).join('')}
        <input id="stake" type="hidden" min="1" max="${Math.max(1,max)}" value="${value}">`:''}
    </div><small class="ticket-reserve">Riserva obbligatoria: ${fmt(sum.reserve)} cr</small>`}
    ${sum.closed?`<button type="button" class="ticket-save" disabled><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Chiusa</button>`:
      saved?`<button type="button" class="ticket-save is-done" id="save-slip" data-ticket-edit>Confermata ✓ · Modifica</button>`:
      `<button type="button" class="ticket-save" id="save-slip" ${sum.canSave?'':'disabled'}>${preview||unavailable&&!sum.canSave?'Non ancora aperta':'Salva schedina'+(sum.pointsOnly?'':' · '+fmt(stake)+' cr')}</button>`}
  </div>`;
}

function renderStakeRange(sum,stake,fmt,disabled){
  const {step,max,value}=stakeBounds(sum,stake),fill=100*(value-1)/Math.max(1,max-1);
  return `<div class="auction-offer-amount v2-slip-range" role="group" aria-label="Puntata in crediti">
    <button type="button" class="secondary auction-offer-step" data-stake-step="-1" aria-label="Diminuisci di un credito" ${disabled||value<=1?'disabled':''}>−</button>
    <div class="auction-offer-slider">
      <input id="stake" type="range" min="1" max="${Math.max(1,max)}" step="${step}" value="${value}" aria-label="Importo della puntata" aria-valuetext="${fmt(value)} crediti" style="--offer-fill:${fill}%" ${disabled||max<=1?'disabled':''}>
      <div class="auction-offer-bounds"><span>1 cr</span>${sum.reserve?`<span>${sum.reserve} cr di riserva</span>`:''}<span>${fmt(max)} cr</span></div>
    </div>
    <button type="button" class="secondary auction-offer-step" data-stake-step="1" aria-label="Aumenta di un credito" ${disabled||value>=max?'disabled':''}>+</button>
  </div>`;
}

export function patchSlipBar(bar,options){
  if(!bar)return;
  const html=bar.classList.contains('ticket-summary')?renderTicketBar(options):renderSlipBar(options);
  const template=bar.ownerDocument.createElement('template');template.innerHTML=html;
  patchRegion(bar,html);
  const input=bar.querySelector('#stake'),fresh=template.content.querySelector('#stake');
  if(input&&fresh){
    for(const attr of ['min','max','step','value','style','aria-valuetext']){
      if(fresh.hasAttribute(attr))input.setAttribute(attr,fresh.getAttribute(attr));
    }
    input.disabled=fresh.disabled;
    if(input.value!==fresh.value)input.value=fresh.value;
  }
}

// A choice changes the odds controls, never the match header or its loaded crest.
// A different round/shape deliberately falls back to the caller's normal render.
export function tickSlipEventClocks(root=globalThis.document,now=Date.now()){
 for(const clock of root?.querySelectorAll('[data-slip-event-at]')||[]){const value=eventCountdown(Number(clock.dataset.slipEventAt),now);if(clock.textContent!==value)clock.textContent=value;}
}
export function patchSlipV2(root,options){
 const current=root.querySelector('.v2-slip');if(!current||current.dataset.slipRound!==String(options.round?.id||''))return false;
 const barTicket=current.classList.contains('bar-ticket');
 const doc=current.ownerDocument,template=doc.createElement('template');template.innerHTML=renderSlipV2({...options,barTicket});
 const fresh=template.content.querySelector('.v2-slip'),bar=root.querySelector('.v2-slipbar'),nextBar=template.content.querySelector('.v2-slipbar');
 const rows=[...current.querySelectorAll('[data-match-card]')],nextRows=[...fresh.querySelectorAll('[data-match-card]')],byId=new Map(rows.map(row=>[row.dataset.matchCard,row]));
 if(rows.length!==nextRows.length||nextRows.some(row=>!byId.has(row.dataset.matchCard))||!!bar!==!!nextBar)return false;
 for(const next of nextRows){
  const row=byId.get(next.dataset.matchCard),odds=row.querySelector('.v2-odds-main');
  patchRegion(odds,next.querySelector('.v2-odds-main').outerHTML);
  if(barTicket)row.parentElement.dataset.ticketPicked=next.parentElement.dataset.ticketPicked;
  const extra=row.querySelector('.v2-odds-extra'),nextExtra=next.querySelector('.v2-odds-extra');
  if(extra&&nextExtra)patchRegion(extra,nextExtra.outerHTML);
  else if(extra)extra.remove();else if(nextExtra)odds.after(nextExtra);
 }
 if(barTicket){
  patchRegion(current.querySelector('[data-ticket-count]'),fresh.querySelector('[data-ticket-count]').outerHTML);
  const dialog=current.querySelector('.ticket-markets'),nextDialog=fresh.querySelector('.ticket-markets');
  if(dialog&&nextDialog)patchRegion(dialog.querySelector('.ticket-sheet'),nextDialog.querySelector('.ticket-sheet').outerHTML);
  else if(dialog){
   const trigger=byId.get(dialog.dataset.ticketMarkets)?.querySelector('[data-v2-more]');
   dialog.close();dialog.remove();trigger?.focus({preventScroll:true});
  }else if(nextDialog)current.append(nextDialog);
 }else current.querySelector('.slip-play-note').hidden=fresh.querySelector('.slip-play-note').hidden;
 if(bar)patchSlipBar(bar,options);
 return true;
}

// handlers: onPick(matchId, value), onToggle(matchId), onStake(n), onSave()
export function bindSlipV2(root, { onPick, onToggle, onStake, onSave }) {
  root.querySelectorAll('.v2-odd[data-pick]').forEach(b => b.onclick = () => onPick(b.dataset.pick, b.dataset.value));
  root.querySelectorAll('[data-v2-more]').forEach(b => b.onclick = () => onToggle(b.dataset.v2More));
  const input=root.querySelector('#stake');
  if(input)input.oninput=()=>onStake(Number(input.value));
  root.querySelectorAll('[data-stake-step]').forEach(button=>button.onclick=()=>{
    const value=Math.round((Number(input.value)+Number(button.dataset.stakeStep))*100)/100;
    onStake(Math.max(Number(input.min||input.getAttribute('min')),Math.min(Number(input.max||input.getAttribute('max')),value)));
  });
  root.querySelectorAll('[data-ticket-stake]').forEach(button=>button.onclick=()=>{
    const value=button.dataset.ticketStake;
    onStake(Number(value==='Max'?input.max:value));
  });
  const ticket=root.querySelector('.bar-ticket');
  const count=ticket?.querySelector('[data-ticket-count]');
  if(count)count.onclick=()=>focusTicketMatch(ticket.querySelector('[data-ticket-picked="false"] [data-detail]'));
  const save=root.querySelector('#save-slip');
  if(save)save.onclick=()=>{
    if(!save.hasAttribute('data-ticket-edit'))return onSave();
    const row=ticket.querySelector('[data-pick]:enabled');
    focusTicketMatch(row||ticket.querySelector('[data-detail]'));
  };
  const dialog=ticket?.querySelector('.ticket-markets');
  if(dialog)bindTicketSheet(dialog,()=>onToggle(dialog.dataset.ticketMarkets));
}

function focusTicketMatch(target){
  if(!target)return;
  target.scrollIntoView({block:'nearest',inline:'nearest'});
  target.focus({preventScroll:true});
}

function bindTicketSheet(dialog,dismiss){
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('[data-ticket-dismiss]').onclick=dismiss;
  dialog.onclick=e=>{if(e.target===dialog)dismiss();};
  dialog.oncancel=e=>{e.preventDefault();dismiss();};
  let start;
  dialog.ontouchstart=e=>{start=e.touches[0];};
  dialog.ontouchcancel=()=>{start=null;};
  dialog.ontouchend=e=>{
    const touch=e.changedTouches[0];
    if(start&&touch.clientY-start.clientY>55&&Math.abs(touch.clientX-start.clientX)<40)dismiss();
    start=null;
  };
}
