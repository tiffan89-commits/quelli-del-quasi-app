import {apiFootballClient} from '../api-football.mjs';
import {ODDS_POLICY,oddsCandidates,collectApiOdds,aggregateApiOdds} from '../api-football-odds.mjs';
import {readOddsSnapshot,persistApiOdds,readOddsHistory} from './odds-db.mjs';
import {estimateSerieAOdds} from '../seriea-odds-estimate.mjs';
export async function runOddsOperation(plan,{env=process.env,provider=apiFootballClient({env}),connect,now=Date.now,sportsStorage='snapshot',opening}={}){
 const at=now(),candidates=opening
  ?plan.fixtures.filter(f=>opening.fixtureIds.includes(f.id)&&Date.parse(f.kickoff)>at).map(f=>({...f,refresh:true}))
  :oddsCandidates(plan.fixtures,plan.odds,at);
 const metrics={scope:'api-football-prematch-odds',providerCalls:0,fixtures:candidates.length,changed:0,markets:0,conflicts:0};
 try{
 if(!candidates.length)return {ok:true,metrics,odds:{policy:ODDS_POLICY,fixtures:{},lastReport:{at:new Date(at).toISOString(),...metrics}}};
 const snapshot=await readOddsSnapshot(candidates.map(f=>f.id),{connect,sportsStorage}),season=snapshot.season;if(!Number.isInteger(season))throw Error('Stagione quote non disponibile');
 const targets=candidates.filter(f=>snapshot.matches.some(m=>m.id===f.id&&
  (opening||Number(m.apiFootballId)===Number(f.apiId))&&Date.parse(m.kickoff)>at&&['NS','TBD',null,undefined].includes(m.status)));
 if(!targets.length)return {ok:true,metrics,odds:{policy:ODDS_POLICY,fixtures:{}}};
 const apiTargets=targets.map(f=>({...f,apiId:snapshot.matches.find(m=>m.id===f.id).apiFootballId})).filter(f=>Number(f.apiId)>0);
 let batch={rows:[],calls:0,at:new Date(at).toISOString()};
 try{if(apiTargets.length)batch=await collectApiOdds(apiTargets,provider,{season,now:at});}
 catch(error){if(!opening)throw error;metrics.apiError=error.code||error.name;batch.calls=provider.quota?.calls||0;}
 const state={},updates=[],missing=[];
 for(const f of targets){const m=snapshot.matches.find(m=>m.id===f.id),row=batch.rows.find(r=>Number(r.fixture.id)===Number(m.apiFootballId)),quotes=row?aggregateApiOdds(row,{now:at,kickoff:m.kickoff,season}):{};
  updates.push({id:f.id,quotes,refresh:f.refresh});
  if(opening&&m.home&&m.away&&Object.keys(quotes).length<10)missing.push(m);
  const covered=[...new Set([...(plan.odds?.fixtures?.[f.id]?.covered||[]),...Object.keys(quotes)])];state[f.id]={covered,...(Object.keys(quotes).length?{refreshedAt:f.refresh?batch.at:plan.odds?.fixtures?.[f.id]?.refreshedAt||batch.at}:plan.odds?.fixtures?.[f.id]?.refreshedAt?{refreshedAt:plan.odds.fixtures[f.id].refreshedAt}:{})};
 }
 if(missing.length){
  const estimates=estimateSerieAOdds(missing,await readOddsHistory(season,at,{connect,sportsStorage}),at);
  for(const update of updates)update.quotes={...estimates.get(update.id),...update.quotes};
 }
 const priced=updates.filter(u=>Object.keys(u.quotes).length);
 const saved=await persistApiOdds(priced,{connect,now:now(),sportsStorage});Object.assign(metrics,saved,{providerCalls:batch.calls,quotedFixtures:priced.length,missing:targets.filter(f=>(state[f.id]?.covered?.length||0)<10).length});
 return {ok:true,metrics,odds:{policy:ODDS_POLICY,fixtures:state,lastReport:{at:batch.at,...metrics,remaining:provider.quota?.remaining??null}}};
 }catch(error){const report={at:new Date(at).toISOString(),...metrics,providerCalls:provider.quota?.calls||0};return {ok:false,error:String(error.message||'Recupero quote non riuscito').slice(0,220),metrics:report,odds:{policy:ODDS_POLICY,fixtures:{},lastReport:report}};}

}
