const MOVE_PX=8,HOLD_MS=240,FLIP_MS=220;

export function enableDrag(root,{canDrop,onStart,onFlip,onDrop,onCancel,signal}){
 const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal});
 let pending=null,drag=null,suppressClick=false,holdTimer,clickTimer,scrollFrame,flipTimer;
 const targets=()=>root.querySelectorAll('[data-drop]');
 const at=(x,y)=>document.elementFromPoint(x,y)?.closest('[data-drop]');
 const allowed=(item,target)=>target&&root.contains(target)&&!target.closest('[hidden],[inert]')&&
  (!item.flipped||target.dataset.drop!=='flip')&&canDrop(item,target.dataset.drop);

 function paintTargets(){
  for(const target of targets())target.classList.toggle('is-droppable',!!allowed(drag,target));
 }
 function turn(){
  if(!drag||drag.flipped)return;
  clearTimeout(flipTimer);
  drag.flipped=true;drag.turnedAt=drag.point;
  drag.over?.classList.remove('is-over');drag.over=null;
  onFlip?.({id:drag.id,from:drag.from});
  paintTargets();
 }
 function markTarget(){
  const {x,y}=drag.point,under=at(x,y),fromTurn=drag.turnedAt;
  const underThreshold=fromTurn&&Math.hypot(x-fromTurn.x,y-fromTurn.y)<=MOVE_PX;
  const target=!underThreshold&&allowed(drag,under)?under:null;
  if(target===drag.over)return;
  clearTimeout(flipTimer);
  drag.over?.classList.remove('is-over');
  target?.classList.add('is-over');drag.over=target;
  if(target?.dataset.drop==='flip')flipTimer=setTimeout(turn,FLIP_MS);
 }
 function scrollBench(){
  scrollFrame=null;
  if(!drag)return;
  const list=root.querySelector('[data-st-face="bench"]:not([inert]) .fs-grid');
  if(list&&list.scrollHeight>list.clientHeight&&drag.over?.dataset.drop!=='flip'){
   const {x,y}=drag.point,bounds=list.getBoundingClientRect();
   if(x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom){
    const direction=y<bounds.top+32?-1:y>bounds.bottom-32?1:0;
    if(direction){
     const before=list.scrollTop;
     list.scrollTop+=direction*8;
     if(list.scrollTop!==before){markTarget();scrollFrame=window.requestAnimationFrame(scrollBench);}
    }
   }
  }
 }
 function move(x,y){
  drag.point={x,y};
  drag.ghost.style.transform=`translate(${x-drag.dx}px,${y-drag.dy}px) scale(1.06)`;
  drag.moved ||= Math.hypot(x-drag.origin.x,y-drag.origin.y)>MOVE_PX;
  if(!drag.moved)return;
  markTarget();
  if(scrollFrame==null&&window.requestAnimationFrame)scrollFrame=window.requestAnimationFrame(scrollBench);
 }
 function start(p,x,y){
  clearTimeout(holdTimer);
  pending=null;
  if(!root.contains(p.el)||p.el.disabled||p.el.closest('[hidden],[inert]'))return;
  const candidate={id:p.el.dataset.dragId,from:p.el.dataset.dragFrom,flipped:false};
  if(![...targets()].some(t=>allowed(candidate,t)))return;
  onStart?.();
  const rect=p.el.getBoundingClientRect(),ghost=p.el.cloneNode(true);
  ghost.classList.add('fanta-ghost');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
  ghost.style.width=rect.width+'px';document.body.append(ghost);
  drag={...candidate,el:p.el,ghost,pointerId:p.pointerId,dx:p.origin.x-rect.left,dy:p.origin.y-rect.top,origin:p.origin,moved:false,over:null};
  try{root.setPointerCapture?.(p.pointerId);}catch{}
  p.el.classList.add('is-dragging');document.body.classList.add('fanta-dragging');
  paintTargets();navigator.vibrate?.(15);move(x,y);
 }
 function end(commit,{notify=true}={}){
  clearTimeout(holdTimer);
  pending=null;if(!drag)return;
  const target=commit&&allowed(drag,drag.over)?drag.over.dataset.drop:null;
  if(target==='flip')turn();
  clearTimeout(flipTimer);
  if(scrollFrame!=null){window.cancelAnimationFrame?.(scrollFrame);scrollFrame=null;}
  const {id,from,flipped,el,pointerId,ghost}=drag;
  ghost.remove();el.classList.remove('is-dragging');document.body.classList.remove('fanta-dragging');
  for(const t of root.querySelectorAll('.is-droppable,.is-over'))t.classList.remove('is-droppable','is-over');
  drag=null;try{root.releasePointerCapture?.(pointerId);}catch{}
  suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>{suppressClick=false;},0);
  if(target&&target!=='flip')onDrop({id,from},target);
  else if(notify)onCancel?.({id,from,flipped,commit});
 }
 on(root,'pointerdown',e=>{
  if(e.button>0||e.isPrimary===false||drag||pending||e.target.closest('[inert],[hidden]'))return;
  const el=e.target.closest('[data-drag-id]');
  if(!el||el.disabled||!root.contains(el))return;
  // A swipe outside the shirt still scrolls the bench. Holding lifts the whole card.
  const canSwipe=el.dataset.dragFrom==='bench'&&e.pointerType!=='mouse'&&!e.target.closest('.fs-shirt');
  const point={x:e.clientX,y:e.clientY};
  const press={el,origin:point,point,canSwipe,pointerId:e.pointerId};
  pending=press;
  holdTimer=setTimeout(()=>start(press,press.point.x,press.point.y),HOLD_MS);
 });
 on(window,'pointermove',e=>{
  if(e.pointerId!==(drag||pending)?.pointerId)return;
  if(drag){e.preventDefault();move(e.clientX,e.clientY);return;}
  pending.point={x:e.clientX,y:e.clientY};
  if(Math.hypot(e.clientX-pending.origin.x,e.clientY-pending.origin.y)<=MOVE_PX)return;
  if(pending.canSwipe){end(false);return;}
  e.preventDefault();start(pending,e.clientX,e.clientY);
 },{passive:false});
 on(window,'pointerup',e=>{if(e.pointerId===(drag||pending)?.pointerId){if(drag)move(e.clientX,e.clientY);end(true);}});
 on(window,'pointercancel',e=>{if(e.pointerId===(drag||pending)?.pointerId)end(false);});
 on(window,'keydown',e=>{if(e.key==='Escape'&&(drag||pending)){e.preventDefault();end(false);}});
 signal?.addEventListener('abort',()=>{end(false,{notify:false});clearTimeout(clickTimer);},{once:true});
 on(root,'touchmove',e=>{if(drag)e.preventDefault();},{passive:false});
 on(root,'contextmenu',e=>{if(drag||pending)e.preventDefault();});
 on(root,'dragstart',e=>{if(e.target.closest('[data-drag-id]'))e.preventDefault();});
 on(root,'click',e=>{if(suppressClick){e.stopPropagation();e.preventDefault();}},{capture:true});
 return {active:()=>!!drag,cancel:()=>end(false,{notify:false})};
}
