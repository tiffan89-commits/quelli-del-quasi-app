import {AVATAR_OPTIONS,DEFAULT_AVATAR,normalizeAvatar,avatarSvg} from './avatar.mjs';
import {quasiScene} from './quasi-scene.mjs';
import {rewardById,REWARD_SLOTS,REWARD_CATALOG} from './reward-catalog.mjs';
import {roomAsset} from './locker-rooms.mjs';
import {BACK_ICON} from './back-navigation.mjs';
import {bindSwipeBack} from './match-page.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const STUDIO_TABS=[['character','Personaggio','◉'],['body','Fisico','↔'],['skin','Incarnato','●'],['hair','Capelli','⌁'],['beard','Barba','⌄'],['outfit','Abiti','♧'],['color','Colore abiti','◐'],['accessory','Portafortuna','✧'],['headwear','Copricapi','♛'],['title','Titoli','✦'],['room','Spogliatoi','⌂']];
const slotFor={outfit:'rewardOutfit',color:'rewardColor',accessory:'rewardCharm',headwear:'rewardHat',title:'rewardTitle',room:'rewardRoom'};
const rewardType={outfit:'outfit',color:'color',accessory:'charm',headwear:'headwear',title:'title',room:'room'};
const profileLooks={neutral:{hair:'wave',beard:'none',outfit:'jersey'},male:{hair:'fade',beard:'stubble',outfit:'jersey'},female:{hair:'bob',beard:'none',outfit:'tennis-dress'}};
const wardrobeForFemale=new Set(['pleated-skirt','denim-skirt','tennis-dress','summer-dress','wrap-dress']);
export function studioChoices(tab,ownedIds=[],character='neutral'){
 const base=AVATAR_OPTIONS[tab]?.values||[['none',tab==='headwear'?'Senza copricapo':'Quasi fenomeno']];
 const free=tab==='outfit'&&character==='female'?[...base].sort(([a],[b])=>Number(wardrobeForFemale.has(b))-Number(wardrobeForFemale.has(a))):base;
 const standard=free.map(([value,label])=>({key:tab==='headwear'?'rewardHat':tab==='title'?'rewardTitle':tab,value,label}));
 const unlocked=ownedIds.map(rewardById).filter(r=>r?.type===rewardType[tab]).map(r=>({key:slotFor[tab],value:r.id,label:r.shortName,reward:r}));
 return [...(tab==='color'?[{key:'originalColor',value:'original',label:'Colore originale'}]:[]),...standard,...unlocked];
}
export function applyStudioChoice(draft,choice){
 if(choice.key==='originalColor')return normalizeAvatar({...draft,color:DEFAULT_AVATAR.color,rewardColor:'none',customOutfitColor:false});
 const next={...draft,[choice.key]:choice.value};
 if(slotFor[choice.key])next[slotFor[choice.key]]='none';
 if(choice.key==='color'||choice.key==='rewardColor')next.customOutfitColor=choice.key==='color';
 if(choice.key==='character'&&choice.value!==draft.character&&Object.hasOwn(profileLooks,choice.value)){
  const before=Object.hasOwn(profileLooks,draft.character)?profileLooks[draft.character]:profileLooks.neutral;
  const after=profileLooks[choice.value];
  for(const key of ['hair','beard'])if((draft[key]??DEFAULT_AVATAR[key])===before[key])next[key]=after[key];
  if((draft.rewardOutfit??'none')==='none'&&(draft.outfit??DEFAULT_AVATAR.outfit)===before.outfit)next.outfit=after.outfit;
 }
 if(choice.key==='rewardCharm'&&choice.value!=='none')next.accessory='none';
 return normalizeAvatar(next);
}
export function openQuasiStudio({user,api,onSaved,initialReward}){
 if(document.querySelector('.quasi-studio'))return;
 const owned=[...new Set((user.rewards||[]).flatMap(a=>a.ids))];let draft=normalizeAvatar(user.avatar,owned),original=JSON.stringify(draft),tab='outfit',limit=24,saving=false;
 let nickname=user.name,nicknameEditing=false;
 const reward=owned.includes(initialReward)?rewardById(initialReward):null;
 if(reward){draft=applyStudioChoice(draft,{key:REWARD_SLOTS[reward.type],value:reward.id});tab=Object.keys(rewardType).find(k=>rewardType[k]===reward.type)||tab;}
 const dialog=document.createElement('dialog');dialog.className='quasi-studio';dialog.setAttribute('aria-label','Modifica il tuo Quasi');
 dialog.innerHTML=`<div class="studio-shell"><header class="studio-header"><button type="button" class="studio-back screen-back secondary" aria-label="Torna alla schermata precedente">${BACK_ICON}</button><h1>COMPONI IL TUO QUASI</h1><button type="button" class="studio-reset" aria-label="Annulla le modifiche">↶</button><button type="button" class="studio-save" aria-label="Salva il Quasi">✓</button></header><div class="studio-preview"></div><div class="studio-status" role="status"></div><div class="studio-dock"><nav class="studio-tabs" role="tablist" aria-label="Personalizza">${STUDIO_TABS.map(([key,label,icon])=>`<button type="button" role="tab" data-studio-tab="${key}"><b aria-hidden="true">${icon}</b><span>${label}</span></button>`).join('')}</nav><div class="studio-suboptions"></div><div class="studio-options" role="group" aria-label="Opzioni"></div><span class="studio-hint">Scorri le anteprime ↔</span></div></div>`;
 document.body.append(dialog);document.documentElement.classList.add('studio-active');
 const status=dialog.querySelector('.studio-status'),options=dialog.querySelector('.studio-options');
 const close=()=>{if(saving)return;dialog.close();dialog.remove();document.documentElement.classList.remove('studio-active');document.querySelector('[data-quasi-edit]')?.focus({preventScroll:true});};
 const attemptClose=()=>{if(saving)return;if(JSON.stringify(draft)===original&&nickname===user.name){close();return;}status.innerHTML='Modifiche non salvate. <button type="button" data-continue>Resta qui</button><button type="button" data-discard>Esci senza salvare</button>';status.querySelector('[data-discard]').onclick=close;status.querySelector('[data-continue]').onclick=()=>status.textContent='';};
 const preview=({focus=false}={})=>{
  const region=dialog.querySelector('.studio-preview');
  region.innerHTML=quasiScene(draft,nickname,{eager:true});
  const caption=region.querySelector('.quasi-scene-caption span');
  caption.innerHTML=nicknameEditing?'<input maxlength="60" autocomplete="off" aria-label="Nickname">':'<button type="button" class="studio-nickname" aria-label="Modifica nickname"></button>';
  const button=caption.querySelector('button'),input=caption.querySelector('input');
  if(button){button.textContent=nickname+' ✎';button.onclick=()=>{if(!saving){nicknameEditing=true;preview({focus:true});}};}
  if(input){
   input.value=nickname;
   input.oninput=()=>{nickname=input.value;status.textContent='';};
   input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();dialog.querySelector('.studio-save').click();}};
   if(focus){input.focus();input.select();}
  }
 };
 const originalColor=()=>draft.rewardColor==='none'&&!draft.customOutfitColor&&(draft.rewardOutfit!=='none'||draft.color===DEFAULT_AVATAR.color);
 const selected=c=>{
  if(c.key==='originalColor')return originalColor();
  if(c.key==='color'&&originalColor())return false;
  return draft[c.key]===c.value&&(!slotFor[c.key]||draft[slotFor[c.key]]==='none');
 };
 const art=c=>{
  if(tab==='room')return `<img data-deferred-src="${roomAsset(c.value)}" alt="" loading="lazy" decoding="async">`;
  if(tab==='color'&&c.key!=='originalColor')return `<span class="studio-swatch" style="background:${c.reward?.color||c.value}"></span>`;
  if(tab==='title')return '<span class="studio-title-choice">'+esc(c.label)+'</span>';
  const config=applyStudioChoice(draft,c);
  if(['character','skin','hair','beard'].includes(tab))config.rewardHat='none';
  if(tab==='character')Object.assign(config,profileLooks[c.value],{rewardOutfit:'none',rewardCharm:'none',accessory:'none'});
  let svg=avatarSvg(config);
  if(['skin','hair','beard','headwear'].includes(tab))svg=svg.replace('viewBox="0 0 280 350"','viewBox="64 0 152 200"');
  if(tab==='character')svg=svg.replace('viewBox="0 0 280 350"','viewBox="46 22 188 328"');
  return '<span class="studio-choice-art" aria-hidden="true">'+svg+'</span>';
 };
 const renderOptions=(preserve=false)=>{
  const previous=options.scrollLeft,choices=studioChoices(tab,owned,draft.character);
  options.dataset.studioCategory=tab;
  const rewardIndex=reward?choices.findIndex(c=>c.reward?.id===reward.id):-1;
  if(rewardIndex>0)choices.unshift(...choices.splice(rewardIndex,1));
  options.innerHTML=choices.slice(0,limit).map((c,i)=>`<button type="button" class="studio-choice ${tab==='room'?'studio-room-choice':''} ${tab==='title'?'studio-title-tile':''}" data-studio-choice="${i}" aria-label="${esc(c.label)}" aria-pressed="${selected(c)}">${art(c)}<small>${esc(c.label)}</small>${c.reward?'<span class="studio-earned" aria-label="Premio conquistato">✦</span>':''}</button>`).join('')+(choices.length>limit?'<button type="button" class="studio-choice studio-more">Altre anteprime +</button>':'');
  options.querySelectorAll('[data-studio-choice]').forEach(b=>b.onclick=()=>{if(saving)return;draft=applyStudioChoice(draft,choices[Number(b.dataset.studioChoice)]);preview();status.textContent='';options.querySelectorAll('[data-studio-choice]').forEach(x=>x.setAttribute('aria-pressed',String(selected(choices[Number(x.dataset.studioChoice)]))));});
  const more=options.querySelector('.studio-more');if(more)more.onclick=()=>{limit+=24;renderOptions(true);};options.scrollLeft=preserve?previous:0;
 };
 const renderCategory=(preserve=false)=>{
  dialog.querySelectorAll('[data-studio-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.studioTab===tab)));
  const hint=dialog.querySelector('.studio-hint'),type=rewardType[tab];
  hint.textContent=type?'Premi '+(owned.map(rewardById).filter(r=>r?.type===type).length)+' / '+REWARD_CATALOG.filter(r=>r.type===type).length+' · nuovi a ogni giornata giocata':'Scorri le anteprime ↔';
  const sub=dialog.querySelector('.studio-suboptions');
  sub.innerHTML=tab==='hair'?AVATAR_OPTIONS.hairColor.values.map(([color,label])=>
   `<button type="button" class="studio-hair-color" aria-label="Capelli ${label}" aria-pressed="${draft.hairColor===color}" data-hair-color="${color}" style="--swatch:${color}"></button>`).join('')
   :tab==='color'?'<p class="studio-color-note">La tinta si applica anche agli abiti sbloccati.</p>':'';
  sub.hidden=tab!=='hair'&&tab!=='color';
  sub.querySelectorAll('[data-hair-color]').forEach(b=>b.onclick=()=>{
   draft.hairColor=b.dataset.hairColor;
   preview();renderCategory(true);
  });
  renderOptions(preserve);
 };
 dialog.querySelectorAll('[data-studio-tab]').forEach(b=>b.onclick=()=>{if(saving)return;tab=b.dataset.studioTab;limit=24;renderCategory();b.scrollIntoView({block:'nearest',inline:'nearest'});});
 dialog.querySelector('.studio-back').onclick=attemptClose;dialog.addEventListener('cancel',e=>{e.preventDefault();attemptClose();});
 bindSwipeBack(dialog.querySelector('.studio-header'),attemptClose,'both');
 dialog.querySelector('.studio-reset').onclick=()=>{if(saving)return;draft=normalizeAvatar(JSON.parse(original),owned);nickname=user.name;nicknameEditing=false;status.textContent='Modifiche annullate.';preview();renderCategory();};
 dialog.querySelector('.studio-save').onclick=async()=>{if(saving)return;saving=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Prepariamo il tuo ingresso al bar…';try{const result=await api('profile-avatar',{avatar:draft,name:nickname.trim()});user.avatar=result.avatar;if(user.name!==result.name)delete user.nicknameSuggested;user.name=result.name??nickname.trim();await onSaved?.(result.avatar,user.name);saving=false;close();}catch(error){saving=false;status.textContent=error.message;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}};
 preview();renderCategory();dialog.showModal();dialog.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
