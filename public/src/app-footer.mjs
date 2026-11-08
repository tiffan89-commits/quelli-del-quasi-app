const contexts=new WeakMap();
export function restoreAppFooter(doc=globalThis.document){
 const context=doc&&contexts.get(doc);context?.observer?.disconnect();
 if(context?.links){context.links.hidden=false;doc.body.append(context.links);}
 if(doc?.body)delete doc.body.dataset.gameMode;
 doc?.documentElement?.style.removeProperty('--app-bottom-space');doc?.documentElement?.style.removeProperty('--app-tabbar-height');
}
// Move the consent controls into account settings without replacing their handlers.
export function placeAppFooter(root){
 if(!root?.ownerDocument||typeof root.querySelector!=='function')return;
 const doc=root?.ownerDocument,main=root?.querySelector('main');if(!doc||!main)return;
 let context=contexts.get(doc);if(!context){context={links:doc.querySelector('.analytics-footer')};contexts.set(doc,context);}
 context.observer?.disconnect();
 main.querySelector(':scope>.footer,:scope>[data-app-footer]')?.remove();
 const nav=root.querySelector('.v2-tabbar');
 if(nav&&!nav.querySelector('[data-app-footer]')){
  const footer=doc.createElement('small');
  footer.dataset.appFooter='true';
  footer.textContent=`© ${new Date().getFullYear()} QUELLI DEL QUASI. Gioco fantasy con solo crediti virtuali`;
  nav.append(footer);
 }
 if(context.links){
  const settings=main.querySelector('[data-account-privacy]');
  context.links.hidden=!settings;
  (settings||doc.body).append(context.links);
 }
 const measure=()=>{
  const win=doc.defaultView;if(!Number.isFinite(win?.innerHeight)||!win.getComputedStyle)return;
  const nav=doc.querySelector('.v2-tabbar');doc.documentElement.style.setProperty('--app-tabbar-height',nav&&win.getComputedStyle(nav).position==='fixed'?Math.ceil(nav.getBoundingClientRect().height)+'px':'0px');
  let inset=12;
  for(const bar of doc.querySelectorAll('.v2-tabbar,.v2-slipbar'))if(win.getComputedStyle(bar).position==='fixed')inset=Math.max(inset,win.innerHeight-bar.getBoundingClientRect().top+12);
  doc.documentElement.style.setProperty('--app-bottom-space',Math.ceil(inset)+'px');
 };
 measure();const Observer=doc.defaultView?.ResizeObserver;
 if(Observer){context.observer=new Observer(measure);doc.querySelectorAll('.v2-tabbar,.v2-slipbar').forEach(el=>context.observer.observe(el));}
}
