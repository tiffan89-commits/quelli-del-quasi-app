import {apiFootballClient} from '../api-football.mjs';
import {ODDS_POLICY,oddsCandidates,collectApiOdds,aggregateApiOdds} from '../api-football-odds.mjs';
import {readOddsSnapshot,persistApiOdds} from './odds-db.mjs';
export async function runOddsOperation(plan,{env=process.env,provider=apiFootballClient({env}),connect,now=Date.now,sportsStorage='snapshot'}={}){
 const at=now(),candidates=oddsCandidates(plan.fixtures,plan.odds,at),metrics={scope:'api-football-prematch-odds',providerCalls:0,fixtures:candidates.length,changed:0,markets:0,conflicts:0};
 try{
 if(!candidates.length)return {ok:true,metrics,odds:{policy:ODDS_POLICY,fixtures:{},lastReport:{at:new Date(at).toISOString(),...metrics}}};
 const snapshot=await readOddsSnapshot(candidates.map(f=>f.id),{connect,sportsStorage}),season=snapshot.season;if(!Number.isInteger(season))throw Error('Stagione quote non disponibile');
 const targets=candidates.filter(f=>snapshot.matches.some(m=>m.id===f.id&&Number(m.apiFootballId)===Number(f.apiId)&&Date.parse(m.kickoff)>at));
 if(!targets.length)return {ok:true,metrics,odds:{policy:ODDS_POLICY,fixtures:{}}};
 const batch=await collectApiOdds(targets,provider,{season,now:at}),updates=[],state={};
 for(const f of targets){const m=snapshot.matches.find(m=>m.id===f.id),row=batch.rows.find(r=>Number(r.fixture.id)===Number(f.apiId)),quotes=row?aggregateApiOdds(row,{now:at,kickoff:m.kickoff,season}):{};if(Object.keys(quotes).length)updates.push({id:f.id,quotes,refresh:f.refresh});
  const covered=[...new Set([...(plan.odds?.fixtures?.[f.id]?.covered||[]),...Object.keys(quotes)])];state[f.id]={covered,...(Object.keys(quotes).length?{refreshedAt:f.refresh?batch.at:plan.odds?.fixtures?.[f.id]?.refreshedAt||batch.at}:plan.odds?.fixtures?.[f.id]?.refreshedAt?{refreshedAt:plan.odds.fixtures[f.id].refreshedAt}:{})};
 }
 const saved=await persistApiOdds(updates,{connect,now:at,sportsStorage});Object.assign(metrics,saved,{providerCalls:batch.calls,quotedFixtures:updates.length,missing:targets.filter(f=>(state[f.id]?.covered?.length||0)<10).length});
 return {ok:true,metrics,odds:{policy:ODDS_POLICY,fixtures:state,lastReport:{at:batch.at,...metrics,remaining:provider.quota?.remaining??null}}};
 }catch(error){const report={at:new Date(at).toISOString(),...metrics,providerCalls:provider.quota?.calls||0};return {ok:false,error:String(error.message||'Recupero quote non riuscito').slice(0,220),metrics:report,odds:{policy:ODDS_POLICY,fixtures:{},lastReport:report}};}

}
