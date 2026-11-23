import {roomThumbnail} from './locker-rooms.mjs';
import {rewardById,rewardMark,REWARD_SLOTS} from './reward-catalog.mjs';
import {hatArt,charmArt,outfitArt,INK} from './avatar-art.mjs';
function ownedRewards(user){
 const rewards=new Map();
 for(const award of [...(user.rewards||[])].reverse()){
  for(const id of award.ids){
   const reward=rewardById(id);
   if(reward&&!rewards.has(reward.id))rewards.set(reward.id,reward);
  }
 }
 return [...rewards.values()];
}

function rewardImage(reward){
 const drawing=(viewBox,art)=>`<svg viewBox="${viewBox}" aria-hidden="true"><g fill="${reward.color}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${art}</g></svg>`;
 if(reward.type==='room')return roomThumbnail(reward.id);
 if(reward.type==='headwear')return drawing('74 3 132 90',hatArt(reward));
 if(reward.type==='charm')return drawing('177 212 73 78',charmArt(reward));
 if(reward.type==='outfit')return drawing('74 163 132 120',`<path d="m112 174-28 13-9 31 24 8v46h82v-46l24-8-9-31-28-13q-28 24-56 0z"/>${outfitArt(reward)}`);
 if(reward.type==='color')return drawing('0 0 60 60','<circle cx="30" cy="30" r="23"/>');
 return rewardMark(reward);
}

export function rewardsView(user){
 const count=ownedRewards(user).length;
 return `<details class="card rewards-collection" id="rewards-collection" data-os-paged-detail><summary><strong>I tuoi premi</strong><span class="pill">${count}</span></summary><div class="reward-tile-grid">${count?'':'<p class="muted">Nessun premio conquistato.</p>'}</div></details>`;
}

export function bindRewards(user,esc,onEquip){
 const root=document.querySelector('#rewards-collection'),grid=root?.querySelector('.reward-tile-grid');
 if(!grid)return;
 root.addEventListener('toggle',()=>{
  if(!root.open||grid.firstElementChild)return;
  const rewards=ownedRewards(user),rows=[];
  for(let i=0;i<rewards.length;i+=3){
   rows.push(`<div class="reward-tile-row">${rewards.slice(i,i+3).map(reward=>`<button type="button" class="reward-tile" data-equip-reward="${esc(reward.id)}" aria-label="Indossa ${esc(reward.shortName)}"><span class="reward-tile-art" aria-hidden="true">${rewardImage(reward)}</span><span>${esc(reward.shortName)}</span></button>`).join('')}</div>`);
  }
  grid.innerHTML=rows.join('');
 });
 grid.addEventListener('click',event=>{
  const id=event.target.closest('[data-equip-reward]')?.dataset.equipReward,reward=rewardById(id);
  if(reward)onEquip(REWARD_SLOTS[reward.type],reward.id);
 });
}
