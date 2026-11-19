import {renderAppInvite} from './app-invite.mjs';
import {hubSymbol} from './league-hub.mjs';
import {backButton} from './back-navigation.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PRESIDENT_GROUPS=[['associazioni','Associa squadre'],['regole','Regole'],['calendario','Calendario e asta'],['competizioni','Competizioni'],['identita','Identità'],['account','Account'],['avvisi','Avvisi'],['assistenza','Assistenza'],['elimina','Elimina lega']];
export function presidentEntry(attribute='data-bar-page="admin"',active=false){return `<button type="button" class="president-entry settings-entry" ${attribute} aria-label="Apri impostazioni" title="Impostazioni" ${active?'aria-current="page"':''}>${hubSymbol('gear')}<span class="sr-only">Impostazioni</span></button>`;}
export function settingsFooter({bridge=false}={}){return renderAppInvite({compact:true})+'<section class="profile-logout"><button type="button" class="secondary full" '+(bridge?'data-mode="bar" data-bar-page="logout"':'id="logout"')+'>Logout</button></section><div class="settings-legal" data-settings-legal></div>';}
export function presidentPanel({groups={},open=null,footer='',title='Impostazioni',back=''}){
 return `<section class="president-panel"><header class="president-heading" data-os-header>${back?backButton(back,'Torna alla lega'):''}<h1 class="eyebrow">${esc(title)}</h1></header><div data-os-content><div class="president-groups">${PRESIDENT_GROUPS.filter(([id])=>groups[id]).map(([id,title])=>`<details class="card president-group" data-president-section="${id}" ${open===id?'open':''}><summary><span><b>${title}</b><small>${esc(groups[id]?.summary||'')}</small></span></summary><div class="president-body">${groups[id]?.html||''}</div></details>`).join('')}</div>${footer}</div></section>`;
}
export function bindPresidentPanel(root){
 const search=root.querySelector('[data-member-search]');
 if(search)search.oninput=()=>{const q=search.value.trim().toLocaleLowerCase('it');let count=0;root.querySelectorAll('[data-member-name]').forEach(row=>{row.hidden=!row.dataset.memberName.toLocaleLowerCase('it').includes(q);if(!row.hidden)count++;});const status=root.querySelector('[data-member-count]');if(status)status.textContent=count+' partecipanti mostrati';};
 const palette=root.querySelector('.theme-palette');
 if(palette)palette.addEventListener('change',e=>{if(e.target.name==='accent'){const label=palette.querySelector('[data-color-label]');if(label)label.textContent=e.target.dataset.colorName;}});
}
