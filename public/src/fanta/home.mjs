import {esc,pts,countdown,OUTCOME} from './formato.mjs';
import {socialHome} from '../home-social.mjs';
import {homeReminderBanner} from '../president-reminders.mjs';
import {renderHomeStories} from '../home-stories.mjs';
import {teamLogo} from './team-logo.mjs';
import {fitTeamName} from './team-name.mjs';
import {FANTA_HOME_QUOTES} from './home-quotes.mjs';

export function homeTeam(h){
 const id=h?.me?.teamId;
 return [h?.match?.home,h?.match?.away,...(h?.standings||[]).map(s=>s.team)].find(t=>t?.id===id)||{id,name:h?.me?.teamName||'La tua squadra',branding:h?.me?.branding||{}};
}

const roundAction=(round,matchup)=>`data-go="giornata" data-round="${esc(round)}"${matchup?` data-mu="${esc(matchup)}"`:''}`;
const storyButton=(action,label,round='',matchup='')=>`<button type="button" class="secondary" data-home-action="${action}" data-round="${esc(round)}" data-mu="${esc(matchup)}">${label} <span aria-hidden="true">→</span></button>`;
const otherTeam=(match,id)=>!match||!id?null:match.home?.id===id?match.away:match.away?.id===id?match.home:null;
const fixtureOpponent=(fixture,id)=>otherTeam({home:fixture?.home?.team,away:fixture?.away?.team},id);
const number=v=>Number.isFinite(v);
const credits=new Intl.NumberFormat('it-IT',{maximumFractionDigits:2});
const fp=v=>number(v)?pts(v)+' fp':'';
const playersList=(players,value)=>`<ul class="home-story-players">${players.map(p=>`<li><span>${esc(p.name)}</span><b>${value(p)}</b></li>`).join('')}</ul>`;
const statusLabel=form=>form.map(outcome=>OUTCOME[outcome]).filter(Boolean).join(' · ');

export function nextHomeOpponent(h){
 const next=h.nextLineup?.round??(!['in-corso','calcolata'].includes(h.round.state)?h.round.number:null);
 if(next===h.round.number)return otherTeam(h.match,h.me.teamId);
 return fixtureOpponent(h.storyData?.nextFixture,h.me.teamId);
}

function storyItems(h){
 const last=h.lastResult, ownTeam=h.me.teamId, items=[];
 const scores=h.roundScores;
 const entries=(scores?.entries||[]).filter(entry=>number(entry.points));
 if(entries.length>1){
  const values=entries.map(entry=>entry.points);
  const day=scores.label||'Giornata '+scores.round;
  for(const [id,label,title,value] of [
   ['fanta-best','Miglior FP','Miglior fantapunteggio',Math.max(...values)],
   ['fanta-worst','Peggior FP','Peggior fantapunteggio',Math.min(...values)],
  ]){
   const cards=entries.filter(entry=>entry.points===value).map(({team,points,matchupId})=>
    `<article class="home-round-score">
     <div class="home-round-score-team">${teamLogo(team,{eager:true})}<h3>${esc(team.name)}</h3></div>
     <p><strong>${pts(points,2)}</strong> fantapunti</p>
     ${storyButton('giornata','Apri il tabellino',scores.round,matchupId)}
    </article>`).join('');
   items.push({id,label,title,version:scores.round,body:`<p class="home-round-score-day">${esc(day)}</p>${cards}`});
  }
 }
 if(number(last?.round)&&number(last.home?.goals)&&number(last.away?.goals)){
  const own=last.home.id===ownTeam?last.home:last.away, data=h.storyData?.lastMatch;
  const sheet=[data?.home,data?.away].find(side=>side?.team?.id===ownTeam);
  const starters=sheet?.starters||[];
  const scorers=[...starters.filter(p=>!p.replacedBy),...(sheet?.bench||[]).filter(p=>p.enteredFor)].filter(p=>p.events?.goals>0);
  const info=`<p class="home-story-score">${fitTeamName(last.home.name)}<b>${last.home.goals}–${last.away.goals}</b>${fitTeamName(last.away.name)}</p>${number(own?.points)?`<p>${fp(own.points)}</p>`:''}`;
  const details=(scorers.length?`<h3>Marcatori</h3>${playersList(scorers,p=>p.events.goals)}`:'' )+(starters.length?`<section class="home-story-votes"><h3>Voti dei titolari</h3>${playersList(starters,p=>number(p.vote)?pts(p.vote):'s.v.')}</section>`:'');
  items.push({id:'results',version:last.matchupId||last.round,label:'Giornata '+last.round,title:'Giornata '+last.round,body:info+details+storyButton('giornata','Apri il tabellino',last.round,last.matchupId)});
  const voted=[...starters.filter(p=>!p.replacedBy),...(sheet?.bench||[]).filter(p=>p.enteredFor)].filter(p=>number(p.fantavote)).sort((a,b)=>b.fantavote-a.fantavote);
  if(voted.length>=4)items.push({id:'top',version:last.matchupId||last.round,label:'Top e flop',title:'Top e flop',body:'<h3>Top</h3>'+playersList(voted.slice(0,2),p=>pts(p.fantavote))+'<h3>Flop</h3>'+playersList(voted.slice(-2).reverse(),p=>pts(p.fantavote))});
 }
 const opponent=nextHomeOpponent(h),row=h.standings?.find(entry=>entry.team.id===opponent?.id);
 if(opponent)items.push({id:'opponent',version:(h.nextLineup?.round??h.round.number)+':'+opponent.id,label:'Avversario',title:opponent.name,body:
  (row?.position?`<p>${row.position}° in classifica</p>`:'')+(row?.form?.length?`<p>Ultime cinque · ${esc(statusLabel(row.form.slice(-5)))}</p>`:'')});
 const auction=h.auction?.status==='running',trades=h.storyData?.tradeCount||0;
 if(auction||trades)items.push({id:'market',version:[auction?h.auction?.startsAt||h.auction?.type||'asta':'',trades?h.storyData?.tradeVersion||trades:''].join(':'),label:'Mercato',title:'Mercato in corso',body:
  (auction?storyButton('asta','Entra nell’asta'):'')+(trades?`<p>${trades} ${trades===1?'proposta in attesa':'proposte in attesa'}</p>`+storyButton('scambi','Apri gli scambi'):'')});
 return items;
}

const formStates={V:'yes',N:'draw',P:'no'};
export function renderHome(h,now=Date.now()){
 const last=number(h.lastResult?.round)?h.lastResult:null,team=homeTeam(h),round=h.round,live=round.state==='in-corso';
 const next=h.nextLineup??{round:round.number,deadline:round.deadline,savedAt:h.lineup?.savedAt};
 const hasLineup=!!next.savedAt||(!h.nextLineup&&round.state==='schierata');
 const open=Date.parse(next.deadline)>now&&['da-schierare','schierata','calcolata','in-corso'].includes(round.state)&&(h.nextLineup||round.state==='da-schierare'||round.state==='schierata');
 const liveKey=h.match?.home?.id===h.me.teamId?'home':'away';
 const liveOwn=h.match?.live?.[liveKey];
 const rival=otherTeam(last,h.me.teamId);
 const away=last?.away?.id===h.me.teamId;
 const ownGoals=away?last?.away?.goals:last?.home?.goals, rivalGoals=away?last?.home?.goals:last?.away?.goals;
 const outcome={V:'win',N:'draw',P:'loss'}[last?.outcome];
 const quote=FANTA_HOME_QUOTES[open&&!hasLineup&&Date.parse(next.deadline)-now<86400000?'late':outcome||'start'](rival?.name);
 const form=h.me.form?.slice(-5)||[];
 const segments=Array.from({length:5},(_,i)=>{
  const result=form[i-(5-form.length)];
  return {state:formStates[result]||'pending',label:OUTCOME[result]||'Da giocare'};
 });
 const balances=[number(h.balances?.slip)?credits.format(h.balances.slip)+' cr schedina':'',number(h.balances?.auction)?credits.format(h.balances.auction)+' cr asta':''].filter(Boolean);
 const cta=h.openingLineup?{label:'Apertura formazione…',disabled:true,busy:true}:
  h.competition?.status==='draft'?{label:'Vedi la competizione',action:'data-go="competizioni"'}:
  live?{label:'Giornata '+round.number+' live'+(number(liveOwn?.points)?' · '+fp(liveOwn.points)+' parziali':''),action:roundAction(round.number,h.match?.id||h.match?.matchupId||h.storyData?.liveMatchup)}:
  open?{label:(hasLineup?'✓ Formazione':'Schiera la formazione')+' · Giornata '+next.round,warning:!hasLineup,deadline:next.deadline,action:'data-go="formazione"'}:
  {label:'Prossima giornata',disabled:true,waiting:true,deadline:[h.nextLineup?.deadline,round.firstKickoff].find(time=>Date.parse(time)>now)};
 return socialHome({mode:'fanta',now,reminder:homeReminderBanner('fanta',h.reminder),stories:renderFantaStories(h),hero:{
  title:h.me.teamName+(h.league.season?' · '+h.league.season:''),quote,
  chips:`<span>${esc(h.me.position)}° · ${pts(h.me.points)} pt</span><span>${pts(h.me.fantapoints)} fp</span>`,
  art:`<button type="button" class="bar-home-mascot home-team-crest" data-action="edit-logo" aria-label="Modifica lo stemma di ${esc(team.name)}">${teamLogo(team,{eager:true})}<span class="home-edit-mark" aria-hidden="true">✎</span></button>`
 },last:last||balances.length?{
  title:last?'Giornata '+last.round:'Ultime cinque',opponent:last?(rival?.name||last.away?.name):null,
  value:number(ownGoals)&&number(rivalGoals)?ownGoals+'–'+rivalGoals:null,
  action:last?roundAction(last.round,last.matchupId):'data-go="squadra"',
  segments,segmentLabel:'Ultime cinque',
  footer:`<span class="home-last-footer"><span>Ultime cinque</span><span>${balances.join(' · ')}</span></span>`
 }:null,cta});
}

export function renderFantaStories(h){
 return renderHomeStories({mode:'fanta',uid:h.viewerId||h.me.teamId,scope:h.league.id+':'+(h.competition?.id||''),stories:storyItems(h)});
}

export function tickCountdowns(root,now=Date.now()){
 for(const el of root.querySelectorAll('[data-countdown]'))el.textContent=countdown(el.dataset.countdown,now)||'chiusa';
}
