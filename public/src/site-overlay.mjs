export function bindSheetDismiss(dialog,close){
 let touch=null,pressed=false;
 function clearTouch(){
  touch=null;
  dialog.classList.remove('is-sheet-dragging');
  dialog.style.removeProperty('--sheet-drag');
 }
 dialog.addEventListener('pointerdown',event=>{
  const bounds=dialog.getBoundingClientRect();
  pressed=event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom);
 });
 dialog.addEventListener('click',event=>{if(pressed&&event.target===dialog)close();});
 dialog.addEventListener('touchstart',event=>{
  const point=event.touches[0];
  const scroll=event.target.closest('[data-overlay-scroll]');
  touch=event.touches.length===1&&!(scroll?.scrollTop>0)?{
   x:point.clientX,y:point.clientY,grip:!!event.target.closest('[data-sheet-grip]')
  }:null;
 },{passive:true});
 dialog.addEventListener('touchmove',event=>{
  if(!touch?.grip||event.touches.length!==1)return;
  const point=event.touches[0],dy=point.clientY-touch.y;
  if(dy<0||dy<Math.abs(point.clientX-touch.x)*1.4)return;
  dialog.classList.add('is-sheet-dragging');
  dialog.style.setProperty('--sheet-drag',dy+'px');
 },{passive:true});
 dialog.addEventListener('touchend',event=>{
  const point=event.changedTouches[0];
  const start=touch;clearTouch();
  if(!start||!point)return;
  const dy=point.clientY-start.y;
  if(dy>65&&dy>Math.abs(point.clientX-start.x)*1.4)close();
 },{passive:true});
 dialog.addEventListener('touchcancel',clearTouch,{passive:true});
}

export function openSiteOverlay(dialog,trigger){
 const document=trigger.ownerDocument;
 const close=()=>{if(dialog.open)dialog.close();};
 dialog.addEventListener('close',()=>{
  dialog.remove();
  const button=trigger.isConnected?trigger:trigger.id?document.getElementById(trigger.id):null;
  button?.focus({preventScroll:true});
 },{once:true});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const actions=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length);
  const first=actions[0],last=actions.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 bindSheetDismiss(dialog,close);
 document.body.append(dialog);
 dialog.showModal();
 return close;
}
