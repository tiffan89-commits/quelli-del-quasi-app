// Pointer dragging: horizontal swipes browse the studio; an upward gesture places a player.
// The older vertical roster keeps its hold gesture. Mouse and field slots drag immediately.
const MOVE_PX=8,HOLD_MS=220;
export function enableDrag(root,{canDrop,onDrop,signal}){
 const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...(typeof options==='boolean'?{capture:options}:options),signal});
 let pending=null,drag=null,suppressClick=false,clickTimer;
 const targetAt=(x,y)=>{const t=document.elementFromPoint(x,y)?.closest('[data-drop]');return t&&root.contains(t)?t:null;};
 function move(x,y){
  drag.ghost.style.transform=`translate(${x-drag.dx}px,${y-drag.dy}px) scale(1.06)`;
  const t=targetAt(x,y),ok=t&&canDrop(drag,t.dataset.drop)?t:null;
  if(ok!==drag.over){drag.over?.classList.remove('is-over');ok?.classList.add('is-over');drag.over=ok;}
 }
 function start(p,x=p.x,y=p.y){
  clearTimeout(p.timer);pending=null;
  const candidate={id:p.el.dataset.dragId,from:p.el.dataset.dragFrom};
  const targets=[...root.querySelectorAll('[data-drop]')].filter(t=>canDrop(candidate,t.dataset.drop));
  if(!targets.length)return;
  const rect=p.el.getBoundingClientRect(),ghost=p.el.cloneNode(true);ghost.classList.add('fanta-ghost');ghost.setAttribute('aria-hidden','true');ghost.style.width=rect.width+'px';document.body.append(ghost);
  drag={...candidate,el:p.el,ghost,pointerId:p.pointerId,dx:p.x-rect.left,dy:p.y-rect.top,over:null};
  try{p.el.setPointerCapture?.(p.pointerId);}catch{}
  p.el.classList.add('is-dragging');document.body.classList.add('fanta-dragging');
  for(const t of targets)t.classList.add('is-droppable');navigator.vibrate?.(15);move(x,y);
 }
 function end(commit){
  clearTimeout(pending?.timer);pending=null;if(!drag)return;
  const {id,from,over,el,pointerId}=drag;
  drag.ghost.remove();el.classList.remove('is-dragging');document.body.classList.remove('fanta-dragging');
  for(const t of root.querySelectorAll('.is-droppable,.is-over'))t.classList.remove('is-droppable','is-over');
  drag=null;try{el.releasePointerCapture?.(pointerId);}catch{}
  suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>{suppressClick=false;},0);
  if(commit&&over&&canDrop({id,from},over.dataset.drop))onDrop({id,from},over.dataset.drop);
 }
 on(root,'pointerdown',e=>{
  if(e.button>0||e.isPrimary===false||drag||e.target.closest('[data-no-drag]'))return;
  const el=e.target.closest('[data-drag-id]');if(!el||el.disabled||!root.contains(el))return;
  clearTimeout(pending?.timer);
  const directional=el.dataset.dragAxis==='up'&&e.pointerType!=='mouse';
  const immediate=!directional&&(e.pointerType==='mouse'||e.target.closest('[data-drag-handle]')||el.dataset.dragFrom?.startsWith('slot'));
  pending={el,x:e.clientX,y:e.clientY,immediate,directional,pointerId:e.pointerId};
  if(!immediate&&!directional)pending.timer=setTimeout(()=>{if(pending)start(pending);},HOLD_MS);
 });
 on(window,'pointermove',e=>{
  if(drag){if(e.pointerId!==drag.pointerId)return;e.preventDefault();move(e.clientX,e.clientY);return;}
  if(!pending||e.pointerId!==pending.pointerId)return;
  const dx=e.clientX-pending.x,dy=e.clientY-pending.y;
  if(Math.hypot(dx,dy)<=MOVE_PX)return;
  if(pending.directional){
   if(dy<-MOVE_PX&&Math.abs(dy)>Math.abs(dx)*1.2){e.preventDefault();start(pending,e.clientX,e.clientY);}
   else if(Math.abs(dx)>MOVE_PX||dy>MOVE_PX){clearTimeout(pending.timer);pending=null;}
  }else if(pending.immediate){e.preventDefault();start(pending,e.clientX,e.clientY);}
  else{clearTimeout(pending.timer);pending=null;}
 },{passive:false});
 on(window,'pointerup',e=>{if(e.pointerId===(drag||pending)?.pointerId)end(true);});
 on(window,'pointercancel',e=>{if(e.pointerId===(drag||pending)?.pointerId)end(false);});
 on(window,'keydown',e=>{if(e.key==='Escape')end(false);});
 signal?.addEventListener('abort',()=>{end(false);clearTimeout(clickTimer);},{once:true});
 on(root,'touchmove',e=>{if(drag)e.preventDefault();},{passive:false});
 on(root,'contextmenu',e=>{if(drag||pending)e.preventDefault();});
 on(root,'dragstart',e=>{if(e.target.closest('[data-drag-id]'))e.preventDefault();});
 on(root,'click',e=>{if(suppressClick){e.stopPropagation();e.preventDefault();}},true);
}
