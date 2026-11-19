const contexts=new WeakMap();
export function restoreAppFooter(doc=globalThis.document){
 const context=doc&&contexts.get(doc);context?.observer?.disconnect();
 if(context?.links){context.links.hidden=false;doc.body.append(context.links);}
 if(doc?.body)delete doc.body.dataset.gameMode;
 doc?.documentElement?.style.removeProperty('--app-bottom-space');doc?.documentElement?.style.removeProperty('--app-tabbar-height');
}

export function placeAppFooter(root){
 if(!root?.ownerDocument||typeof root.querySelector!=='function')return;
 const doc=root.ownerDocument,main=root.querySelector('main');if(!main)return;
 let context=contexts.get(doc);if(!context){context={links:doc.querySelector('.analytics-footer')};contexts.set(doc,context);}
 context.observer?.disconnect();
 main.querySelector(':scope>.footer')?.remove();
 const slot=main.querySelector('[data-settings-legal]');
 if(slot&&!slot.querySelector('[data-app-footer]')){
  const copyright=doc.createElement('p');copyright.dataset.appFooter='';
  copyright.textContent=`© ${new Date().getFullYear()} QUELLI DEL QUASI. Gioco fantasy con solo crediti virtuali`;
  slot.prepend(copyright);
 }
 if(context.links){context.links.hidden=!slot;(slot||doc.body).append(context.links);}
 const measure=()=>{
  const win=doc.defaultView;if(!Number.isFinite(win?.innerHeight)||!win.getComputedStyle)return;
  const nav=root.querySelector('.v2-tabbar');
  doc.documentElement.style.setProperty('--app-tabbar-height',nav&&win.getComputedStyle(nav).position==='fixed'?Math.ceil(nav.getBoundingClientRect().height)+'px':'0px');
  let inset=12;
  for(const bar of root.querySelectorAll('.v2-tabbar,.v2-slipbar'))if(win.getComputedStyle(bar).position==='fixed')inset=Math.max(inset,win.innerHeight-bar.getBoundingClientRect().top+12);
  doc.documentElement.style.setProperty('--app-bottom-space',Math.ceil(inset)+'px');
 };
 measure();const Observer=doc.defaultView?.ResizeObserver;
 if(Observer){context.observer=new Observer(measure);root.querySelectorAll('.v2-tabbar,.v2-slipbar').forEach(el=>context.observer.observe(el));}
}
