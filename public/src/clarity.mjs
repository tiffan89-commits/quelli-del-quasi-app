// Optional behavior analytics. Never create the vendor queue or load its tag before explicit consent.
const forbiddenPages=/^\/(?:admin|account|reminder-off|privacy)(?:\.html)?\/?$/;
export function clarityLocationAllowed(location={}){
 if(/^#social(?:$|[-=&])/.test(location.hash||''))return false;
 const path=String(location.pathname||'/'),hash=String(location.hash||'');
 if(forbiddenPages.test(path)||path.startsWith('/invito/'))return false;
 if(/(?:^#|[?&#/])(?:action|token|code|invito|invite|email|password|verify|reset)(?:[=/]|$)/i.test(hash))return false;
 if(/^#\/(?:bar|fanta)\/(?:admin|profilo|io)(?:[/?]|$)/.test(hash))return false;
 // Clarity reads the browser URL itself: do not enable it on private query strings.
 for(const [key,value] of new URLSearchParams(location.search||''))if(!/^utm_(?:source|medium|campaign|content|term)$/.test(key)||!/^[a-zA-Z0-9_-]{1,80}$/.test(value))return false;
 return !hash.includes('?')&&!/[&=]/.test(hash);
}
export function createClarity({win,doc,config,screen=()=>'/inizio'}={}){
 const project=config?.clarityProjectId;
 const enabled=config?.enabled===true&&/^[a-zA-Z0-9]{5,24}$/.test(project||'')&&win.location.protocol==='https:'&&(config.hostnames||[]).includes(win.location.hostname)&&!win.navigator?.globalPrivacyControl;
 let granted=false,script=null,stub=null,startConfig=null,running=false,paused=false,lastScreen=null,disposed=false;
 const allowed=()=>enabled&&!disposed&&clarityLocationAllowed(win.location);
 const invoke=(...args)=>{try{if(typeof win.clarity==='function')win.clarity(...args);}catch{/* Diagnostics cannot interrupt the app. */}};
 function clearCookies(){for(const cookie of ['_clck','_clsk'])for(const domain of ['',win.location.hostname,'.'+win.location.hostname,'.quellidelquasi.com'])doc.cookie=cookie+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}
 function halt(revoke=false){
  if(!enabled)return;
  if(revoke)clearCookies();
  if(!script&&!stub)return;
  if(win.clarity===stub)stub.q.length=0;
  if(revoke)invoke('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});
  if(running||revoke)invoke('stop');
  script?.setAttribute('data-qdq-clarity-status',revoke?'disabled':'paused');
  running=false;paused=true;lastScreen=null;
 }
 function load(){
  if(!granted||!allowed())return;
  // Inherited by newly rendered SPA views too: all text and images remain masked.
  doc.documentElement?.setAttribute('data-clarity-mask','true');
  if(typeof win.clarity!=='function'){
   stub=function(){if(arguments[0]==='start'){startConfig=arguments[1];if(!granted||!allowed())return;}stub.q.push(arguments);};
   stub.q=[];win.clarity=stub;
  }
  if(paused&&startConfig)invoke('start',startConfig);
  invoke('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});
  if(!script){script=doc.createElement('script');script.async=true;script.src='https://www.clarity.ms/tag/'+project;script.referrerPolicy='no-referrer';script.setAttribute?.('data-qdq-clarity','true');script.onload=()=>script.setAttribute('data-qdq-clarity-status',granted&&allowed()?'loaded':'disabled');script.onerror=()=>script.setAttribute('data-qdq-clarity-status','unavailable');doc.head.append(script);}
  invoke('metadata',()=>{if(granted&&allowed())script.setAttribute('data-qdq-clarity-status','ready');},false);
  running=true;paused=false;
 }
 function page(){
  if(!granted||!allowed()){if(running)halt();return;}
  if(!running)load();
  const value=screen();if(lastScreen===value)return;lastScreen=value;
  invoke('set','app_section',value);invoke('set','app_surface',win.matchMedia?.('(display-mode: standalone)')?.matches?'pwa':'web');
 }
 function consent(value){granted=enabled&&value===true;if(granted)page();else halt(true);}
 function event(name){if(granted&&running&&allowed()&&/^[a-z_]{1,60}$/.test(name))invoke('event',name);}
 function stop(){granted=false;halt(true);disposed=true;}
 return {enabled,consent,page,event,stop,get running(){return running;}};
}
