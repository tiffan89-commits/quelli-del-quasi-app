import {avatarSvg,normalizeAvatar} from './avatar.mjs';
import {rewardById} from './reward-catalog.mjs';
import {roomAsset,roomById,roomMedia} from './locker-rooms.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const artKey='qdq:quasi-art:v3';
const drawings=new Map(),urls=new Map();
let scheduled=false;
try{const saved=JSON.parse(localStorage.getItem(artKey)||'[]');for(const [key,svg] of saved.slice(-32))if(typeof key==='string'&&typeof svg==='string'&&svg.startsWith('<svg '))drawings.set(key,svg);}catch{}
function quasiArt(avatar){
 if(!globalThis.window?.URL?.createObjectURL)return avatarSvg(avatar);
 const key=JSON.stringify(avatar);let url=urls.get(key);
 if(!url){
  let svg=drawings.get(key);
  if(!svg){
   svg=avatarSvg(avatar);drawings.set(key,svg);
   while(drawings.size>32)drawings.delete(drawings.keys().next().value);
   if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;try{localStorage.setItem(artKey,JSON.stringify([...drawings]));}catch{}});}
  }
  url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));urls.set(key,url);
  if(urls.size>128){const oldest=urls.keys().next().value;URL.revokeObjectURL(urls.get(oldest));urls.delete(oldest);}
 }
 return `<img class="quasi-avatar" src="${esc(url)}" width="280" height="350" alt="" decoding="sync" aria-hidden="true">`;
}
export function quasiScene(value,name,{compact=false,eager=false}={}){
 const a=normalizeAvatar(value),room=a.rewardRoom!=='none'?a.rewardRoom:a.room,title=rewardById(a.rewardTitle)?.name||'Quasi fenomeno';
 return `<div class="quasi-scene ${compact?'quasi-scene-small':''}"><img class="quasi-scene-room" src="${roomAsset(room,compact?'thumb':'full')}" srcset="${roomAsset(room,'tiny')} 240w, ${roomAsset(room,'thumb')} 480w, ${roomAsset(room)} ${roomMedia(room)?.full.width||640}w" sizes="${compact?'(max-width:600px) calc((100vw - 48px)/3), 220px':'(max-width:600px) calc(100vw - 32px), 520px'}" width="640" height="800" fetchpriority="${eager?'high':'low'}" data-media-priority="${eager?'user':'idle'}" alt="${esc(roomById(room)?.name||'Spogliatoio')}" loading="eager" decoding="async"><div class="quasi-scene-shade"></div><div class="quasi-scene-person">${quasiArt(a)}</div><div class="quasi-scene-caption"><strong>${esc(title)}</strong><span>${esc(name)}</span></div></div>`;
}
export function quasiBanner(value,name){
 const a=normalizeAvatar(value),room=a.rewardRoom!=='none'?a.rewardRoom:a.room;
 return `<button type="button" class="dash-scene" data-open-quasi-studio aria-label="Apri il tuo Quasi, ${esc(name)}"><img class="dash-scene-room" src="${roomAsset(room,'hero')}" srcset="${roomMedia(room)?.hero.width!==roomMedia(room)?.full.width?roomAsset(room,'hero')+' '+roomMedia(room).hero.width+'w, ':''}${roomAsset(room)} ${roomMedia(room)?.full.width||640}w" sizes="(min-width:900px) 1180px, calc(100vw - 36px)" width="640" height="800" fetchpriority="high" alt="" loading="eager" decoding="async"><span class="dash-scene-shade"></span><span class="dash-scene-person">${quasiArt(a)}</span><span class="dash-scene-edit">Il mio Quasi ✎</span></button>`;
}
export function showQuasi(member){
 const d=document.createElement('dialog');d.className='quasi-zoom';d.setAttribute('aria-label','Il Quasi di '+member.name);d.innerHTML='<button type="button" class="quasi-zoom-close" aria-label="Chiudi">×</button>'+quasiScene(member.avatar,member.name,{eager:true});document.body.append(d);const close=()=>{d.close();d.remove();};d.querySelector('button').onclick=close;d.addEventListener('cancel',close);d.onclick=e=>{if(e.target===d)close();};d.showModal();
}
