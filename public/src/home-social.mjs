import {esc} from './fanta/formato.mjs';

export function homeCountdown(deadline,now=Date.now()){
 const minutes=Math.ceil((Date.parse(deadline)-now)/60000);
 if(minutes<=0||!Number.isFinite(minutes))return '';
 const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60);
 return days?days+'g '+hours+'h':hours?hours+'h '+minutes%60+'m':minutes+'m';
}

export function socialHome({mode,stories,hero,last,cta,now,reminder=''}){
 return `<section class="bar-home-social${mode==='fanta'?' fanta-home fanta-social-home':''}" aria-label="Home ${mode==='bar'?'del Bar':'Fanta'}">
  ${stories}
  <section class="bar-home-hero">${hero.background||''}
   <div class="bar-home-hero-copy"><h2>${esc(hero.title)}</h2><p>“${esc(hero.quote)}”</p>
   <div class="bar-home-balances">${hero.chips}</div></div>
   ${hero.art}
  </section>
  ${last?`<button type="button" class="bar-home-last" ${last.action}><span class="bar-home-last-top"><b>${esc(last.title)}</b>${last.value?`<strong class="${last.valueClass||''}">${esc(last.value)}</strong>`:''}</span>
  ${last.segments?.length?`<span class="bar-home-segments" style="--segments:${last.segments.length}" aria-label="${esc(last.segmentLabel||'Esiti')}">${last.segments.map(item=>`<i class="is-${item.state}" role="img" aria-label="${esc(item.label)}"></i>`).join('')}</span>`:''}
  ${last.footer||''}</button>`:''}
  <button type="button" class="bar-home-cta primary" ${cta.disabled?'disabled':cta.action||''}${cta.busy?' aria-busy="true"':''}><span>${cta.warning?'<i class="home-cta-warning" aria-hidden="true"></i>':''}${esc(cta.label)}</span>
   <span>${cta.deadline?`<span data-dashboard-countdown data-deadline="${esc(cta.deadline)}"${cta.waiting?' data-waiting':''}>${cta.waiting?'tra ':''}${homeCountdown(cta.deadline,now)}</span>`:''}${cta.disabled?'':' <span aria-hidden="true">→</span>'}</span></button>
  ${reminder}
 </section>`;
}

export function tickHomeCountdowns(root,now=Date.now()){
 let expired=false;
 for(const el of root.querySelectorAll('[data-dashboard-countdown]')){
  const remaining=homeCountdown(el.dataset.deadline,now);
  if(!remaining){expired=true;continue;}
  const label=(el.hasAttribute('data-waiting')?'tra ':'')+remaining;
  if(el.textContent!==label)el.textContent=label;
 }
 return expired;
}
