export async function withMembershipProgress(document,title,operation){
 const win=document.defaultView,history=win?.history,currentUrl=win?.location?.href,currentState=history?.state;
 const previous=document.activeElement;
 const dialog=document.createElement('dialog');
 dialog.className='site-confirm membership-progress';
 dialog.setAttribute('aria-label',title);
 dialog.setAttribute('aria-busy','true');
 dialog.innerHTML='<div role="status" tabindex="-1" autofocus><span class="membership-spinner" aria-hidden="true"></span><strong></strong></div>';
 dialog.querySelector('strong').textContent=title;
 dialog.addEventListener('cancel',event=>event.preventDefault());
 // Keep the same route beneath a separate history entry so the native back
 // gesture cannot navigate to the parent while the request is running.
 const guardedState={...currentState,qdqMembershipProgress:true};
 let finishBack=null;
 const keepRoute=event=>{
  event.stopImmediatePropagation();
  if(finishBack)finishBack();
  else history.pushState(guardedState,'',currentUrl);
 };
 if(history?.pushState&&currentUrl){
  win.addEventListener('popstate',keepRoute,{capture:true});
  history.pushState(guardedState,'',currentUrl);
 }
 document.body.append(dialog);
 try{
  if(typeof dialog.showModal==='function')dialog.showModal();
  return await operation();
 }finally{
  if(history?.state?.qdqMembershipProgress)await new Promise(resolve=>{
   const timer=setTimeout(()=>{
    history.replaceState(currentState,'',currentUrl);
    resolve();
   },250);
   finishBack=()=>{clearTimeout(timer);resolve();};
   history.back();
  });
  win?.removeEventListener('popstate',keepRoute,{capture:true});
  if(dialog.open)dialog.close();
  dialog.remove();
  const target=previous?.isConnected?previous:document.querySelector('.president-operation-body [data-screen-back]');
  target?.focus({preventScroll:true});
 }
}
