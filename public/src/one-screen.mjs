import {bindSwipeBack} from './match-page.mjs';
import {backButton} from './back-navigation.mjs';

// Una sezione = una schermata.
// Il contenuto di `#app > main` scorre in colonne CSS alte quanto lo spazio
// libero tra intestazione e barra in basso: quello che non ci sta passa alla
// pagina successiva, che si raggiunge scorrendo di lato. Non si spostano né si
// clonano nodi: id, gestori, patch live e scrollIntoView restano quelli di
// prima. La sala d'asta, la pagina partita e la landing pubblica sono escluse.
const EXCLUDED = [
 '.auction-room', '.fanta-asta', '.auction-lobby', '.auction-wizard-fields', '.auction-page-head',
 '[data-bid-form]', '.auction-countdown-overlay', '.pb-landing', '.bar-ticket'
].join(',');
const FIXED_BOTTOM = '.v2-tabbar,.v2-slipbar,#pwa-install-card';
const DOTS_SPACE = 10; // riga dei puntini: il minimo indispensabile (18 px su desktop, con le frecce)
// Sottosezioni di una schermata lunga: ogni voce apre la pagina in cui inizia
// il suo blocco. `when` riconosce la sezione dal contenuto già disegnato.
// Riga da tenere sempre a vista (la tua posizione) quando sta in un'altra pagina.
export const PINS = ['.rankrow.is-me'];
export const SEGMENTS = [
 { when: main => !!main.querySelector('#league-dashboard'), label: 'Oggi', items: [['Home', null], ['Obiettivi', '#league-objectives']] },
 { when: main => !!main.querySelector('.fanta-home'), label: 'Oggi', items: [['Home', null], ['Classifica', '.fanta-home section.fanta-block:has(.fanta-table)']] }
];
let started = false;

export function oneScreenExcluded(main, doc = main?.ownerDocument) {
 if (!main || !doc) return true;
 if (!doc.querySelector('#app > .v2-tabbar')) return true;
 if (doc.body?.classList.contains('match-page-active') || doc.body?.classList.contains('v2-landing-on')) return true;
 if (main.querySelector('.fanta-live-studio')) return true;
 if (/^#\/fanta\/asta\b/.test(doc.defaultView?.location?.hash || '')) return true;
 return main.matches(EXCLUDED) || !!main.querySelector(EXCLUDED);
}

// Numero di pagine e pagina corrente a partire dalle misure del contenitore.
export function pageMetrics(scrollWidth, clientWidth, scrollLeft) {
 if (!(clientWidth > 0)) return { pages: 1, page: 0 };
 const pages = Math.max(1, Math.ceil(scrollWidth / clientWidth - 0.02));
 return { pages, page: Math.min(pages - 1, Math.max(0, Math.round(scrollLeft / clientWidth))) };
}

export function startOneScreen(doc = globalThis.document) {
 const win = doc?.defaultView;
 if (started || !win || typeof win.MutationObserver !== 'function') return;
 // Senza colonne CSS (browser molto vecchi) resta lo scorrimento verticale, ma dentro la pagina e sopra la barra in basso.
 const columns = !!win.CSS?.supports?.('column-fill', 'auto');
 started = true;
 if (!columns) doc.documentElement.classList.add('os-nocols');
 const root = doc.documentElement;
 const saved = new Map();
 const bound = new WeakSet();
 let host = null, main = null, key = '', raf = 0, snapTimer = 0, dragging = null, wheelLock = 0, height = 0;
 let segs = null, segAnchors = [], pin = null, pinned = null;
 let drill = [], drillNav = null, drillGesture = null;
 let dots = null, metrics = { pages: 1, page: 0 }, restore = false, toTop = false, pausedForMatch = false;
 let slipAnchor = null;
 // L'app torna "in cima" con window.scrollTo(0, 0) dopo ogni cambio di sezione:
 // con le pagine laterali "in cima" vuol dire la prima pagina. I ridisegni
 // (aggiornamenti live, salvataggi) non lo chiamano e restano sulla pagina.
 // Alla chiusura della pagina partita si torna dove si era.
 const nativeScrollTo = win.scrollTo;
 if (typeof nativeScrollTo === 'function') win.scrollTo = function (...args) {
  const a = args[0], top = typeof a === 'object' && a ? (a.top ?? 0) : (args[1] ?? 0), left = typeof a === 'object' && a ? (a.left ?? 0) : (a ?? 0);
  if ((root.classList.contains('os-on') || main) && !pausedForMatch && !doc.body?.classList.contains('match-page-active') && top === 0 && left === 0) { toTop = true; schedule(); }
  return nativeScrollTo.apply(win, args);
 };
 const reduced = () => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const typing = () => {
  const el = doc.activeElement;
  return !!el && main?.contains(el) && (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName) || (el.tagName === 'INPUT' && !/^(button|submit|checkbox|radio|range|reset)$/i.test(el.type)));
 };
 const observer = new win.MutationObserver(() => schedule());
 const watch = () => observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden', 'aria-selected'] });
 const quiet = fn => { observer.disconnect(); try { fn(); } finally { observer.takeRecords(); watch(); } };
 function schedule() { if (!raf) raf = win.requestAnimationFrame(() => { raf = 0; update(); }); }

 function signature(el) {
  const picked = [...el.querySelectorAll('[data-os-header] [aria-selected="true"],[data-os-header] [aria-pressed="true"],.ranking-metric [aria-pressed="true"]')]
   .map(x => (x.dataset.legaSub || x.dataset.tab || x.dataset.page || x.textContent || '').trim().slice(0, 24));
  const round=el.querySelector('#round-switch,[data-fanta-slip-round]')?.value||'';
  return (win.location?.hash || '') + '|' + picked.join('|')+'|'+round;
 }
 const flow=()=>!drill.length&&main?.hasAttribute('data-os-flow');
 const detailTitle = summary => (summary?.querySelector('b,strong')||summary)?.textContent?.trim()||'Dettaglio';
 function clearDrillView(removeNav=true){
  if(removeNav)drillNav?.remove();
  main?.classList.remove('os-drill','os-drill-parent');
  for(const el of main?.querySelectorAll('.os-drill-parent,.os-drill-path,.os-drill-target')||[])el.classList.remove('os-drill-parent','os-drill-path','os-drill-target');
 }
 function paintDrill(){
  clearDrillView(false);
  const detail=drill.at(-1)?.el;
  if(!detail)return;
  main.classList.add('os-drill');
  detail.classList.add('os-drill-target');
  for(let el=detail;el&&el!==main;el=el.parentElement){
   el.classList.add('os-drill-path');
   el.parentElement.classList.add('os-drill-parent');
  }
  if(!drillNav){
   drillNav=doc.createElement('div');drillNav.className='os-drill-nav';
   drillNav.innerHTML=backButton('','Torna alla schermata precedente');
   const back=drillNav.firstElementChild;
   back.addEventListener('click',backDetail);
   drillNav.append(doc.createElement('strong'));
   bindSwipeBack(drillNav,backDetail,'both');
  }
  drillNav.lastElementChild.textContent=drill.at(-1).title;
  drillNav.style.width=Math.max(0,main.clientWidth-28)+'px';
  if(drillNav.nextElementSibling!==main)main.before(drillNav);
 }
 function openDetail(detail){
  if(drill.some(entry=>entry.el===detail))return;
  if(!drill.length)saved.set(key,metrics.page);
  const summary=detail.querySelector(':scope>summary');
  drill.push({el:detail,index:[...main.querySelectorAll('details')].indexOf(detail),title:detailTitle(summary),scroll:main.scrollTop});
  const hash=win.location.hash;
  if(win.history&&hash)win.history.pushState({...win.history.state,qdqDrill:drill.length,qdqDrillHash:hash},'',win.location.href);
  detail.open=true;
  update();
  main.scrollLeft=0;
  main.scrollTop=0;
  if(!reduced())detail.animate?.([{opacity:.65,transform:'translateX(20px)'},{opacity:1,transform:'none'}],{duration:160});
  drillNav?.firstElementChild.focus({preventScroll:true});
 }
 function backDetail(){
  if(win.history?.state?.qdqDrill===drill.length&&win.history.state.qdqDrillHash===win.location.hash){win.history.back();return;}
  closeDetail();
 }
 function closeDetail(){
  const entry=drill.pop();
  if(!entry)return;
  entry.el.open=false;
  restore=!drill.length;
  update();
  main.scrollTop=entry.scroll;
  entry.el.querySelector(':scope>summary')?.focus({preventScroll:true});
 }
 function teardown() {
  if (!root.classList.contains('os-on') && !main) return;
  quiet(() => { segs?.remove(); pin?.remove(); doc.querySelectorAll('.os-seg-start').forEach(el => el.classList.remove('os-seg-start')); });
  segAnchors = [];
  if (main&&!drill.length) saved.set(key, metrics.page);
  if (doc.body?.classList.contains('match-page-active')) pausedForMatch = true;
  quiet(() => {
   clearDrillView();drill=[];drillGesture=null;
   root.classList.remove('os-on'); root.style.removeProperty('--os-h'); root.style.removeProperty('--os-dots-bottom');
   doc.querySelectorAll('main.os-root').forEach(el => el.classList.remove('os-root','os-split'));
   doc.querySelectorAll('.os-track').forEach(el => el.classList.remove('os-track'));
   doc.querySelectorAll('.os-tall,.os-break,.os-unclip').forEach(el => el.classList.remove('os-tall', 'os-break', 'os-unclip'));
   if (dots) dots.hidden = true;
  });
  host = main = null;
 }
 function bottomInset() {
  let inset = 0;
  for (const el of doc.querySelectorAll(FIXED_BOTTOM)) {
   if (el.hidden) continue;
   const cs = win.getComputedStyle(el), r = el.getBoundingClientRect();
   if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || r.height === 0) continue;
   if (r.top < win.innerHeight / 2) continue; // barra in alto (desktop): non toglie spazio sotto
   inset = Math.max(inset, win.innerHeight - r.top);
  }
  return inset;
 }
 function update() {
  const next = doc.querySelector('#app > main');
  if (!next || oneScreenExcluded(next, doc)) { teardown(); return; }
  const track = next.querySelector('[data-os-content]') || next;
  const nextKey=signature(next);
  const newTrack=track!==main;
  pausedForMatch = false;
  if (newTrack||nextKey!==key) {
   dragging=null;
   slipAnchor=null;
   if (main&&!drill.length)saved.set(key,metrics.page);
   clearDrillView();
   if(nextKey!==key){for(const entry of drill)entry.el.open=false;drill=[];}
   host=next;main=track;key=nextKey;restore=true;
   if(drill.length){
    const all=[...main.querySelectorAll('details')];
    drill=drill.map(entry=>{
     const el=all[entry.index];
     return el&&detailTitle(el.querySelector(':scope>summary'))===entry.title?{...entry,el}:null;
    }).filter(Boolean);
    for(const entry of drill)entry.el.open=true;
   }else if(newTrack){
    const el=main.querySelector('[data-president-section][open]');
    if(el)drill=[{el,index:[...main.querySelectorAll('details')].indexOf(el),title:detailTitle(el.querySelector(':scope>summary')),scroll:0}];
   }
  }
  if(drill.some(entry=>!entry.el.open||!main.contains(entry.el))){
   drill=drill.slice(0,drill.findIndex(entry=>!entry.el.open||!main.contains(entry.el)));restore=!drill.length;
  }
  if (toTop) { toTop = false; saved.delete(key); restore = true; }
  if (dragging?.active && !restore) return;
  quiet(() => {
   if (!root.classList.contains('os-on')) { root.classList.add('os-on'); nativeScrollTo?.call(win, 0, 0); }
   host.classList.add('os-root');
   host.classList.toggle('os-split', main !== host);
   main.classList.add('os-track');
   bind(main);
   paintSegments();
   if(drill.length){segs?.remove();paintDrill();}
   else clearDrillView();
   if (!typing() || !height) {
    const inset = bottomInset();
    const top = main.getBoundingClientRect().top;
    const space = main.matches('.fanta-team-formation,.fanta-calendar-scroll') ? 0 : win.innerWidth >= 760 ? 18 : DOTS_SPACE;
    const footer = host !== main ? [...host.querySelectorAll(':scope>#live-channel-status,[data-os-footer]')].reduce((sum,el)=>{
     if(!shown(el))return sum;
     const style=win.getComputedStyle(el);
     return sum+el.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);
    },0) : 0;
    root.style.setProperty('--os-dots-h', space + 'px');
    pinned = segAnchors.length||drill.length ? null : PINS.map(sel => main.querySelector(sel)).find(Boolean) || null;
    height = Math.max(80, Math.floor(win.innerHeight - Math.max(0, top) - inset - space - footer - (pinned ? 48 : 0)));
    root.style.setProperty('--os-h', height + 'px');
    root.style.setProperty('--os-dots-bottom', Math.round(inset) + 'px');
   }
   if (!columns || flow()) { refresh(false); return; }
   if (win.getComputedStyle(main).columnFill !== 'auto') { win.setTimeout(schedule, 200); return; } // foglio non ancora caricato
   if(!main.matches('[data-os-strip],[data-os-slip]')){
    markTall();
    markBreaks();
   }
   if (restore) { restore = false; main.scrollLeft = (drill.length ? metrics.page : saved.get(key) || 0) * main.clientWidth; }
   if (slipAnchor) {
    const row = slipAnchor;
    slipAnchor = null;
    if (main.contains(row)) main.scrollLeft = pageOf(row) * main.clientWidth;
   }
   refresh(false);
  });
 }
 // Un blocco che non si può spezzare (scorrimento interno, immagine, ecc.)
 // e che da solo supera l'altezza della pagina scorre al suo interno.
 function markTall() {
  const kept = new Map();
  for (const el of main.querySelectorAll('.os-tall')) { kept.set(el, el.scrollTop); el.classList.remove('os-tall'); }
  for (const el of main.querySelectorAll('.os-unclip')) el.classList.remove('os-unclip');
  const walker = doc.createTreeWalker(main, 1);
  for (let el = walker.nextNode(); el; ) {
   if (!shown(el)) { el = skip(walker); continue; }
   const h = el.getBoundingClientRect().height;
   if (h > height + 2) {
    const leaf = clips(el) || /^(IMG|SVG|svg|CANVAS|VIDEO|IFRAME|TEXTAREA|SELECT)$/.test(el.tagName) || ![...el.children].some(c => c.getBoundingClientRect().height > height + 2);
    if (!leaf) { el = walker.nextNode(); continue; }
    // Contenitore a scorrimento orizzontale che in realtà ci sta in larghezza: lo si lascia spezzare.
    if (clips(el) && el.scrollWidth <= el.clientWidth + 1 && el.tagName !== 'TEXTAREA') el.classList.add('os-unclip');
    else { el.classList.add('os-tall'); if (kept.get(el)) el.scrollTop = kept.get(el); }
    el = skip(walker); continue;
   }
   el = walker.nextNode();
  }
 }
 // Un blocco indivisibile che parte a metà pagina e non ci sta (riga flex,
 // carosello orizzontale, grafico) va a capo nella pagina successiva.
 function markBreaks() {
  for (const el of main.querySelectorAll('.os-break')) el.classList.remove('os-break');
  const bottom = main.getBoundingClientRect().bottom;
  for (let pass = 0; pass < 8; pass++) {
   const found = new Set();
   for (const el of main.querySelectorAll('*')) {
    if (el.closest('.os-tall') || !shown(el)) continue;
    if (el.classList.contains('os-unclip')) continue;
    const r = el.getBoundingClientRect();
    if (!r.height || r.bottom <= bottom + 2 || r.height > height) continue;
    let target = el, clipped = false;
    for (let up = el.parentElement; up && up !== main; up = up.parentElement) {
     const ur = up.getBoundingClientRect();
     if (ur.bottom <= bottom + 2 && clips(up)) { clipped = true; break; }
     if (ur.bottom > bottom + 2 && ur.height <= height) { target = up; continue; }
     const d = win.getComputedStyle(up).display;
     if (/flex|grid|table/.test(d) && up.getBoundingClientRect().height <= height) target = up;
     break;
    }
    if (clipped || win.getComputedStyle(target).position === 'fixed') continue;
    found.add(target);
   }
   const fresh = [...found].filter(el => !el.classList.contains('os-break') && ![...found].some(o => o !== el && o.contains(el)));
   if (!fresh.length) break;
   fresh.slice(0, 1).forEach(el => el.classList.add('os-break'));
  }
 }
 function shown(el) { return typeof el.checkVisibility === 'function' ? el.checkVisibility() : !!el.getClientRects().length; }
 function clips(el) { const cs = win.getComputedStyle(el); return cs.overflowX !== 'visible' || cs.overflowY !== 'visible'; }
 function skip(walker) { let n = walker.currentNode; while (n && n !== main) { const s = n.nextElementSibling; if (s) { walker.currentNode = s; return s; } n = n.parentElement; } return null; }

 function refresh(store = true) {
  if (!main) return;
  metrics = flow() ? {pages:1,page:0} : pageMetrics(main.scrollWidth, main.clientWidth, main.scrollLeft);
  if (store&&!drill.length) saved.set(key, metrics.page);
  paintDots();
  markSegment();
  paintPin();
 }
 function paintPin() {
  const el = pinned?.isConnected && main?.contains(pinned) ? pinned : null;
  const show = !!el && metrics.pages > 1 && pageOf(el) !== metrics.page;
  if (!pin && !el) return;
  if (!pin) {
   pin = doc.createElement('button'); pin.type = 'button'; pin.className = 'os-pin';
   pin.addEventListener('click', () => { if (pinned) go(pageOf(pinned)); });
  }
  quiet(() => {
   if (!el) { pin.remove(); return; }
   const src = el.querySelector('summary') || el;
   const html = src.innerHTML;
   if (pin.dataset.html !== html) { pin.innerHTML = html; pin.dataset.html = html; pin.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); }
   pin.setAttribute('aria-label', 'La tua posizione: ' + src.textContent.replace(/\s+/g, ' ').trim() + ' — vai alla pagina');
   pin.hidden = !show;
   if (!pin.isConnected) doc.body.append(pin);
  });
 }
 function paintSegments() {
  const conf = SEGMENTS.find(c => { try { return c.when(host); } catch { return false; } });
  const items = conf ? conf.items.map(([label, sel]) => [label, sel ? main.querySelector(sel) : null]).filter(([, el], i) => i === 0 || el) : [];
  for (const el of main.querySelectorAll('.os-seg-start')) if (!items.some(([, a]) => a === el)) el.classList.remove('os-seg-start');
  if (items.length < 2) { segs?.remove(); segAnchors = []; return; }
  items.forEach(([, el]) => el?.classList.add('os-seg-start'));
  segAnchors = items.map(([, el]) => el);
  if (!segs) {
   segs = doc.createElement('nav'); segs.className = 'os-segs';
   segs.addEventListener('click', e => { const b = e.target.closest('[data-os-seg]'); if (b) go(pageOf(segAnchors[Number(b.dataset.osSeg)])); });
  }
  segs.setAttribute('aria-label', conf.label);
  const html = items.map(([label], i) => '<button type="button" data-os-seg="' + i + '">' + label + '</button>').join('');
  if (segs.dataset.html !== html) { segs.innerHTML = html; segs.dataset.html = html; }
  if (segs.nextElementSibling !== host) host.before(segs);
  const r = main.getBoundingClientRect(), w = Math.round(r.width - 28) + 'px'; // stessa larghezza del contenuto, anche su desktop
  if (segs.style.width !== w) { segs.style.width = w; segs.style.marginLeft = 'auto'; segs.style.marginRight = 'auto'; }
 }
 function pageOf(el) {
  if (!el || !main?.clientWidth) return 0;
  return Math.max(0, Math.floor((el.getBoundingClientRect().left - main.getBoundingClientRect().left + main.scrollLeft + 2) / main.clientWidth));
 }
 function markSegment() {
  if (!segs?.isConnected || !segAnchors.length) return;
  let on = 0; segAnchors.forEach((el, i) => { if (pageOf(el) <= metrics.page) on = i; });
  quiet(() => segs.querySelectorAll('[data-os-seg]').forEach((b, i) => { const sel = i === on; if (b.classList.contains('is-on') !== sel) { b.classList.toggle('is-on', sel); b.setAttribute('aria-current', sel ? 'true' : 'false'); } }));
 }
 function paintDots() {
  if (!dots) {
   dots = doc.createElement('nav'); dots.className = 'os-dots'; dots.setAttribute('aria-label', 'Pagine della sezione');
   dots.addEventListener('click', e => { const b = e.target.closest('[data-os-page]'); if (b) go(Number(b.dataset.osPage)); });
   doc.body.append(dots);
  }
  const { pages, page } = metrics;
  if (dots.hidden !== (pages < 2)) quiet(() => { dots.hidden = pages < 2; });
  const html = pages < 2 ? '' : '<button type="button" class="os-arrow" data-os-page="' + Math.max(0, page - 1) + '" aria-label="Pagina precedente"' + (page === 0 ? ' disabled' : '') + '>‹</button>' +
   Array.from({ length: pages }, (_, i) => '<button type="button" class="os-dot' + (i === page ? ' is-on' : '') + '" data-os-page="' + i + '" aria-label="Pagina ' + (i + 1) + ' di ' + pages + '"' + (i === page ? ' aria-current="true"' : '') + '></button>').join('') +
   '<button type="button" class="os-arrow" data-os-page="' + Math.min(pages - 1, page + 1) + '" aria-label="Pagina successiva"' + (page === pages - 1 ? ' disabled' : '') + '>›</button>';
  if (dots.dataset.html !== html) quiet(() => { dots.innerHTML = html; dots.dataset.html = html; });
 }
 function go(page, smooth = true) {
  if (!main) return;
  const { pages } = pageMetrics(main.scrollWidth, main.clientWidth, main.scrollLeft);
  const target = Math.min(pages - 1, Math.max(0, page));
  main.scrollTo({ left: target * main.clientWidth, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  metrics = { pages, page: target }; if(!drill.length)saved.set(key, target); paintDots();
 }
 function scroller(el, axis) {
  for (let n = el; n && n !== main; n = n.parentElement) {
   const cs = win.getComputedStyle(n), o = axis === 'x' ? cs.overflowX : cs.overflowY;
   if (/(auto|scroll)/.test(o) && (axis === 'x' ? n.scrollWidth > n.clientWidth + 2 : n.scrollHeight > n.clientHeight + 2)) return n;
   if (axis === 'x' && n.type === 'range') return n;
  }
  return null;
 }
 function bind(el) {
  if (bound.has(el)) return; bound.add(el);
  if (el.hasAttribute('data-os-slip')) el.addEventListener('click', e => {
   const toggle = e.target.closest('[data-v2-more]');
   if (el !== main || !toggle) return;
   slipAnchor = toggle.closest('.v2-match-row');
   schedule();
  }, {capture:true});
  el.addEventListener('click',e=>{
   if(el!==main||!root.classList.contains('os-on'))return;
   const summary=e.target.closest('summary'),detail=summary?.parentElement;
   if(!detail?.matches('details')||detail.matches('.v2-stake-picker,.member-menu')||e.target.closest('button,a,input,select,label'))return;
   e.preventDefault();
   if(drill.at(-1)?.el===detail)backDetail();else openDetail(detail);
  });
  el.addEventListener('scroll', () => {
   if (el !== main) return;
   if (dragging?.active) return;
   if(flow()){refresh(false);return;}
   refresh();
   if (dragging) return;
   win.clearTimeout(snapTimer);
   snapTimer = win.setTimeout(() => { const w = el.clientWidth; if (w && Math.abs(el.scrollLeft - Math.round(el.scrollLeft / w) * w) > 1) go(Math.round(el.scrollLeft / w)); if (win.scrollY) nativeScrollTo.call(win, 0, 0); }, 140);
  }, { passive: true });
  el.addEventListener('touchstart', e => {
   if(el===main&&drill.length&&metrics.page===0&&e.touches.length===1&&!scroller(e.target,'x')&&!e.target.closest('input,select,textarea,button,a')){
    const t=e.touches[0];drillGesture={x:t.clientX,y:t.clientY};
   }else drillGesture=null;
   if (el !== main || flow() || !el.clientWidth || e.touches.length !== 1 || scroller(e.target, 'x') || e.target.closest('input,select,textarea,[contenteditable]')) { dragging = null; return; }
   const t = e.touches[0];
   const {page,pages}=pageMetrics(el.scrollWidth,el.clientWidth,el.scrollLeft);
   win.clearTimeout(snapTimer);
   dragging = { x: t.clientX, y: t.clientY, left: el.scrollLeft, page, pages, at: Date.now(), active: false };
  }, { passive: true });
  el.addEventListener('touchmove', e => {
   if (!dragging || el !== main) return;
   const t = e.touches[0], dx = t.clientX - dragging.x, dy = t.clientY - dragging.y;
   if (!dragging.active) {
    if (Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.4) {if(Math.abs(dy)>12)dragging=null;return;}
    const next=dragging.page+(dx<0?1:-1);
    if(next<0||next>=dragging.pages)return;
    dragging.active=true;
   }
   el.scrollLeft = dragging.left - dx;
  }, { passive: true });
  const end = e => {
   if(drillGesture){
    const g=drillGesture,t=e.changedTouches?.[0];drillGesture=null;
    if(e.type==='touchend'&&t&&Math.abs(t.clientX-g.x)>55&&Math.abs(t.clientX-g.x)>Math.abs(t.clientY-g.y)*1.4){e.stopImmediatePropagation();dragging=null;backDetail();return;}
   }
   if (!dragging || el !== main) return;
   const d = dragging; dragging = null;
   if (!d.active) return;
   e.stopPropagation();
   const t = e.changedTouches?.[0], dx = t ? t.clientX - d.x : 0, fast = Math.abs(dx) / Math.max(1, Date.now() - d.at) > 0.35;
   const advance=e.type==='touchend'&&(Math.abs(dx)>el.clientWidth*.18||fast&&Math.abs(dx)>24);
   go(advance?d.page+(dx<0?1:-1):d.page);
   schedule();
  };
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });
  el.addEventListener('wheel', e => {
   if (el !== main || flow() || e.ctrlKey) return;
   const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
   const delta = horizontal ? e.deltaX : e.deltaY;
   if (Math.abs(delta) < 4 || scroller(e.target, horizontal ? 'x' : 'y')) return;
   e.preventDefault();
   if (Date.now() < wheelLock) return;
   wheelLock = Date.now() + 450;
   go(Math.round(el.scrollLeft / el.clientWidth) + (delta > 0 ? 1 : -1));
  }, { passive: false });
 }
 doc.addEventListener('keydown', e => {
  if(!main||!root.classList.contains('os-on')||e.altKey||e.ctrlKey||e.metaKey||typing())return;
  if(drill.length&&(e.key==='Escape'||e.key==='ArrowLeft'&&metrics.page===0)){e.preventDefault();backDetail();return;}
  if(flow())return;
  const a = doc.activeElement;
  if (a && a !== doc.body && !main.contains(a)) return;
  if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
  if (a && a.closest('[role="tablist"],[role="listbox"],[role="slider"]')) return;
  const step = { PageDown: 1, PageUp: -1, ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!step) return;
  e.preventDefault(); go(metrics.page + step);
 });
 win.addEventListener('resize', () => { height = typing() ? height : 0; schedule(); });
 win.addEventListener('orientationchange', () => { height = 0; schedule(); });
 win.addEventListener('hashchange', schedule);
 win.addEventListener('quasi:navigation', schedule);
 win.addEventListener('popstate',e=>{
  if(!drill.length||!key.startsWith(win.location.hash+'|')||doc.body.classList.contains('match-page-active'))return;
  const depth=e.state?.qdqDrill||0;
  if(depth>=drill.length)return;
  e.stopImmediatePropagation();
  while(drill.length>depth)closeDetail();
 },{capture:true});
 if (win.ResizeObserver) new win.ResizeObserver(schedule).observe(doc.body);
 watch(); schedule();
}
