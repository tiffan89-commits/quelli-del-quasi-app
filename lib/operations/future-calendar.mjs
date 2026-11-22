import {beginBackgroundWrite} from './background-db.mjs';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {connection} from '../db.mjs';
import {refreshCachedFootballMatches} from './bar-rows.mjs';

const romeTime=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});

// Keep kickoff and official-lineup scheduling aligned without repricing slips or moving their deadlines.
export async function refreshFutureCalendar(provider,{connect=connection,now=Date.now(),through=now+21*86400000,season=2026,sportsStorage='snapshot',fixtures=null}={}){
 const known=fixtures??JSON.parse(readFileSync(resolve('lib/operations/bootstrap-calendar.json'),'utf8')).flatMap(r=>r.matches.map(m=>({...m,apiId:m.apiFootballId,round:r.number})));
 const byId=new Map(known.filter(f=>Number(f.apiId)>0).map(f=>[Number(f.apiId),f]));
 if(!byId.size)return [];
 const ids=[...byId.keys()];
 const data=await provider.get(fixtures?'fixtures?ids='+ids.join('-'):`fixtures?league=135&season=${season}`);
 const updates=[];
 for(const raw of data.response||[]){
  const apiId=Number(raw.fixture?.id),k=Date.parse(raw.fixture?.date),m=byId.get(apiId);
  const status=raw.fixture?.status?.short;
  if(!m||!status||status==='TBD'||!Number.isFinite(k)||k<=now||k>through)continue;
  updates.push({id:m.id,apiId,round:m.round,home:m.home,away:m.away,kickoff:new Date(k).toISOString(),status});
 }
 // API-Football can report NS and the same nominal 18:30 for all ten matches of an unpublished round.
 const confirmed=[...Map.groupBy(updates,f=>f.round).values()].flatMap(round=>
  round.length===10&&romeTime.format(new Date(round[0].kickoff))==='18:30'
   &&round.every(f=>f.status==='NS'&&f.kickoff===round[0].kickoff)?[]:round);
 if(!confirmed.length)return confirmed;
 const times=Object.fromEntries(confirmed.map(f=>[f.id,f.kickoff]));
 const nativeTimes=Object.fromEntries(confirmed.map(f=>[f.apiId,f.kickoff]));
 const c=await connect();try{
  await beginBackgroundWrite(c);
  await c.query('SELECT pg_advisory_xact_lock(826501)');
  if(sportsStorage==='rows'){
   const patch=`data=data||jsonb_build_object('kickoff',$1::jsonb->id,'officialKickoff',$1::jsonb->id)
    WHERE $1::jsonb?id AND (data->'kickoff' IS DISTINCT FROM $1::jsonb->id OR data->'officialKickoff' IS DISTINCT FROM $1::jsonb->id)`;
   const changed=await c.query('UPDATE fanta.bar_seriea_matches SET '+patch+' RETURNING id',[JSON.stringify(times)]);
   if(changed.rows.length)await refreshCachedFootballMatches(c,changed.rows.map(r=>r.id));
  }else{
   await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{football,calendar,rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',(SELECT jsonb_agg(CASE WHEN $1::jsonb?(m->>'id') THEN m||jsonb_build_object('kickoff',$1::jsonb->(m->>'id'),'officialKickoff',$1::jsonb->(m->>'id')) ELSE m END) FROM jsonb_array_elements(r->'matches') m))) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r)) WHERE id=1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE $1::jsonb?(m->>'id') AND (m->'kickoff' IS DISTINCT FROM $1::jsonb->(m->>'id') OR m->'officialKickoff' IS DISTINCT FROM $1::jsonb->(m->>'id')))`,[JSON.stringify(times)]);
  }
  const native=(await c.query("SELECT to_regclass('fanta.fixtures') IS NOT NULL AS available")).rows[0]?.available;
  if(native)await c.query(`UPDATE fanta.fixtures f SET kickoff=($1::jsonb->>f.api_id::text)::timestamptz,
   data=CASE WHEN jsonb_typeof(data->'fixture')='object' THEN
    jsonb_set(data,'{fixture}',(data->'fixture')||jsonb_build_object('date',$1::jsonb->f.api_id::text,
     'timestamp',extract(epoch from ($1::jsonb->>f.api_id::text)::timestamptz)::bigint)) ELSE data END
   WHERE $1::jsonb?f.api_id::text AND f.kickoff>$2 AND f.frozen_at IS NULL AND f.status IN ('NS','TBD','PST')
    AND f.kickoff IS DISTINCT FROM ($1::jsonb->>f.api_id::text)::timestamptz`,[JSON.stringify(nativeTimes),new Date(now).toISOString()]);
  await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
 return confirmed;
}
