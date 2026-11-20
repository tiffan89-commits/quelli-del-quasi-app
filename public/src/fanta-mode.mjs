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
export function refreshFantaMembership(barLeagues,linkedLeagues,listChanged=false){
 const view=instance||parked.values().next().value;
 view?.setBarLeagues?.(barLeagues);
 const currentChanged=linkedLeagues.includes(view?.leagueId);
 if(listChanged||currentChanged)void view?.refreshMembership?.({listChanged,currentChanged});
}
export function preferredFanta(){return selectedMode==='fanta';}
export function leaveFanta({keepSplash=false}={}){selectedMode='bar';if(!keepSplash)document.querySelector('.mode-splash')?.remove();operation++;if(instance){instance.suspend?.();parked.set(activeUser||'demo',instance);}instance=null;document.body.classList.remove('fanta-active');try{const url=new URL(location.href);url.searchParams.delete('mode');url.searchParams.delete('fantaLeague');if(url.href!==location.href)history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch{}}
export async function enterFanta(root,{user,onBar,barLeagues=[],leagueId=null,force=false,slipServices=null,initialTab='oggi',initialSection=null}={}){
 if(user&&!user.demo&&!barLeagues.length)return;
 if(initialSection)writeAppRoute({mode:'fanta',page:initialTab,section:initialSection,league:leagueId});
 const requested=readAppRoute();
 if(!force&&instance&&activeUser===user?.id&&(root.querySelector('.fanta-top')||document.querySelector('#app-header .fanta-top')))return;
 loadAppStyles();if(typeof startOneScreen==='function')startOneScreen();selectedMode='fanta';const cached=parked.get(user?.id||'demo');if(cached&&cached.hasTeam!==false&&!force&&!requested?.competition&&requested?.section!=='studio'&&(!leagueId||cached.leagueId===leagueId)){instance=cached;activeUser=user?.id;document.body.classList.add('fanta-active');const route=readAppRoute();if(route?.mode!=='fanta')writeAppRoute({mode:'fanta',page:initialTab||'oggi',section:initialSection,league:cached.leagueId});cached.setBarLeagues?.(barLeagues);cached.resume(initialTab,{route:readAppRoute()});return;}
 const hideSplash=showModeSplash('fanta');activeUser=user?.id;
 const mine=++operation;const old=parked.get(user?.id||'demo');if(old&&old!==instance)old.destroy();parked.delete(user?.id||'demo');instance?.destroy();instance=null;root.innerHTML='';document.body.classList.add('fanta-active');
 try{
  const [{mountFanta},{createFantaApi}]=await Promise.all([import('./fanta/app.mjs'),import('./fanta/api.mjs')]);
  await loadAppStyles();
  const real=createFantaApi({userId:user?.id});if(requested?.mode==='fanta'&&requested.competition)real.setCompetition(requested.competition);let access='demo',bootstrap=null,assigned=false;if(user&&!user.demo){try{bootstrap=await real.bootstrap(leagueId||new URLSearchParams(location.search).get('fantaLeague')||localStorage.getItem('qdq:fantaLeague'));if(mine!==operation)return;({bootstrap,assigned}=await assignEntryTeam(real,bootstrap));access=bootstrap.me.access;}catch(e){if(e.status!==403)throw e;}}
  const target=new URLSearchParams(location.search).get('fantaLeague');if(target)try{localStorage.setItem('qdq:fantaLeague',target);}catch{}
  if(mine!==operation)return;
  const demo=access==='demo',demoSession=demo?(await import('./demo-session.mjs')).getDemoSession():null;if(demoSession)await demoSession.ready;try{localStorage.setItem('qdq:mode','fanta');}catch{}
  const demoServices=demoSession?.slips||null;if(demoSession)barLeagues=demoSession.bar.state.leagues;
 const activeRoute=readAppRoute();
 writeAppRoute({...(activeRoute?.mode==='fanta'?activeRoute:{page:initialTab,section:initialSection}),mode:'fanta',league:leagueId||activeRoute?.league});
 instance=mountFanta(root,{api:demo?demoSession.fanta:real,bootstrap,barLeagues,slipServices:demoServices?{...demoServices,account:slipServices?.account}:slipServices,initialTab,viewerId:user?.id,demo:access==='pilot'?'pilot':demo,onModeChange:async (mode,target)=>{if(mode==='bar'){const hide=()=>{};leaveFanta({keepSplash:true});try{localStorage.setItem('qdq:mode','bar');}catch{}writeAppRoute({mode:'bar',page:target?.page==='invita'?'impostazioni':target?.page==='barleague'?'lega':target?.page==='lega'?'oggi':target?.page||'oggi',league:linkedBarTarget(barLeagues,target?.fantaLeague,target)?.league});onBar?.(linkedBarTarget(barLeagues,target?.fantaLeague,target));requestAnimationFrame(hide);}}});
 await instance.ready;
 if(assigned&&mine===operation)document.dispatchEvent(new CustomEvent('quasi:fanta-team-claimed',{detail:{league:instance.leagueId}}));
 }catch{
  if(mine===operation){
   root.innerHTML='<main class="fanta-empty"><h2>Il Fanta non si è caricato</h2><button type="button" class="primary" data-fanta-entry-retry>Riprova</button> <button type="button" class="secondary" data-app-mode="bar">Torna al Bar</button></main>';
   root.querySelector('[data-fanta-entry-retry]').onclick=()=>void enterFanta(root,{user,onBar,barLeagues,leagueId,force:true,slipServices,initialTab,initialSection});
  }
 }finally{hideSplash();}
}
