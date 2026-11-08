// Visible media has a small queue; hidden accordions never start downloads.
const pending=new Set(),near=new WeakSet(),seenPublicMedia=new Set();let active=0,lastInput=Date.now(),timer;
const interacting=()=>{lastInput=Date.now();};
for(const name of ['pointerdown','keydown','touchstart','wheel'])document.addEventListener(name,interacting,{passive:true,capture:true});
const visible=img=>img.isConnected&&![...ancestors(img)].some(e=>e.tagName==='DETAILS'&&!e.open)&&img.getClientRects().length>0;
function* ancestors(e){for(let p=e.parentElement;p;p=p.parentElement)yield p;}
const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)near.add(e.target);else near.delete(e.target);}schedule();},{rootMargin:'160px 0px'});
function scan(root){if(root.nodeType!==1&&root!==document)return;const images=[...(root.matches?.('img[data-deferred-src]')?[root]:[]),...(root.querySelectorAll?.('img[data-deferred-src]')||[])];for(const img of images){if(pending.has(img))continue;pending.add(img);observer?.observe(img);}schedule();}
function schedule(){if(timer||!pending.size)return;timer=setTimeout(pump,80);}
function pump(){timer=null;if(document.hidden)return;let waitingForIdle=false;for(const img of pending){if(!img.isConnected||!img.dataset.deferredSrc){pending.delete(img);observer?.unobserve(img);continue;}const urgent=!!img.closest('dialog[open]');if(active>=(urgent?6:2))continue;if(observer&&!near.has(img)||!visible(img))continue;if(!urgent&&!seenPublicMedia.has(img.dataset.deferredSrc)&&Date.now()-lastInput<650){waitingForIdle=true;continue;}
  pending.delete(img);observer?.unobserve(img);active++;const url=img.dataset.deferredSrc;delete img.dataset.deferredSrc;img.decoding='async';img.fetchPriority=urgent?'high':'low';let ended=false;const done=()=>{if(ended)return;ended=true;if(img.naturalWidth&&/^\/assets\/(?:rooms-v2|optimized|icons|teams)\//.test(url))seenPublicMedia.add(url);active--;img.removeEventListener('load',done);img.removeEventListener('error',done);schedule();};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});if(img.dataset.deferredSrcset){img.srcset=img.dataset.deferredSrcset;delete img.dataset.deferredSrcset;}img.src=url;if(img.complete)done();
 }if(waitingForIdle)schedule();}
new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')scan(r.target);else for(const n of r.addedNodes)scan(n);}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-deferred-src']});
document.addEventListener('toggle',schedule,true);document.addEventListener('visibilitychange',schedule);scan(document);
setInterval(()=>{if(!document.hidden&&Date.now()-lastInput>1800)window.dispatchEvent(new CustomEvent('quasi:idle'));},1000);
