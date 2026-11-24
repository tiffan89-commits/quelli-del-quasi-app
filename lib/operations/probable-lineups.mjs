import {connection} from '../db.mjs';
import {loadProbableLineups,probableLineupsDue} from '../lineups.mjs';
import {barStorageMode} from '../storage-mode.mjs';
import {readCalendarFixtures} from './bar-rows.mjs';
import {patchSports} from './sports-db.mjs';
import {refreshPlayerAvailability} from '../../fanta/player-availability.mjs';
import {enrichPresence,lineupCatalog} from '../lineup-presence.mjs';
import {recordLineupIssues} from './lineup-quality.mjs';

const MINUTE=60000;
const stopped=new Set(['FT','AET','PEN','PST','CANC','ABD','AWD','WO','TIMED_OUT']);
const usable=(match,now)=>!match.storedDataClosure&&!stopped.has(match.status)&&Date.parse(match.kickoff)-now>30*MINUTE&&match.lineups?.kind!=='official';
const timestamp=iso=>Date.parse(iso)||0;

async function getCalendar(ids,connect,sportsStorage){
 const c=await connect();
 try{
  if(sportsStorage==='rows')return await readCalendarFixtures(c,ids);
  const {rows:[row]}=await c.query(`SELECT jsonb_build_object('season',payload#>'{football,calendar,season}',
   'rounds',coalesce((SELECT jsonb_agg(jsonb_build_object('number',r->'number','matches',picked.matches))
    FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r
    CROSS JOIN LATERAL (SELECT jsonb_agg(m) AS matches FROM jsonb_array_elements(r->'matches') m
     WHERE m->>'id'=ANY($1::text[])) picked WHERE picked.matches IS NOT NULL),'[]'::jsonb)) AS calendar
   FROM fanta_state WHERE id=1`,[ids]);
  if(!row)throw Error('Sports state unavailable');
  return row.calendar;
 }finally{c.release();}
}

export async function runProbableLineups(job,{connect=connection,sportsStorage=barStorageMode(),now=Date.now,fetcher=fetch,availabilityProvider,recentFixtures}={}){
 const ids=[...new Set(job.fixtureIds||[])];
 const metrics={scope:'editorial-lineups-only',attempted:0,available:0,saved:0,missing:0};
 if(!ids.length)return {ok:true,metrics};
 const calendar=await getCalendar(ids,connect,sportsStorage);
 const matches=calendar.rounds.flatMap(r=>r.matches);
 const snapshot={football:{calendar}},updates=new Map(),issues=[];
 const started=now(),scheduledAt=job.refreshAvailability?Date.parse(job.at):undefined;
 const season=Number(calendar.season);
 const forMatch=match=>issue=>issues.push({season,round:job.round,fixture:match.id,fixtureApiId:match.apiFootballId??null,source:'Catalogo e probabili',...issue});
 const forecastWindow={maxDays:Infinity,scheduledAt,enrich:false};
 for(const match of matches){
  const at=new Date(started);
  if(!usable(match,+at)||!probableLineupsDue(match,at,forecastWindow))continue;
  const previous=match.lineups;
  await loadProbableLineups(snapshot,match,fetcher,at,{...forecastWindow,report:forMatch(match)});
  const lineups=match.lineups!==previous&&match.lineups?.kind==='probable'?match.lineups:null;
  updates.set(match.id,{checked:match.lineupCheckedAt,lineups});
  metrics.attempted++;
 }
 if(availabilityProvider){
  try{metrics.availability=await refreshPlayerAvailability(matches,{connect,provider:availabilityProvider,season,now:started,recentFixtures});}
  catch(error){metrics.availabilityError=error.code||error.name;}
 }
 const catalogEnabled=process.env.SELFHOST_RUNTIME==='true'||process.env.FANTA_ENABLED==='true'||process.env.DATABASE_URL||process.env.NETLIFY_DB_URL;
 if(availabilityProvider||catalogEnabled&&[...updates.values()].some(u=>u.lineups)){
  const checkedAt=new Date(started).toISOString();
  let catalog;
  try{catalog=await lineupCatalog({connect,season,now:started});}
  catch(error){metrics.catalogError=error.code||error.name;}
  if(catalog)for(const match of matches){
   if(!usable(match,now())||match.lineups?.kind!=='probable'||(!availabilityProvider&&!updates.get(match.id)?.lineups))continue;
   const lineups=enrichPresence(match.lineups,catalog,{fixtureId:match.apiFootballId,report:forMatch(match)});
   updates.set(match.id,{checked:match.lineupCheckedAt,lineups:{...lineups,availabilityCheckedAt:checkedAt}});
  }
 }
 if(issues.length)metrics.qualityIssues=await recordLineupIssues(issues,{connect,now:started});
 if(updates.size){
  const {result}=await patchSports([...updates.keys()],state=>{
   let saved=0;
   for(const target of state.football.calendar.rounds.flatMap(r=>r.matches)){
    const incoming=updates.get(target.id);
    if(!incoming||!usable(target,now()))continue;
    if(timestamp(incoming.checked)>timestamp(target.lineupCheckedAt))target.lineupCheckedAt=incoming.checked;
    const sourceUpdate=timestamp(incoming.lineups?.updatedAt)-timestamp(target.lineups?.updatedAt);
    const availabilityUpdate=timestamp(incoming.lineups?.availabilityCheckedAt)>timestamp(target.lineups?.availabilityCheckedAt);
    if(incoming.lineups&&(sourceUpdate>0||sourceUpdate===0&&availabilityUpdate)){
     target.lineups=incoming.lineups;
     saved++;
    }
   }
   return saved;
  },{connect,sportsStorage,forecastOnly:true});
  metrics.saved=result;
 }
 metrics.available=matches.filter(m=>m.lineups?.kind==='probable'||m.lineups?.kind==='official').length;
 metrics.missing=matches.length-metrics.available;
 return {ok:!metrics.availabilityError,...(metrics.availabilityError?{error:metrics.availabilityError}:{}),metrics};
}
