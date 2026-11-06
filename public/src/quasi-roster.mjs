import {rewardById} from './reward-catalog.mjs';
import {quasiScene,showQuasi} from './quasi-scene.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rosterView(league,uid){
 return `<div class="quasi-roster-grid ${league.members.length<=3?'roster-three':league.members.length>10?'roster-six':'roster-four'}">${league.members.map(m=>`<article class="league-quasi-card"><button type="button" class="quasi-roster-open" data-quasi-member="${esc(m.uid)}" aria-label="Guarda il Quasi di ${esc(m.name)}">${quasiScene(m.avatar,m.name,{compact:true})}<span class="quasi-card-name">${esc(m.name)}</span>${rewardById(m.avatar?.rewardTitle)?'<small class="quasi-card-title">'+esc(rewardById(m.avatar.rewardTitle).name)+'</small>':''}</button><div class="quasi-roster-meta"><span>${m.uid===league.admin?'Presidente':(league.prizeWinners||[]).includes(m.uid)?'A premio':'Al bancone'}</span>${m.uid===uid?'<button type="button" class="quasi-edit-button" data-quasi-edit>Modifica ✎</button>':''}</div></article>`).join('')}</div><p class="quasi-roster-hint">Tocca un Quasi per guardarlo da vicino.</p>`;
}
export function bindRoster(league,onEdit){
 document.querySelectorAll('[data-quasi-member]').forEach(b=>b.onclick=()=>{const member=league?.members.find(m=>m.uid===b.dataset.quasiMember);if(member)showQuasi(member);});
 document.querySelectorAll('[data-quasi-edit]').forEach(b=>b.onclick=onEdit);
}

