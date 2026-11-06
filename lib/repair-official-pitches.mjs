import {connection} from './db.mjs';
import {officialLineups,sameOfficialLineups} from './official-lineups.mjs';
// One idempotent, cached-data-only repair. No settlement, provider or vote calls.
export async function repairOfficialPitches({connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const rows=(await c.query(`SELECT m->>'id' AS id,m->'lineups' AS lineups,m#>'{details,sourceLineups}' AS source,m#>'{details,matchInfo,teams}' AS teams,m#>>'{details,updatedAt}' AS at FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m#>'{details,sourceLineups}' IS NOT NULL`)).rows,patch={};
  for(const r of rows){const next=officialLineups({lineups:r.source,teams:r.teams},r.lineups?.updatedAt||r.at||new Date().toISOString());if(next&&!sameOfficialLineups(r.lineups,next))patch[r.id]=next;}
  const changed=Object.keys(patch).length;
  if(changed)await c.query(`UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(payload,
   '{football,calendar,rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',(SELECT jsonb_agg(CASE WHEN $1::jsonb ? (m->>'id') THEN jsonb_set(m,'{lineups}',$1::jsonb->(m->>'id')) ELSE m END) FROM jsonb_array_elements(r->'matches') m))) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r)),
   '{rounds}',(SELECT coalesce(jsonb_agg(jsonb_set(r,'{matches}',(SELECT coalesce(jsonb_agg(CASE WHEN $1::jsonb ? (m->>'id') THEN jsonb_set(m,'{lineups}',$1::jsonb->(m->>'id')) ELSE m END),'[]'::jsonb) FROM jsonb_array_elements(r->'matches') m))),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r)),
   '{football,rounds}',(SELECT coalesce(jsonb_object_agg(k.key,CASE WHEN jsonb_typeof(k.value->'matches')='array' THEN jsonb_set(k.value,'{matches}',(SELECT coalesce(jsonb_agg(CASE WHEN $1::jsonb ? (m->>'id') THEN jsonb_set(m,'{lineups}',$1::jsonb->(m->>'id')) ELSE m END),'[]'::jsonb) FROM jsonb_array_elements(k.value->'matches') m)) ELSE k.value END),'{}'::jsonb) FROM jsonb_each(coalesce(payload#>'{football,rounds}','{}'::jsonb)) k)) WHERE id=1`,[JSON.stringify(patch)]);
  await c.query('COMMIT');return {inspected:rows.length,changed,providerCalls:0};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
