const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PRESIDENT_GROUPS=[['persone','Persone'],['regole','Regole'],['calendario','Calendario e asta'],['identita','Identità']];
export function presidentEntry(attribute='data-bar-page="admin"',active=false){return `<button type="button" class="president-entry" ${attribute} aria-label="Apri pannello del presidente" ${active?'aria-current="page"':''}><span aria-hidden="true">⚙</span><span>Presidente</span></button>`;}
export function presidentTodos(tasks=[],mode='bar'){
 if(!tasks.length)return '';
 return `<aside class="president-todos" aria-label="Da fare per il presidente"><h2>Da fare</h2><ul>${tasks.map(t=>`<li><span>${esc(t.text)}</span><button type="button" class="text-button" ${mode==='bar'?'data-bar-page="admin"':'data-go="presidente"'} data-president-group="${esc(t.group)}">${esc(t.action||'Apri')}</button></li>`).join('')}</ul></aside>`;
}
export function presidentPanel({name,mode='bar',groups={},tasks=[],other='',open=null}){
 return `<section class="president-panel"><header class="president-heading"><span class="eyebrow">IL TUO BANCO DI COMANDO</span><h1>Pannello del presidente</h1><p>${esc(name)}</p></header><nav class="president-context" aria-label="Gestione Bar e Fanta"><span aria-current="page">${mode==='bar'?'Bar':'Fanta'}</span>${other}</nav>${presidentTodos(tasks,mode)}<div class="president-groups">${PRESIDENT_GROUPS.map(([id,title])=>`<details class="card president-group" data-president-section="${id}" ${open===id?'open':''}><summary><span><b>${title}</b><small>${esc(groups[id]?.summary||'Nessuna impostazione disponibile')}</small></span></summary><div class="president-body">${groups[id]?.html||''}</div></details>`).join('')}</div></section>`;
}
export function bindPresidentPanel(root){
 const search=root.querySelector('[data-member-search]');
 if(search)search.oninput=()=>{const q=search.value.trim().toLocaleLowerCase('it');let count=0;root.querySelectorAll('[data-member-name]').forEach(row=>{row.hidden=!row.dataset.memberName.toLocaleLowerCase('it').includes(q);if(!row.hidden)count++;});const status=root.querySelector('[data-member-count]');if(status)status.textContent=count+' partecipanti mostrati';};
 const palette=root.querySelector('.theme-palette');
 if(palette)palette.addEventListener('change',e=>{if(e.target.name==='accent'){const label=palette.querySelector('[data-color-label]');if(label)label.textContent=e.target.dataset.colorName;}});
}
export function barPresidentTasks(league){
 const tasks=[];if(!league.nativeFantaLink)tasks.push({text:league.fantaCreation&&league.fantaCreation.status!=='ready'?'Il Fanta è in preparazione':'Il Fanta non è attivo',group:'calendario',action:'Gestisci'});
 // Only count a complete public list. Never infer missing slips from a private DTO.
 const round=league.rounds?.find(r=>r.publicSlips&&r.status==='open');
 if(round){const missing=league.members.filter(m=>!round.publicSlips.some(s=>s.uid===m.uid)).length;if(missing)tasks.push({text:missing+' membri senza schedina',group:'persone',action:'Vedi membri'});}
 return tasks;
}
