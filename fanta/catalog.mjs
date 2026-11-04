import {hashInput,ROLE} from './votes.mjs';
import {connection} from '../lib/db.mjs';
import {normalizeTeam} from '../lib/calendar.mjs';
export async function seedStoredCatalog({connect=connection}={}){
 const c=await connect();try{
  const teams=(await c.query(`SELECT DISTINCT t FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m CROSS JOIN LATERAL jsonb_each(m#>'{details,matchInfo,teams}') q(key,t) WHERE t->>'id' IS NOT NULL`)).rows.map(x=>x.t);
  const clubs=[...new Map(teams.map(t=>[t.id,{id:'af:'+t.id,api_id:t.id,name:t.name}])).values()].sort((a,b)=>a.api_id-b.api_id),byName=new Map(clubs.map(t=>[normalizeTeam(t.name),t]));
  const cached=(await c.query("SELECT DISTINCT ON(player_id) metadata FROM football_player_catalog ORDER BY player_id,season DESC,metadata->>'checkedAt' DESC")).rows.map(r=>r.metadata);
  let players=cached.filter(p=>/^\d+$/.test(String(p.providerId))&&byName.has(p.team)&&ROLE[p.position]).map(p=>({id:'af:'+p.providerId,api_id:Number(p.providerId),club_id:byName.get(p.team).id,name:p.name,role:ROLE[p.position],data:{photoUrl:p.placeholder?null:'/api/player-photo?id='+encodeURIComponent(p.id)+'&v='+p.digest,active:true}}));
  const fresh=(await c.query(`SELECT DISTINCT ON(p#>>'{player,id}') p#>>'{player,id}' AS id,p#>>'{player,name}' AS name,t#>>'{team,id}' AS club_id,p#>>'{statistics,0,games,position}' AS position FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m CROSS JOIN LATERAL jsonb_array_elements(m#>'{details,players}') t CROSS JOIN LATERAL jsonb_array_elements(t->'players') p WHERE m#>>'{details,source}'='API-FOOTBALL' ORDER BY p#>>'{player,id}',(r->>'number')::int DESC`)).rows;
  const merged=new Map(players.map(p=>[p.id,p]));for(const p of fresh){if(!/^\d+$/.test(p.id)||!ROLE[p.position]||!clubs.some(t=>t.id==='af:'+p.club_id))continue;const id='af:'+p.id,old=merged.get(id);merged.set(id,{...old,id,api_id:Number(p.id),club_id:'af:'+p.club_id,name:p.name,role:ROLE[p.position],data:old?.data||{active:true}});}players=[...merged.values()].sort((a,b)=>a.api_id-b.api_id);
  const digest=hashInput([clubs,players]),old=(await c.query("SELECT data->>'digest' AS digest FROM fanta.jobs WHERE id='seed:stored-catalog'")).rows[0];if(old?.digest===digest)return {cached:true,players:players.length};
  await c.query('BEGIN');
  await c.query(`INSERT INTO fanta.clubs SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text,api_id int,name text) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,[JSON.stringify(clubs)]);
  await c.query(`INSERT INTO fanta.players(id,api_id,club_id,name,role,data) SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text,api_id int,club_id text,name text,role text,data jsonb) ON CONFLICT(id) DO UPDATE SET club_id=coalesce(fanta.players.club_id,EXCLUDED.club_id),name=EXCLUDED.name,data=fanta.players.data||EXCLUDED.data WHERE (fanta.players.club_id,fanta.players.name,fanta.players.data->>'photoUrl') IS DISTINCT FROM (EXCLUDED.club_id,EXCLUDED.name,EXCLUDED.data->>'photoUrl')`,[JSON.stringify(players)]);
  await c.query("INSERT INTO fanta.jobs(id,data) VALUES('seed:stored-catalog',$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify({digest,players:players.length})]);await c.query('COMMIT');return {players:players.length};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
