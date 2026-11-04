// Diagnostics only: this does not alter votes, bonus rules or missing metrics.
export function finalReadiness(raw,normalized,votes=[]){
 const issues=[];
 for(const team of [raw.teams?.home,raw.teams?.away]){
  const group=(raw.players||[]).find(x=>x.team?.id===team?.id),played=(group?.players||[]).filter(p=>Number(p.statistics?.[0]?.games?.minutes)>0).length;
  if(played<11)issues.push({code:'player-statistics-incomplete',team:team?.name,played,expected:11});
 }
 for(const p of normalized||[]){const vote=votes.find(x=>x.p.id===p.id)?.vote;if(p.onField&&(!p.role||p.needsReview)||vote?.needsReview)issues.push({code:!p.role?'player-role-missing':'player-review-required',playerId:p.id,name:p.name,club:p.club,warnings:p.warnings||[]});}
 return {complete:issues.length===0,issues};
}
