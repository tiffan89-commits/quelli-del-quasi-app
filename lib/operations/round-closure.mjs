import {computeRounds} from '../../fanta/ingest.mjs';
import {syncNativeBar} from '../../fanta/bar.mjs';
import {configuredVotes,currentModelKey} from '../../fanta/statistical-votes/repository.mjs';
import {patchSports} from './sports-db.mjs';
import {updateDerived} from './derived-db.mjs';
import {voidUnpricedPicks} from '../game.mjs';

const finished=new Set(['FT','AET','PEN']);
const unavailable=new Set(['PST','CANC','ABD','AWD','WO']);
const validScore=score=>Array.isArray(score)&&score.length===2&&score.every(n=>Number.isInteger(n)&&n>=0);

export function closeBarMatches(state,job){
 const matches=state.football.calendar.rounds.find(r=>Number(r.number)===job.round)?.matches||[];
 const ids=new Set(job.fixtureIds);
 const targets=matches.filter(m=>ids.has(m.id));
 if(targets.length!==ids.size||Number(state.football.calendar.season)!==job.season)throw Error('Incomplete stored calendar for round closure');

 const voidIds=new Set();
 for(const m of targets){
  if(!m.void&&!m.scoreConflict&&finished.has(m.status)&&validScore(m.score)){
   Object.assign(m,{status:'FT',officialConfirmed:true,liveScore:null,clock:null,phase:'Finale'});
  }else{
   voidIds.add(m.id);
   if(!unavailable.has(m.status))m.status='ABD';
   Object.assign(m,{score:null,liveScore:null,clock:null,phase:'Risultato non disponibile',officialConfirmed:false});
  }
  m.storedDataClosure=job.cutoffAt;
 }
 for(const round of state.rounds.filter(r=>!r.settled)){
  for(const match of round.matches){
   if(voidIds.has(match.id))match.void=true;
  }
  voidUnpricedPicks(round,ids);
 }
 return {closed:targets.length,voided:voidIds.size};
}

export async function closeRoundFromStorage(job,{connect,env,now,sportsStorage}){
 if(!Number.isInteger(job.round)||job.fixtureIds?.length!==10||new Set(job.fixtureIds).size!==10||!Number.isFinite(Date.parse(job.cutoffAt))||Date.parse(job.cutoffAt)>now())throw Error('Invalid stored-data round closure');
 const season=Number(env.FANTA_SEASON||2026);
 const saved=await patchSports(job.fixtureIds,state=>closeBarMatches(state,{...job,season}),{connect,sportsStorage});
 const derived=saved.derive?await updateDerived(job.fixtureIds,{connect,sportsStorage}):null;

 let fantaRounds=0,barChanges=0;
 if(env.FANTA_ENABLED==='true'){
  const modelKey=currentModelKey(configuredVotes(env));
  fantaRounds=await computeRounds({connect,now,modelKey,season,serieARounds:[job.round],closeWithStoredVotesAt:job.cutoffAt});
  const c=await connect();let leagueIds;
  try{
   const {rows}=await c.query(`SELECT DISTINCT r.league_id FROM fanta.rounds r
    JOIN fanta.leagues l ON l.id=r.league_id
    JOIN fanta.bar_links b ON b.competition_id=r.competition_id AND b.active
    WHERE l.season=$1 AND r.seriea_round=$2 AND r.official
      AND l.rules->>'disabledAt' IS NULL`,[season,job.round]);
   leagueIds=rows.map(r=>r.league_id);
  }finally{c.release();}
  for(const id of leagueIds){
   const bar=await syncNativeBar({connect,now:now(),onlyLeagueIds:[id],onlySerieARound:job.round,sportsStorage});
   barChanges+=bar.changed;
  }
 }
 return {matches:saved.matches,fixtures:saved.result.closed,voided:saved.result.voided,fantaRounds,barChanges,derived};
}
