import {groupMatches} from '../match-layout.mjs';
import {calendarSections} from './calendar-order.mjs';
import {clubShirt} from './club-crest.mjs';
import {esc} from './fanta/formato.mjs';
import {fitTeamName} from './fanta/team-name.mjs';
import {roundCalendar} from './round-calendar.mjs';
import {barKickoff,inlineResultView} from './slip-results.mjs';

const finalStatuses=new Set(['FT','AET','PEN','AWD','WO']);
const liveStatuses=new Set(['LIVE','1H','HT','2H','ET','BT','P','INT']);
const cancelledStatuses=new Set(['CANC','ABD','VOID']);
const statusLabels={PST:'Rinviata',SUSP:'Sospesa'};
const calendarDate=new Intl.DateTimeFormat('it-IT',{
 weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Rome'
});
const validScore=score=>Array.isArray(score)&&score.length===2&&score.every(n=>Number.isInteger(n)&&n>=0);
const finalScore=match=>finalStatuses.has(match.status)&&validScore(match.score)?match.score:null;
export const calendarMatchTab=match=>liveStatuses.has(match.status)?'cronaca':'formazioni';

function matchRow(match){
 const {home,away}=match,score=finalScore(match),live=liveStatuses.has(match.status);
 const liveResult=live?inlineResultView({status:'LIVE',liveScore:validScore(match.liveScore)?match.liveScore:null,clock:match.clock}):'';
 const {kickoff,timeLabel}=barKickoff(match);
 const status=statusLabels[match.status]||(match.void||cancelledStatuses.has(match.status)?'Annullata':'');
 const pending=status?`<small>${esc(status)}</small>`:timeLabel?`<time datetime="${esc(kickoff)}">${esc(timeLabel)}</time>`:'';
 return `<li><button type="button" class="fanta-cal-match${live?' is-live':''}" data-bar-calendar-match="${esc(match.id)}">
  <span class="fanta-cal-team">${clubShirt(home,{vs:away,home:true})}${fitTeamName(home)}</span>
  <span class="fanta-cal-score">${liveResult||(score?`<strong>${score.join('–')}</strong>`:pending)}</span>
  <span class="fanta-cal-team is-away">${fitTeamName(away)}${clubShirt(away,{vs:home,home:false})}</span>
 </button></li>`;
}

function datesAndMatches(round){
 return groupMatches(round.matches,match=>match.kickoff||match.officialKickoff).map(({key,matches})=>{
  const reference=key==='unknown';
  const date=reference?round.date:key;
  const heading=Number.isFinite(Date.parse(date))?`<li><h3 class="ticket-day">${reference?'Data del turno · ':''}<time datetime="${esc(date)}">${esc(calendarDate.format(new Date(date)))}</time></h3></li>`:'';
  return heading+matches.map(matchRow).join('');
 }).join('');
}

export function serieACalendar(calendar,{openRound=null,now=Date.now()}={}){
 if(!calendar?.rounds?.length)return '<section class="fanta-block is-first"><p class="fanta-note">Calendario di Serie A in aggiornamento.</p></section>';
 const current=calendarSections(calendar.rounds,calendar,new Date(now)).find(group=>group.kind==='current')?.rounds[0]?.number;
 const rounds=calendar.rounds.map(round=>{
  const matches=round.matches||[],complete=matches.length>0&&matches.every(match=>finalScore(match)||match.void||cancelledStatuses.has(match.status));
  const started=matches.some(match=>finalScore(match)||liveStatuses.has(match.status));
  return {...round,matches,state:complete?'calcolata':started?'in-corso':'futura',stateLabel:complete?'Conclusa':undefined};
 });
 const open=openRound??(rounds.find(r=>r.number===current&&r.state!=='calcolata')?.number);
 return `<section class="fanta-block is-first" aria-label="Calendario di Serie A">${roundCalendar(rounds,{bar:true,current,open,rows:datesAndMatches})}</section>`;
}
