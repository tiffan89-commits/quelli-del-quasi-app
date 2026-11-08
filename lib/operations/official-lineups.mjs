import {officialLineups,sameOfficialLineups} from '../official-lineups.mjs';
import {patchSports} from './sports-db.mjs';

export async function runOfficialLineups(job,plan,{connect,provider,now=Date.now,sportsStorage='snapshot'}={}){
 const fixtures=plan.fixtures.filter(f=>job.fixtureIds.includes(f.id)),c=await connect();let cached;
 try{
  const sql=sportsStorage==='rows'
   ? "SELECT id,data->'lineups' AS lineups FROM fanta.bar_seriea_matches WHERE id=ANY($1::text[])"
   : `SELECT m->>'id' AS id,m->'lineups' AS lineups FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])`;
  cached=(await c.query(sql,[job.fixtureIds])).rows;
 }finally{c.release();}
 const updates=[],pending=[],resolved=[];
 for(const f of fixtures){
  const old=cached.find(m=>m.id===f.id)?.lineups;
  if(old?.kind==='official'&&old.teams?.length===2&&old.teams.every(t=>t.players?.length===11)){resolved.push(f.id);continue;}
  if(!f.apiId){pending.push(f.id);continue;}
  const data=await provider.get('fixtures/lineups?fixture='+f.apiId),at=new Date(now()).toISOString();
  const parsed=officialLineups({teams:{home:{name:f.home},away:{name:f.away}},lineups:data.response},at);
  if(!parsed){pending.push(f.id);continue;}
  updates.push({fixture:f,lineups:parsed,raw:data.response});resolved.push(f.id);
 }
 if(updates.length){
  await patchSports(updates.map(x=>x.fixture.id),s=>{for(const m of s.football.calendar.rounds.flatMap(r=>r.matches)){const next=updates.find(x=>x.fixture.id===m.id);if(next&&!sameOfficialLineups(m.lineups,next.lineups))m.lineups=next.lineups;}},{connect,sportsStorage});
  const db=await connect();try{for(const update of updates)await db.query(`UPDATE fanta.fixtures SET data=jsonb_set(data,'{lineups}',$2::jsonb) WHERE api_id=$1 AND data->'lineups' IS DISTINCT FROM $2::jsonb`,[update.fixture.apiId,JSON.stringify(update.raw)]);}finally{db.release();}
 }
 return {ok:pending.length===0,retryable:pending.length>0,pendingFixtureIds:pending,fixtures:resolved.map(id=>({id,officialLineups:true})),metrics:{scope:'official-lineups-only',providerCalls:provider.quota?.calls||0,fixtures:fixtures.length,official:resolved.length,saved:updates.length,pending:pending.length}};
}
