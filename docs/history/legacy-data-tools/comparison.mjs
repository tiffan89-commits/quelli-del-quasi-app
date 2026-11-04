// Historical, offline-only data migration tool. Never imported by application entrypoints.
import {round2} from '../../../fanta/rules.mjs';
import {connection} from '../../../lib/db.mjs';
export function comparisonView(reference,home,away,{historical=false}={}){
 if(!reference)return null;
 const side=(key,current)=>({points:reference[key]?.points??null,goals:reference[key]?.goals??null,ours:historical?null:current.total,delta:!historical&&Number.isFinite(current.total)&&Number.isFinite(reference[key]?.points)?round2(current.total-reference[key].points):null});
 return {source:'Leghe Fantacalcio',historical,home:side('home',home),away:side('away',away)};
}

// Copy only published reference scores, inside Postgres. Never overwrite our results.
export async function refreshReferences({connect=connection}={}){
 const c=await connect();try{
  const r=await c.query(`WITH raw AS (
   SELECT m.id,jsonb_build_object('home',jsonb_build_object('points',x->'fantasyPoints'->0,'goals',x->'score'->0),'away',jsonb_build_object('points',x->'fantasyPoints'->1,'goals',x->'score'->1)) AS data
   FROM fanta.leagues l JOIN fanta_state s ON s.id=1
   CROSS JOIN LATERAL jsonb_array_elements(s.payload->'fantasyConnections') e
   CROSS JOIN LATERAL jsonb_array_elements(e->'rounds') r
   CROSS JOIN LATERAL jsonb_array_elements(r->'matches') x
   JOIN fanta.matchups m ON m.league_id=l.id AND m.competition_id=l.id||':main' AND m.round=(r->>'number')::int
   JOIN fanta.teams h ON h.id=m.home_id AND h.name=x->>'home'
   JOIN fanta.teams a ON a.id=m.away_id AND a.name=x->>'away'
   WHERE l.source_key=(e->>'alias')||':'||(e->>'competitionId') AND l.admin_uid=e->>'owner'
   AND r->>'calculated'='true' AND jsonb_typeof(x->'fantasyPoints')='array' AND jsonb_typeof(x->'score')='array'
   AND jsonb_typeof(x->'fantasyPoints'->0)='number' AND jsonb_typeof(x->'fantasyPoints'->1)='number'
   AND jsonb_typeof(x->'score'->0)='number' AND jsonb_typeof(x->'score'->1)='number'
  ) INSERT INTO fanta.reference_results(matchup_id,data,digest)
  SELECT id,data,md5(data::text) FROM raw
  ON CONFLICT(matchup_id) DO UPDATE SET data=EXCLUDED.data,digest=EXCLUDED.digest,captured_at=now()
  WHERE fanta.reference_results.data IS DISTINCT FROM EXCLUDED.data`);
  return r.rowCount??r.affectedRows??0;
 }finally{c.release();}
}
