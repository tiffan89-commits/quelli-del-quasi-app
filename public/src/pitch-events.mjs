const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function eventCounts(events){
 if(!Array.isArray(events))return events||{};
 const out={};for(const e of events){const k=({goal:'goals',assist:'assists',yellow:'yellow',red:'red','own-goal':'ownGoals',Gol:'goals',Assist:'assists',Ammonizione:'yellow',Espulsione:'red',Autogol:'ownGoals'})[e.kind||e.label];if(k)out[k]=(out[k]||0)+1;}return out;
}
export const substitutionMark=label=>`<span class="pitch-event is-sub" role="img" aria-label="${esc(label||'Sostituzione')}" title="${esc(label||'Sostituzione')}"><b>↑</b><b>↓</b></span>`;
export function pitchEvents(p){
 const e=eventCounts(p.events),out=[];
 for(const[k,label,glyph]of [['goals','Gol','⚽'],['assists','Assist','👟'],['yellow','Ammonizione',''],['red','Espulsione',''],['ownGoals','Autorete','⚽']])for(let i=0;i<Math.min(6,Number(e[k])||0);i++)out.push(`<span class="pitch-event is-${k}" role="img" aria-label="${label}" title="${label}">${k==='ownGoals'?'<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#ee5253" stroke="#fff"/><path d="M10 5 14 8 12.5 13 7.5 13 6 8ZM10 1V5M1 7 6 8M4 17 7.5 13M16 17 12.5 13M19 7 14 8" fill="#44201e" stroke="#44201e" stroke-width="1"/></svg>':glyph}</span>`);
 if(p.substitution?.in||p.substitution?.out||p.subIn||p.subOut||p.enteredFor||p.replacedBy)out.push(substitutionMark(p.substitution?.in||p.subIn||p.enteredFor?'Entrato':'Sostituito'));
 return `<span class="pitch-event-ring" data-pitch-events>${out.join('')}</span>`;
}
export const hasEntered=p=>!!(p.substitution?.in||p.subIn||p.enteredFor||Number(p.minutes)>0);
