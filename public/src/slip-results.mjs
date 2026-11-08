import {predictionStatus} from '../prediction.mjs';
import {editingEventLocked} from './slip-state.mjs';
import {orderSlipMatches} from '../match-layout.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function inlineResultView(m){
 const live=m.status==='LIVE',score=live?m.liveScore:m.score;
 if(!live&&!Array.isArray(score))return '';
 return `${live?'<span class="inline-live"><i aria-hidden="true"></i>LIVE</span>':'<small>Finale</small>'}<b class="inline-score">${Array.isArray(score)?score.map(esc).join(' – '):'—'}</b>${live&&m.clock?'<small>'+esc(m.clock)+'</small>':''}`;
}
export function increasedScore(before,after){return Array.isArray(before)&&Array.isArray(after)&&after.some((n,i)=>Number.isInteger(n)&&n>before[i]);}
function reorderSlipRows(root,round){
 const lists=[...(root.matches?.('[data-slip-match-list]')?[root]:[]),...root.querySelectorAll('[data-slip-match-list]')];
 const ordered=orderSlipMatches(round.matches),doc=root.ownerDocument||root,focused=doc.activeElement;
 for(const list of lists){
  const rows=[...list.children].filter(el=>el.hasAttribute('data-match-card')||el.hasAttribute('data-result-row'));
  if(rows.length<2)continue;
  const byId=new Map(rows.map(el=>[el.dataset.matchCard||el.dataset.resultRow,el]));
  let anchor=rows[0];
  for(const row of ordered.map(m=>byId.get(String(m.id))).filter(Boolean)){
   if(row!==anchor)list.insertBefore(row,anchor);
   else anchor=row.nextSibling;
  }
 }
 // Moving a row keeps its controls and handlers; restore focus if the browser blurs it on insertion.
 if(focused?.isConnected&&doc.activeElement!==focused)focused.focus?.({preventScroll:true});
}
export function patchSlipResults(root,round,picks,closed){
 for(const row of root.querySelectorAll('[data-match-card],[data-result-row]')){
  const m=round.matches.find(m=>m.id===(row.dataset.matchCard||row.dataset.resultRow));if(!m)continue;
  const score=m.status==='LIVE'?m.liveScore:m.score,previous=row.dataset.resultScore?JSON.parse(row.dataset.resultScore):null;
  const result=row.querySelector('[data-inline-result]');if(result){const html=inlineResultView(m);if(result.innerHTML!==html)result.innerHTML=html;}
  const status=row.querySelector('[data-match-status]');if(status&&(m.status==='LIVE'||m.score))status.textContent=m.status==='LIVE'?'In corso':'Risultato finale';
  if(increasedScore(previous||(m.status==='LIVE'?[0,0]:null),score)){
   row.classList.remove('goal-flash');void row.offsetWidth;row.classList.add('goal-flash');
   row.addEventListener('animationend',()=>row.classList.remove('goal-flash'),{once:true});
  }
  row.dataset.resultScore=JSON.stringify(score||null);
  const locked=round.eventBetting?editingEventLocked(round,m):closed;
  const pick=row.hasAttribute('data-saved-pick')?row.dataset.savedPick:round.eventBetting&&locked?round.slip?.picks?.[m.id]:picks[m.id],f=predictionStatus(m,pick,locked);
  if(row.classList.contains('bar-bet')){row.classList.toggle('win',!!f?.winning);row.classList.toggle('lose',!!f&&!f.winning);}
  for(const b of row.querySelectorAll('[data-pick]')){const selected=b.dataset.value===pick;for(const c of ['pick-winning','pick-losing'])b.classList.toggle(c,selected&&f?.className===c);if(locked)b.disabled=true;}
  const extra=row.querySelector('[data-v2-more]');
  if(extra){const selected=!!pick&&!['1','X','2'].includes(pick);for(const c of ['pick-winning','pick-losing'])extra.classList.toggle(c,selected&&f?.className===c);}
  const feedback=row.querySelector('[data-pick-feedback]');if(feedback){const html=f?`<p class="pick-feedback ${f.className}" role="status"><b>${f.winning?'✓':'✕'} ${esc(pick)} · ${f.label}</b><small>${f.note}</small></p>`:'';if(feedback.innerHTML!==html)feedback.innerHTML=html;}
  const check=row.querySelector('[data-result-check]');if(check)check.textContent=f?(f.winning?'✓':'✕'):'';
  const saved=row.querySelector('[data-result-pick]');if(saved){saved.classList.remove('win','lose');for(const c of ['pick-winning','pick-losing'])saved.classList.toggle(c,f?.className===c);}
 }
 reorderSlipRows(root,round);
}

export function slipNotice(missingOdds=false){
 return `<p class="tiny muted slip-play-note" data-os-footer><span class="slip-odds-legend"${missingOdds?'':' hidden'}>? = Quota in arrivo <i aria-hidden="true">·</i> </span>Gioco fantasy con solo crediti virtuali</p>`;
}
