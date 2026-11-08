import {loadAppStyles} from './app-styles.mjs';
import {startOneScreen} from './one-screen.mjs';
import {writeAppRoute,readAppRoute} from './routes.mjs';
const parked=new Map();
import {linkedBarTarget} from './display-cache.mjs';
import {showModeSplash} from './mode-splash.mjs';
import {modeSwitch} from './mode-switch.mjs';
import {assignEntryTeam} from './fanta/entry-team.mjs';
let instance=null,operation=0,activeUser=null,selectedMode='bar';
export function clearFantaSessions(){for(const view of new Set([instance,...parked.values()]))view?.destroy();parked.clear();instance=null;activeUser=null;operation++;}
export function barModeSwitch(){return modeSwitch('bar','data-app-mode');}
export function preferredFanta(){return selectedMode==='fanta';}
export function leaveFanta({keepSplash=false}={}){selectedMode='bar';if(!keepSplash)document.querySelector('.mode-splash')?.remove();operation++;if(instance){instance.suspend?.();parked.set(activeUser||'demo',instance);}instance=null;document.body.classList.remove('fanta-active');try{const url=new URL(location.href);url.searchParams.delete('mode');url.searchParams.delete('fantaLeague');history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{}}
export async function enterFanta(root,{user,onBar,barLeagues=[],leagueId=null,force=false,slipServices=null,initialTab='oggi'}={}){
 if(!force&&instance&&activeUser===user?.id&&(root.querySelector('.fanta-top')||document.querySelector('#app-header .fanta-top')))return;
 loadAppStyles();if(typeof startOneScreen==='function')startOneScreen();selectedMode='fanta';const cached=parked.get(user?.id||'demo');if(cached&&cached.hasTeam!==false&&!force&&(!leagueId||cached.leagueId===leagueId)){instance=cached;activeUser=user?.id;document.body.classList.add('fanta-active');const route=readAppRoute();if(route?.mode!=='fanta')writeAppRoute({mode:'fanta',page:initialTab||'oggi',league:cached.leagueId});cached.setBarLeagues?.(barLeagues);cached.resume(initialTab,{route:route?.mode==='fanta'?route:null});return;}
 const hideSplash=showModeSplash('fanta');activeUser=user?.id;
 const mine=++operation;const old=parked.get(user?.id||'demo');if(old&&old!==instance)old.destroy();parked.delete(user?.id||'demo');instance?.destroy();instance=null;root.innerHTML='';document.body.classList.add('fanta-active');
 try{
  const [{mountFanta},{createFantaApi}]=await Promise.all([import('./fanta/app.mjs'),import('./fanta/api.mjs')]);
  await loadAppStyles();
  const real=createFantaApi({userId:user?.id});let access='demo',bootstrap=null,assigned=false;if(user&&!user.demo){try{bootstrap=await real.bootstrap(leagueId||new URLSearchParams(location.search).get('fantaLeague')||localStorage.getItem('qdq:fantaLeague'));if(mine!==operation)return;({bootstrap,assigned}=await assignEntryTeam(real,bootstrap));access=bootstrap.me.access;}catch(e){if(e.status!==403)throw e;}}
  const target=new URLSearchParams(location.search).get('fantaLeague');if(target)try{localStorage.setItem('qdq:fantaLeague',target);}catch{}
  if(mine!==operation)return;
  const demo=access==='demo',demoSession=demo?(await import('./demo-session.mjs')).getDemoSession():null;if(demoSession)await demoSession.ready;try{localStorage.setItem('qdq:mode','fanta');}catch{}
  const demoServices=demoSession?.slips||null;if(demoSession)barLeagues=demoSession.bar.state.leagues;
 writeAppRoute({mode:'fanta',page:readAppRoute()?.mode==='fanta'?readAppRoute().page:initialTab,section:readAppRoute()?.section,round:readAppRoute()?.round,league:leagueId||readAppRoute()?.league});
 instance=mountFanta(root,{api:demo?demoSession.fanta:real,bootstrap,barLeagues,slipServices:demoServices?{...demoServices,account:slipServices?.account}:slipServices,initialTab,demo:access==='pilot'?'pilot':demo,onModeChange:async (mode,target)=>{if(mode==='bar'){const hide=()=>{};leaveFanta({keepSplash:true});try{localStorage.setItem('qdq:mode','bar');}catch{}writeAppRoute({mode:'bar',page:target?.page==='invita'?'profilo':['create-league','join-league'].includes(target?.page)?'oggi':target?.page||'oggi',league:linkedBarTarget(barLeagues,target?.fantaLeague,target)?.league});onBar?.(linkedBarTarget(barLeagues,target?.fantaLeague,target));requestAnimationFrame(hide);}}});
 await instance.ready;
 if(assigned&&mine===operation)document.dispatchEvent(new CustomEvent('quasi:fanta-team-claimed',{detail:{league:instance.leagueId}}));
 }catch{if(mine===operation)root.innerHTML=modeSwitch('fanta','data-app-mode')+'<main class="fanta-empty"><h2>Il Fanta si sta preparando.</h2><p>Riprova tra poco.</p><button class="secondary" data-app-mode="bar">Torna al Bar</button></main>';}finally{hideSplash();}
}
