import {connection} from '../db.mjs';
import {settle} from '../game.mjs';
import {compensateSettlement} from '../settlement-corrections.mjs';

// Transfer only the affected matches and slips. Authentication, assets, source
// credentials, unrelated rounds and the large football snapshot remain in Postgres.
export async function patchSports(ids,apply,{connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const {rows}=await c.query(`SELECT jsonb_build_object(
   'football',jsonb_build_object('calendar',jsonb_build_object('season',payload#>'{football,calendar,season}','rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('number',r->'number','matches',(SELECT jsonb_agg(m) FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])))),'[]'::jsonb) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[]))))),
   'rounds',(SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[]))),
   'leagues',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l->'id','members',l->'members','removedMembers',l->'removedMembers')),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l), 'ledger','[]'::jsonb
  ) AS payload FROM fanta_state WHERE id=1`,[ids]);
  const s=rows[0]?.payload;if(!s)throw Error('Sports state unavailable');
  const previousLineups=new Map(s.football.calendar.rounds.flatMap(r=>r.matches).map(m=>[m.id,{lineups:m.lineups,status:m.status,kickoff:m.kickoff}]));
  const before=JSON.stringify(s),previousRounds=new Map(s.rounds.map(r=>[r.id,JSON.stringify(r)])),previousLeagues=new Map(s.leagues.map(l=>[l.id,JSON.stringify(l)]));const result=apply(s);
  if(result?.then)throw Error('Network and asynchronous work forbidden inside sports transaction');
  const matches=s.football.calendar.rounds.flatMap(r=>r.matches),map=new Map(matches.map(m=>[m.id,m]));
  const fields=['lineups','status','score','liveScore','clock','phase','clockUpdatedAt','scoreUpdatedAt','officialConfirmed','scoreVerifiedAt','liveSource','details','apiFootballDigest','apiFootballId','apiFootballCheckedAt','apiFootballFinalAt'];
  for(const r of s.rounds){for(const m of r.matches){const source=map.get(m.id);if(source)for(const k of fields)if(source[k]!==undefined)m[k]=source[k];}const l=s.leagues.find(l=>l.id===r.league);if(!l)continue;if(r.settled)compensateSettlement(s,l,r);else settle(s,l,r);}
  if(JSON.stringify(s)!==before){
   const patch={matches:Object.fromEntries(matches.map(m=>[m.id,m])),rounds:Object.fromEntries(s.rounds.map(r=>[r.id,r])),leagues:Object.fromEntries(s.leagues.filter(l=>previousLeagues.get(l.id)!==JSON.stringify(l)).map(l=>[l.id,l])),ledger:s.ledger};
   // JSONB updates are merged while holding the existing game advisory lock;
   // concurrent auth and chat fields are never replaced by a stale snapshot.
   await c.query(`UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(jsonb_set(payload,
    '{football,calendar,rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',(SELECT jsonb_agg(coalesce($1::jsonb->'matches'->(m->>'id'),m)) FROM jsonb_array_elements(r->'matches') m))) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r)),
    '{rounds}',(SELECT coalesce(jsonb_agg(coalesce($1::jsonb->'rounds'->(r->>'id'),r)),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r)),
    '{leagues}',(SELECT coalesce(jsonb_agg(CASE WHEN $1::jsonb->'leagues' ? (l->>'id') THEN l||jsonb_build_object('members',$1::jsonb->'leagues'->(l->>'id')->'members','removedMembers',coalesce($1::jsonb->'leagues'->(l->>'id')->'removedMembers','[]'::jsonb)) ELSE l END),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l)),
    '{ledger}',coalesce(payload->'ledger','[]'::jsonb)||($1::jsonb->'ledger')) WHERE id=1`,[JSON.stringify(patch)]);
   await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{football,rounds}',(SELECT coalesce(jsonb_object_agg(k.key,CASE WHEN k.value?'matches' THEN jsonb_set(k.value,'{matches}',(SELECT coalesce(jsonb_agg(coalesce($1::jsonb->(m->>'id'),m)),'[]'::jsonb) FROM jsonb_array_elements(k.value->'matches') m)) ELSE k.value END),'{}'::jsonb) FROM jsonb_each(payload#>'{football,rounds}') k)) WHERE id=1 AND payload#>'{football,rounds}' IS NOT NULL`,[JSON.stringify(patch.matches)]);
  }
  const accuracyMatches=matches.filter(m=>{const old=previousLineups.get(m.id);return m.lineups?.kind==='official'&&(m.lineups!==old?.lineups||m.status!==old?.status||m.kickoff!==old?.kickoff);});
  await c.query('COMMIT');return {result,matches,accuracyMatches,changed:JSON.stringify(s)!==before,derive:s.rounds.some(r=>r.settled&&previousRounds.get(r.id)!==JSON.stringify(r))};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
