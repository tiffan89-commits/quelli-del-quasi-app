import {predictionStatus} from '../prediction.mjs';
import {rewardById,rewardMark} from './reward-catalog.mjs';
import {renderHomeStories} from './home-stories.mjs';
import {createVerdictCard,creditLeaders,recapForRound,verdictWinnerTitle} from './community.mjs';
import {sourceOf} from './slip-state.mjs';

const score=(value,fmt)=>(value>0?'+':'')+fmt(value);
const points=value=>Math.round(value*100);
export function crossingsFor(league,uid,round,history){
 const members=league.members||[],mine=members.find(member=>member.uid===uid);
 const settled=league.community?.seriea?.history?.find(item=>item.id===round?.id);
 const ownTotal=history?.pointsTotal;
 if(!mine||!settled?.players||!Number.isFinite(mine.points)||!Number.isFinite(ownTotal)||points(mine.points)!==points(ownTotal))return {ahead:[],behind:[]};
 const earned=new Map(settled.players.map(player=>[player.uid,player.points]));
 const old=points(mine.points)-points(earned.get(uid)||0),current=points(mine.points);
 const ahead=[],behind=[];
 for(const member of members){
  if(member.uid===uid||!Number.isFinite(member.points)||member.joinedAt&&Date.parse(member.joinedAt)>Date.parse(round.kickoff))continue;
  const after=points(member.points),before=after-points(earned.get(member.uid)||0);
  if(after<current&&before>=old)ahead.push(member.name);
  if(after>current&&before<=old)behind.push(member.name);
 }
 return {ahead,behind};
}

export function matchSegments(round){
 return (round.matches||[]).map(match=>{
  const saved=round.slip?.picks?.[match.id];
  const outcome=match.status==='LIVE'?null:predictionStatus(match,saved,true);
  const state=outcome?(outcome.winning?'yes':'no'):'pending';
  const label=match.home+' – '+match.away+' · '+(match.void?'Annullata':outcome?(outcome.winning?'Presa':'Sbagliata'):match.score?'Nessuna scelta':'Da giocare');
  return {state,label};
 });
}

export function renderBarStories({league,user,round,history,fmt,esc}){
 const stories=[];
 const community=league.community?.seriea;
 const verdictRound=(league.rounds||[]).filter(r=>sourceOf(r)==='seriea'&&r.settled)
  .sort((a,b)=>Date.parse(b.kickoff)-Date.parse(a.kickoff)||b.number-a.number)[0];
 if(verdictRound){
  const pointsWinners=recapForRound(community,verdictRound)?.winners||[];
  const creditWinners=creditLeaders(community,verdictRound)?.winners||[];
  for(const [id,category,label,winners] of [
   ['winner','points','Punti',pointsWinners],['winner-credits','credits','Crediti',creditWinners],
  ]){
   if(!winners.length)continue;
   stories.push({id,label,title:verdictWinnerTitle(category,winners.length),version:verdictRound.id,
    body:winners.map(uid=>createVerdictCard(league,'seriea',null,uid,verdictRound.id,{embedded:true,category})).join('')});
  }
 }
 if(round){
  const tally=history?.played?history.correct+'/'+history.total+' prese':'';
  const change=history?.positionChange;
  const stats=history?`<dl class="bar-story-stats"><div><dt>Prese</dt><dd>${tally||'In panchina'}</dd></div><div><dt>Punti giornata</dt><dd class="${history.points<0?'loss':'gain'}">${score(history.points,fmt)}</dd></div><div><dt>Bilancio crediti</dt><dd>${score(history.profit,fmt)} cr</dd></div><div><dt>Posizione</dt><dd>${history.position}°${change?' · '+(change>0?'↑ ':'↓ ')+Math.abs(change):''}</dd></div></dl>`:'';
  stories.push({id:'results',label:round.title,title:round.title,body:stats+`<button type="button" class="secondary" data-story-slip="${esc(round.id)}">Risultati e schedina <span aria-hidden="true">→</span></button>`});
 }
 const rewards=(history?.awards||[]).map(rewardById).filter(Boolean);
 if(rewards.length)stories.push({id:'rewards',label:'Bottino',title:'Il bottino della giornata',body:`<ul class="bar-story-rewards">${rewards.map(reward=>`<li>${rewardMark(reward)}<b>${esc(reward.shortName)}</b></li>`).join('')}</ul>`});
 const {ahead,behind}=crossingsFor(league,user.id,round,history);
 if(ahead.length||behind.length)stories.push({id:'crossings',label:'Sorpassi',title:'Sorpassi in classifica',body:[['Hai superato',ahead],['Ti hanno superato',behind]].filter(([,names])=>names.length).map(([heading,names])=>`<section><h3>${heading}</h3><ul>${names.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></section>`).join('')});
 return renderHomeStories({mode:'bar',uid:user.id,scope:league.id+':'+(round?.id||''),stories});
}
