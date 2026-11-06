import {connection} from '../lib/db.mjs';
import {fail} from './rules.mjs';
import {ensureBar} from './random-leagues.mjs';
const open=`l.kind IN('pilot','random') AND l.source_key IS NULL AND l.rules->>'disabledAt' IS NULL AND l.rules->>'acquisitionOpen'='true'`;
const joins=`FROM fanta.teams t JOIN fanta.leagues l ON l.id=t.league_id JOIN fanta.bar_links b ON b.fanta_league_id=l.id AND b.active JOIN fanta_state s ON s.id=1`;
const permitted=`${open} AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.payload->'leagues') bar CROSS JOIN LATERAL jsonb_array_elements(coalesce(bar->'removedMembers','[]')) gone WHERE bar->>'id'=b.bar_league_id AND gone->>'uid'=$1)`;
// Only deliberately opened native trial leagues participate. No new leagues,
// providers, scheduled work or broad database snapshots on this path.
export async function entryStatus(user,{connect=connection}={}){
 const c=await connect();try{
  const own=(await c.query(`SELECT t.league_id AS league,t.id,t.name ${joins} WHERE t.user_id=$1 AND ${permitted} ORDER BY l.id LIMIT 1`,[user.id])).rows[0];
  if(own)return {signedIn:true,owned:own,available:true};
  const row=(await c.query(`SELECT count(*)::int AS free ${joins} WHERE t.user_id IS NULL AND ${permitted}`,[user.id])).rows[0];
  return {signedIn:true,owned:null,available:row.free>0};
 }finally{c.release();}
}
export async function claimEntry(user,{connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query("SELECT set_config('lock_timeout','5s',true),set_config('statement_timeout','12s',true)");await c.query('SELECT pg_advisory_xact_lock(826501)');
  await c.query('SELECT id FROM fanta_state WHERE id=1 FOR UPDATE');
  const own=(await c.query(`SELECT t.league_id AS league,t.id,t.name ${joins} WHERE t.user_id=$1 AND ${permitted} ORDER BY l.id LIMIT 1`,[user.id])).rows[0];
  if(own){await c.query('COMMIT');return {...own,reused:true};}
  const pick=(await c.query(`SELECT t.id,t.name,l.id AS league,b.bar_league_id ${joins} WHERE t.user_id IS NULL AND ${permitted} ORDER BY l.pilot_number,l.id,t.id LIMIT 1 FOR UPDATE OF t` ,[user.id])).rows[0];
  if(!pick)fail('Le squadre di prova sono tutte occupate. Torna a trovarci: stiamo preparando altre panchine.',409);
  await c.query('UPDATE fanta.teams SET user_id=$2,manager=$3,joined_at=now() WHERE id=$1',[pick.id,user.id,user.name||user.username]);
  const league=(await c.query('SELECT * FROM fanta.leagues WHERE id=$1',[pick.league])).rows[0];await ensureBar(c,league,{barId:pick.bar_league_id});
  await c.query('COMMIT');return {league:pick.league,id:pick.id,name:pick.name,reused:false};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
