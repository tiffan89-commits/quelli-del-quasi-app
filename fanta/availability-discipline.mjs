const threshold=cards=>[5,10,14,17].includes(cards)||cards>=19;
const final=new Set(['FT','AET','PEN']);

function fixtureCards(match){
 const events=match.events;
 if(!Array.isArray(events))return {yellow:new Map(),red:new Map(),complete:false};
 const yellow=new Map(),red=new Map(),counts=new Map(),seen=new Set();
 let valid=true;
 for(const event of events){
  if(event.type!=='Card')continue;
  const team=Number(event.team?.id),player=Number(event.player?.id),detail=String(event.detail||'').toLowerCase();
  const key=[team,player,event.time?.elapsed,event.time?.extra,detail].join(':');
  if(seen.has(key))continue;
  seen.add(key);
  if(![match.home_id,match.away_id].includes('af:'+team)||!Number.isSafeInteger(player)||player<1){valid=false;continue;}
  if(detail==='yellow card'){
   yellow.set(player,'af:'+team);
   counts.set(team,(counts.get(team)||0)+1);
  }
  if(detail==='red card'||detail==='second yellow card')red.set(player,'af:'+team);
 }
 const complete=valid&&[match.home_id,match.away_id].every(id=>{
  const team=Number(id.slice(3));
  const stats=match.statistics?.find(s=>Number(s.team?.id)===team)?.statistics;
  const reported=stats?.find(s=>s.type==='Yellow Cards')?.value;
  return Number.isInteger(reported)&&reported===(counts.get(team)||0);
 });
 return {yellow,red,complete};
}

export function availabilityFromCards(history,previousRound){
 const ended=history.filter(m=>final.has(m.status)).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
 const completeRounds=Array.from({length:previousRound},(_,i)=>i+1).every(round=>
  new Set(ended.filter(m=>m.round===round).map(m=>m.id)).size===10);
 const evaluations=ended.map(match=>({match,...fixtureCards(match)}));
 const full=completeRounds&&evaluations.every(row=>row.complete);
 const yellowTotals=new Map(),lastByClub=new Map();
 for(const item of evaluations){
  for(const id of [item.match.home_id,item.match.away_id])lastByClub.set(id,item);
  for(const playerId of item.yellow.keys())yellowTotals.set(playerId,(yellowTotals.get(playerId)||0)+1);
 }
 const reports=[];
 for(const [club,item] of lastByClub){
  if(item.match.round!==previousRound)continue;
  for(const [playerId,team] of item.red)if(team===club)reports.push({
   playerId,clubId:club,type:'suspended',source:'cards',note:'Espulsione nell’ultima partita',
  });
  if(full)for(const [playerId,team] of item.yellow)if(team===club&&!item.red.has(playerId)&&threshold(yellowTotals.get(playerId)))reports.push({
   playerId,clubId:club,type:'suspended',source:'cards',note:'Soglia di ammonizioni raggiunta ('+yellowTotals.get(playerId)+')',
  });
 }
 return {reports,completeCards:full};
}
