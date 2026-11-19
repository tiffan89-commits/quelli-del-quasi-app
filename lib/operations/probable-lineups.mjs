import {connection} from '../db.mjs';
import {loadProbableLineups,probableLineupsDue} from '../lineups.mjs';
import {barStorageMode} from '../storage-mode.mjs';
import {readCalendarFixtures} from './bar-rows.mjs';
import {patchSports} from './sports-db.mjs';

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

export async function runProbableLineups(job,{connect=connection,sportsStorage=barStorageMode(),now=Date.now,fetcher=fetch}={}){
 const ids=[...new Set(job.fixtureIds||[])];
 const metrics={scope:'editorial-lineups-only',attempted:0,available:0,saved:0,missing:0};
 if(!ids.length)return {ok:true,metrics};
 const calendar=await getCalendar(ids,connect,sportsStorage);
 const matches=calendar.rounds.flatMap(r=>r.matches);
 const snapshot={football:{calendar}},updates=new Map();
 for(const match of matches){
  const at=new Date(now());
  if(!usable(match,+at)||!probableLineupsDue(match,at))continue;
  const previous=match.lineups;
  await loadProbableLineups(snapshot,match,fetcher,at);
  const lineups=match.lineups!==previous&&match.lineups?.kind==='probable'?match.lineups:null;
  updates.set(match.id,{checked:match.lineupCheckedAt,lineups});
  metrics.attempted++;
 }
 if(updates.size){
  const {result}=await patchSports([...updates.keys()],state=>{
   let saved=0;
   for(const target of state.football.calendar.rounds.flatMap(r=>r.matches)){
    const incoming=updates.get(target.id);
    if(!incoming||!usable(target,now()))continue;
    if(timestamp(incoming.checked)>timestamp(target.lineupCheckedAt))target.lineupCheckedAt=incoming.checked;
    if(incoming.lineups&&timestamp(incoming.lineups.updatedAt)>timestamp(target.lineups?.updatedAt)){
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
 return {ok:true,metrics};
}
