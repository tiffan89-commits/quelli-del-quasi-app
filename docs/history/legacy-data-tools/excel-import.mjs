// Historical, offline-only data migration tool. Never imported by application entrypoints.
import {connection} from '../../../lib/db.mjs';
export async function saveCompletedLineups(input,{connect=connection}={}){
 if(input.competitionId!==548867||!Number.isInteger(input.round)||input.round<1||input.round>38||input.matches?.length!==5||!/^[a-f0-9]{64}$/.test(input.digest))throw Error('Import non valido');
 const c=await connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826511)');
  const parameters=[JSON.stringify(input),input.digest,String(input.round)];
  const checked=(await c.query(`SELECT count(*)::int AS n FROM fanta.import_sources s CROSS JOIN LATERAL jsonb_array_elements(s.data->'rounds') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m JOIN jsonb_array_elements($1::jsonb->'matches') x ON lower(regexp_replace(m->>'home','[^[:alnum:]]','','g'))=lower(regexp_replace(x->>'home','[^[:alnum:]]','','g')) AND lower(regexp_replace(m->>'away','[^[:alnum:]]','','g'))=lower(regexp_replace(x->>'away','[^[:alnum:]]','','g')) WHERE s.id='lucas-bar:548867' AND r->>'number'=$3 AND s.owner_uid IN(SELECT u->>'id' FROM fanta_state z CROSS JOIN LATERAL jsonb_array_elements(z.payload->'users') u WHERE u->>'username'='frankwood') AND $2::text IS NOT NULL`,parameters)).rows[0];
  if(checked.n!==5)throw Error('Gli incontri del file non coincidono con il calendario della lega');
  const result=await c.query(`WITH updated AS (
   SELECT s.id,s.data||jsonb_build_object('excelDigests',coalesce(s.data->'excelDigests','{}'::jsonb)||jsonb_build_object($3::text,$2::text),'rounds',(
    SELECT jsonb_agg(CASE WHEN r->>'number'=$3 THEN r||jsonb_build_object('matches',(
     SELECT jsonb_agg(m||jsonb_build_object('details',coalesce(m->'details','{}'::jsonb)||jsonb_build_object('teams',x->'teams','complete',true,'sourceFinal',true,'source','provided-excel','workbookDigest',$2::text)) ORDER BY ord)
     FROM jsonb_array_elements(r->'matches') WITH ORDINALITY old(m,ord) JOIN jsonb_array_elements($1::jsonb->'matches') x ON lower(regexp_replace(m->>'home','[^[:alnum:]]','','g'))=lower(regexp_replace(x->>'home','[^[:alnum:]]','','g')) AND lower(regexp_replace(m->>'away','[^[:alnum:]]','','g'))=lower(regexp_replace(x->>'away','[^[:alnum:]]','','g'))
    )) ELSE r END ORDER BY (r->>'number')::int) FROM jsonb_array_elements(s.data->'rounds') r
   )) AS body FROM fanta.import_sources s WHERE s.id='lucas-bar:548867' AND s.data#>>ARRAY['excelDigests',$3] IS DISTINCT FROM $2
  ) UPDATE fanta.import_sources s SET data=u.body,digest=md5(u.body::text),captured_at=now() FROM updated u WHERE s.id=u.id`,parameters);
  await c.query('COMMIT');return {round:input.round,changed:(result.rowCount??result.affectedRows??0)>0,matches:5,lineups:input.matches.flatMap(m=>m.teams).filter(t=>!t.missing).length,players:input.matches.flatMap(m=>m.teams.flatMap(t=>t.players)).length};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
