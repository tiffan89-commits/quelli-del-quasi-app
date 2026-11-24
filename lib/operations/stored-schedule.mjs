import {beginBackgroundWrite} from './background-db.mjs';
import {syncConfirmedDeadlines} from './round-deadlines.mjs';
import {barCalendarRows} from '../storage-mode.mjs';

const notClosed=data=>`NOT coalesce((${data}->>'settled')::boolean,false)
 AND NOT coalesce((${data}->>'archived')::boolean,false)`;
const timePatch=id=>`jsonb_build_object('kickoff',$1::jsonb->(${id}),'officialKickoff',$1::jsonb->(${id}))`;
const different=(data,id)=>`(${data}->'kickoff' IS DISTINCT FROM $1::jsonb->(${id})
 OR ${data}->'officialKickoff' IS DISTINCT FROM $1::jsonb->(${id}))`;

export async function alignStoredSchedule(client,{season,now,sportsStorage,rounds=null}){
 const {rows}=await client.query(`SELECT m->>'id' AS id, (r->>'number')::int AS round,
  m->>'officialKickoff' AS kickoff, m->>'status' AS status,
  m->'apiFootballId' AS "apiId", m->>'home' AS home, m->>'away' AS away
  FROM ${barCalendarRows(sportsStorage,{round:true})}
  WHERE m->>'id' LIKE ('seriea:'||$1::int::text||':%') AND ($3::int[] IS NULL OR (r->>'number')::int=ANY($3))
   AND nullif(m->>'officialKickoff','')::timestamptz>$2::timestamptz
  ORDER BY (r->>'number')::int,m->>'id'`,[season,new Date(now).toISOString(),rounds]);
 const fixtures=rows.filter(f=>['NS','TBD','SCHEDULED'].includes(f.status||'NS'));
 const times=Object.fromEntries(fixtures.map(f=>[f.id,new Date(f.kickoff).toISOString()]));
 const deadlines=await syncConfirmedDeadlines(client,{season,now,sportsStorage,rounds});
 const patch=JSON.stringify(times);
 let barMatches=0;
 if(fixtures.length&&sportsStorage==='rows'){
  const changed=await client.query(`UPDATE fanta.bar_matchday_matches m SET data=m.data||${timePatch('m.id')}
   FROM fanta.bar_matchdays d WHERE d.id=m.matchday_id AND $1::jsonb?m.id
    AND coalesce(d.data->>'source','seriea')='seriea' AND ${notClosed('d.data')}
    AND ${different('m.data','m.id')}`,[patch]);
  barMatches=changed.rowCount??changed.affectedRows??0;
  await client.query(`UPDATE fanta.bar_football_round_cache c SET data=jsonb_set(c.data,'{matches}',(
   SELECT jsonb_agg(CASE WHEN $1::jsonb?(m->>'id') THEN m||${timePatch("m->>'id'")} ELSE m END ORDER BY pos)
   FROM jsonb_array_elements(c.data->'matches') WITH ORDINALITY items(m,pos)))
   WHERE c.cache_key LIKE ('seriea:'||$2::int::text||':%') AND jsonb_typeof(c.data->'matches')='array'
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.data->'matches') m WHERE $1::jsonb?(m->>'id') AND ${different('m',"m->>'id'")})`,[patch,season]);
 }else if(fixtures.length){
  const eligible=`coalesce(r->>'source','seriea')='seriea' AND ${notClosed('r')}
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE $1::jsonb?(m->>'id') AND ${different('m',"m->>'id'")})`;
  const changed=await client.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{rounds}',(
   SELECT jsonb_agg(CASE WHEN ${eligible} THEN jsonb_set(r,'{matches}',(
    SELECT jsonb_agg(CASE WHEN $1::jsonb?(m->>'id') THEN m||${timePatch("m->>'id'")} ELSE m END ORDER BY match_pos)
    FROM jsonb_array_elements(r->'matches') WITH ORDINALITY matches(m,match_pos))) ELSE r END ORDER BY pos)
   FROM jsonb_array_elements(payload->'rounds') WITH ORDINALITY days(r,pos)))
   WHERE id=1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'rounds') r WHERE ${eligible})`,[patch]);
  barMatches=changed.rowCount??changed.affectedRows??0;
 }
 return {fixtures:rows.map(f=>({...f,kickoff:new Date(f.kickoff).toISOString()})),metrics:{...deadlines,barMatches}};
}

export async function syncStoredSchedule({connect,season,now,sportsStorage,rounds}){
 const client=await connect();
 try{
  await beginBackgroundWrite(client);
  await client.query('SELECT pg_advisory_xact_lock(826501)');
  const result=await alignStoredSchedule(client,{season,now,sportsStorage,rounds});
  await client.query('COMMIT');
  return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}
