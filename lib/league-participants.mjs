import {connection} from './db.mjs';
import {fail,sha} from './game.mjs';
import {barStorageMode} from './storage-mode.mjs';

function accessSql(rows){
 const bars=rows?'SELECT data AS bar FROM fanta.bar_league_state':"SELECT bar FROM root CROSS JOIN LATERAL jsonb_array_elements(root.payload->'leagues') AS bar";
 return `WITH root AS (
  SELECT payload FROM public.fanta_state WHERE id=1
 ), actor AS (
  SELECT u->>'id' AS uid,lower(u->>'username') AS username FROM root
  CROSS JOIN LATERAL jsonb_array_elements(payload->'sessions') a
  JOIN LATERAL jsonb_array_elements(payload->'users') u ON u->>'id'=a->>'uid'
  WHERE a->>'token'=$1 AND (a->>'expires')::numeric>$2 AND u->>'emailVerified'='true'
  AND coalesce(u->>'demo','false')='false' AND coalesce(u->>'adminOnly','false')='false'
  LIMIT 1
 ), bars AS (${bars}), chosen AS (
  SELECT a.uid,b.bar,l.id AS fanta_id,l.kind,l.admin_uid
  FROM actor a JOIN bars b ON b.bar->>'id'=$3
  LEFT JOIN fanta.bar_links link ON link.bar_league_id=$3 AND link.active
  LEFT JOIN fanta.leagues l ON l.id=link.fanta_league_id AND l.rules->>'disabledAt' IS NULL
  WHERE $4='bar' AND coalesce(b.bar->>'demo','false')='false' AND b.bar->>'disabledAt' IS NULL
  AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.bar->'members') m WHERE m->>'uid'=a.uid)
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(b.bar->'removedMembers','[]')) m WHERE m->>'uid'=a.uid)
  UNION ALL
  SELECT a.uid,b.bar,l.id,l.kind,l.admin_uid
  FROM actor a JOIN fanta.leagues l ON l.id=$3 AND l.rules->>'disabledAt' IS NULL
  LEFT JOIN fanta.bar_links link ON link.fanta_league_id=$3 AND link.active
  LEFT JOIN bars b ON b.bar->>'id'=link.bar_league_id AND b.bar->>'disabledAt' IS NULL
  WHERE $4='fanta' AND (l.source_key IS NULL OR a.username='frankwood')
  AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=$3 AND t.user_id=a.uid)
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(b.bar->'removedMembers','[]')) m WHERE m->>'uid'=a.uid)
  ORDER BY 2 NULLS LAST LIMIT 1
 ), teams AS (
  SELECT t.id,t.name,t.color,t.branding,t.user_id FROM chosen k JOIN fanta.teams t ON t.league_id=k.fanta_id
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(k.bar->'removedMembers','[]')) m WHERE m->>'uid'=t.user_id)
 ), member_ids AS (
  SELECT m->>'uid' AS uid FROM chosen k CROSS JOIN LATERAL jsonb_array_elements(k.bar->'members') m
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(k.bar->'removedMembers','[]')) r WHERE r->>'uid'=m->>'uid')
  UNION SELECT user_id FROM teams WHERE user_id IS NOT NULL
 )`;
}
const crestUrl=(league,mode,team)=>'/api/league-participants/logo?'+new URLSearchParams({league,mode,team});
export async function readLeagueParticipants(token,league,mode,{logo=null,connect=connection,sportsStorage=barStorageMode()}={}){
 if(typeof league!=='string'||!league||league.length>200||!['bar','fanta'].includes(mode))fail('Lega non accessibile',403);
 const args=[sha(token||''),Date.now(),league,mode];
 const c=await connect();
 try{
  const sql=accessSql(sportsStorage==='rows');
  if(logo){
   const row=(await c.query(sql+` SELECT logo.data,logo.mime FROM teams t
    JOIN fanta.team_logos logo ON logo.team_id=t.id WHERE t.id=$5`,[...args,logo])).rows[0];
   if(!row)fail('Logo non disponibile',404);
   return row;
  }
  const row=(await c.query(sql+` SELECT k.uid,k.admin_uid,k.kind,k.fanta_id,
   CASE WHEN k.bar IS NULL THEN NULL ELSE jsonb_build_object('id',k.bar->'id','code',k.bar->'code','name',k.bar->'name','admin',k.bar->'admin') END AS bar,
   coalesce((SELECT data->>'status' FROM fanta.auctions WHERE league_id=k.fanta_id),'none') AS auction,
   coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name,t.id) FROM teams t),'[]') AS teams,
   coalesce((SELECT jsonb_agg(jsonb_build_object(
     'uid',u->>'id','name',coalesce(u->>'name',u->>'username'),'avatar',u->'avatar',
     'email',CASE WHEN u->>'emailVerified'='true' THEN u->'email' END)
    ORDER BY lower(coalesce(u->>'name',u->>'username')),u->>'id')
    FROM root CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u
    JOIN member_ids m ON m.uid=u->>'id' WHERE coalesce(u->>'adminOnly','false')='false'),'[]') AS people
   FROM chosen k`,args)).rows[0];
  if(!row)fail('Lega non accessibile',403);
  const {uid,bar,fanta_id,kind,admin_uid,auction}=row,adminUid=bar?.admin||admin_uid;
  const teamsByUser=new Map();
  const bots=[];
  for(const t of row.teams){
   const {id,name,color}=t,branding=t.branding||{};
   const team={id,name,color,branding:branding.type==='image'&&branding.imageUrl?.startsWith('/fanta-api/')?{type:'image',imageUrl:crestUrl(league,mode,id)}:branding};
   if(t.user_id)teamsByUser.set(t.user_id,team);
   else bots.push({team});
  }
  const members=row.people.map(p=>({...p,team:teamsByUser.get(p.uid)||null,isMe:p.uid===uid,isAdmin:p.uid===adminUid}));
  return {bar,isAdmin:uid===adminUid,
   fanta:fanta_id?{id:fanta_id,kind,auction,isCoach:teamsByUser.has(uid),isAdmin:uid===admin_uid}:null,
   members:[...members,...bots]};
 }finally{c.release();}
}
