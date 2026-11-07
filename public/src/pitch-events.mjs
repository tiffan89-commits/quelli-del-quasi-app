const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function eventCounts(events){
 if(!Array.isArray(events))return events||{};
 const out={};for(const e of events){const k=({goal:'goals',assist:'assists',yellow:'yellow',red:'red','own-goal':'ownGoals','penalty-saved':'penSaved',penSaved:'penSaved',Gol:'goals',Assist:'assists',Ammonizione:'yellow',Espulsione:'red',Autogol:'ownGoals',Autorete:'ownGoals','Rigore parato':'penSaved'})[e.kind||e.label];if(k)out[k]=(out[k]||0)+1;}return out;
}
// Same football drawing: only the light panels change colour for an own goal.
export const ballIcon=(ownGoal=false)=>`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${ownGoal?'#ed4e47':'#f4f3e8'}" stroke="#809482"/><path d="m12 7 5 4-2 6H9l-2-6z" fill="#172b22"/><path d="m12 7 0-5m5 9 5-1m-7 7 3 4m-9-4-3 4m1-10-5-1" stroke="#172b22" stroke-width="1.4"/></svg>`;
export const fantasyGradeText=p=>Number.isFinite(p.fantagrade??p.fantavote)?String(p.fantagrade??p.fantavote).replace('.',','):p.status==='sv'?'s.v.':'—';
export const substitutionMark=label=>`<span class="pitch-event is-sub" role="img" aria-label="${esc(label||'Sostituzione')}" title="${esc(label||'Sostituzione')}"><b>↑</b><b>↓</b></span>`;
export function pitchEvents(p){
 const e=eventCounts(p.events),out=[];
 for(const[k,label,glyph]of [['goals','Gol',ballIcon()],['ownGoals','Autorete',ballIcon(true)],['penSaved','Rigore parato','🧤'],['assists','Assist','👟'],['yellow','Ammonizione',''],['red','Espulsione','']])for(let i=0;i<Math.min(6,Number(e[k])||0);i++)out.push(`<span class="pitch-event is-${k}" role="img" aria-label="${label}" title="${label}">${glyph}</span>`);
 if(p.substitution?.in||p.substitution?.out||p.subIn||p.subOut||p.enteredFor||p.replacedBy)out.push(substitutionMark(p.substitution?.in||p.subIn||p.enteredFor?'Entrato':'Sostituito'));
 return `<span class="pitch-event-ring" data-pitch-events>${out.join('')}</span>`;
}
export const hasEntered=p=>!!(p.substitution?.in||p.subIn||p.enteredFor||Number(p.minutes)>0);
