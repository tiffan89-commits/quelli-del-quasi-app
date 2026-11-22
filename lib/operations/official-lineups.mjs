import {officialLineups,sameOfficialLineups} from '../official-lineups.mjs';
import {API_FOOTBALL_SOURCE} from '../api-football.mjs';
import {loadSkyLineups} from '../lineups.mjs';
import {patchSports} from './sports-db.mjs';
import {recordLineupIssues} from './lineup-quality.mjs';

const complete=lineups=>lineups?.kind==='official'&&lineups.teams?.length===2&&lineups.teams.every(t=>t.players?.length===11);
const primary=lineups=>complete(lineups)&&lineups.source===API_FOOTBALL_SOURCE;
const sameKickoff=(match,fixture)=>Date.parse(match.officialKickoff||match.kickoff)===Date.parse(fixture.kickoff);

export async function runOfficialLineups(job,plan,{connect,provider,now=Date.now,sportsStorage='snapshot',onSaved,skyFetcher,season=2026}={}){
 const fixtures=plan.fixtures.filter(f=>job.fixtureIds.includes(f.id)),c=await connect();let cached;
 try{
  const sql=sportsStorage==='rows'
   ? "SELECT id,data->'lineups' AS lineups FROM fanta.bar_seriea_matches WHERE id=ANY($1::text[])"
   : `SELECT m->>'id' AS id,m->'lineups' AS lineups FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])`;
  cached=(await c.query(sql,[job.fixtureIds])).rows;
 }finally{c.release();}
 const updates=new Map(),resolved=new Set(),issues=[];
 const calendar={season,rounds:[...Map.groupBy(fixtures,f=>f.round)].map(([number,matches])=>({number,matches}))};
 const metrics={scope:'official-lineups-only',fixtures:fixtures.length,skyChecks:0,skyPublished:0,apiUnavailable:0,apiIncomplete:0};
 for(const f of fixtures){
  const old=cached.find(m=>m.id===f.id)?.lineups;
  if(primary(old)){resolved.add(f.id);continue;}
  const report=source=>issue=>issues.push({season,round:f.round,fixture:f.id,fixtureApiId:f.apiId,source,...issue});
  const apiRequest=f.apiId?provider.get('fixtures/lineups?fixture='+f.apiId).catch(()=>{metrics.apiUnavailable++;return null;}):null;
  let skyRequest=null;
  if(skyFetcher&&!complete(old)){
   metrics.skyChecks++;
   skyRequest=loadSkyLineups(f,calendar,{fetcher:skyFetcher,report:report('Sky Sport')}).catch(()=>null);
  }
  const [data,sky]=await Promise.all([apiRequest,skyRequest]),at=new Date(now()).toISOString();
  const parsed=data&&officialLineups({teams:{home:{name:f.home},away:{name:f.away}},lineups:data.response},at,{report:report('API-Football /fixtures/lineups')});
  if(parsed)updates.set(f.id,{fixture:f,lineups:parsed,raw:data.response});
  else{
   if(data)metrics.apiIncomplete++;
   if(complete(sky))updates.set(f.id,{fixture:f,lineups:{...sky,updatedAt:at}});
  }
 }
 let saved=[];
 if(updates.size){
  const {result}=await patchSports([...updates.keys()],s=>{
   const stored=[];
   for(const m of s.football.calendar.rounds.flatMap(r=>r.matches)){
    const next=updates.get(m.id);
    if(!next||!sameKickoff(m,next.fixture))continue;
    if(!next.raw&&complete(m.lineups))continue;
    if(next.raw&&primary(m.lineups)&&Date.parse(m.lineups.updatedAt)>Date.parse(next.lineups.updatedAt)){
     resolved.add(m.id);
     continue;
    }
    const changed=!sameOfficialLineups(m.lineups,next.lineups);
    if(changed)m.lineups={...next.lineups,updatedAt:new Date(Math.max(Date.parse(next.lineups.updatedAt),(Date.parse(m.lineups?.updatedAt)||0)+1)).toISOString()};
    stored.push({...next,id:m.id,revision:m.lineups.updatedAt,changed});
   }
   return stored;
  },{connect,sportsStorage,forecastOnly:true,persistRelated:async(db,stored)=>{
   for(const update of stored.filter(x=>x.raw))await db.query(`UPDATE fanta.fixtures SET data=jsonb_set(data,'{lineups}',$2::jsonb) WHERE api_id=$1 AND frozen_at IS NULL AND data->'lineups' IS DISTINCT FROM $2::jsonb`,[update.fixture.apiId,JSON.stringify(update.raw)]);
  }});
  for(const item of result)if(item.raw)resolved.add(item.id);else metrics.skyPublished++;
  saved=result.filter(x=>x.changed).map(({id,revision})=>({id,revision}));
  if(saved.length)await onSaved?.(saved);
 }
 const pending=fixtures.filter(f=>!resolved.has(f.id)).map(f=>f.id);
 const qualityIssues=await recordLineupIssues(issues,{connect,now:now()});
 return {ok:!pending.length,...(pending.length?{error:'official-lineups-provider-pending'}:{}),retryable:!!pending.length,pendingFixtureIds:pending,fixtures:[...resolved].map(id=>({id,officialLineups:true})),metrics:{...metrics,providerCalls:provider.quota?.calls||0,official:resolved.size,saved:saved.length,pending:pending.length,...(qualityIssues?{qualityIssues}:{})}};
}
