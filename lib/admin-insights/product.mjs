import {connection} from '../db.mjs';

// Projection happens in PostgreSQL: no sports payload, chat text, emails or password fields leave the DB.
export const PRODUCT_SQL=`SELECT jsonb_build_object(
 'users',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',u->'id','createdAt',u->'createdAt','verifiedAt',u->'emailVerifiedAt','verified',u->'emailVerified','lastSeenAt',u->'lastSeenAt','lastLoginAt',u->'lastLoginAt')),'[]'::jsonb) FROM jsonb_array_elements(coalesce(payload->'users','[]'::jsonb)) u WHERE coalesce((u->>'adminOnly')::boolean,false)=false AND coalesce((u->>'demo')::boolean,false)=false),
 'leagues',(SELECT count(*) FROM jsonb_array_elements(coalesce(payload->'leagues','[]'::jsonb)) l WHERE coalesce((l->>'demo')::boolean,false)=false),
 'slips',(SELECT count(*) FROM jsonb_array_elements(coalesce(payload->'rounds','[]'::jsonb)) r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'slips','[]'::jsonb)) b),
 'stats',payload->'platformStats','external',payload->'externalStats',
 'mailPending',jsonb_array_length(coalesce(payload->'mailOutbox','[]'::jsonb)),
 'mailFailures',(SELECT count(*) FROM jsonb_array_elements(coalesce(payload->'mailDeliveryLog','[]'::jsonb)) m WHERE m->>'result'='failed' AND (m->>'at')::numeric > $1)
 ) AS data FROM fanta_state WHERE id=1`;
const FANTA_SQL=`SELECT (SELECT count(*) FROM fanta.leagues WHERE rules->>'disabledAt' IS NULL) AS leagues,(SELECT count(*) FROM fanta.teams WHERE user_id IS NOT NULL) AS coached,(SELECT count(*) FROM fanta.teams) AS teams,(SELECT count(*) FROM fanta.lineups) AS lineups`;
const number=x=>Math.max(0,Number(x)||0);
export function summarizeProduct(data={},native={},now=Date.now()){
 const users=data.users||[],week=now-7*86400000,month=now-28*86400000,known=users.filter(u=>Number.isFinite(Date.parse(u.createdAt)));
 const days=Object.entries(data.stats?.days||{}).sort().slice(-90).map(([date,d])=>({date,requests:number(d.requests),errors:number(d.errors),activeUsers:Object.keys(d.users||{}).filter(id=>users.some(u=>u.id===id)).length,routes:Object.fromEntries(Object.entries(d.routes||{}).map(([name,r])=>[name,{calls:number(r.calls),errors:number(r.errors),milliseconds:number(r.milliseconds)}]))}));
 const recent=days.filter(d=>Date.parse(d.date)>=month&&Date.parse(d.date)<now),requests=recent.reduce((s,d)=>s+d.requests,0),errors=recent.reduce((s,d)=>s+d.errors,0);
 return {capturedAt:new Date(now).toISOString(),users:users.length,verified:users.filter(u=>u.verified===true).length,unknownRegistrationDates:users.length-known.length,registered7:known.filter(u=>Date.parse(u.createdAt)>=week).length,registered28:known.filter(u=>Date.parse(u.createdAt)>=month).length,active7:users.filter(u=>Math.max(Date.parse(u.lastSeenAt)||0,Date.parse(u.lastLoginAt)||0)>=week).length,barLeagues:number(data.leagues),slips:number(data.slips),fanta:{leagues:number(native.leagues),coached:number(native.coached),teams:number(native.teams),lineups:number(native.lineups)},requests,errors,errorRate:requests?errors/requests:null,days,mail:{pending:number(data.mailPending),failures24:number(data.mailFailures)},external:data.external||{},telemetryStartedAt:data.stats?.startedAt||null,telemetryNote:'Contatori operativi dell’app, non visite: i buffer possono non essere ancora persistiti. Nessun confronto diretto con le sessioni Google.'};
}
export async function loadProduct({connect=connection,now=Date.now()}={}){
 const c=await connect();try{
  await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL statement_timeout='15s'");
  const data=(await c.query(PRODUCT_SQL,[now-86400000])).rows[0]?.data||{};
  const native=(await c.query(FANTA_SQL)).rows[0]||{};
  await c.query('COMMIT');return summarizeProduct(data,native,now);
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
