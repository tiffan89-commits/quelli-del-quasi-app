import {openSiteOverlay} from './site-overlay.mjs';
import {esc} from './fanta/formato.mjs';

const icons={
 results:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
 rewards:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12m0-12C5 9 6 2 9 4c1 .7 3 4 3 4Zm0 0c7 1 6-6 3-4-1 .7-3 4-3 4Z"/>',
 crossings:'<path d="m3 17 6-6 4 4 7-8m-6 0h6v6"/>',
 top:'<path d="M3 17h18M6 14l4-8 4 8m1-1 2 3 3-5"/>',
 opponent:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
 market:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
};
function readSeen(uid,mode){
 try {const value=JSON.parse(localStorage.getItem('qdq:'+mode+'-stories:'+uid)||'[]');return new Set(Array.isArray(value)?value:[]);}catch{return new Set();}
}
function markSeen(uid,mode,key){
 try {const seen=readSeen(uid,mode);seen.delete(key);seen.add(key);localStorage.setItem('qdq:'+mode+'-stories:'+uid,JSON.stringify([...seen].slice(-128)));}catch{}
}

export function renderHomeStories({mode,uid,scope,stories}){
 const seen=readSeen(uid,mode);
 return `<div class="bar-home-stories"${stories.length?'':' hidden'} aria-label="Storie ${mode==='bar'?'del Bar':'Fanta'}">${stories.map(({id,label,title,body,version})=>{
  const key=scope+(version?':'+version:'')+':'+id;
  return `<article class="bar-home-story-slot"><button type="button" class="bar-story-trigger story-${id}" id="${mode}-story-${id}" data-bar-story="${esc(key)}" aria-haspopup="dialog" aria-label="${esc(title)}${seen.has(key)?', già vista':''}"${seen.has(key)?' data-seen':''}><span><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg></span><small>${esc(label)}</small></button>
  <template data-story-card><h2>${esc(title)}</h2>${body}</template></article>`;
 }).join('')}</div>`;
}

export function openHomeStory(trigger,{uid,mode,onAction}){
 const stories=[...trigger.closest('.bar-home-stories').querySelectorAll('[data-bar-story]')];
 const document=trigger.ownerDocument;
 const dialog=document.createElement('dialog');
 dialog.className='bar-story-dialog';
 dialog.setAttribute('aria-label',mode==='bar'?'Storie del Bar':'Storie Fanta');
 dialog.innerHTML=`<section class="bar-story-frame"><div class="bar-story-progress" aria-hidden="true"></div>
  <div class="bar-story-controls"><button type="button" data-story-pause aria-pressed="false">Pausa</button><button type="button" data-story-close aria-label="Chiudi storia" autofocus>×</button></div>
  <div class="bar-story-pages"><button type="button" data-story-back aria-label="Storia precedente">‹</button><article class="bar-story-copy" data-overlay-scroll></article><button type="button" data-story-next aria-label="Storia successiva">›</button></div></section>`;
 const close=openSiteOverlay(dialog,trigger),progress=dialog.querySelector('.bar-story-progress');
 const content=dialog.querySelector('.bar-story-copy'),pause=dialog.querySelector('[data-story-pause]');
 const duration=11000;
 let index=stories.indexOf(trigger),remaining=duration,started=0,timer=null,paused=false;
 const stop=()=>{clearTimeout(timer);timer=null;};
 const advance=()=>index+1<stories.length?show(index+1):close();
 function play(){
  const fill=progress.children[index]?.firstElementChild;
  if(!fill||paused)return;
  started=performance.now();
  fill.style.animationDuration=remaining+'ms';fill.style.animationPlayState='running';
  timer=setTimeout(advance,remaining);
 }
 function show(next){
  stop();index=next;remaining=duration;
  const button=stories[index],key=button.dataset.barStory;
  markSeen(uid,mode,key);
  button.setAttribute('data-seen','');
  if(!button.getAttribute('aria-label').endsWith(', già vista'))button.setAttribute('aria-label',button.getAttribute('aria-label')+', già vista');
  content.replaceChildren(button.parentElement.querySelector('template').content.cloneNode(true));
  progress.innerHTML=stories.map((_,i)=>`<span class="${i<index?'is-done':i===index?'is-now':''}"><i></i></span>`).join('');
  dialog.querySelector('[data-story-back]').disabled=index===0;
  play();
 }
 pause.onclick=()=>{
  paused=!paused;
  pause.textContent=paused?'Riprendi':'Pausa';pause.setAttribute('aria-pressed',String(paused));
  const fill=progress.children[index].firstElementChild;
  if(paused){remaining=Math.max(0,remaining-(performance.now()-started));stop();fill.style.animationPlayState='paused';}
  else{started=performance.now();fill.style.animationPlayState='running';timer=setTimeout(advance,remaining);}
 };
 content.addEventListener('focusin',()=>{if(!paused)pause.click();});
 dialog.querySelector('[data-story-close]').onclick=close;
 dialog.querySelector('[data-story-back]').onclick=()=>{if(index>0)show(index-1);};
 dialog.querySelector('[data-story-next]').onclick=advance;
 dialog.addEventListener('click',event=>{const button=event.target.closest('[data-story-slip],[data-home-action]');if(button){close();onAction(button.dataset);}});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'){event.preventDefault();advance();}
  if(event.key==='ArrowLeft'&&index>0){event.preventDefault();show(index-1);}
 });
 dialog.addEventListener('close',stop,{once:true});
 show(index);
}
