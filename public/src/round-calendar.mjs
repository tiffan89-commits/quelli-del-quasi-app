import {esc} from './fanta/formato.mjs';

const labels={calcolata:'Calcolata','in-corso':'In corso',schierata:'Si gioca','da-schierare':'Si gioca',futura:'Da giocare',archiviata:'Archiviata'};

export function roundCalendar(rounds,{current,open,rows,after=()=>'',bar=false}){
 const control=bar?'data-bar-calendar-round':'data-lega-round';
 return `<div class="fanta-cal">${[...rounds].sort((a,b)=>a.number-b.number).map(r=>{
  const expanded=r.number===open;
  return `<div class="fanta-cal-round${expanded?' is-open':''}${r.number===current?' is-current':''}">
   <button type="button" class="fanta-cal-head" ${control}="${esc(r.number)}" aria-expanded="${expanded}">
    <b>${esc(r.label||'Giornata '+r.number)}</b><span class="fanta-cal-state is-${esc(r.state)}">${esc(r.stateLabel||labels[r.state])}</span><i aria-hidden="true">${expanded?'▴':'▾'}</i>
   </button>${expanded?`<ul>${rows(r)}</ul>${after(r)}`:''}
  </div>`;
 }).join('')}</div>`;
}

export function restoreRoundCalendarScroll(track,state){
 const win=track?.ownerDocument.defaultView;
 win?.requestAnimationFrame?.(()=>win.requestAnimationFrame(()=>{
  if(!track.isConnected)return;
  const current=track.querySelector('.fanta-cal-round.is-current');
  if(state.calendarScroll!=null)track.scrollTop=state.calendarScroll;
  else if(current)track.scrollTop+=current.getBoundingClientRect().top-track.getBoundingClientRect().top-4;
  state.calendarScroll=track.scrollTop;
  track.addEventListener('scroll',()=>{if(track.isConnected)state.calendarScroll=track.scrollTop;},{passive:true});
 }));
}
