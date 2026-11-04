import {isDeepStrictEqual} from 'node:util';
import {connection} from './db.mjs';
import {normalizeTeam} from './calendar.mjs';
import {databaseReadCache} from './read-cache.mjs';
const prefix=season=>'lineup-accuracy:v1:'+season+':';
const iso=value=>new Date(value).toISOString();
function eleven(lineups,match){
 if(!['probable','official'].includes(lineups?.kind)||lineups.teams?.length!==2)return null;
 const teams=['home','away'].map(side=>{
  const candidates=lineups.teams.filter(t=>normalizeTeam(t.team)===normalizeTeam(match[side]));
  if(candidates.length!==1||candidates[0].players?.length!==11)return null;
  const ids=candidates[0].players.map(p=>String(p.apiId||p.playerId||p.id||'').replace(/^(af:|apifootball:|api-football:)/,''));
  if(ids.some(id=>!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0)||new Set(ids.map(Number)).size!==11)return null;
  return {side,club:normalizeTeam(match[side]),ids:ids.map(id=>'af:'+Number(id)).sort()};
 });return teams.every(Boolean)?teams:null;
}
// Freeze the last observed pre-kickoff XI. Never reconstruct it from the result.
export function advanceLineupAccuracy(prior,match,{season=2026,now=Date.now()}={}){
 const kickoff=Date.parse(match.kickoff),teams=eleven(match.lineups,match);if(!match.id||!teams||!Number.isFinite(kickoff))return prior||null;
 const data=prior?structuredClone(prior):{version:1,season,matchId:match.id,kickoff:iso(kickoff)};
 if(prior&&(prior.season!==season||prior.matchId!==match.id))return prior;
 if(match.lineups.kind==='probable'){
  const sourceAt=Date.parse(match.lineups.updatedAt||iso(now));
  if(now>=kickoff||!Number.isFinite(sourceAt)||sourceAt>now||sourceAt>=kickoff||data.official)return prior||null;
  const model=match.lineups.method||'probable-xi';
  if(!isDeepStrictEqual(data.prediction?.teams,teams)||data.prediction?.model!==model){data.kickoff=iso(kickoff);data.prediction={teams,model,observedAt:iso(now),sourceAt:iso(sourceAt)};}
 }else{
  if(!data.prediction||Date.parse(data.prediction.observedAt)>=kickoff||data.prediction.teams.some((t,i)=>t.club!==teams[i].club))return prior||null;
  const incoming=Date.parse(match.lineups.updatedAt||iso(now));if(!Number.isFinite(incoming)||incoming>now||data.official&&incoming<Date.parse(data.official.sourceAt))return prior||null;
  if(!isDeepStrictEqual(data.official?.teams,teams))data.official={teams,observedAt:iso(now),sourceAt:iso(incoming)};
  data.status=match.status||'NS';
  const results=teams.map((team,i)=>({side:team.side,correct:data.prediction.teams[i].ids.filter(id=>team.ids.includes(id)).length,total:11}));
  data.kickoff=iso(kickoff);data.comparison={correct:results.reduce((n,t)=>n+t.correct,0),total:22,teams:results};
 }return data.prediction?data:prior||null;
}
export function summarizeLineupAccuracy(records,{now=Date.now(),minimumMatches=10}={}){
 const matches=[...new Map(records.filter(r=>r.comparison?.total===22&&['LIVE','FT','1H','HT','2H','ET','AET','PEN'].includes(r.status)&&Date.parse(r.kickoff)<=now).map(r=>[r.matchId,r])).values()];
 const total=matches.reduce((n,r)=>n+r.comparison.total,0),correct=matches.reduce((n,r)=>n+r.comparison.correct,0);
 return {visible:matches.length>=minimumMatches,minimumMatches,validMatches:matches.length,teamLineups:matches.length*2,correctPlayers:correct,totalPlayers:total,accuracyPct:total?Math.round(correct/total*1000)/10:null,sufficientSample:matches.length>=minimumMatches,perfectTeamLineups:matches.flatMap(r=>r.comparison.teams).filter(t=>t.correct===11).length};
}
// Existing backend metadata table: one row per fixture, no new periodic job.
export async function recordLineupAccuracy(matches,{connect=connection,season=Number(process.env.FANTA_SEASON||2026),now=Date.now()}={}){
 const eligible=[...new Map(matches.filter(m=>eleven(m.lineups,m)).map(m=>[m.id,m])).values()];
 if(!eligible.length)return {changed:0,captured:0,evaluated:0,providerCalls:0};
 const c=await connect();try{
  await c.query('BEGIN');await c.query("SELECT set_config('lock_timeout','4s',true),pg_advisory_xact_lock(826529)");
  const old=new Map((await c.query('SELECT id,data FROM fanta.jobs WHERE id=ANY($1::text[]) FOR UPDATE',[eligible.map(m=>prefix(season)+m.id)])).rows.map(r=>[r.id,r.data])),updates=[];let captured=0,evaluated=0;
  for(const match of eligible){const id=prefix(season)+match.id,prior=old.get(id),data=advanceLineupAccuracy(prior,match,{season,now});if(!data||isDeepStrictEqual(data,prior))continue;updates.push({id,data});if(data.prediction&&!prior?.prediction)captured++;if(data.comparison&&!isDeepStrictEqual(data.comparison,prior?.comparison))evaluated++;}
  if(updates.length)await c.query('INSERT INTO fanta.jobs(id,data) SELECT id,data FROM jsonb_to_recordset($1::jsonb) AS r(id text,data jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data WHERE fanta.jobs.data IS DISTINCT FROM EXCLUDED.data',[JSON.stringify(updates)]);
  await c.query('COMMIT');return {changed:updates.length,captured,evaluated,providerCalls:0};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
export async function lineupAccuracySummary({connect=connection,season=Number(process.env.FANTA_SEASON||2026),now=Date.now()}={}){
 const c=await connect();try{return summarizeLineupAccuracy((await c.query("SELECT jsonb_build_object('matchId',data->'matchId','kickoff',data->'kickoff','status',data->'status','comparison',data->'comparison') AS data FROM fanta.jobs WHERE id LIKE $1 AND data ? 'comparison'",[prefix(season)+'%'])).rows.map(r=>r.data),{now});}finally{c.release();}
}
export async function publicLineupAccuracy({connect=connection,cache=databaseReadCache(),season=Number(process.env.FANTA_SEASON||2026),now=Date.now()}={}){
 const load=()=>lineupAccuracySummary({connect,season,now}),summary=cache?await cache.read('lineup-accuracy:v1:'+season,'v1',load,{ttl:3600000}):await load();
 return summary.visible?{accuracyPct:summary.accuracyPct,validMatches:summary.validMatches,totalPlayers:summary.totalPlayers,correctPlayers:summary.correctPlayers}:null;
}
export async function seedUpcomingLineupAccuracy({connect=connection,season=Number(process.env.FANTA_SEASON||2026),now=Date.now()}={}){
 const c=await connect();let matches;try{matches=(await c.query(`SELECT m-'details' AS match FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE payload#>>'{football,calendar,season}'=$1 AND m#>>'{lineups,kind}'='probable' AND m->>'kickoff'>$2`,[String(season),iso(now)])).rows.map(r=>r.match);}finally{c.release();}
 return recordLineupAccuracy(matches,{connect,season,now});
}
