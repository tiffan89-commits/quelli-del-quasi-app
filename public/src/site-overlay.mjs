export function openSiteOverlay(dialog,trigger){
 const document=trigger.ownerDocument;
 let touch=null,pressed=false;
 const close=()=>{if(dialog.open)dialog.close();};
 dialog.addEventListener('close',()=>{
  dialog.remove();
  const button=trigger.isConnected?trigger:trigger.id?document.getElementById(trigger.id):null;
  button?.focus({preventScroll:true});
 },{once:true});
 dialog.addEventListener('pointerdown',event=>{
  const bounds=dialog.getBoundingClientRect();
  pressed=event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom);
 });
 dialog.addEventListener('click',event=>{if(pressed&&event.target===dialog)close();});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const actions=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length);
  const first=actions[0],last=actions.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 dialog.addEventListener('touchstart',event=>{
  const point=event.touches[0];
  const scroll=event.target.closest('[data-overlay-scroll]');
  touch=event.touches.length===1&&!(scroll?.scrollTop>0)?[point.clientX,point.clientY]:null;
 },{passive:true});
 dialog.addEventListener('touchend',event=>{
  const point=event.changedTouches[0];
  if(touch&&point.clientY-touch[1]>65&&Math.abs(point.clientX-touch[0])<55)close();
  touch=null;
 },{passive:true});
 document.body.append(dialog);
 dialog.showModal();
 return close;
}
