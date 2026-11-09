import {barMembershipRoot} from '../lib/storage-mode.mjs';
import {connection} from '../lib/db.mjs';
// Detach the coach, never delete the team or its roster/results/lineups.
// Called inside the same transaction that removes Bar membership.
export async function detachBarCoach(c,bar,uid){
 const rows=(await c.query(`UPDATE fanta.teams t SET user_id=NULL,manager=coalesce(nullif(t.coach_name,''),'Allenatore automatico')
 FROM fanta.bar_links b WHERE b.active AND b.bar_league_id=$1 AND t.league_id=b.fanta_league_id AND t.user_id=$2 RETURNING t.id,t.league_id`,[bar.id,uid])).rows;
 const claims=await c.query(`DELETE FROM fanta.pilot_claims p USING fanta.bar_links b WHERE b.active AND b.bar_league_id=$1 AND p.league_id=b.fanta_league_id AND p.user_id=$2`,[bar.id,uid]);rows.removedClaims=claims.rowCount??claims.affectedRows??0;
 rows.adminTransfers=0;if(bar.admin&&bar.admin!==uid){const admins=await c.query(`UPDATE fanta.leagues l SET admin_uid=$3 FROM fanta.bar_links b WHERE b.active AND b.bar_league_id=$1 AND l.id=b.fanta_league_id AND l.admin_uid=$2`,[bar.id,uid,bar.admin]);rows.adminTransfers=admins.rowCount??admins.affectedRows??0;}
 if(bar.nativeFantaLink)bar.nativeFantaLink.coachIds=(bar.nativeFantaLink.coachIds||[]).filter(id=>id!==uid);
 return rows;
}
export async function repairRemovedCoaches({connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const data=(await c.query(`SELECT jsonb_build_object('leagues',payload->'leagues','testIds',(SELECT coalesce(jsonb_agg(u->>'id'),'[]') FROM jsonb_array_elements(payload->'users') u WHERE lower(u->>'username')='testuser2')) AS data FROM ${barMembershipRoot()} WHERE id=1 FOR UPDATE`)).rows[0]?.data;
  if(!data)throw Error('State unavailable');const report={detached:0,removedClaims:0,adminTransfers:0,resurrectedMembersRemoved:0,remainingRemovedAssignments:0,testuser2Remaining:0,leagues:[],providerCalls:0};
  for(const bar of data.leagues||[]){
   const removed=new Set((bar.removedMembers||[]).map(m=>m.uid));
   const priorMembers=bar.members||[];bar.members=priorMembers.filter(m=>!removed.has(m.uid));report.resurrectedMembersRemoved+=priorMembers.length-bar.members.length;
   for(const uid of data.testIds||[])if(!bar.members?.some(m=>m.uid===uid))removed.add(uid);
   for(const uid of removed){const rows=await detachBarCoach(c,bar,uid);report.detached+=rows.length;report.removedClaims+=rows.removedClaims;report.adminTransfers+=rows.adminTransfers;if(rows.length)report.leagues.push({id:bar.id,name:bar.name,teams:rows.map(t=>t.id)});}
  }
  const patch=Object.fromEntries((data.leagues||[]).map(b=>[b.id,{members:b.members,...(b.nativeFantaLink?{nativeFantaLink:b.nativeFantaLink}:{})}]));
  await c.query(`UPDATE ${barMembershipRoot()} SET payload=jsonb_set(payload,'{leagues}',(SELECT jsonb_agg(CASE WHEN $1::jsonb ? (b->>'id') THEN b||($1::jsonb->(b->>'id')) ELSE b END) FROM jsonb_array_elements(payload->'leagues') b)) WHERE id=1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'leagues') b WHERE $1::jsonb ? (b->>'id') AND b||($1::jsonb->(b->>'id')) IS DISTINCT FROM b)`,[JSON.stringify(patch)]);
  const verify=(await c.query(`SELECT count(*) FILTER(WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(bar->'removedMembers','[]')) m WHERE m->>'uid'=t.user_id))::int AS removed,
 count(*) FILTER(WHERE t.user_id=ANY($1::text[]))::int AS test FROM fanta.teams t JOIN fanta.bar_links l ON l.fanta_league_id=t.league_id AND l.active JOIN ${barMembershipRoot()} s ON s.id=1 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'leagues') bar WHERE bar->>'id'=l.bar_league_id AND t.user_id IS NOT NULL`,[data.testIds||[]])).rows[0];
  report.remainingRemovedAssignments=verify.removed;report.testuser2Remaining=verify.test;
  await c.query('COMMIT');return report;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
