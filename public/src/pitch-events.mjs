const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function eventCounts(events){
 if(!Array.isArray(events))return events||{};
 const out={};for(const e of events){const k=({goal:'goals',assist:'assists',yellow:'yellow',red:'red','own-goal':'ownGoals','penalty-saved':'penSaved',penSaved:'penSaved',Gol:'goals',Assist:'assists',Ammonizione:'yellow',Espulsione:'red',Autogol:'ownGoals',Autorete:'ownGoals','Rigore parato':'penSaved'})[e.kind||e.label];if(k)out[k]=(out[k]||0)+1;}return out;
}
// The ink and seams are shared by the goal and own-goal marks.
export function ballIcon(ownGoal=false) {
 const leather=ownGoal?'#ed4e47':'#f4f3e8';
 return `<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10.4" fill="${leather}" stroke="#171715" stroke-width="1.7"/>
  <path d="M4 14.5a8.6 8.6 0 0 0 14.9 2.7" fill="none" stroke="#171715" stroke-opacity=".23" stroke-width="1.4" stroke-linecap="round"/>
  <path d="m10.1 7.6-.8-3.7m7.1 6.9 3.4-2m-5 8.2 1.6 3.4m-7.7-4.1-4 1.4m2.9-6.7-4-.8" fill="none" stroke="#171715" stroke-width="1.15" stroke-linecap="round"/>
  <path d="m10.1 7.6 6.3 3.2-1.6 6.2-6.1-.7-1.1-5.3Z M6 3.5l3.8-1.6 2.7 1.5-3.2 2.4Z M20.7 6.3l1.6 4.8-2.7 1.1-1.3-3.8Z M14.4 22.3l-.6-2.3 4.3-2.1 2.2 1.2a10.4 10.4 0 0 1-5.9 3.2Z M2.2 11.7l2.3-1.5 1.2 4.8-2.2 2.6a10.4 10.4 0 0 1-1.3-5.9Z" fill="#171715"/>
 </svg>`;
}

export const assistBootIcon=()=>`<svg viewBox="0 0 24 24" aria-hidden="true" stroke="#211713" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
 <path d="m4.4 17.5-.2 2.8m4-2.2-.2 2.9m6.9-2.6.3 2.2m4.2-3.2.4 2" fill="none" stroke-width="2.1"/>
 <path d="M3.1 5.4 7.7 5l1 3.2 3.1-.7 2.4 3.1 5.5 1.5c2 .5 2.9 1.8 2.6 3.7l-.6 2c-5.8 1.9-12.7 1.8-19.4.5-.8-.2-1.1-.7-.9-1.5Z" fill="#bb7745"/>
 <path d="m7.2 11 3.2-.9m-.9 3.1 3.2-.9M3.3 8l2.5-.3" fill="none" stroke="#fae6b6" stroke-width="1.25"/>
 <path d="M2 16.1c6.7 1.4 14.1 1.2 20.3-.5l-.6 2.2c-5.8 1.9-12.7 1.8-19.4.5-.8-.2-1.1-.7-.9-1.5Z" fill="#f0cc8b"/>
 </svg>`;
export const fantasyGradeText=p=>Number.isFinite(p.fantagrade??p.fantavote)?String(p.fantagrade??p.fantavote).replace('.',','):p.status==='sv'?'s.v.':'—';
export const hasPitchPerformance=p=>['playing','voted','sv'].includes(p.status)||[p.grade,p.vote,p.fantagrade,p.fantavote].some(Number.isFinite);
export function pitchPerformance(p,visible=hasPitchPerformance(p)){
 return `<small class="pitch-player-grades" data-fantasy-grade="pitch"${visible?'':' hidden'}>${visible?fantasyGradeText(p):''}</small>${visible?pitchEvents(p):'<span data-pitch-events></span>'}`;
}
export const substitutionMark=label=>`<span class="pitch-event is-sub" role="img" aria-label="${esc(label||'Sostituzione')}" title="${esc(label||'Sostituzione')}"><b>↑</b><b>↓</b></span>`;
export function pitchEvents(p){
 const e=eventCounts(p.events),out=[];
 for(const[k,label,glyph]of [['goals','Gol',ballIcon()],['ownGoals','Autorete',ballIcon(true)],['penSaved','Rigore parato','🧤'],['assists','Assist',assistBootIcon()],['yellow','Ammonizione',''],['red','Espulsione','']])for(let i=0;i<Math.min(6,Number(e[k])||0);i++)out.push(`<span class="pitch-event is-${k}" role="img" aria-label="${label}" title="${label}">${glyph}</span>`);
 if(p.substitution?.in||p.substitution?.out||p.subIn||p.subOut||p.enteredFor||p.replacedBy)out.push(substitutionMark(p.substitution?.in||p.subIn||p.enteredFor?'Entrato':'Sostituito'));
 return `<span class="pitch-event-ring" data-pitch-events>${out.join('')}</span>`;
}
export const hasEntered=p=>!!(p.substitution?.in||p.subIn||p.enteredFor||Number(p.minutes)>0);
