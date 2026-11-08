// Count actual effective players, including replacements, rather than inferring votes from a score.
export function effectiveVoteCount(side){
 if(!Array.isArray(side?.starters))return null;
 const players=[...side.starters.filter(p=>!p.replacedBy),...(side.bench||[]).filter(p=>p.enteredFor)];
 const seen=new Set();return players.filter(p=>{if(seen.has(p.id)||!Number.isFinite(p.vote))return false;seen.add(p.id);return true;}).length;
}
export function withHomeVotes(home,matchup){
 if(!home?.match?.live||!matchup)return home;
 const match={...home.match,live:{...home.match.live}};
 for(const key of ['home','away']){const side=matchup[key],dest=home.match.home?.id===side?.team?.id?'home':home.match.away?.id===side?.team?.id?'away':null;
  const count=effectiveVoteCount(side);if(dest&&count!==null)match.live[dest]={...match.live[dest],withVote:count,played:count,goals:side.goals,points:side.total??side.points??match.live[dest]?.points};}
 return {...home,match};
}
