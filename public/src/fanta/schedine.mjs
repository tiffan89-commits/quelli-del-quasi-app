import {slipCreditReserve,slipStakeLimit} from '../../slip-events.mjs';
import {fantasyMatchHeadline} from '../bar-fanta-match.mjs';
import {createSportsPush} from '../sports-push.mjs';
import {openMatchPage} from '../match-page.mjs';
import {patchFantasyMatch} from '../fantasy-live-detail.mjs';
import {teamLogo} from './team-logo.mjs';
import {renderFantasyLineup,bindLineupPitch} from '../lineup-pitch.mjs';
import {readAppRoute,writeAppRoute} from '../routes.mjs';
import {playerRanking} from '../bar-fanta-rankings.mjs';
import {showQuasi} from '../quasi-scene.mjs';
import {esc,pts} from './formato.mjs';
import {renderSlipV2,patchSlipV2,patchSlipBar,bindSlipV2,tickSlipEventClocks} from '../v2/slip-v2.mjs';
import {barSlipsView} from '../bar-slips.mjs';
import {fantasyAccount} from '../fantasy-accounts.mjs';
import {patchSlipResults} from '../slip-results.mjs';
import {sourceOf,isClosed,editingClosed,editingEventLocked,editablePicks,roundAvailability,defaultSlipRound,selectableSlipRounds,draftKey,loadDraft,saveDraft,fingerprint,slipSummary} from '../slip-state.mjs';

// Lega e competizione appartengono alla cornice Fanta. Leggiamo solo lo snapshot
// autorizzato già caricato dal Bar: nessuna nuova lettura al cambio di schermata.
export function fantaSlipContext(snapshot,leagueId,competitionId){
 const league=leagueId?snapshot?.leagues?.find(l=>l.nativeFantaLink?.leagueId===leagueId):undefined;
 const rounds=(league?.rounds||[]).filter(r=>r.nativeFanta&&r.nativeFanta.leagueId===leagueId&&(!competitionId||r.nativeFanta.competitionId===competitionId)&&!r.archived);
 return {league,rounds,uid:snapshot?.user?.id,calendar:snapshot?.calendar};
}
const date=value=>new Date(value).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const fmt=n=>pts(n,Number.isInteger(Number(n))?0:2);
function nativeSlipMatch(match,view){
 const status=view.official?'FT':view.state==='in-corso'?'LIVE':match.status;
 const score=[view.home.goals,view.away.goals];
 const teams=['home','away'].map(side=>{
  const team=view[side];
  return {name:team.team.name,formation:team.formation,players:[
   ...(team.starters||[]).map(p=>({...p,starter:true})),
   ...(team.bench||[]).map(p=>({...p,starter:false})),
  ]};
 });
 return {...match,homeTeam:view.home.team,awayTeam:view.away.team,status,...(score.every(Number.isFinite)?status==='FT'?{score}:{liveScore:score}:{}),
  fantasyPoints:[view.home.total,view.away.total],details:{...match.details,teams,started:status==='LIVE'||status==='FT',complete:view.official}};
}
export function createFantaSlips({services,redraw,loadMatchup,teamResolver,storage=globalThis.localStorage,now=()=>Date.now()}){
 let sub='mine',selection=null,expanded=null,message='',saving=false,detail=null,scope=null,lastView=null;
 const drafts=new Map(),detailCache=new Map();
 function current(context){
  const key=context.leagueId+':'+context.competitionId;if(scope!==key){scope=key;selection=null;expanded=null;message='';detail=null;}
  const route=readAppRoute();if(route?.mode==='fanta'&&route.page==='schedine'){if(['mine','league'].includes(route.section))sub=route.section;if(route.round)selection=route.round;}
  const snapshot=services?.snapshot?.(),data=fantaSlipContext(snapshot,context.leagueId,context.competitionId);
  const eligible=selectableSlipRounds(data.rounds,now(),data.calendar);
  const round=eligible.find(r=>r.id===selection||String(r.number)===selection)||defaultSlipRound(data.rounds,now(),data.calendar);
  return {...data,round:round?{...round,stakeReserve:slipCreditReserve(round,data.league.rounds,data.league,data.uid)}:round,eligible};
 }
 function draft(data){
  const {round,uid,league}=data;if(!round||!uid||!league)return null;
  const key=draftKey(uid,league.id,round),serverBase=fingerprint(round.slip?.picks,round.pointsOnly?0:round.slip?.stake||1);
  let d=drafts.get(key);
  if(!d){const saved=loadDraft(storage,key,round,now());d={key,picks:{...(saved?.picks||round.slip?.picks||{})},stake:round.pointsOnly?0:saved?.stake??round.slip?.stake??1,base:saved?.base??serverBase,baseSavedAt:round.slip?.savedAt||null,conflict:!!saved?.conflict};drafts.set(key,d);}
  if(d.base!==serverBase){if(fingerprint(d.picks,round.pointsOnly?0:d.stake)===d.base){drafts.delete(key);return draft(data);}d.conflict=true;}
  if(round.eventBetting){d.picks=editablePicks(round,d.picks,now());if(slipSummary(round,d.picks,d.stake,Infinity,now()).fixedStake)d.stake=round.slip.stake;}
  if(!round.pointsOnly&&!slipSummary(round,d.picks,d.stake,Infinity,now()).fixedStake){
   const credits=fantasyAccount(league.members?.find(m=>m.uid===uid),round,league).credits;
   d.stake=Math.max(1,Math.min(d.stake,slipStakeLimit(credits,round.slip?.stake,round.stakeReserve)));
  }
  return d;
 }
 function persist(data,d){saveDraft(storage,d.key,{round:data.round,picks:d.picks,stake:d.stake,base:d.base},now());}
 function ticketOptions(data,d){
  const {round,league,uid}=data;
  const account=fantasyAccount(league.members?.find(m=>m.uid===uid),round,league);
  const teams=new Map();
  for(const m of round.matches){
   if(m.homeTeam)teams.set(m.home,m.homeTeam);
   if(m.awayTeam)teams.set(m.away,m.awayTeam);
  }
  return {round:{...round,closed:isClosed(round,now())},picks:d.picks,stake:d.stake,credits:account.credits,openMatch:expanded,esc,fmt,date,barTicket:true,
   teamLabel:name=>`<span class="slip-team-label">${teamLogo(teams.get(name)||teamResolver?.(name)||{name})}<span class="slip-team-name">${esc(name)}</span></span>`};
 }
 function matchDetail(round){
  const match=round?.matches?.find(m=>m.id===detail);if(!match)return '';
  const cached=detailCache.get(scope+':'+round.id+':'+match.id);
  const m=cached?.data?nativeSlipMatch(match,cached.data):match;
  return `<section class="fanta-block" data-slip-detail>${fantasyMatchHeadline(m,name=>'<span class="team-label">'+teamLogo((name===m.home?m.homeTeam:m.awayTeam)||teamResolver?.(name)||{name},{eager:true})+'<span>'+esc(name)+'</span></span>','data-fanta-slip-detail-close')}<p data-fantasy-points ${m.fantasyPoints?.some(Number.isFinite)?'':'hidden'}>${m.fantasyPoints?.some(Number.isFinite)?'Fantapunti: '+m.fantasyPoints.map(fmt).join(' – '):''}</p>${m.details?.teams?renderFantasyLineup(m.details,{paged:true,showExtras:false}):`<p role="status">${esc(cached?.error||'Carichiamo le formazioni…')}</p>`}</section>`;
 }

 const signature=data=>JSON.stringify([scope,sub,data.round?.id,editingClosed(data.round,now()),data.round?.eventBetting?data.round.matches.map(m=>[editingEventLocked(data.round,m,now()),m.kickoff||m.officialKickoff]):null,data.eligible.map(r=>r.id)]);
 function render(context){
  const data=current(context),{league,round,uid}=data;
  lastView=signature(data);
  if(context.enabled===false||league?.fantaSlipsEnabled===false)return '<section class="fanta-block"><h1>Le schedine sono in pausa.</h1><p class="fanta-note">Il presidente ha disattivato le schedine per questa lega.</p></section>';
  if(!league||!uid)return '<section class="fanta-block"><h1>Schedina del Fanta</h1><p class="fanta-note">Le schedine saranno disponibili quando la tua squadra sarà collegata alla lega.</p></section>';
  const tabs=`<div class="fanta-slip-tabs" data-os-header role="group" aria-label="Schedine"><button type="button" data-fanta-slip-sub="mine" aria-pressed="${sub==='mine'}">La mia schedina</button><button type="button" data-fanta-slip-sub="league" aria-pressed="${sub==='league'}">Le altre schedine</button></div>`;
  if(!round)return '<section class="fanta-native-slips"><h1>Schedina del Fanta</h1><p class="fanta-note">Scommetti sulle sfide della tua lega.</p>'+tabs+'<div class="fanta-block">La prossima schedina arriva con il calendario della competizione.</div></section>';
  if(sub==='league')return '<section class="fanta-native-slips"><h1 class="sr-only">Schedina del Fanta</h1>'+tabs+barSlipsView({l:league,r:round,uid,fmt,rounds:data.eligible,sourceOf,compact:true}).replace('id="round-switch"','data-fanta-slip-round')+'</section>';
  const d=draft(data),at=now();
  const roundPicker=`<label class="field round-selector"><span class="sr-only">Giornata</span><select data-fanta-slip-round>${data.eligible.map(r=>`<option value="${esc(r.id)}" ${r.id===round.id?'selected':''}>${esc(r.title)} · ${roundAvailability(r,at)}</option>`).join('')}</select></label>`;
  const feedback=message?`<p class="fanta-note" data-fanta-slip-feedback role="status">${esc(message)}</p>`:'';
  const conflict=d.conflict?'<div class="notice" role="alert">La schedina è stata aggiornata da un altro dispositivo. La tua bozza è conservata.<button type="button" class="secondary" data-fanta-slip-reload>Usa la schedina salvata</button></div>':'';
  return `<section class="fanta-native-slips"><h1 class="sr-only">Schedina del Fanta</h1>${tabs}${renderSlipV2({...ticketOptions(data,d),roundPicker,conflictNotice:feedback+conflict})}</section>`;
 }
 function bind(root,context,{keepDetail=false}={}){
  const data=current(context),d=sub==='mine'?draft(data):null;
  root.querySelectorAll('[data-fanta-slip-sub]').forEach(b=>b.onclick=()=>{if(sub===b.dataset.fantaSlipSub)return;selection=data.round?.id||null;sub=b.dataset.fantaSlipSub;detail=null;expanded=null;message='';writeAppRoute({mode:'fanta',page:'schedine',section:sub,league:context.leagueId,round:selection});redraw();});
  root.querySelectorAll('[data-fanta-slip-round]').forEach(s=>s.onchange=()=>{selection=s.value;message='';detail=null;expanded=null;writeAppRoute({mode:'fanta',page:'schedine',section:sub,league:context.leagueId,round:selection});redraw();});
  const reload=root.querySelector('[data-fanta-slip-reload]');if(reload)reload.onclick=()=>{try{storage.removeItem(d.key);}catch{}drafts.delete(d.key);message='';redraw();};
  root.querySelectorAll('[data-detail]').forEach(b=>b.onclick=async()=>{
   const match=data.round.matches.find(m=>m.id===b.dataset.detail);if(!match)return;
   const existing=root.ownerDocument.getElementById('match-page-root');if(existing?.open&&existing.dataset.match===match.id)return;
   message='';const key=scope+':'+data.round.id+':'+match.id,old=detailCache.get(key);
   let live=null;const page=openMatchPage({document:root.ownerDocument,trigger:b,onClose:()=>{detail=null;live?.stop();}});detail=match.id;page.dataset.match=match.id;
   if(globalThis.window&&match.nativeId&&!services?.snapshot?.()?.user?.demo){live=createSportsPush({context:()=>page.open?{mode:'fanta',league:context.leagueId,competition:context.competitionId,round:Number(data.round.number),matchup:match.nativeId}:null,apply:({matchup:view})=>{
    if(!page.open||!view||detail!==match.id)return;const before=detailCache.get(key)?.data,shape=v=>JSON.stringify(['home','away'].map(k=>[v?.[k]?.formation,...(v?.[k]?.starters||[]).map(p=>p.id),...(v?.[k]?.bench||[]).map(p=>p.id)]));detailCache.set(key,{data:view,at:now()});if(shape(before)!==shape(view))show();
    patchFantasyMatch(page,nativeSlipMatch(match,view));
   }});}
   const show=()=>{if(!page.open||detail!==match.id)return;page._pitchCleanup?.();page.innerHTML=matchDetail(data.round);page.querySelector('[data-fanta-slip-detail-close]').onclick=()=>page.close();bindLineupPitch(page);};show();
   if(!loadMatchup||old?.pending||old?.data&&now()-old.at<60000){live?.start();return;}
   detailCache.set(key,{pending:true});
   try{const view=await loadMatchup(context,data.round,match);detailCache.set(key,{data:view,at:now()});}catch(error){detailCache.set(key,{error:'Formazioni momentaneamente non disponibili. Riprova.'});}
   show();live?.start();
  });
  root.querySelectorAll('[data-quasi-member]').forEach(b=>b.onclick=()=>{const member=data.league?.members?.find(m=>m.uid===b.dataset.quasiMember);if(member)showQuasi(member);});
  if(!d)return;
  const redrawChoices=()=>{
   if(!patchSlipV2(root,ticketOptions(data,d))){redraw();return;}
   if(!message)root.querySelector('[data-fanta-slip-feedback]')?.remove();
   bind(root,context,{keepDetail:true});
  };
  bindSlipV2(root,{
   onPick:(id,value)=>{if(saving||editingEventLocked(data.round,data.round.matches.find(m=>m.id===id),now()))return;if(data.round.eventBetting&&d.picks[id]===value)delete d.picks[id];else d.picks[id]=value;persist(data,d);message='';redrawChoices();},
   onToggle:id=>{expanded=expanded===id?null:id;redrawChoices();},
   onStake:value=>{if(saving||editingClosed(data.round,now())||slipSummary(data.round,d.picks,d.stake,Infinity,now()).fixedStake)return;d.stake=value;persist(data,d);
    const credits=fantasyAccount(data.league.members?.find(m=>m.uid===data.uid),data.round,data.league).credits;
    patchSlipBar(root.querySelector(".v2-slipbar"),{round:data.round,picks:d.picks,stake:d.stake,credits,esc,fmt,date});
    const save=root.querySelector("#save-slip");if(save&&(d.conflict||globalThis.navigator?.onLine===false||!services?.save))save.disabled=true;},
   onSave:async()=>{
    const summary=slipSummary(data.round,d.picks,d.stake,fantasyAccount(data.league.members?.find(m=>m.uid===data.uid),data.round,data.league).credits,now());
    if(saving||d.conflict||globalThis.navigator?.onLine===false||!services?.save||!summary.canSave)return;
    saving=true;message='Salvataggio…';redraw();
    try{await services.save({league:data.league.id,round:data.round.id,picks:summary.picks,stake:data.round.pointsOnly?0:d.stake,baseSavedAt:d.baseSavedAt},{onAcknowledged:()=>{message='Schedina ricevuta ✓ · aggiorniamo il saldo';redraw();}});try{storage.removeItem(d.key);}catch{}drafts.delete(d.key);message='Schedina confermata. Ora puoi iniziare a dubitare.';}
    catch(e){message=e.message||'Salvataggio non riuscito. Riprova.';if(e.status===409)d.conflict=true;}
    finally{saving=false;redraw();}
   }
  });
  const save=root.querySelector('#save-slip');if(save&&saving){save.textContent='Salvataggio in corso…';save.setAttribute('aria-busy','true');save.classList.add('is-busy');}
  if(save&&(saving||d.conflict||globalThis.navigator?.onLine===false||!services?.save))save.disabled=true;
  if(saving)root.querySelectorAll('[data-pick],#stake,[data-stake-step],[data-ticket-stake]').forEach(b=>b.disabled=true);
  patchSlipResults(root,data.round,d.picks,isClosed(data.round,now()));
 }
 function ranking(context,metric='points'){const data=current(context);return data.league?playerRanking(data.league,'fantacalcio',metric,{id:data.uid},esc,fmt,data.round?.competitionKey).replace(/<section class="round-heading">[\s\S]*?<\/section>/,'<p class="fanta-note">Punti e crediti delle schedine del Fanta.</p>'):'<section class="fanta-block"><h2>Classifica schedine</h2><p>La classifica arriva con il calendario della lega.</p></section>';}
 return {render,bind,ranking,context:current,enter:()=>{selection=null;sub='mine';detail=null;expanded=null;message='';},tick:context=>{const data=current(context);const page=globalThis.document?.getElementById('match-page-root'),match=data.round?.matches?.find(m=>m.id===detail);if(page?.open&&match&&page.dataset.match===match.id&&!detailCache.get(scope+':'+data.round.id+':'+match.id)?.data)patchFantasyMatch(page,match);if(lastView!==signature(data))redraw();else tickSlipEventClocks();}};
}
