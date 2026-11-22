import {isMatchEvent} from '../match-events.mjs';
import {clubShirt} from './club-crest.mjs';
import {sameClub} from './fanta/maglie.mjs';
import {footballComparison,footballPenalties,footballPlayerStats} from './football-statistics.mjs';
import {bindLineupPitch,matchAvailability,renderLineup} from './lineup-pitch.mjs';
import {patchRegion} from './live-channel.mjs';
import {bindPullDown} from './match-page.mjs';
import {assistBootIcon,ballIcon,substitutionMark} from './pitch-events.mjs';
import {playerSurname} from './player-label.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const live=new Set(['LIVE','1H','HT','2H','ET','BT','P','INT']);
const finals=new Set(['FT','AET','PEN','AWD','WO']);
const scoreOf=match=>live.has(match.status)?match.liveScore??match.score:match.score;
const started=match=>live.has(match.status)||finals.has(match.status);
const romeDate=new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
const views=new WeakMap();
const tabs=[['cronaca','Cronaca'],['statistiche','Statistiche'],['formazioni','Formazioni']];

function minute(value){
 const m=String(value??'').trim().match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?['’′]?$|^(\d{1,3}):\d\d$/);
 return m?{base:Number(m[1]??m[3]),added:Number(m[2]||0)}:null;
}
const goal=event=>event.kind==='goal'||event.kind==='own-goal';

function matchEvents(match){
 return (match.details?.events||[]).filter(isMatchEvent).map((event,index)=>{
  const team=event.side==='home'||event.side==='away'?event.side:
   event.team&&sameClub(event.team,match.home)?'home':event.team&&sameClub(event.team,match.away)?'away':null;
  const time=minute(event.minute)??(event.seconds>0?{base:Math.floor(event.seconds/60),added:0}:null);
  return {...event,teamSide:team,time,index};
 }).sort((a,b)=>(a.time?.base??Infinity)-(b.time?.base??Infinity)||(a.time?.added??0)-(b.time?.added??0)||(a.order??a.index)-(b.order??b.index));
}

function phaseLabel(match){
 const status=match.status,phase=String(match.phase??'').toLowerCase();
 if(finals.has(status))return 'Finale';
 if(status==='HT'||phase.includes('halftime')||match.clock==='Intervallo')return 'Intervallo';
 if(status==='BT'||phase.includes('break time'))return 'Pausa supplementari';
 if(status==='1H'||phase.includes('first half'))return 'Primo tempo';
 if(status==='2H'||phase.includes('second half'))return 'Secondo tempo';
 if(status==='ET'||phase.includes('extra time'))return 'Supplementari';
 if(status==='P'||phase.includes('penalty shootout'))return 'Rigori';
 return ({PST:'Rinviata',CANC:'Annullata',ABD:'Interrotta',SUSP:'Sospesa',INT:'Interrotta',TBD:'Da definire'})[status]
  ||(live.has(status)?'In corso':'Da giocare');
}

function matchHead(match){
 const isLive=live.has(match.status),isFinal=finals.has(match.status);
 const score=scoreOf(match)?.join(' – ')||'–',phase=phaseLabel(match);
 const clock=minute(match.clock);
 const clockText=clock?clock.base+(clock.added?'+'+clock.added:'')+'′':'';
 const kickoff=Date.parse(match.officialKickoff||match.kickoff);
 const timing=phase==='Da giocare'&&Number.isFinite(kickoff)?romeDate.format(kickoff):phase;
 return `<div class="live-match-center" data-live-match-region="score">
  ${isLive?`<span class="live-match-badge"><i aria-hidden="true"></i>LIVE${clockText?`<b>${esc(clockText)}</b>`:''}</span>`:isFinal?'<span class="live-match-finished">Finale</span>':''}
  <strong class="live-match-score" data-live-detail-score role="status" aria-atomic="true">${esc(score)}</strong>
  ${isFinal?'':`<span class="live-match-phase">${esc(timing)}</span>`}
 </div>`;
}

function matchTimeline(match,events){
 const phase=phaseLabel(match),goals=events.filter(e=>goal(e)&&e.time),clock=minute(match.clock);
 const duration=match.status==='AET'||match.status==='PEN'||['Supplementari','Rigori','Pausa supplementari'].includes(phase)
  ||(clock?.base??0)>90||goals.some(e=>e.time.base>90)?120:90;
 const progress=finals.has(match.status)?duration:phase==='Intervallo'?45:phase==='Pausa supplementari'?105:clock?.base;
 const percentage=value=>100*Math.min(duration,Math.max(0,value))/duration;
 const summary=goals.map(e=>`${e.kind==='own-goal'?'Autogol':'Gol'} ${e.teamSide?match[e.teamSide]:e.team||''} ${e.minute||e.time.base+'′'}`).join(', ');
 const markers=[...new Map(goals.map(e=>[e.time.base+'-'+e.teamSide,e])).values()];
 return `<div class="live-match-timeline" data-live-match-region="timeline"${progress===undefined?' hidden':''}>
  <div class="live-match-track" role="img" aria-label="${esc(summary?'Gol della partita. '+summary:'Linea del tempo della partita')}">
   <span class="live-match-played" style="--played:${percentage(progress??0)}%" aria-hidden="true"></span>
   <span class="live-match-half" style="--moment:${percentage(45)}%" aria-hidden="true"></span>
   ${markers.map(e=>`<span class="live-match-goal-mark ${e.teamSide||''}" aria-hidden="true" style="--moment:${percentage(e.time.base)}%">${ballIcon(e.kind==='own-goal')}</span>`).join('')}
  </div>
  <div class="live-match-track-labels" aria-hidden="true"><span>0′</span><span style="--moment:${percentage(45)}%">45′</span><span>${duration}′</span></div>
 </div>`;
}

const labels={goal:'Gol','own-goal':'Autogol',yellow:'Ammonizione',red:'Espulsione','penalty-missed':'Rigore sbagliato','penalty-saved':'Rigore parato',substitution:'Sostituzione',var:'VAR'};
const varLabel=detail=>({'goal cancelled':'Gol annullato','goal confirmed':'Gol confermato','penalty confirmed':'Rigore confermato','penalty cancelled':'Rigore annullato'})[String(detail??'').toLowerCase()]||detail;

function chronology(match,events){
 const tally=[0,0],scores=new Map(),official=scoreOf(match);
 for(const e of events.filter(e=>e.kind==='goal'&&e.teamSide)){
  tally[e.teamSide==='home'?0:1]++;
  scores.set(e,tally.join('–'));
 }
 const reliable=official?.length===2&&tally.every((value,i)=>value===Number(official[i]))
  &&!events.some(e=>e.kind==='own-goal'||e.kind==='goal'&&(!e.teamSide||!e.time));
 const eventList=events.slice().reverse().map(e=>{
  const icon=goal(e)?ballIcon(e.kind==='own-goal'):e.kind==='substitution'?substitutionMark():
   ({yellow:'<i class="live-match-card-mark"></i>',red:'<i class="live-match-card-mark"></i>','penalty-missed':'×','penalty-saved':'🧤',var:'▣'})[e.kind];
  const name=[(e.players||[]).map(playerSurname).filter(Boolean).join(', '),playerSurname(e.incoming)].filter(Boolean).join(' → ');
  const team=e.teamSide?match[e.teamSide]:e.team;
  const detail=[name,e.kind==='var'?varLabel(e.detail):''].filter(Boolean).join(' · ');
  const assist=e.kind==='goal'&&!e.penalty&&typeof e.assist==='string'?playerSurname(e.assist):'';
  const score=reliable?scores.get(e):null;
  return `<li class="live-match-event${goal(e)?' is-goal':''}">
   <b class="live-event-minute">${esc(e.minute||'—')}</b>
   <span class="live-event-icon ${e.kind} ${e.teamSide||''}" aria-hidden="true">${icon}</span>
   <div class="live-event-description">
    <span>${esc([e.penalty&&e.kind==='goal'?'Rigore segnato':labels[e.kind],team].filter(Boolean).join(' · '))}</span>
    ${detail?`<strong>${esc(detail)}</strong>`:''}
    ${assist?`<span class="live-event-assist">${assistBootIcon()}<span><span class="sr-only">Assist di </span>${esc(assist)}</span></span>`:''}
   </div>
   ${score?`<b class="live-event-score" aria-label="Risultato ${score.replace('–',' a ')}">${score}</b>`:''}
  </li>`;
 }).join('');
 const stats=footballComparison(match,{summary:true});
 return `<div data-live-match-region="chronology">
  <h2>Ultimi eventi</h2>
  ${events.length?`<ol class="live-match-events">${eventList}</ol>`:`<p class="live-match-empty muted">${live.has(match.status)?'Nessun evento registrato finora.':finals.has(match.status)?'Cronaca non disponibile.':'La cronaca inizierà al calcio d’inizio.'}</p>`}
  ${stats?`<div class="live-match-summary"><div class="live-match-section-head"><h2>In numeri</h2><button type="button" data-open-match-stats>Vedi tutte <span aria-hidden="true">›</span></button></div>${stats}</div>`:''}
 </div>`;
}

function statistics(match){
 const teams=footballComparison(match),penalties=footballPenalties(match,{compact:true});
 return `<div data-live-match-region="statistics">
  ${teams?' <h2>Confronto squadre</h2>'+teams:''}
  ${penalties}
  ${teams||penalties?'':'<p class="live-match-empty muted">Statistiche non ancora disponibili.</p>'}
 </div>`;
}

function matchLineup(match,availabilityOpen=false){
 return renderLineup(match,{paged:true,showExtras:false,showTitle:false,playerDetails:true})+matchAvailability(match,{open:availabilityOpen});
}

function regions(match){
 const events=matchEvents(match);
 return {score:matchHead(match),timeline:matchTimeline(match,events),chronology:chronology(match,events),statistics:statistics(match)};
}

function bindPitch(root,view){
 if(view.pitchBound){
  const slides=root.querySelector('.pitch-slides');
  if(slides&&root._pitchPage>0)slides.scrollLeft=root._pitchPage*slides.clientWidth;
  return;
 }
 view.pitchBound=true;
 bindLineupPitch(root,{fitViewport:false,autoHeight:false});
}

function bindMatchTabSwipe(panel,step){
 let start=null;
 panel.addEventListener('touchstart',event=>{
  const target=event.target.closest?.('.pitch-slides,input,select,textarea,[contenteditable]');
  start=event.touches.length===1&&!target?event.touches[0]:null;
 },{passive:true});
 panel.addEventListener('touchmove',event=>{
  if(!start)return;
  const point=event.touches[0];
  if(event.touches.length!==1||!point){start=null;return;}
  const dx=Math.abs(point.clientX-start.clientX),dy=Math.abs(point.clientY-start.clientY);
  if(dy>12&&dy>dx*1.4)start=null;
 },{passive:true});
 panel.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 panel.addEventListener('touchend',event=>{
  const first=start,point=event.changedTouches[0];
  start=null;
  if(!first||!point||event.touches.length)return;
  const dx=point.clientX-first.clientX,dy=point.clientY-first.clientY;
  if(Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.4)step(dx<0?1:-1);
 },{passive:true});
}

function paintPlayerStats(view){
 if(!view.player)return;
 const html=footballPlayerStats(view.match,view.player);
 if(html!==view.playerHTML){
  view.sheet.querySelector('[data-live-player-values]').innerHTML=html;
  view.playerHTML=html;
 }
}

function bindPlayerStats(view){
 const sheet=view.sheet;
 const close=()=>{
  view.player=null;
  if(typeof sheet.close==='function')sheet.close();
  else sheet.removeAttribute('open');
 };
 sheet.onclick=event=>{
  if(event.target===sheet||event.target.closest?.('[data-close-live-player]'))close();
 };
 sheet.addEventListener('cancel',event=>{event.preventDefault();close();});
 bindPullDown(sheet,close);
}

function openPlayerStats(view,trigger){
 const sheet=view.sheet;
 if(sheet.hasAttribute('open'))return;
 const {playerId:id,playerName:name,playerSide:side}=trigger.dataset;
 view.player={id,name,side};
 sheet.querySelector('#live-player-name').textContent=trigger.parentElement.querySelector('.pitch-player-name').textContent;
 sheet.querySelector('[data-live-player-team]').textContent=view.match[side];
 paintPlayerStats(view);
 trigger.focus({preventScroll:true});
 if(typeof sheet.showModal==='function')sheet.showModal();
 else sheet.setAttribute('open','');
}

function bindPlayerTap(panel,view){
 let tap=null;
 const distance=point=>Math.hypot(point.clientX-tap.x,point.clientY-tap.y);
 panel.addEventListener('touchstart',event=>{
  const trigger=event.target.closest?.('[data-pitch-player-detail]'),point=event.touches[0];
  tap=trigger&&event.touches.length===1?{trigger,x:point.clientX,y:point.clientY}:null;
 },{passive:true});
 panel.addEventListener('touchmove',event=>{
  if(tap&&(event.touches.length!==1||distance(event.touches[0])>10))tap=null;
 },{passive:true});
 panel.addEventListener('touchcancel',()=>{tap=null;},{passive:true});
 panel.addEventListener('touchend',event=>{
  const point=event.changedTouches[0],trigger=tap&&!event.touches.length&&point&&distance(point)<=10?tap.trigger:null;
  tap=null;
  if(!trigger?.isConnected)return;
  event.preventDefault();
  openPlayerStats(view,trigger);
 },{passive:false});
}

export function mountFootballMatch(root,match,{initialTab}={}){
 root._pitchCleanup?.();
 const selected=initialTab|| (started(match)?'cronaca':'formazioni');
 const parts=regions(match),view={match,parts,pitchBound:false};
 views.set(root,view);
 root.classList.add('live-match-page');
 root.innerHTML=`<div class="live-match-top">
  <header class="live-match-header">
   <div class="live-match-scoreboard">
    <button type="button" class="secondary match-nav-button match-close" id="close-modal" aria-label="Chiudi partita">×</button>
    <div class="live-match-team home">${clubShirt(match.home,{home:true,vs:match.away})}<span>${esc(match.home)}</span></div>
    ${parts.score}
    <div class="live-match-team away">${clubShirt(match.away,{home:false,vs:match.home})}<span>${esc(match.away)}</span></div>
   </div>
   ${parts.timeline}
  </header>
  <nav class="live-match-tabs" aria-label="Dettagli partita">
   ${tabs.map(([id,label])=>`<button type="button" data-live-match-tab="${id}" aria-controls="live-match-${id}" aria-pressed="${id===selected}">${label}</button>`).join('')}
  </nav>
 </div>
 <section class="live-match-panel" id="live-match-cronaca" data-live-match-panel="cronaca" aria-label="Cronaca"${selected==='cronaca'?'':' hidden'}>${parts.chronology}</section>
 <section class="live-match-panel" id="live-match-statistiche" data-live-match-panel="statistiche" aria-label="Statistiche"${selected==='statistiche'?'':' hidden'}>${parts.statistics}</section>
 <section class="live-match-panel" id="live-match-formazioni" data-live-match-panel="formazioni" aria-label="Formazioni"${selected==='formazioni'?'':' hidden'}>${matchLineup(match)}</section>
 <dialog class="live-player-dialog" aria-labelledby="live-player-name">
  <div class="live-player-dialog-body">
   <div class="v2-sheet-handle" aria-hidden="true"></div>
   <div class="live-player-heading">
    <div><h2 id="live-player-name"></h2><p class="muted" data-live-player-team></p></div>
    <button type="button" class="secondary match-nav-button" data-close-live-player aria-label="Chiudi statistiche giocatore" autofocus>×</button>
   </div>
   <div data-live-player-values></div>
  </div>
 </dialog>`;
 root.querySelector('#close-modal').onclick=()=>root.close();
 view.sheet=root.querySelector('.live-player-dialog');
 bindPlayerStats(view);
 const formations=root.querySelector('#live-match-formazioni');
 bindPlayerTap(formations,view);
 formations.addEventListener('toggle',event=>{
  if(formations.hidden||!event.target.matches?.('.match-availability'))return;
  if(!event.target.hasAttribute('open'))root.scrollTop=0;
  else if(!root.scrollTop)root.scrollTop=Math.max(0,Math.min(Math.floor(root.clientHeight/3),root.scrollHeight-root.clientHeight));
 },true);
 const controls=[...root.querySelectorAll('[data-live-match-tab]')],panels=[...root.querySelectorAll('[data-live-match-panel]')];
 const select=target=>{
  for(const control of controls)control.setAttribute('aria-pressed',String(control.dataset.liveMatchTab===target));
  for(const panel of panels)panel.hidden=panel.dataset.liveMatchPanel!==target;
  root.scrollTop=0;
  if(target==='formazioni')bindPitch(root,view);
 };
 panels.forEach((panel,index)=>bindMatchTabSwipe(panel,direction=>{
  const next=panels[index+direction];
  if(next)select(next.dataset.liveMatchPanel);
 }));
 root.onclick=event=>{
  const button=event.target.closest?.('[data-live-match-tab],[data-open-match-stats],[data-pitch-player-detail]');
  if(!button)return;
  if(button.hasAttribute('data-pitch-player-detail')){openPlayerStats(view,button);return;}
  const target=button.dataset.liveMatchTab||'statistiche';
  select(target);
  if(button.hasAttribute('data-open-match-stats'))controls.find(control=>control.dataset.liveMatchTab===target)?.focus({preventScroll:true});
 };
 if(selected==='formazioni')bindPitch(root,view);
}

export function updateFootballMatch(root,incoming,{refreshLineup=false}={}){
 const view=views.get(root);
 if(!view)return;
 const previous=view.match;
 const older=incoming.scoreUpdatedAt&&previous.scoreUpdatedAt&&Date.parse(incoming.scoreUpdatedAt)<Date.parse(previous.scoreUpdatedAt);
 if(older&&!refreshLineup)return;
 const match=older?{...previous,lineups:incoming.lineups??previous.lineups,lineupRevision:incoming.lineupRevision}:
  {...previous,...incoming,lineups:incoming.lineups??previous.lineups,details:{...previous.details,...incoming.details}};
 const parts=regions(match);
 for(const [part,html] of Object.entries(parts)){
  if(html!==view.parts[part])patchRegion(root.querySelector('[data-live-match-region="'+part+'"]'),html);
 }
 if(refreshLineup||started(previous)!==started(match)){
  const panel=root.querySelector('[data-live-match-panel="formazioni"]'),active=root.ownerDocument.activeElement;
  const pressed=panel.contains(active)?active.getAttribute('data-pitch-tab'):null;
  const availability=panel.querySelector('.match-availability'),wasOpen=availability?.hasAttribute('open'),scroll=root.scrollTop;
  root._pitchCleanup?.();
  view.pitchBound=false;
  panel.innerHTML=matchLineup(match,wasOpen);
  if(!panel.hidden)bindPitch(root,view);
  if(wasOpen&&!panel.hidden&&panel.querySelector('.match-availability[open]'))root.scrollTop=scroll;
  if(pressed!=null)panel.querySelector('[data-pitch-tab="'+pressed+'"]')?.focus({preventScroll:true});
 }
 view.match=match;
 view.parts=parts;
 paintPlayerStats(view);
}
