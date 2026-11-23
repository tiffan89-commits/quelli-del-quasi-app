import {openSiteOverlay} from './site-overlay.mjs';
import {esc} from './fanta/formato.mjs';

const icons={
 winner:'<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 14v6m-4 1h8"/>',
 'winner-credits':'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
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

const iconFor=id=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]||''}</svg>`;

export function renderHomeStories({mode,uid,scope,stories}){
 const seen=readSeen(uid,mode);
 return `<div class="bar-home-stories"${stories.length?'':' hidden'} aria-label="Storie ${mode==='bar'?'del Bar':'Fanta'}">${stories.map(({id,label,title,body,version})=>{
  const key=scope+(version?':'+version:'')+':'+id;
  return `<article class="bar-home-story-slot"><button type="button" class="bar-story-trigger story-${id}" id="${mode}-story-${id}" data-bar-story="${esc(key)}" aria-haspopup="dialog" aria-label="${esc(title)}${seen.has(key)?', già vista':''}"${seen.has(key)?' data-seen':''}><span class="bar-story-ring"><span class="bar-story-art">${iconFor(id)}</span></span><small>${esc(label)}</small></button>
  <template data-story-card data-story-kind="${id}"><h2>${esc(title)}</h2>${body}</template></article>`;
 }).join('')}</div>`;
}

export function openHomeStory(trigger,{uid,mode,onAction}){
 const stories=[...trigger.closest('.bar-home-stories').querySelectorAll('[data-bar-story]')];
 const document=trigger.ownerDocument,win=document.defaultView;
 const dialog=document.createElement('dialog');
 dialog.className='bar-story-dialog';
 dialog.setAttribute('aria-label',mode==='bar'?'Storie del Bar':'Storie Fanta');
 dialog.innerHTML=`<section class="bar-story-frame"><div class="bar-story-progress" aria-hidden="true"></div>
  <header class="bar-story-top"><div class="bar-story-heading"><span class="bar-story-art"></span><strong></strong></div>
  <div class="bar-story-controls"><button type="button" data-story-pause aria-pressed="false">Pausa</button><button type="button" data-story-close aria-label="Chiudi storia" autofocus>×</button></div></header>
  <div class="bar-story-pages"><button type="button" data-story-back aria-label="Storia precedente">‹</button><article class="bar-story-copy" data-overlay-scroll></article><button type="button" data-story-next aria-label="Storia successiva">›</button></div></section>`;
 const close=openSiteOverlay(dialog,trigger),progress=dialog.querySelector('.bar-story-progress');
 const content=dialog.querySelector('.bar-story-copy'),pause=dialog.querySelector('[data-story-pause]');
 const heading=dialog.querySelector('.bar-story-heading'),back=dialog.querySelector('[data-story-back]');
 const controls=new AbortController(),{signal}=controls;
 let index=stories.indexOf(trigger),remaining=0,started=0,timer=null,manual=false,heldAt=null,suppressClick=false;
 const stop=()=>{clearTimeout(timer);timer=null;};
 const advance=()=>index+1<stories.length?show(index+1):close();
 function syncPlayback(){
  const fill=progress.children[index]?.firstElementChild;
  if(!fill)return;
  if(manual||heldAt!==null||document.hidden){
   if(timer!==null)remaining=Math.max(0,remaining-(performance.now()-started));
   stop();fill.style.animationPlayState='paused';return;
  }
  if(timer!==null)return;
  started=performance.now();fill.style.animationPlayState='running';
  timer=setTimeout(advance,remaining);
 }
 function show(next){
  stop();index=next;
  const button=stories[index],key=button.dataset.barStory,template=button.parentElement.querySelector('template');
  markSeen(uid,mode,key);
  button.setAttribute('data-seen','');
  if(!button.getAttribute('aria-label').endsWith(', già vista'))button.setAttribute('aria-label',button.getAttribute('aria-label')+', già vista');
  dialog.dataset.storyKind=template.dataset.storyKind;
  heading.firstElementChild.innerHTML=iconFor(template.dataset.storyKind);
  heading.lastElementChild.textContent=button.querySelector('small').textContent;
  content.replaceChildren(template.content.cloneNode(true));
  content.scrollTop=0;
  if(content.scrollHeight>content.clientHeight)content.tabIndex=0;else content.removeAttribute('tabindex');
  remaining=content.querySelector('.home-story-votes,.verdict-postcard')?24000:14000;
  progress.innerHTML=stories.map((_,i)=>`<span class="${i<index?'is-done':i===index?'is-now':''}"><i></i></span>`).join('');
  progress.children[index].firstElementChild.style.animationDuration=remaining+'ms';
  back.disabled=index===0;
  syncPlayback();
 }
 function hold(event){
  if(heldAt!==null||event.target.closest('.bar-story-controls'))return;
  suppressClick=false;heldAt=performance.now();syncPlayback();
 }
 function release(){
  if(heldAt===null)return;
  suppressClick=performance.now()-heldAt>=250;
  heldAt=null;syncPlayback();
 }
 // Touch events keep the hold active through native scrolling, which can
 // cancel pointer events before the user's finger leaves the screen.
 dialog.addEventListener('touchstart',event=>{if(event.touches.length===1)hold(event);},{passive:true,signal});
 dialog.addEventListener('touchend',event=>{if(!event.touches.length)release();},{passive:true,signal});
 dialog.addEventListener('touchcancel',release,{passive:true,signal});
 dialog.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'&&event.button===0)hold(event);},{signal});
 win?.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')release();},{signal});
 win?.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')release();},{signal});
 win?.addEventListener('blur',release,{signal});
 document.addEventListener('visibilitychange',syncPlayback,{signal});
 dialog.addEventListener('contextmenu',event=>event.preventDefault(),{signal});
 dialog.addEventListener('click',event=>{
  if(event.detail!==0&&suppressClick&&!event.target.closest('.bar-story-controls')){
   event.preventDefault();event.stopImmediatePropagation();suppressClick=false;
  }
 },{capture:true,signal});
 pause.onclick=()=>{
  manual=!manual;
  pause.textContent=manual?'Riprendi':'Pausa';pause.setAttribute('aria-pressed',String(manual));
  syncPlayback();
 };
 dialog.querySelector('[data-story-close]').onclick=close;
 back.onclick=()=>{if(index>0)show(index-1);};
 dialog.querySelector('[data-story-next]').onclick=advance;
 dialog.addEventListener('click',event=>{const button=event.target.closest('[data-story-slip],[data-home-action]');if(button){close();onAction(button.dataset);}},{signal});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'){event.preventDefault();advance();}
  if(event.key==='ArrowLeft'&&index>0){event.preventDefault();show(index-1);}
 },{signal});
 dialog.addEventListener('close',()=>{stop();controls.abort();},{once:true});
 show(index);
}
