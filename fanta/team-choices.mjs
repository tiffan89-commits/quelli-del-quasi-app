import {connection} from '../lib/db.mjs';
// Members can see available benches only in their linked, active native leagues.
// This narrow bootstrap read never exposes rosters, account data or private imports.
export async function teamChoices(uid,{connect=connection}={}){
 const c=await connect();try{return (await c.query(`SELECT l.id,l.name,l.rules->>'creationPending'='true' AS pending,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color,'branding',t.branding,'available',t.user_id IS NULL) ORDER BY t.id),'[]') FROM fanta.teams t WHERE t.league_id=l.id) AS teams
 FROM fanta.leagues l WHERE l.source_key IS NULL AND l.rules->>'disabledAt' IS NULL
 AND EXISTS(SELECT 1 FROM fanta.bar_links b JOIN fanta_state s ON s.id=1 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'leagues') bar CROSS JOIN LATERAL jsonb_array_elements(coalesce(bar->'members','[]')) m
 WHERE b.fanta_league_id=l.id AND b.active AND bar->>'id'=b.bar_league_id AND m->>'uid'=$1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(bar->'removedMembers','[]')) gone WHERE gone->>'uid'=$1))
 AND NOT EXISTS(SELECT 1 FROM fanta.teams own WHERE own.league_id=l.id AND own.user_id=$1) ORDER BY l.name,l.id`,[uid])).rows;}finally{c.release();}
}
