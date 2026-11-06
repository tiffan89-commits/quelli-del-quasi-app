const contexts=new WeakMap();
export function restoreAppFooter(doc=globalThis.document){
 const context=doc&&contexts.get(doc);context?.observer?.disconnect();
 if(context?.links)doc.body.append(context.links);
 if(doc?.body)delete doc.body.dataset.gameMode;
 doc?.documentElement?.style.removeProperty('--app-bottom-space');doc?.documentElement?.style.removeProperty('--app-tabbar-height');
}
// Move the existing controls rather than cloning them: consent handlers and
// disabled state survive navigation between Bar and Fanta.
export function placeAppFooter(root){
 if(!root?.ownerDocument||typeof root.querySelector!=='function')return;
 const doc=root?.ownerDocument,main=root?.querySelector('main');if(!doc||!main)return;
 let context=contexts.get(doc);if(!context){context={links:doc.querySelector('.analytics-footer')};contexts.set(doc,context);}
 context.observer?.disconnect();
 let footer=main.querySelector('.footer');
 if(!footer){footer=doc.createElement('footer');footer.className='footer';footer.innerHTML=`<p class="footer-line">© ${new Date().getFullYear()} QUELLI DEL QUASI. Infinite scuse.<br>Crediti virtuali · Nessun denaro reale · Niente pubblicità, per sempre.<br><a href="https://www.api-football.com/" title="Sports data by API-FOOTBALL">Powered by API-FOOTBALL</a></p>`;main.append(footer);}
 footer.dataset.appFooter='true';
 if(context.links){const control=context.links.querySelector('[data-analytics-preferences]');if(control){control.textContent='Statistiche';control.setAttribute('aria-label','Preferenze statistiche');}footer.append(context.links);}
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
