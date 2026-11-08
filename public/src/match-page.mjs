// A page inside the existing app chrome. The underlying slip and its draft DOM
// stay mounted, so closing a match never reloads or resets the user's choices.
let active=null,skipPop=false;
export function bindSwipeBack(surface,back){
 let start=null;
 surface.addEventListener('touchstart',event=>{start=event.touches.length===1?event.touches[0]:null;},{passive:true});
 surface.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 surface.addEventListener('touchend',event=>{
  const first=start,point=event.changedTouches[0];start=null;
  if(!first||!point)return;
  const dx=point.clientX-first.clientX,dy=point.clientY-first.clientY;
  if(dx>=45&&dx>Math.abs(dy)*1.4)back();
 },{passive:true});
}
export function closeMatchPage({back=true}={}){
 if(!active)return;const {root,scroll,focus,onClose,doc}=active;active=null;
 root.open=false;root.dispatchEvent(new doc.defaultView.Event('close'));root._pitchCleanup?.();root.remove();
 doc.body.classList.remove('match-page-active');onClose?.();
 globalThis.scrollTo?.(0,scroll);focus?.focus?.({preventScroll:true});
 if(back&&globalThis.history?.state?.qdqMatchPage){skipPop=true;globalThis.history.back();}
 else if(!back&&globalThis.history?.state?.qdqMatchPage){const {qdqMatchPage,...state}=history.state;history.replaceState(state,'',location.href);}
}
export function openMatchPage({onClose,document:doc=globalThis.document,kind='match',label='Dettaglio della partita',swipeBack=false}={}){
 if(active)closeMatchPage({back:false});
 const root=doc.createElement('main');root.id='match-page-root';root.className='match-page'+(kind==='postcard'?' verdict-page':'');root.setAttribute('aria-label',label);root.tabIndex=-1;
 root.open=true;root.close=()=>closeMatchPage();
 if(swipeBack){
  root.classList.add('match-swipe-back');
  bindSwipeBack(root,root.close);
 }
 active={root,scroll:globalThis.scrollY||0,focus:doc.activeElement,onClose,doc};
 doc.getElementById('app').after(root);doc.body.classList.add('match-page-active');
 if(globalThis.history&&!history.state?.qdqMatchPage)history.pushState({...history.state,qdqMatchPage:true},'',location.href);
 globalThis.scrollTo?.(0,0);root.focus?.({preventScroll:true});return root;
}
globalThis.window?.addEventListener('popstate',event=>{
 if(!active&&!skipPop)return;event.stopImmediatePropagation();skipPop=false;closeMatchPage({back:false});
},{capture:true});
globalThis.window?.addEventListener('quasi:navigation',()=>closeMatchPage({back:false}));
globalThis.document?.addEventListener('click',event=>{if(event.target.closest?.('[data-app-mode],[data-mode],nav.v2-tabbar button'))closeMatchPage({back:false});},{capture:true});
globalThis.document?.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();closeMatchPage();}});
