import {beginBackgroundWrite} from '../lib/operations/background-db.mjs';
import {createHash} from 'node:crypto';
import {connection} from '../lib/db.mjs';
import {PRESENCE_MODEL,estimatePresence} from '../public/src/fanta/presence-probability.mjs';
export const presenceJobId=season=>'presence:current:'+season;
// One bounded aggregate over completed matches. Missing team coverage is unknown,
// not a fabricated absence. Votes are read-only; fantasy bonuses are never used.
export const PRESENCE_INPUT_SQL=`WITH club_matches AS (
 SELECT f.id,f.kickoff,club.id AS club_id,
 row_number() OVER(PARTITION BY club.id ORDER BY f.kickoff DESC,f.id DESC) AS ordinal,
 count(*) OVER(PARTITION BY club.id)::int AS team_matches,
 EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.data->'players')='array' THEN f.data->'players' ELSE '[]'::jsonb END) t
  WHERE t#>>'{team,id}'=club.api_id::text AND (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t->'players')='array' THEN t->'players' ELSE '[]'::jsonb END) x WHERE CASE WHEN jsonb_typeof(x#>'{statistics,0,games,minutes}')='number' THEN (x#>>'{statistics,0,games,minutes}')::numeric>0 ELSE false END)>=11) AS covered
 FROM fanta.fixtures f JOIN (SELECT id,api_id FROM fanta.clubs WHERE id IN(SELECT DISTINCT club_id FROM fanta.players)) club ON club.id IN(f.home_id,f.away_id)
 WHERE f.season=$1 AND f.kickoff<$2 AND f.status IN('FT','AET','PEN')
), recent AS(SELECT * FROM club_matches WHERE ordinal<=5),
 latest_votes AS(SELECT DISTINCT ON(v.fixture_id,v.player_id) v.fixture_id,v.player_id,v.data->'vote' AS grade FROM fanta.votes v WHERE v.fixture_id IN(SELECT id FROM recent) ORDER BY v.fixture_id,v.player_id,v.id DESC),
 totals AS(SELECT s.player_id,sum((s.data->>'minutes')::numeric)::float AS minutes FROM fanta.player_stats s JOIN fanta.fixtures f ON f.id=s.fixture_id JOIN fanta.players p ON p.id=s.player_id
 WHERE f.season=$1 AND f.kickoff<$2 AND f.status IN('FT','AET','PEN') AND p.club_id IN(f.home_id,f.away_id) AND coalesce(s.data->>'clubId',p.club_id)=p.club_id AND jsonb_typeof(s.data->'minutes')='number' GROUP BY s.player_id)
 SELECT p.id,p.club_id AS "clubId",p.name,p.data->'status' AS status,p.data->'presenceEstimate' AS "previousEstimate",
 jsonb_build_object('minutes',coalesce(to_jsonb(totals.minutes),p.data#>'{seasonStats,games,minutes}'),'teamMatches',coalesce(max(r.team_matches),0),
 'recentPresence',coalesce(jsonb_agg(jsonb_build_object('fixtureId',r.id,'kickoff',r.kickoff,
  'known',jsonb_typeof(s.data->'minutes')='number' OR (s.player_id IS NULL AND r.covered),
  'minutes',CASE WHEN jsonb_typeof(s.data->'minutes')='number' THEN s.data->'minutes' WHEN s.player_id IS NULL AND r.covered THEN '0'::jsonb ELSE 'null'::jsonb END,
  'starter',CASE WHEN jsonb_typeof(s.data#>'{presence,starter}')='boolean' THEN s.data#>'{presence,starter}' WHEN s.player_id IS NULL AND r.covered THEN 'false'::jsonb ELSE 'null'::jsonb END,
  'baseVote',CASE WHEN jsonb_typeof(v.grade)='number' THEN v.grade ELSE 'null'::jsonb END,
  'decisiveGoal',coalesce(s.data#>>'{context,marqueeEvidence,timelineVerified}'='true',false) AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.data#>'{context,marqueeEvidence,decisive}')='array' THEN s.data#>'{context,marqueeEvidence,decisive}' ELSE '[]'::jsonb END) d WHERE d->>'kind'='goal'),
  'decisiveAssist',coalesce(s.data#>>'{context,marqueeEvidence,timelineVerified}'='true',false) AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.data#>'{context,marqueeEvidence,decisive}')='array' THEN s.data#>'{context,marqueeEvidence,decisive}' ELSE '[]'::jsonb END) d WHERE d->>'kind'='assist')
 ) ORDER BY r.kickoff DESC,r.id DESC) FILTER(WHERE r.id IS NOT NULL),'[]'::jsonb)) AS stats
 FROM fanta.players p LEFT JOIN recent r ON r.club_id=p.club_id LEFT JOIN totals ON totals.player_id=p.id
 LEFT JOIN fanta.player_stats s ON s.fixture_id=r.id AND s.player_id=p.id AND coalesce(s.data->>'clubId',p.club_id)=p.club_id
 LEFT JOIN latest_votes v ON v.fixture_id=r.id AND v.player_id=p.id
 GROUP BY p.id,totals.minutes ORDER BY p.id`;
export async function refreshPresenceEstimates({connect=connection,season=Number(process.env.FANTA_SEASON||2026),now=Date.now()}={}){
 const c=await connect();try{
  await beginBackgroundWrite(c);await c.query("SELECT pg_advisory_xact_lock(826528)");
  const players=(await c.query(PRESENCE_INPUT_SQL,[season,new Date(now).toISOString()])).rows,updates=[],examples=[];
  for(const player of players){
   const inputHash=createHash('sha256').update(JSON.stringify([PRESENCE_MODEL,season,player.clubId,player.status?.type||null,player.stats])).digest('hex');
   if(player.previousEstimate?.inputHash===inputHash&&player.previousEstimate?.model===PRESENCE_MODEL)continue;
   const result=estimatePresence(player),estimate={model:PRESENCE_MODEL,season,clubId:player.clubId,pct:result?.pct??null,inputHash,updatedAt:new Date(now).toISOString(),evidence:result?.evidence||null};
   updates.push({id:player.id,club_id:player.clubId,status:player.status?.type||null,estimate});
   const prior=player.stats.minutes!==null&&player.stats.teamMatches?Math.round(Number(player.stats.minutes)/(90*player.stats.teamMatches)*100):null;
   if(result&&result.evidence.recentMatches>0)examples.push({id:player.id,name:player.name,previous:player.previousEstimate?.pct??prior,pct:result.pct,streak:result.evidence.starterStreak,goodForm:result.evidence.goodForm});
  }
  let changed=0;if(updates.length){
   const result=await c.query(`UPDATE fanta.players p SET data=jsonb_set(p.data,'{presenceEstimate}',r.estimate,true) FROM jsonb_to_recordset($1::jsonb) AS r(id text,club_id text,status text,estimate jsonb)
    WHERE p.id=r.id AND p.club_id IS NOT DISTINCT FROM r.club_id AND p.data#>>'{status,type}' IS NOT DISTINCT FROM r.status AND p.data->'presenceEstimate' IS DISTINCT FROM r.estimate RETURNING p.id`,[JSON.stringify(updates)]);changed=result.rows.length;
   if(changed){const revision=createHash('sha256').update(JSON.stringify(updates.map(p=>[p.id,p.estimate.inputHash]))).digest('hex');await c.query("INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",[presenceJobId(season),JSON.stringify({model:PRESENCE_MODEL,season,revision,updatedAt:new Date(now).toISOString(),players:players.length,changed})]);}
  }
  await c.query('COMMIT');return {model:PRESENCE_MODEL,season,players:players.length,changed,unchanged:players.length-updates.length,providerCalls:0,examples:examples.sort((a,b)=>(b.pct-(b.previous??b.pct))-(a.pct-(a.previous??a.pct))).slice(0,12)};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
