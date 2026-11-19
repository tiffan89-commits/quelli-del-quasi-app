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
export function bindPullDown(surface,close){
 let start=null;
 const clear=()=>{
  start=null;
  surface.style.removeProperty('--match-drag');
 };
 surface.addEventListener('touchstart',event=>{
  clear();
  if(event.touches.length!==1||surface.ownerDocument.defaultView?.scrollY>0||event.target.closest?.('input,select,textarea,[contenteditable]'))return;
  for(let node=event.target;node;node=node.parentElement){
   if(node.scrollTop>0)return;
   if(node===surface)break;
  }
  start=event.touches[0];
 },{passive:true});
 surface.addEventListener('touchmove',event=>{
  if(!start||event.touches.length!==1){clear();return;}
  const point=event.touches[0],dy=point.clientY-start.clientY,dx=Math.abs(point.clientX-start.clientX);
  if(dx>12&&dx>Math.abs(dy)||dy<-8){clear();return;}
  if(dy<8||dy<=dx*1.4||!event.cancelable)return;
  event.preventDefault();
  surface.style.setProperty('--match-drag',Math.min(dy/3,42)+'px');
 },{passive:false});
 surface.addEventListener('touchcancel',clear,{passive:true});
 surface.addEventListener('touchend',event=>{
  const first=start,point=event.changedTouches[0];clear();
  if(!first||!point)return;
  const dy=point.clientY-first.clientY;
  if(dy>65&&dy>Math.abs(point.clientX-first.clientX)*1.4)close();
 },{passive:true});
}

export function closeMatchPage({back=true}={}){
 if(!active)return;const {root,scroll,focus,onClose,doc}=active;active=null;
 root.open=false;root.dispatchEvent(new doc.defaultView.Event('close'));root._pitchCleanup?.();
 root.remove();
 doc.body.classList.remove('match-page-active');onClose?.();
 globalThis.scrollTo?.(0,scroll);
 const target=focus?.isConnected?focus:root.dataset.match
  ?[...doc.querySelectorAll('button[data-detail]')].find(button=>button.dataset.detail===root.dataset.match):null;
 target?.focus?.({preventScroll:true});
 if(back&&globalThis.history?.state?.qdqMatchPage){skipPop=true;globalThis.history.back();}
 else if(!back&&globalThis.history?.state?.qdqMatchPage){const {qdqMatchPage,...state}=history.state;history.replaceState(state,'',location.href);}
}
export function openMatchPage({onClose,document:doc=globalThis.document,kind='match',label='Dettaglio della partita',swipeBack=false,trigger}={}){
 if(active)closeMatchPage({back:false});
 const root=doc.createElement('main');
 root.id='match-page-root';root.className='match-page'+(kind==='postcard'?' verdict-page':'');root.setAttribute('aria-label',label);
 root.close=()=>closeMatchPage();
 root.tabIndex=-1;root.open=true;
 if(kind==='match')bindPullDown(root,root.close);
 if(swipeBack){
  root.classList.add('match-swipe-back');
  bindSwipeBack(root,root.close,swipeBack===true?'right':swipeBack);
 }
 active={root,scroll:globalThis.scrollY||0,focus:trigger||doc.activeElement,onClose,doc};
 doc.getElementById('app').after(root);doc.body.classList.add('match-page-active');
 if(globalThis.history&&!history.state?.qdqMatchPage)history.pushState({...history.state,qdqMatchPage:true},'',location.href);
 globalThis.scrollTo?.(0,0);root.focus?.({preventScroll:true});
 return root;
}
globalThis.window?.addEventListener('popstate',event=>{
 if(!active&&!skipPop)return;event.stopImmediatePropagation();skipPop=false;closeMatchPage({back:false});
},{capture:true});
globalThis.window?.addEventListener('quasi:navigation',()=>closeMatchPage({back:false}));
globalThis.document?.addEventListener('click',event=>{if(event.target.closest?.('[data-app-mode],[data-mode],nav.v2-tabbar button'))closeMatchPage({back:false});},{capture:true});
globalThis.document?.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();closeMatchPage();}});
