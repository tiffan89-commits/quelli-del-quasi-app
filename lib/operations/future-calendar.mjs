import {beginBackgroundWrite} from './background-db.mjs';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {connection} from '../db.mjs';
// Called once by a morning verification. Existing betting deadlines are preserved.
export async function refreshFutureCalendar(provider,{connect=connection,now=Date.now(),season=2026,sportsStorage='snapshot'}={}){
 const data=await provider.get(`fixtures?league=135&season=${season}`),known=JSON.parse(readFileSync(resolve('lib/operations/bootstrap-calendar.json'),'utf8')).flatMap(r=>r.matches.map(m=>({...m,round:r.number}))),updates=[];
 for(const raw of data.response||[]){const k=Date.parse(raw.fixture?.date),m=known.find(m=>Number(m.apiFootballId)===raw.fixture?.id);if(!m||!Number.isFinite(k)||k<=now||k>now+21*86400000)continue;updates.push({id:m.id,apiId:raw.fixture.id,round:m.round,home:m.home,away:m.away,kickoff:new Date(k).toISOString(),status:raw.fixture.status.short});}
 if(!updates.length)return updates;
 const times=Object.fromEntries(updates.map(f=>[f.id,f.kickoff])),c=await connect();try{
  if(sportsStorage==='rows'){
   await beginBackgroundWrite(c);
   await c.query('SELECT pg_advisory_xact_lock(826501)');
   await c.query(`UPDATE fanta.bar_seriea_matches SET data=data||jsonb_build_object(
    'kickoff',$1::jsonb->id,'officialKickoff',$1::jsonb->id)
    WHERE $1::jsonb?id AND (data->'kickoff' IS DISTINCT FROM $1::jsonb->id
     OR data->'officialKickoff' IS DISTINCT FROM $1::jsonb->id)`,[JSON.stringify(times)]);
   await c.query('COMMIT');
   return updates;
  }
  await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{football,calendar,rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',(SELECT jsonb_agg(CASE WHEN $1::jsonb?(m->>'id') THEN m||jsonb_build_object('kickoff',$1::jsonb->(m->>'id'),'officialKickoff',$1::jsonb->(m->>'id')) ELSE m END) FROM jsonb_array_elements(r->'matches') m))) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r)) WHERE id=1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE $1::jsonb?(m->>'id') AND (m->'kickoff' IS DISTINCT FROM $1::jsonb->(m->>'id') OR m->'officialKickoff' IS DISTINCT FROM $1::jsonb->(m->>'id')))`,[JSON.stringify(times)]);
 }catch(error){if(sportsStorage==='rows')await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
 return updates;
}
