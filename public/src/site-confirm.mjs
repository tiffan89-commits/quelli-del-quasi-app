export function askConfirmation({title,message,confirmLabel='Conferma',cancelLabel='Annulla',danger=false}){
 return new Promise(resolve=>{
  const previous=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='site-confirm';
  dialog.innerHTML=`<h2></h2><p></p><form method="dialog"><button class="secondary" value="cancel" autofocus></button>
   <button class="primary" value="confirm"></button></form>`;
  dialog.setAttribute('aria-label',title);
  dialog.querySelector('h2').textContent=title;
  dialog.querySelector('[value="cancel"]').textContent=cancelLabel;
  const body=dialog.querySelector('p');body.textContent=message||'';body.hidden=!message;
  const action=dialog.querySelector('[value="confirm"]');action.textContent=confirmLabel;
  if(danger)action.classList.add('site-confirm-danger');
  dialog.addEventListener('close',()=>{
   const accepted=dialog.returnValue==='confirm';
   dialog.remove();
   if(previous?.isConnected)previous.focus({preventScroll:true});
   resolve(accepted);
  },{once:true});
  let outside=false;
  dialog.addEventListener('pointerdown',e=>{outside=e.target===dialog;});
  dialog.addEventListener('click',e=>{if(outside&&e.target===dialog)dialog.close();});
  document.body.append(dialog);
  dialog.showModal();
 });
}
