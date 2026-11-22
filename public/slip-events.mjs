import {fantasyWalletKey} from './src/fantasy-accounts.mjs';
const beforeKickoff=new Set(['NS','TBD','SCHEDULED']);
export function eventDeadline(round,match){
 const exact=round?.source==='fantacalcio'?match?.kickoff:match?.officialKickoff||match?.kickoff;
 if(exact)return Date.parse(exact);
 if(match&&(Object.hasOwn(match,'kickoff')||Object.hasOwn(match,'officialKickoff')))return NaN;
 return Date.parse(round?.deadline||round?.kickoff);
}
export function eventLocked(round,match,now=Date.now()){
 if(!match||match.void||round?.waitingForOpen||round?.archived||round?.settled||round?.sourceConflict||round?.calculated&&round?.source==='fantacalcio')return true;
 const at=eventDeadline(round,match);
 return !!(match.score||match.liveScore||match.status&&!beforeKickoff.has(match.status)||!Number.isFinite(at)||now>=at);
}
export function noOpenEvents(round,now=Date.now()){
 return !round?.matches?.some(match=>!eventLocked(round,match,now));
}
export function stakeLocked(round,picks=round?.slip?.picks,now=Date.now()){
 return !!picks&&round.matches.some(match=>!match.void&&Object.hasOwn(picks,match.id)&&eventLocked(round,match,now));
}
export function eventCountdown(at,now=Date.now()){
 const seconds=Math.max(0,Math.ceil((at-now)/1000)),mins=Math.floor(seconds/60),hours=Math.floor(mins/60),pad=n=>String(n).padStart(2,'0');
 return hours>=24?Math.floor(hours/24)+'g '+pad(hours%24)+':'+pad(mins%60):pad(hours)+':'+pad(mins%60)+':'+pad(seconds%60);
}
export function playableEventRound(round){
 return !!round&&!round.archived&&(round.source!=='fantacalcio'||!!round.nativeFanta);
}

export function slipCreditReserve(round,rounds,league,uid){
 if(round.pointsOnly)return 0;
 const fantasy=!!round.virtualBookmaker,wallet=fantasy?fantasyWalletKey(round,league):null;
 const season=r=>r.season??/^seriea:(\d+):/.exec(r.sourceId||'')?.[1];
 const later=r=>{
  if(fantasy&&r.serieARound!=null&&round.serieARound!=null)return Number(r.serieARound)>Number(round.serieARound);
  if((!fantasy||r.competitionKey===round.competitionKey)&&r.number!=null&&round.number!=null)return Number(r.number)>Number(round.number);
  return Date.parse(r.kickoff)>Date.parse(round.kickoff);
 };
 return rounds.filter(r=>{
  if(r===round||r.id===round.id||r.pointsOnly||r.archived||r.league&&league?.id&&r.league!==league.id||!!r.virtualBookmaker!==fantasy)return false;
  if(fantasy?fantasyWalletKey(r,league)!==wallet:r.source==='fantacalcio')return false;
  if(season(round)!=null&&season(r)!=null&&String(season(round))!==String(season(r)))return false;
  const remaining=r.stakeReserveOpen??(!r.settled&&r.matches?.some(match=>!match.void));
  return remaining&&later(r)&&!((r.slip??r.slips?.find(s=>s.uid===uid))?.stake>0);
 }).length;
}

export function slipStakeLimit(credits,savedStake=0,reserve=0){
 return Math.max(0,savedStake,Math.round((credits+savedStake-reserve)*100)/100);
}
