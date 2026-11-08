const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PRESIDENT_GROUPS=[['persone','Persone'],['regole','Regole'],['calendario','Calendario e asta'],['competizioni','Competizioni'],['identita','Identità'],['account','Account, avvisi e assistenza'],['elimina','Elimina lega']];
const gear='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m12 3 7-1 2 5 5 1 4 6-3 4 1 5-6 4-5-2-5 3-6-4 1-5-5-4 2-7 5-1Z" fill="currentColor" stroke="#25382f" stroke-width="2.2" stroke-linejoin="round"/><path d="m12 5 6-1" fill="none" stroke="#fff7d8" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="6" fill="#fff3d5" stroke="#25382f" stroke-width="2.2"/><path d="M13 18a4 4 0 0 0 6-4" fill="none" stroke="#b8a57d" stroke-width="1.5" stroke-linecap="round"/></svg>';
export function presidentEntry(attribute='data-bar-page="admin"',active=false){return `<button type="button" class="president-entry settings-entry" ${attribute} aria-label="Apri impostazioni" title="Impostazioni" ${active?'aria-current="page"':''}>${gear}<span class="sr-only">Impostazioni</span></button>`;}
export function presidentTodos(tasks=[],mode='bar'){
 if(!tasks.length)return '';
 return `<aside class="president-todos${mode==='fanta'?' president-todos-fanta':''}" aria-label="Pannello del presidente"><h2>Pannello del presidente</h2><ul>${tasks.map(t=>`<li>${t.text?`<span>${esc(t.text)}</span>`:''}<button type="button" class="text-button" ${t.auction?'data-auction-manage="1"':mode==='bar'&&t.group==='calendario'?'data-president-activate':`${mode==='bar'?'data-bar-page="admin"':'data-go="presidente"'} data-president-group="${esc(t.group)}"`}>${esc(t.action||'Apri')}</button></li>`).join('')}</ul></aside>`;
}
export function settingsLogout({bridge=false}={}){return '<section class="profile-logout"><button type="button" class="secondary full" '+(bridge?'data-mode="bar" data-bar-page="logout"':'id="logout"')+'>Logout</button></section>';}
export function presidentPanel({mode='bar',groups={},tasks=[],open=null,footer=''}){
 return `<section class="president-panel"><header class="president-heading" data-os-header><h1 class="eyebrow">Il tuo banco di comando</h1></header><div data-os-content>${presidentTodos(tasks,mode)}<div class="president-groups">${PRESIDENT_GROUPS.filter(([id])=>groups[id]).map(([id,title])=>`<details class="card president-group" data-president-section="${id}" ${open===id?'open':''}><summary><span><b>${title}</b><small>${esc(groups[id]?.summary||'')}</small></span></summary><div class="president-body">${groups[id]?.html||''}</div></details>`).join('')}</div>${footer}</div></section>`;
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
