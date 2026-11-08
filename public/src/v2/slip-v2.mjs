import {slipTeamLabel} from '../club-crest.mjs';
import {patchRegion} from '../live-channel.mjs';
import {pointTerms,QUOTA_SCORING,roundPointRules,slipPointTerms} from '../../scoring.mjs';
// 0.26: righe compatibili con patchSlipResults (data-match-card, data-inline-result, data-match-status, data-pick-feedback).
// Schedina v2: 1/X/2 al primo livello, altri mercati espandibili, barra fissa con puntata e quota totale.
// Usa lo stesso modello dati di app.mjs: picks[match.id] = valore (es. "1", "X2", "Over 2.5").
import {eventDeadline,eventCountdown} from '../../slip-events.mjs';
import { slipSummary, editingClosed,editingEventLocked,sourceOf,roundAvailability } from '../slip-state.mjs';
import { inlineResultView,slipNotice } from '../slip-results.mjs';
import {orderSlipMatches} from '../../match-layout.mjs';
import {teamCode,pickCode} from '../bar-slips.mjs';

export const MAIN = ['1', 'X', '2'];
export const EXTRA = ['1X', '12', 'X2', 'Under 2.5', 'Over 2.5', 'Goal', 'No Goal'];
const show = (p) => p.replace(' 2.5', ' 2,5');

export function totalOdds(round, picks) {
  let t = 1, n = 0;
  for (const m of round?.matches || []) {
    const p = picks[m.id];
    if (typeof p === 'string' && Number.isFinite(m.odds?.[p])) { t *= m.odds[p]; n++; }
  }
  return n ? t : null;
}

function option(m, p, picks, closed, esc, fmt, pointsOnly,round) {
  const on = picks[m.id] === p;
  const rules=roundPointRules(round),quotaScoring=rules?.scoring===QUOTA_SCORING;
  const accepted=closed&&round.slip?.picks?.[m.id]===p?(quotaScoring?slipPointTerms(round,m,round.slip):round.slip.pointTerms?.[m.id]):null;
  const odd=quotaScoring&&accepted?.correct!=null?accepted.correct:round.eventBetting&&round.slip?.picks?.[m.id]===p?round.slip.acceptedOdds?.[m.id]??m.odds?.[p]:m.odds?.[p];
  const terms=accepted||(quotaScoring?pointTerms(m,p,rules,odd):m.pointOffers?.[p])||pointTerms(m,p,{mode:'weighted',scoring:'difficulty-v2',correct:1,wrong:-1,...round.rules});
  const amount=n=>Number.isFinite(n)?(n>0?'+':n<0?'−':'')+Number(Math.abs(n).toFixed(2)).toLocaleString('it-IT'):'—';
  const gain=terms.correct===null?'?':amount(terms.correct),loss=amount(terms.wrong);
  const points='<small class="v2-odd-points"><em class="points-gain">'+gain+'</em>'+(quotaScoring?'':'<span aria-hidden="true"> / </span><em class="points-loss">'+loss+'</em>')+' pt</small>';
  return '<button type="button" class="v2-odd' + (on ? ' is-on' : '') + '" data-pick="' + esc(m.id) + '" data-value="' + esc(p) + '"' +
    (closed ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + esc(m.home + ' – ' + m.away + ': ' + show(p)+'; '+(terms.correct===null?'punti in attesa della quota':gain+' punti se corretto')+', '+loss+' punti se sbagliato') + '">' +
    '<b>' + esc(show(p)) + '</b><span' + (!pointsOnly && Number.isFinite(odd) ? ' data-odd="' + esc(fmt(odd) + (m.oddsEstimated?.[p] ? '*' : '')) + '"' : '') + '>' + (pointsOnly ? 'Solo punti' : Number.isFinite(odd) ? 'Quota '+fmt(odd) + (m.oddsEstimated?.[p] ? '*' : '') : '?') + '</span>'+points+'</button>';
}

const kickoffFormatter=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',weekday:'short',day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});
export function barKickoff(value){
 if(!Number.isFinite(Date.parse(value)))return '';
 const parts=Object.fromEntries(kickoffFormatter.formatToParts(new Date(value)).map(({type,value})=>[type,value]));
 const capital=text=>text[0].toUpperCase()+text.slice(1).replace(/\.$/,'');
 return [capital(parts.weekday),parts.day,capital(parts.month),parts.year,parts.hour+':'+parts.minute].join(' ');
}

export function renderSlipV2({ round, picks = {}, stake = 10, credits = 500, openMatch = null, esc, fmt, date, fantasyMeta, teamLabel=slipTeamLabel }) {
  if (!round) return '<section class="card empty"><h1>La prossima è quella buona.</h1><p>La prossima schedina sarà disponibile a breve.</p></section>';
  const partial=round.eventBetting===true,closed=editingClosed(round),preview=round.preview===true&&!closed,ready=(partial?!closed:roundAvailability(round)==='aperta')||preview, fanta = sourceOf(round) === 'fantacalcio', pointsOnly = round.pointsOnly === true;
  const sum = slipSummary(round, picks, stake, credits);
  if(partial)picks=sum.picks;
  const missingOdds=!pointsOnly&&(sum.missing>0||(round.matches||[]).some(m=>(openMatch===m.id?[...MAIN,...EXTRA]:MAIN).some(p=>!Number.isFinite(m.odds?.[p]))));
  const rows = orderSlipMatches(round.matches || []).map(m => {
    const extraOn=EXTRA.includes(picks[m.id]),open=openMatch===m.id,locked=editingEventLocked(round,m),at=eventDeadline(round,m);
    const clock=partial&&!locked?`<small class="slip-event-clock" data-slip-event-at="${at}" title="Tempo per giocare">${eventCountdown(at)}</small>`:'';

    const kickoff=m.officialKickoff||m.kickoff;
    const meta=fanta?(fantasyMeta?.(m)||(kickoff?date(kickoff):'')):barKickoff(kickoff);
    const live = m.status === 'LIVE', status = fanta?(live?'In corso':m.score?'Risultato finale':meta):meta;
    return '<article class="v2-match" data-match-card="' + esc(m.id) + '" data-result-score="' + esc(JSON.stringify(live ? m.liveScore || null : m.score || null)) + '"><button type="button" class="v2-match-head match-link" data-detail="' + esc(m.id) + '" aria-label="' + esc(m.home+' – '+m.away) + '"><div><b class="slip-teams">' + teamLabel(m.home,{home:true,vs:m.away,short:teamCode(m.home)}) + '<span class="slip-versus">–</span>' + teamLabel(m.away,{home:false,vs:m.home,short:teamCode(m.away)}) + '</b><small data-match-status>' + esc(status) + '</small></div><span class="slip-match-indicator">'+clock+'<span class="inline-result" data-inline-result aria-live="polite">' + inlineResultView(m) + '</span></span></button>' +
      '<div class="v2-odds-main">' + MAIN.map(p => option(m, p, picks, locked||!ready, esc, fmt, pointsOnly,round)).join('') +
      (pointsOnly ? '' : '<button type="button" class="v2-more' + (extraOn ? ' is-on' : '') + '" data-v2-more="' + esc(m.id) + '" data-short-pick="' + esc(open?'−':extraOn?pickCode(picks[m.id]):'+') + '" aria-expanded="' + open + '" aria-label="' + esc(extraOn?'Altri mercati · '+show(picks[m.id]):'Altri mercati') + '">' + (open ? '–' : '+') + '</button>') + '</div>' +
      (open && !pointsOnly ? '<div class="v2-odds-extra">' + EXTRA.map(p => option(m, p, picks, locked||!ready, esc, fmt, pointsOnly,round)).join('') + '</div>' : '') +
      '<div class="sr-only" data-pick-feedback></div></article>';
  }).join('');
  return '<section class="v2-slip" data-slip-source="'+(fanta?'fantacalcio':'seriea')+'" data-slip-round="'+esc(round.id||'')+'"><div class="v2-eyebrow">' + (fanta ? 'IL FANTA DEL TUO BAR' : 'SERIE A') + ' · ' + esc(round.title || ('Giornata ' + round.number)) + '</div>' +
    '<h1 class="v2-title">La schedina</h1><div data-os-content data-slip-match-list>' + rows + '</div>'+slipNotice(missingOdds)+'</section>' +
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

function renderStakeRange(sum,stake,fmt,disabled){
  const step=Number.isInteger(stake)?1:0.01,max=step===1?Math.floor(sum.maxStake):sum.maxStake;
  const value=Math.max(1,Math.min(stake,max)),fill=100*(value-1)/Math.max(1,max-1);
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
  const html=renderSlipBar(options);
  const template=bar.ownerDocument.createElement('template');template.innerHTML=html;
  patchRegion(bar,html);
  const input=bar.querySelector('#stake'),fresh=template.content.querySelector('#stake');
  if(input&&fresh){
    for(const attr of ['min','max','step','value','style','aria-valuetext'])input.setAttribute(attr,fresh.getAttribute(attr));
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
 const doc=current.ownerDocument,template=doc.createElement('template');template.innerHTML=renderSlipV2(options);
 const fresh=template.content.querySelector('.v2-slip'),bar=root.querySelector('.v2-slipbar'),nextBar=template.content.querySelector('.v2-slipbar');
 const rows=[...current.querySelectorAll('[data-match-card]')],nextRows=[...fresh.querySelectorAll('[data-match-card]')],byId=new Map(rows.map(row=>[row.dataset.matchCard,row]));
 if(rows.length!==nextRows.length||nextRows.some(row=>!byId.has(row.dataset.matchCard))||!!bar!==!!nextBar)return false;
 for(const next of nextRows){
  const row=byId.get(next.dataset.matchCard),odds=row.querySelector('.v2-odds-main');
  patchRegion(odds,next.querySelector('.v2-odds-main').outerHTML);
  const extra=row.querySelector('.v2-odds-extra'),nextExtra=next.querySelector('.v2-odds-extra');
  if(extra&&nextExtra)patchRegion(extra,nextExtra.outerHTML);
  else if(extra)extra.remove();else if(nextExtra)odds.after(nextExtra);
 }
 current.querySelector('.slip-play-note').hidden=fresh.querySelector('.slip-play-note').hidden;
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
  const save=root.querySelector('#save-slip');if(save)save.onclick=onSave;
}
