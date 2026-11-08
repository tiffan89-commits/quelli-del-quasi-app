// The wide bench scrolls horizontally. The side bench scrolls vertically and
// uses its handle for vertical reordering, or a horizontal drag from the shirt.
// The older vertical roster keeps its hold gesture. Mouse and field slots drag immediately.
const MOVE_PX=8,HOLD_MS=220;
export function enableDrag(root,{canDrop,onStart,onDrop,signal}){
 const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...(typeof options==='boolean'?{capture:options}:options),signal});
 let pending=null,drag=null,suppressClick=false,clickTimer,scrollFrame;
 const targetAt=(x,y)=>{const t=document.elementFromPoint(x,y)?.closest('[data-drop]');return t&&root.contains(t)?t:null;};
 function paintTargets(){
  for(const t of root.querySelectorAll('[data-drop]'))t.classList.toggle('is-droppable',permitted(drag,t.dataset.drop));
 }
 function canUse(target){
  if(!drag.pane)return true;
  return target.startsWith(drag.toField?'slot:':'bench:');
 }
 function permitted(item,target){return canUse(target)&&canDrop(item,target);}
 function markTarget(x,y){
  const t=targetAt(x,y),ok=t&&permitted(drag,t.dataset.drop)?t:null;
  if(ok!==drag.over){drag.over?.classList.remove('is-over');ok?.classList.add('is-over');drag.over=ok;}
 }
 function scrollBench(){
  if(!drag?.pane||drag.toField)return;
  const {list,point:{x,y}}=drag,b=list.getBoundingClientRect();
  if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom){
   const direction=y<b.top+32?-1:y>b.bottom-32?1:0;
   if(direction){list.scrollTop+=direction*8;markTarget(x,y);}
  }
  scrollFrame=window.requestAnimationFrame(scrollBench);
 }
 function move(x,y){
  drag.ghost.style.transform=`translate(${x-drag.dx}px,${y-drag.dy}px) scale(1.06)`;
  if(drag.pane){
   drag.point={x,y};
   if(!drag.toField&&x<drag.paneLeft){
    drag.toField=true;drag.studio.classList.add('is-drag-to-field');paintTargets();
   }
  }
  markTarget(x,y);
 }
 function start(p,x=p.x,y=p.y){
  clearTimeout(p.timer);pending=null;
  const candidate={id:p.el.dataset.dragId,from:p.el.dataset.dragFrom};
  if(![...root.querySelectorAll('[data-drop]')].some(t=>canDrop(candidate,t.dataset.drop)))return;
  onStart?.();
  const rect=p.el.getBoundingClientRect(),ghost=p.el.cloneNode(true);
  ghost.classList.add('fanta-ghost');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
  ghost.style.width=rect.width+'px';document.body.append(ghost);
  const pane=p.side?p.el.closest('.fs-dock'):null,list=pane?.querySelector('.fs-grid');
  const capture=pane?root:p.el;
  drag={...candidate,el:p.el,ghost,capture,pointerId:p.pointerId,dx:p.x-rect.left,dy:p.y-rect.top,over:null,
   pane,list,paneLeft:pane?.getBoundingClientRect().left,studio:pane?.closest('.fs'),toField:false};
  try{capture.setPointerCapture?.(p.pointerId);}catch{}
  p.el.classList.add('is-dragging');document.body.classList.add('fanta-dragging');
  paintTargets();navigator.vibrate?.(15);move(x,y);
  if(list&&window.requestAnimationFrame&&!drag.toField)scrollFrame=window.requestAnimationFrame(scrollBench);
 }
 function end(commit){
  clearTimeout(pending?.timer);pending=null;if(!drag)return;
  const {id,from,over,el,pointerId,capture,studio}=drag;
  const target=commit&&over&&permitted(drag,over.dataset.drop)?over.dataset.drop:null;
  if(scrollFrame!=null){window.cancelAnimationFrame(scrollFrame);scrollFrame=null;}
  studio?.classList.remove('is-drag-to-field');
  drag.ghost.remove();el.classList.remove('is-dragging');document.body.classList.remove('fanta-dragging');
  for(const t of root.querySelectorAll('.is-droppable,.is-over'))t.classList.remove('is-droppable','is-over');
  drag=null;try{capture.releasePointerCapture?.(pointerId);}catch{}
  suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>{suppressClick=false;},0);
  if(target)onDrop({id,from},target);
 }
 on(root,'pointerdown',e=>{
  if(e.button>0||e.isPrimary===false||drag||e.target.closest('[data-no-drag]'))return;
  const handle=e.target.closest('[data-drag-handle]');
  const el=e.target.closest('[data-drag-id]')||(handle&&!handle.disabled&&handle.closest('[data-drop]')?.querySelector('[data-drag-id]'));
  if(!el||el.disabled||!root.contains(el))return;
  clearTimeout(pending?.timer);
  const directional=el.dataset.dragAxis==='up'&&e.pointerType!=='mouse';
  const side=el.dataset.dragAxis==='side';
  const horizontal=side&&!handle&&e.pointerType!=='mouse';
  const immediate=!directional&&!horizontal&&(e.pointerType==='mouse'||handle||el.dataset.dragFrom?.startsWith('slot'));
  pending={el,x:e.clientX,y:e.clientY,immediate,directional,side,horizontal,pointerId:e.pointerId};
  if(!immediate&&!directional&&!horizontal)pending.timer=setTimeout(()=>{if(pending)start(pending);},HOLD_MS);
 });
 on(window,'pointermove',e=>{
  if(drag){if(e.pointerId!==drag.pointerId)return;e.preventDefault();move(e.clientX,e.clientY);return;}
  if(!pending||e.pointerId!==pending.pointerId)return;
  const dx=e.clientX-pending.x,dy=e.clientY-pending.y;
  if(Math.hypot(dx,dy)<=MOVE_PX)return;
  if(pending.horizontal){
   if(Math.abs(dx)>MOVE_PX&&Math.abs(dx)>Math.abs(dy)){e.preventDefault();start(pending,e.clientX,e.clientY);}
   else if(Math.abs(dy)>MOVE_PX)pending=null;
  }else if(pending.directional){
   if(dy<-MOVE_PX&&Math.abs(dy)>Math.abs(dx)*1.2){e.preventDefault();start(pending,e.clientX,e.clientY);}
   else if(Math.abs(dx)>MOVE_PX||dy>MOVE_PX){clearTimeout(pending.timer);pending=null;}
  }else if(pending.immediate){e.preventDefault();start(pending,e.clientX,e.clientY);}
  else{clearTimeout(pending.timer);pending=null;}
 },{passive:false});
 on(window,'pointerup',e=>{if(e.pointerId===(drag||pending)?.pointerId){if(drag?.pane)move(e.clientX,e.clientY);end(true);}});
 on(window,'pointercancel',e=>{if(e.pointerId===(drag||pending)?.pointerId)end(false);});
 on(window,'keydown',e=>{if(e.key==='Escape')end(false);});
 signal?.addEventListener('abort',()=>{end(false);clearTimeout(clickTimer);},{once:true});
 on(root,'touchmove',e=>{if(drag)e.preventDefault();},{passive:false});
 on(root,'contextmenu',e=>{if(drag||pending)e.preventDefault();});
 on(root,'dragstart',e=>{if(e.target.closest('[data-drag-id]'))e.preventDefault();});
 on(root,'click',e=>{if(suppressClick){e.stopPropagation();e.preventDefault();}},true);
 return {cancel:()=>end(false)};
}
