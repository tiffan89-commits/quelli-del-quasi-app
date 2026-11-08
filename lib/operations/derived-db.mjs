import {isDeepStrictEqual} from 'node:util';
import {connection} from '../db.mjs';
import {updatePlayerProfiles} from '../player-analysis.mjs';
import {syncRoundRewards} from '../progression.mjs';
import {readDerivedRows,writeDerivedRows} from './bar-rows.mjs';
// Run only after a settlement/correction. No providers and no authentication data.
export async function updateDerived(ids,{connect=connection,sportsStorage='snapshot'}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const rowStorage=sportsStorage==='rows';
  const s=rowStorage?await readDerivedRows(c,ids):(await c.query(`WITH state AS(SELECT payload FROM fanta_state WHERE id=1),touched AS(SELECT DISTINCT r->>'league' AS id FROM state CROSS JOIN LATERAL jsonb_array_elements(payload->'rounds') r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])))
  SELECT jsonb_build_object('users',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',u->'id','name',u->'name','createdAt',u->'createdAt','adminOnly',u->'adminOnly')),'[]'::jsonb) FROM jsonb_array_elements(payload->'users') u),
   'leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id' IN(SELECT id FROM touched)),
   'rounds',(SELECT coalesce(jsonb_agg((r-'matches')||jsonb_build_object('matches',(SELECT jsonb_agg(m-ARRAY['details','lineups','consensus','oddsModel']::text[]) FROM jsonb_array_elements(r->'matches') m))),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league' IN(SELECT id FROM touched)),
   'playerRewards',coalesce(payload->'playerRewards','{}'::jsonb),'playerProfiles',coalesce(payload->'playerProfiles','{}'::jsonb),'analysisTextHashes',coalesce(payload->'analysisTextHashes','{}'::jsonb)) AS payload FROM state`,[ids])).rows[0]?.payload;
  if(!s){await c.query('COMMIT');return {changed:false};}
  const before=structuredClone(s);syncRoundRewards(s);updatePlayerProfiles(s);
  const fields=Object.keys(s).filter(k=>!isDeepStrictEqual(before[k],s[k]));
  if(fields.length&&rowStorage)await writeDerivedRows(c,before,s);
  else if(fields.length){
   const patch={playerRewards:s.playerRewards,playerProfiles:s.playerProfiles,analysisTextHashes:s.analysisTextHashes};
   await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload||$1::jsonb,'{rounds}',(SELECT coalesce(jsonb_agg(CASE WHEN $2::jsonb?(r->>'id') THEN r||jsonb_build_object('rewardVersion',$2::jsonb->(r->>'id')) ELSE r END),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r)) WHERE id=1`,[JSON.stringify(patch),JSON.stringify(Object.fromEntries(s.rounds.filter(r=>r.rewardVersion!==undefined).map(r=>[r.id,r.rewardVersion])))]);
  }
  await c.query('COMMIT');return {changed:fields.length>0,fields};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
