import {shirt} from './fanta/maglie.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function clubShirt(name,{vs,home}={}){
 return '<span class="team-logo club-kit" aria-hidden="true">'+shirt(name,{code:false,vs,home})+'</span>';
}
export function slipTeamLabel(name,context){return '<span class="slip-team-label">'+clubShirt(name,context)+'<span>'+esc(name)+'</span></span>';}
