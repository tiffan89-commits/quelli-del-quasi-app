const beforeKickoff=new Set(['NS','TBD','SCHEDULED']);
export function eventDeadline(round,match){
 const exact=match?.kickoff||match?.officialKickoff;
 if(exact)return Date.parse(exact);
 if(match&&(Object.hasOwn(match,'kickoff')||Object.hasOwn(match,'officialKickoff')))return NaN;
 return Date.parse(round?.deadline||round?.kickoff);
}
export function eventLocked(round,match,now=Date.now()){
 if(!match||match.void||round?.archived||round?.settled||round?.sourceConflict||round?.calculated&&round?.source==='fantacalcio')return true;
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
