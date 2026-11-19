import {quasiHomeBackdrop,quasiMascot} from './quasi-scene.mjs';
import {socialHome} from './home-social.mjs';
import {barReminder,homeReminderBanner} from './president-reminders.mjs';
import {stableHash} from './reward-catalog.mjs';
import {BAR_HOME_QUOTES} from './bar-home-quotes.mjs';
import {matchSegments,renderBarStories} from './bar-home-stories.mjs';

import { sourceOf, deadlineOf, isClosed, roundAvailability } from './slip-state.mjs';
import {fantasyGroup} from './fantasy-accounts.mjs';
export function dashboardModel(league, uid, source='seriea', now=Date.now(), competition=null) {
  const fantasy=source==='fantacalcio', members=league.members||[];
  const group=fantasyGroup(league,competition);
  const totals=m=>fantasy?(group?.members||[]).find(t=>t.uid===m.uid)||{points:0,credits:0}:m;
  const mine=members.find(m=>m.uid===uid), own=mine?totals(mine):null, creditsAvailable=!fantasy||Number(group?.bookmakerCompetitions)>0;
  const rank=key=>own?1+members.filter(m=>Number(totals(m)[key]||0)>Number(own[key]||0)).length:null;
  const rounds=(league.rounds||[]).filter(r=>sourceOf(r)===source && (!fantasy||!competition||r.competitionKey===competition) && r.matches?.length);
  const upcoming=rounds.filter(r=>!isClosed(r,now)&&Number.isFinite(Date.parse(deadlineOf(r)))&&Date.parse(deadlineOf(r))>now).sort((a,b)=>Date.parse(deadlineOf(a))-Date.parse(deadlineOf(b)))[0];
  const startedAt=r=>{const dates=[Date.parse(r.kickoff),...(r.matches||[]).map(m=>Date.parse(m.kickoff))].filter(Number.isFinite);return dates.length?Math.min(...dates):NaN;};
  const complete=r=>r.settled||(r.matches||[]).every(m=>m.void||m.status==='FT'&&Array.isArray(m.score)&&m.score.length===2);
  const latest=list=>list.filter(r=>Number.isFinite(startedAt(r))&&startedAt(r)<=now).sort((a,b)=>startedAt(b)-startedAt(a))[0];
  const serieACurrent=latest((league.rounds||[]).filter(r=>sourceOf(r)==='seriea'&&r.matches?.length));
  const serieAActive=serieACurrent&&!complete(serieACurrent)?serieACurrent:null;
  const ownCurrent=latest(rounds),ownActive=ownCurrent&&!complete(ownCurrent)?ownCurrent:null;
  const active=fantasy&&serieAActive?(rounds.find(r=>r.serieARound===serieAActive.number)||ownActive||serieAActive):ownActive;
  return {pointsRank:rank('points'),creditsRank:creditsAvailable?rank('credits'):null,creditsAvailable,points:own?.points||0,credits:own?.credits||0,memberCount:members.length,lastRound:latest(rounds.filter(complete))||null,round:active||upcoming||null,active:!!active,deadline:active?null:upcoming?deadlineOf(upcoming):null};
}
export function countdownLabel(deadline,now=Date.now()) {
  const diff=Date.parse(deadline)-now;
  if(!Number.isFinite(diff)) return 'In attesa';
  if(diff<=0) return 'Tempo scaduto';
  const mins=Math.ceil(diff/60000),days=Math.floor(mins/1440),hours=Math.floor(mins%1440/60),minutes=mins%60;
  return days?`${days}g ${hours}h ${minutes}m`:`${hours}h ${String(minutes).padStart(2,'0')}m`;
}
const shortRound=round=>round?.number?'G'+round.number:'';
const sign=(value,fmt)=>(value>0?'+':'')+fmt(value);
function quote(user,league,last,upcoming,now){
 const change=last?.positionChange||0,rate=last?.played&&last.total?last.correct/last.total:null;
 const key=upcoming&&!upcoming.slip&&Date.parse(deadlineOf(upcoming))-now<86400000?'late':
  rate!==null&&rate<=.3?'low':rate!==null&&rate>=.7?'high':change>0?'up':change<0?'down':!last?'welcome':'steady';
 const options=BAR_HOME_QUOTES[key];
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(now);
 const variation=stableHash([user.id,league.id,day,key].join(':'))%options.length;
 return options[variation]({correct:last?.correct,total:last?.total,change:Math.abs(change),next:shortRound(upcoming)});
}

export function leagueDashboard(league,user,source,fantasyAvailable,esc,fmt,competition=null,now=Date.now()){
 const model=dashboardModel(league,user.id,source,now,competition);
 const round=model.lastRound,last=league.progression?.seriea?.history?.find(item=>item.id===round?.id);
 const candidates=(league.rounds||[]).filter(item=>sourceOf(item)==='seriea'&&!item.archived&&item.matches?.length&&Date.parse(deadlineOf(item))>now)
  .sort((a,b)=>Date.parse(deadlineOf(a))-Date.parse(deadlineOf(b)));
 const open=candidates.find(item=>roundAvailability(item,now)==='aperta');
 const live=model.active?model.round:null, upcoming=open||candidates[0];
 const cta=live?{round:live,label:shortRound(live)+' in corso · segui live'}:
  open?{round:open,label:(open.slip?'Rivedi schedina':'Schedina')+(shortRound(open)?' '+shortRound(open):''),deadline:deadlineOf(open)}:
  {label:upcoming?'Prossima giornata':'Schedine in arrivo',deadline:upcoming&&deadlineOf(upcoming),disabled:true};
 const segments=round?matchSegments(round):[];
 return socialHome({mode:'bar',now,reminder:homeReminderBanner('bar',barReminder(league,user.id,now)),
  stories:renderBarStories({league,user,round,history:last,short:shortRound(round),esc,fmt}),
  hero:{title:'Il tuo Quasi dice',quote:quote(user,league,last,open,now),background:quasiHomeBackdrop(user.avatar),art:quasiMascot(user.avatar,user.name),
   chips:`<button type="button" data-dashboard-rank="points" aria-label="Punti, apri la classifica del Bar">${fmt(model.points)} pt${model.pointsRank?' · '+model.pointsRank+'°':''}</button><button type="button" data-dashboard-rank="credits" aria-label="Crediti, apri la classifica del Bar">${fmt(model.credits)} cr</button>`},
  last:round?{title:round.title,action:`data-dashboard-slip="${esc(round.id)}"`,segments,value:last?sign(last.points,fmt)+' pt':null,valueClass:last?.points<0?'loss':last?.points>0?'gain':''}:null,
  cta:{...cta,waiting:cta.disabled,action:cta.round?`data-dashboard-slip="${esc(cta.round.id)}"`:null}
 });
}
