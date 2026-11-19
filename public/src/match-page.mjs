import {bindSheetDismiss} from './site-overlay.mjs';

// The underlying slip and its draft DOM
// stay mounted, so closing a match never reloads or resets the user's choices.
let active=null,skipPop=false;
export function bindSwipeBack(surface,back,direction='right',canSwipe=()=>true){
 let start=null;
 surface.addEventListener('touchstart',event=>{
  start=null;
  if(event.touches.length!==1||event.target.closest?.('input,select,textarea,[contenteditable]')||!canSwipe(event))return;
  for(let node=event.target;node&&node!==surface;node=node.parentElement){
   if(node.scrollWidth<=node.clientWidth+2)continue;
   const overflow=surface.ownerDocument.defaultView?.getComputedStyle(node).overflowX;
   if(overflow==='auto'||overflow==='scroll')return;
  }
  start=event.touches[0];
 },{passive:true});
 surface.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 surface.addEventListener('touchend',event=>{
  const first=start,point=event.changedTouches[0];start=null;
  if(!first||!point)return;
  const dx=point.clientX-first.clientX,dy=point.clientY-first.clientY;
  const movement=direction==='both'?Math.abs(dx):direction==='left'?-dx:dx;
  if(movement>=45&&movement>Math.abs(dy)*1.4){event.stopPropagation();back();}
 },{passive:true});
}
export function closeMatchPage({back=true}={}){
 if(!active)return;const {root,scroll,focus,onClose,doc,closeNative}=active;active=null;
 if(closeNative){closeNative();root._pitchCleanup?.();}
 else{root.open=false;root.dispatchEvent(new doc.defaultView.Event('close'));root._pitchCleanup?.();}
 root.remove();
 doc.body.classList.remove(closeNative?'match-sheet-active':'match-page-active');onClose?.();
 if(!closeNative)globalThis.scrollTo?.(0,scroll);
 const target=focus?.isConnected?focus:closeNative&&root.dataset.match
  ?[...doc.querySelectorAll('button[data-detail]')].find(button=>button.dataset.detail===root.dataset.match):null;
 target?.focus?.({preventScroll:true});
 if(back&&globalThis.history?.state?.qdqMatchPage){skipPop=true;globalThis.history.back();}
 else if(!back&&globalThis.history?.state?.qdqMatchPage){const {qdqMatchPage,...state}=history.state;history.replaceState(state,'',location.href);}
}
export function openMatchPage({onClose,document:doc=globalThis.document,kind='match',label='Dettaglio della partita',swipeBack=false,trigger}={}){
 if(active)closeMatchPage({back:false});
 const sheet=kind==='lineup',root=doc.createElement(sheet?'dialog':'main');
 root.id='match-page-root';root.className='match-page'+(sheet?' match-sheet':kind==='postcard'?' verdict-page':'');root.setAttribute('aria-label',label);
 const closeNative=sheet?root.close.bind(root):null;
 root.close=()=>closeMatchPage();
 if(sheet){
  root.dataset.overlayScroll='';
  root.innerHTML='<div class="match-sheet-grip" data-sheet-grip aria-hidden="true"><span class="v2-sheet-handle"></span></div><div data-match-sheet-content><button type="button" class="match-nav-button match-close" aria-label="Chiudi partita" autofocus>×</button><p role="status">Caricamento…</p></div>';
  root.querySelector('button').onclick=root.close;
  root.addEventListener('cancel',event=>{event.preventDefault();root.close();});
  bindSheetDismiss(root,root.close);
 }else{root.tabIndex=-1;root.open=true;}
 if(swipeBack){
  root.classList.add('match-swipe-back');
  bindSwipeBack(root,root.close,swipeBack===true?'right':swipeBack);
 }
 active={root,scroll:globalThis.scrollY||0,focus:trigger||doc.activeElement,onClose,doc,closeNative};
 doc.getElementById('app').after(root);doc.body.classList.add(sheet?'match-sheet-active':'match-page-active');
 if(globalThis.history&&!history.state?.qdqMatchPage)history.pushState({...history.state,qdqMatchPage:true},'',location.href);
 if(sheet)root.showModal();
 else{globalThis.scrollTo?.(0,0);root.focus?.({preventScroll:true});}
 return root;
}
globalThis.window?.addEventListener('popstate',event=>{
 if(!active&&!skipPop)return;event.stopImmediatePropagation();skipPop=false;closeMatchPage({back:false});
},{capture:true});
globalThis.window?.addEventListener('quasi:navigation',()=>closeMatchPage({back:false}));
globalThis.document?.addEventListener('click',event=>{if(event.target.closest?.('[data-app-mode],[data-mode],nav.v2-tabbar button'))closeMatchPage({back:false});},{capture:true});
globalThis.document?.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();closeMatchPage();}});
