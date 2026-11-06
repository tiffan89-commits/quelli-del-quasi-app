import {createClarity} from './clarity.mjs';
// New provider, renewed consent. A previous Google-only opt-in does not authorize Microsoft.
export const CONSENT_KEY='qdq:analytics-consent:v2';
export const LEGACY_CONSENT_KEY='qdq:analytics-consent:v1';
const consentAge=180*86400000;
const screens=new Set(['oggi','lega','schedina','schedine','classifica','classifiche','squadra','giornata','giornate','io','profilo','quasi','calendario','admin']);
const publicScreens=new Set(['inizio','accedi','registrati','recupera','demo']);
export function analyticsScreen(location){
 const hash=String(location?.hash||''),match=hash.match(/^#\/(bar|fanta)\/([a-z-]+)/);
 if(match)return '/'+match[1]+'/'+(screens.has(match[2])?match[2]:'altro');
 const publicPage=hash.slice(1).split(/[?&]/)[0];
 if(publicScreens.has(publicPage))return '/'+publicPage;
 if(/(?:action|token|verify|reset)=/.test(hash))return '/account';
 const pathname=String(location?.pathname||'/');
 return /^\/(?:fantacalcio-tra-amici|asta-fantacalcio|schedine-virtuali|privacy|prendi-squadra|entra-fanta)(?:\.html)?$/.test(pathname)?pathname.replace(/\.html$/,'')+'.html':'/inizio';
}
export function analyticsCampaign(search=''){
 const result={},params=new URLSearchParams(search);
 for(const [key,target]of [['utm_source','campaign_source'],['utm_medium','campaign_medium'],['utm_campaign','campaign_name'],['utm_content','campaign_content']]){
  const value=params.get(key);if(value&&/^[a-zA-Z0-9_-]{1,80}$/.test(value))result[target]=value;
 }
 return result;
}
export function requestOperation(url,method){
 if(method!=='POST')return null;
 const path=String(url).split('?')[0];
 return ({'/api/login':'login','/api/register':'registration_requested','/api/activate':'sign_up','/api/forgot-password':'password_recovery_requested','/api/slip':'slip_saved','/fanta-api/lineup':'lineup_saved','/fanta-api/entry/claim':'team_claimed','/acquisition/start':'entry_started'})[path]||null;
}
export function readConsent(storage,now=Date.now()){
 try{const valid=(c,version)=>c?.version===version&&typeof c.granted==='boolean'&&Number.isFinite(c.at)&&c.at<=now&&now-c.at<consentAge;
 const c=JSON.parse(storage.getItem(CONSENT_KEY));if(valid(c,2))return c.granted;
 const old=JSON.parse(storage.getItem(LEGACY_CONSENT_KEY));return valid(old,1)&&old.granted===false?false:null;}catch{return null;}
}
let active;
export function recordAnalyticsRequest(url,method,success,duration,status=0){try{active?.request(url,method,success,duration,status);}catch{/* Analytics must never interfere with a save or login. */}}
export function createAnalytics({win,doc,config,now=Date.now,schedule=fn=>win.requestIdleCallback?win.requestIdleCallback(fn,{timeout:3000}):win.setTimeout(fn,1200)}={}){
 const id=config?.measurementId,enabled=/^G-[A-Z0-9]+$/.test(id||'')&&config.enabled===true&&win.location.protocol==='https:'&&(config.hostnames||[]).includes(win.location.hostname)&&!win.navigator?.globalPrivacyControl;
 let storage;try{storage=win.localStorage;}catch{}
 let granted=readConsent(storage,now())===true,loaded=false,configured=false,lastScreen=null,disposed=false;const pendingRequests=[];
 const protectedOrigin='https://quellidelquasi.com';
 const clarity=createClarity({win,doc,config,screen:()=>analyticsScreen(win.location)});
 const safeReferrer=()=>{try{return new URL(doc.referrer).origin+'/';}catch{return '';}};
 // gtag commands must retain Google's Arguments-object format, not plain arrays.
 function send(){if(!enabled||!granted||disposed)return;win.dataLayer??=[];win.dataLayer.push(arguments);}
 const context=()=>{const path=analyticsScreen(win.location);return {page_location:protectedOrigin+path,page_referrer:safeReferrer(),page_title:'Quelli del Quasi · '+path,page_path:path,app_surface:win.matchMedia?.('(display-mode: standalone)')?.matches?'pwa':'web'};};
 function page(){if(!enabled||!granted||!configured||disposed)return;clarity.page();const c=context();if(c.page_path===lastScreen)return;lastScreen=c.page_path;send('set',c);send('event','page_view',{...c,send_to:id});}
 function load(){
  if(!enabled||!granted||disposed)return;
  clarity.consent(true);
  win['ga-disable-'+id]=false;
  if(!configured){
   send('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   send('js',new Date(now()));
   send('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   send('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:180*86400,cookie_update:false,ignore_referrer:false,...context(),...analyticsCampaign(win.location.search)});
   configured=true;
  }else send('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  if(!loaded){const script=doc.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;script.referrerPolicy='no-referrer';doc.head.append(script);loaded=true;}
  page();
  for(const args of pendingRequests.splice(0))request(...args);
 }
 function clearCookies(){
  for(const part of String(doc.cookie||'').split(';')){const name=part.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))continue;
   for(const domain of ['',win.location.hostname,'.'+win.location.hostname,'.quellidelquasi.com'])doc.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');
  }
 }
 function consent(value,{persist=true}={}){
  granted=value===true;lastScreen=null;
  if(persist)try{const at=now();storage?.setItem(CONSENT_KEY,JSON.stringify({version:2,granted,at}));storage?.setItem(LEGACY_CONSENT_KEY,JSON.stringify({version:1,granted,at}));}catch{}
  if(!granted){clarity.consent(false);pendingRequests.length=0;win['ga-disable-'+id]=true;clearCookies();return;}
  schedule(load);
 }
 function request(url,method,success,duration,status){
  const operation=requestOperation(url,method);if(!operation||!enabled||!granted||disposed)return;if(!configured){if(pendingRequests.length<20)pendingRequests.push([String(url).split('?')[0],method,success,duration,status]);return;}
  const data={operation,outcome:success?'success':'failure',duration_ms:Math.max(0,Math.min(120000,Math.round(Number(duration)||0))),status_group:status>=400?Math.floor(status/100)+'xx':success?'2xx':'network',...context(),send_to:id};
  send('event',success?operation:'action_failed',data);
  clarity.event(success?operation:operation+'_failed');
 }
 const navigation=()=>{clarity.page();schedule(page);},storageChanged=e=>{if(e.key===CONSENT_KEY)consent(readConsent(storage,now())===true,{persist:false});else if(e.key===LEGACY_CONSENT_KEY&&granted){try{const c=JSON.parse(storage?.getItem(LEGACY_CONSENT_KEY));if(c?.granted===false)consent(false);}catch{}}};
 function start(){if(!enabled)return;win.addEventListener('hashchange',navigation);win.addEventListener('popstate',navigation);win.addEventListener('quasi:navigation',navigation);win.addEventListener('storage',storageChanged);if(granted)schedule(load);}
 function stop(){clarity.stop();disposed=true;pendingRequests.length=0;win['ga-disable-'+id]=true;for(const event of ['hashchange','popstate','quasi:navigation'])win.removeEventListener(event,navigation);win.removeEventListener('storage',storageChanged);}
 return {enabled,start,stop,consent,page,request,get granted(){return granted;},get choice(){return readConsent(storage,now());}};
}
export function mountAnalyticsConsent(controller,{doc=document}={}){
 if(!controller.enabled)return;
 const box=doc.createElement('section');box.id='analytics-consent';box.className='analytics-consent';box.setAttribute('role','region');box.setAttribute('aria-label','Preferenze statistiche');box.hidden=true;
 box.innerHTML='<button type="button" class="analytics-close" aria-label="Continua senza statistiche">×</button><strong>Ci aiuti a migliorare il bar?</strong><p>Solo se vuoi, Google Analytics misura le visite e Microsoft Clarity ci aiuta a capire dove l’app è scomoda, con mappe dei clic e sessioni mascherate. Nessuna pubblicità. Puoi usare tutto anche dicendo di no.</p><div class="analytics-actions"><button type="button" data-analytics-deny>No, grazie</button><button type="button" data-analytics-allow>Accetta statistiche</button><a href="/privacy.html">Privacy e dettagli</a></div>';
 const close=()=>{box.hidden=true;};
 const choose=value=>{controller.consent(value);close();};
 box.querySelector('[data-analytics-deny]').onclick=()=>choose(false);box.querySelector('.analytics-close').onclick=()=>choose(false);box.querySelector('[data-analytics-allow]').onclick=()=>choose(true);
 doc.body.append(box);
 const open=()=>{box.hidden=false;box.querySelector('[data-analytics-'+(controller.granted?'deny':'allow')+']')?.focus();};
 for(const control of doc.querySelectorAll('[data-analytics-preferences]'))control.addEventListener('click',open);
 if(controller.choice===null)box.hidden=false;
 return {open,close};
}
export function initAnalytics(config,{win=window,doc=document}={}){
 if(active)return active;
 active=createAnalytics({win,doc,config});active.start();
 if(!active.enabled)for(const control of doc.querySelectorAll('[data-analytics-preferences]')){control.disabled=true;control.textContent='Statistiche non attive su questo dispositivo';}
 if(active.enabled){const mount=()=>{const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href='/analytics.css';let mounted=false;sheet.onload=sheet.onerror=()=>{if(!mounted){mounted=true;mountAnalyticsConsent(active,{doc});}};doc.head.append(sheet);};if(win.requestIdleCallback)win.requestIdleCallback(mount,{timeout:4000});else win.setTimeout(mount,1800);}
 return active;
}
