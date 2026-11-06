export function mountPwaInstall({window:win=window,document:doc=document,navigator:nav=navigator,storage=localStorage}={}){
 const installed=()=>win.matchMedia?.('(display-mode: standalone)')?.matches||nav.standalone===true;
 if(installed())return {destroy(){}};
 let prompt=null,busy=false;const controller=new AbortController(),options={signal:controller.signal};
 const card=doc.createElement('aside');card.id='pwa-install-card';card.setAttribute('aria-label','Installa Quelli del Quasi');
 card.innerHTML='<div><strong>Il bar, nella tua Home.</strong><button type="button" data-install-dismiss aria-label="Non ora">×</button></div><p>Un’icona, tutte le tue leghe.</p><button type="button" data-install-app>Installa l’app</button><div data-install-help hidden></div>';
 const help=card.querySelector('[data-install-help]'),button=card.querySelector('[data-install-app]');
 const eligible=()=>!installed()&&!/^#(?:accedi|accesso|registrati|social|recupera|conferma|reinvia)/.test(win.location.hash);
 const visible=()=>{let dismissed=false;try{dismissed=Date.now()-Number(storage.getItem('qdq:install-dismissed')||0)<7*86400000;}catch{}card.hidden=dismissed||!eligible();};
 const dismiss=()=>{try{storage.setItem('qdq:install-dismissed',String(Date.now()));}catch{}card.hidden=true;};
 card.querySelector('[data-install-dismiss]').onclick=dismiss;
 button.onclick=async()=>{
  if(busy)return;
  if(prompt){busy=true;button.disabled=true;try{const event=prompt;prompt=null;await event.prompt();const choice=await event.userChoice;if(choice?.outcome==='accepted')dismiss();}finally{busy=false;button.disabled=false;}return;}
  const ios=/iPhone|iPad|iPod/.test(nav.userAgent||'')||nav.platform==='MacIntel'&&nav.maxTouchPoints>1;
  help.hidden=false;help.textContent=ios?'Su iPhone: apri questo sito in Safari, premi Condividi e scegli “Aggiungi alla schermata Home”. Se l’hai già installata, aprila dalla sua icona: la lega è nel tuo account.':'Nel menu del browser scegli “Installa Quelli del Quasi” o “Aggiungi alla schermata Home”. Se l’app è già installata, aprila dalla sua icona.';
  button.textContent='Come installarla';
 };
 win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;button.textContent='Installa l’app';visible();},options);
 win.addEventListener('appinstalled',()=>{card.hidden=true;prompt=null;},options);
 win.addEventListener('hashchange',visible,options);win.addEventListener('quasi:navigation',visible,options);
 doc.body.append(card);visible();return {destroy(){controller.abort();card.remove();}};
}
if(typeof window!=='undefined'&&document.body)mountPwaInstall();
