import {LIVE_SNAPSHOT_SQL,ROW_LIVE_SNAPSHOT_SQL} from './live-snapshot.mjs';
import {databaseReadCache} from './read-cache.mjs';
import {isProduction} from './release-env.mjs';
import { Pool } from 'pg';
import {getDatabase} from '@netlify/database';
import { ensureCalendar } from "./calendar.mjs";
import {syncRoundRewards} from './progression.mjs';
let pool;
const lightMatches=`SELECT coalesce(jsonb_agg((m - ARRAY['lineups','details','oddsModel']::text[]) || jsonb_build_object('hasLineups',m->'lineups' IS NOT NULL AND m->'lineups'<>'null'::jsonb,'hasDetails',m->'details' IS NOT NULL AND m->'details'<>'null'::jsonb,'lineupRevision',m#>>'{lineups,updatedAt}','detailRevision',coalesce(m#>>'{details,updatedAt}',m#>>'{details,at}'),'detailsComplete',coalesce((m#>>'{details,complete}')::boolean,false)) || CASE WHEN m->>'status'='LIVE' THEN jsonb_build_object('details',jsonb_build_object('events',m#>'{details,events}','updatedAt',m#>'{details,updatedAt}')) ELSE '{}'::jsonb END),'[]'::jsonb) FROM jsonb_array_elements(coalesce(r->'matches','[]'::jsonb)) m`;
const lightRounds=path=>`SELECT coalesce(jsonb_agg((r-'matches')||jsonb_build_object('matches',(${lightMatches}))),'[]'::jsonb) FROM jsonb_array_elements(coalesce(${path},'[]'::jsonb)) r`;
const rowLightRounds=table=>`SELECT coalesce(jsonb_agg((r-'matches')||jsonb_build_object('matches',(${lightMatches})) ORDER BY d.position),'[]'::jsonb)
 FROM ${table} d CROSS JOIN LATERAL (SELECT d.data AS r) snapshot`;
const ROW_GAME_SNAPSHOT_SQL=`SELECT
 (payload-ARRAY['socialIdentities','socialAttempts','socialPending','socialLimits','football','rounds',
  'fantasyConnections','fantasyAttempts','accountTokens','accountRequests','mailOutbox','mailDeliveryLog',
  'adminChallenges','adminLoginLimit','supportMessages','chatSubscriptions','chatPushKeys','chatPushOutbox',
  'reminderOutbox','leagues','ledger','playerRewards','playerProfiles','analysisTextHashes'])
 || jsonb_build_object(
  'leagues',coalesce((SELECT jsonb_agg(l.data ORDER BY old.position NULLS LAST,l.id)
   FROM fanta.bar_league_state l LEFT JOIN jsonb_array_elements(payload->'leagues')
   WITH ORDINALITY old(data,position) ON old.data->>'id'=l.id),'[]'),
  'ledger',coalesce((SELECT jsonb_agg(data ORDER BY position) FROM fanta.bar_credit_ledger),'[]'),
  'rounds',(${rowLightRounds('fanta.bar_matchday_documents')}),
  'playerRewards',coalesce((SELECT jsonb_object_agg(user_id,data) FROM fanta.bar_player_rewards),'{}'),
  'playerProfiles',coalesce((SELECT jsonb_object_agg(profile_key,data) FROM fanta.bar_player_profiles),'{}'),
  'analysisTextHashes',coalesce((SELECT jsonb_object_agg(hash,data) FROM fanta.bar_analysis_hashes),'{}'),
  'football',((payload->'football')-ARRAY['rounds','fixtures','scoreboardCache','editorialLineupCache','forecastSourceCache','calendar'])
   ||jsonb_build_object('calendar',((payload#>'{football,calendar}')-'rounds')
    ||jsonb_build_object('rounds',(${rowLightRounds('fanta.bar_seriea_calendar_documents')})))
 ) AS payload FROM fanta_state WHERE id=1`;
export const GAME_SNAPSHOT_SQL=`SELECT (payload-ARRAY['socialIdentities','socialAttempts','socialPending','socialLimits','football','rounds','fantasyConnections','fantasyAttempts','accountTokens','accountRequests','mailOutbox','mailDeliveryLog','adminChallenges','adminLoginLimit','supportMessages','chatSubscriptions','chatPushKeys','chatPushOutbox','reminderOutbox']::text[]) || jsonb_build_object(
 'rounds',(${lightRounds("payload->'rounds'")}),
 'football',((payload->'football')-ARRAY['rounds','fixtures','scoreboardCache','editorialLineupCache','forecastSourceCache']::text[])||jsonb_build_object('calendar',(payload#>'{football,calendar}')||jsonb_build_object('rounds',(${lightRounds("payload#>'{football,calendar,rounds}'")})))
) AS payload FROM fanta_state WHERE id=1`;
// New accounts have no reason to load the football calendar and every archived
// league before they can create/join their first bar. CASE evaluates only the needed branch.
const loginGameSnapshotSql=({game,leagues,rewards})=>`WITH state AS (SELECT payload FROM fanta_state WHERE id=1), actor AS (SELECT u FROM state CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'users','[]'::jsonb)) u WHERE u->>'id' IN (SELECT a->>'uid' FROM jsonb_array_elements(coalesce(payload->'sessions','[]'::jsonb)) a WHERE a->>'token'=$1))
 SELECT CASE WHEN EXISTS(SELECT 1 FROM ${leagues} CROSS JOIN LATERAL jsonb_array_elements(coalesce(l->'members','[]'::jsonb)) m WHERE m->>'uid' IN(SELECT u->>'id' FROM actor)) THEN (${game})
 ELSE jsonb_build_object('users',coalesce((SELECT jsonb_agg(u) FROM actor),'[]'::jsonb),'sessions',(SELECT coalesce(jsonb_agg(a),'[]'::jsonb) FROM jsonb_array_elements(coalesce(payload->'sessions','[]'::jsonb)) a WHERE a->>'token'=$1),'systemAdminId',payload->'systemAdminId','leagues','[]'::jsonb,'rounds','[]'::jsonb,'ledger','[]'::jsonb,'football','{}'::jsonb,'playerRewards',(SELECT coalesce(jsonb_object_agg(u->>'id',coalesce(${rewards},'[]'::jsonb)),'{}'::jsonb) FROM actor)) END AS payload FROM state`;
export const LOGIN_GAME_SNAPSHOT_SQL=loginGameSnapshotSql({
 game:GAME_SNAPSHOT_SQL,
 leagues:`jsonb_array_elements(coalesce(payload->'leagues','[]'::jsonb)) l`,
 rewards:`payload->'playerRewards'->(u->>'id')`,
});
const ROW_LOGIN_GAME_SNAPSHOT_SQL=loginGameSnapshotSql({
 game:ROW_GAME_SNAPSHOT_SQL,
 leagues:`(SELECT data AS l FROM fanta.bar_league_state) leagues`,
 rewards:`(SELECT data FROM fanta.bar_player_rewards WHERE user_id=u->>'id')`,
});
export const RESULTS_SNAPSHOT_SQL="SELECT jsonb_build_object('users',payload->'users','sessions',payload->'sessions','leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1),'rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->'id','league',r->'league','matches',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m->'id','status',m->'status','score',m->'score','liveScore',m->'liveScore','clock',m->'clock','phase',m->'phase','officialConfirmed',m->'officialConfirmed','void',m->'void','clockUpdatedAt',m->'clockUpdatedAt','scoreUpdatedAt',m->'scoreUpdatedAt')),'[]'::jsonb) FROM jsonb_array_elements(r->'matches') m))),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league'=$1 AND r->>'id'=$2)) AS payload FROM fanta_state WHERE id=1";
export const MATCH_SNAPSHOT_SQL=`SELECT jsonb_build_object('users',payload->'users','sessions',payload->'sessions',
 'leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1),
 'rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->'id','league',r->'league','matches',(SELECT coalesce(jsonb_agg(m),'[]'::jsonb) FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=$3))),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league'=$1 AND r->>'id'=$2),
 'football',jsonb_build_object('calendar',jsonb_build_object('rounds',jsonb_build_array(jsonb_build_object('matches',(SELECT coalesce(jsonb_agg(m),'[]'::jsonb) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m->>'id'=$3)))))
) AS payload FROM fanta_state WHERE id=1`;
// Read-only verdicts: one league/round, compact picks/prices and stored profiles; no match details or media.
export const ANALYSIS_SNAPSHOT_SQL=`SELECT jsonb_build_object('users',payload->'users','sessions',payload->'sessions',
 'leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1),
 'rounds',(SELECT coalesce(jsonb_agg((r-ARRAY['matches','slips']::text[])||jsonb_build_object('slipUids',(SELECT coalesce(jsonb_agg(sl->'uid'),'[]'::jsonb) FROM jsonb_array_elements(coalesce(r->'slips','[]'::jsonb)) sl),'slips',(SELECT coalesce(jsonb_agg(jsonb_build_object('uid',sl->'uid','picks',sl->'picks','stake',sl->'stake','odds',sl->'odds','portrait',sl->'portrait')),'[]'::jsonb) FROM jsonb_array_elements(coalesce(r->'slips','[]'::jsonb)) sl),'matches',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m->'id','home',m->'home','away',m->'away','status',m->'status','score',m->'score','odds',m->'odds','void',m->'void')),'[]'::jsonb) FROM jsonb_array_elements(coalesce(r->'matches','[]'::jsonb)) m))),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league'=$1 AND r->>'id'=$2),
 'playerProfiles',(SELECT coalesce(jsonb_object_agg(k.key,k.value),'{}'::jsonb) FROM jsonb_each(coalesce(payload->'playerProfiles','{}'::jsonb)) k WHERE k.key LIKE $1||':%')
) AS payload FROM fanta_state WHERE id=1`;
const rowLeague=`coalesce((SELECT jsonb_build_array(data) FROM fanta.bar_league_state WHERE id=$1),'[]'::jsonb)`;
const rowDay=`SELECT data,id FROM fanta.bar_matchdays WHERE league_id=$1 AND id=$2`;
const resultFields=['id','status','score','liveScore','clock','phase','officialConfirmed','void','clockUpdatedAt','scoreUpdatedAt'];
const rowMatchSnapshotSql=({matchProjection,matchFilter='',extras=''})=>`SELECT jsonb_build_object(
 'users',payload->'users','sessions',payload->'sessions','leagues',${rowLeague},
 'rounds',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'league',$1,
  'matches',(SELECT coalesce(jsonb_agg(${matchProjection} ORDER BY m.position),'[]'::jsonb)
   FROM fanta.bar_matchday_matches m WHERE m.matchday_id=r.id${matchFilter})))
 FROM (${rowDay}) r),'[]'::jsonb)${extras}
 ) AS payload FROM fanta_state WHERE id=1`;
const ROW_RESULTS_SNAPSHOT_SQL=rowMatchSnapshotSql({
 matchProjection:`jsonb_build_object(${resultFields.map(key=>`'${key}',m.data->'${key}'`).join(',')})`,
});
const ROW_MATCH_SNAPSHOT_SQL=rowMatchSnapshotSql({
 matchProjection:'m.data',
 matchFilter:' AND m.id=$3',
 extras:`,'football',jsonb_build_object('calendar',jsonb_build_object('rounds',
  jsonb_build_array(jsonb_build_object('matches',coalesce(
   (SELECT jsonb_build_array(data) FROM fanta.bar_seriea_matches WHERE id=$3),'[]'::jsonb)))))`,
});
const rowAnalysisMatches=['id','home','away','status','score','odds','void'];
const rowAnalysisSlip=['uid','picks','stake','odds','portrait'];
const projectFields=(fields,alias)=>fields.map(key=>`'${key}',${alias}.data->'${key}'`).join(',');
const ROW_ANALYSIS_SNAPSHOT_SQL=`SELECT jsonb_build_object(
 'users',payload->'users','sessions',payload->'sessions','leagues',${rowLeague},
 'rounds',coalesce((SELECT jsonb_agg((r.data-ARRAY['matches','slips'])||jsonb_build_object(
  'slipUids',(SELECT coalesce(jsonb_agg(s.user_id ORDER BY s.position),'[]'::jsonb) FROM fanta.bar_slips s WHERE s.matchday_id=r.id),
  'slips',(SELECT coalesce(jsonb_agg(jsonb_build_object(${projectFields(rowAnalysisSlip,'s')}) ORDER BY s.position),'[]'::jsonb) FROM fanta.bar_slips s WHERE s.matchday_id=r.id),
  'matches',(SELECT coalesce(jsonb_agg(jsonb_build_object(${projectFields(rowAnalysisMatches,'m')}) ORDER BY m.position),'[]'::jsonb) FROM fanta.bar_matchday_matches m WHERE m.matchday_id=r.id)))
 FROM (${rowDay}) r),'[]'::jsonb),
 'playerProfiles',coalesce((SELECT jsonb_object_agg(profile_key,data) FROM fanta.bar_player_profiles WHERE profile_key LIKE $1||':%'),'{}'::jsonb)
 ) AS payload FROM fanta_state WHERE id=1`;
export function emptyState() {
  return {
    version: 2,
    users: [],
    sessions: [],
    leagues: [],
    rounds: [],
    ledger: [],
    football: { fixtures: {}, rounds: {}, lastSync: null, lastError: null },
  };
}
export async function connection() {
  if (!pool) {
    if(process.env.SELFHOST_RUNTIME==='true'){
      const url=process.env.DATABASE_URL;
      if(!url)throw Error('DATABASE_URL obbligatorio sul server autonomo');
      pool=new Pool({connectionString:url,max:Number(process.env.DB_POOL_MAX)||6,connectionTimeoutMillis:8000,idleTimeoutMillis:30000});
    }else{
      const url=process.env.NETLIFY_DB_URL||process.env.DATABASE_URL;
      if(!isProduction()&&!url)throw Error('Configure an isolated non-production database');
      pool=getDatabase(url?{connectionString:url}:{}).pool;
    }
  }
  return pool.connect();
}
export async function closeDatabase(){const current=pool;pool=undefined;if(current)await current.end();}
export const AUTH_FIELDS=['users','sessions','accountTokens','accountRequests','socialIdentities','socialAttempts','socialPending','socialLimits','legacyRecoveryOperations','accessEvents','adminProvisioned','systemAdminId','adminProvisionError','adminChallenges','adminLoginLimit','mailOutbox','mailDeliveryLog','platformStats','externalStats'];
// Profile edits and support messages never read 26 MB of sports/history data.
export async function profileTransaction(fn,{connect=connection}={}){
 const c=await connect();try{await c.query('BEGIN');const fields=[...AUTH_FIELDS,'playerRewards','supportMessages','fantasyWaitlist'];const row=(await c.query("SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(payload) WHERE key=ANY($1::text[])) AS payload FROM fanta_state WHERE id=1 FOR UPDATE",[fields])).rows[0];if(!row)throw Error('Database non inizializzato');const s={...row.payload,leagues:[],rounds:[],ledger:[]},before=JSON.stringify(Object.fromEntries(fields.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]))),result=await fn(s,c),patch=Object.fromEntries(fields.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));if(JSON.stringify(patch)!==before)await c.query('UPDATE fanta_state SET payload=payload||$1::jsonb WHERE id=1',[JSON.stringify(patch)]);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
// Creating/joining a league needs identity, membership and future bookable rounds,
// never archived match detail, images, rewards or another league's slips.
export async function membershipTransaction(fn,{connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query("SELECT set_config('lock_timeout','5s',true),set_config('statement_timeout','12s',true),set_config('idle_in_transaction_session_timeout','15s',true)");
  await c.query('SELECT pg_advisory_xact_lock(826501)');
  const {rows}=await c.query(`SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(payload) WHERE key=ANY($1::text[])) || jsonb_build_object('leagues',coalesce(payload->'leagues','[]'::jsonb),'rounds','[]'::jsonb,'football',jsonb_build_object('rounds',(SELECT coalesce(jsonb_object_agg(f.key,(r-'matches')||jsonb_build_object('matches',(${lightMatches}))),'{}'::jsonb) FROM jsonb_each(coalesce(payload#>'{football,rounds}','{}'::jsonb)) f CROSS JOIN LATERAL (SELECT f.value AS r) x WHERE r->>'kickoff'>$2 AND (r->>'bookable'='true' OR r->>'ready'='true')))) AS payload FROM fanta_state WHERE id=1 FOR UPDATE`,[AUTH_FIELDS,new Date().toISOString()]);
  if(!rows.length)throw Error('Database non inizializzato');const s=rows[0].payload,before=new Map(Object.entries(s).map(([k,v])=>[k,JSON.stringify(v)])),result=await fn(s,c);
  const patch=Object.fromEntries([...AUTH_FIELDS,'leagues'].filter(k=>s[k]!==undefined&&JSON.stringify(s[k])!==before.get(k)).map(k=>[k,s[k]]));
  if(Object.keys(patch).length||s.rounds.length||s.leagueChats)await c.query("UPDATE fanta_state SET payload=(payload||$1::jsonb)||jsonb_build_object('rounds',coalesce(payload->'rounds','[]'::jsonb)||$2::jsonb,'leagueChats',coalesce(payload->'leagueChats','{}'::jsonb)||$3::jsonb) WHERE id=1",[JSON.stringify(patch),JSON.stringify(s.rounds),JSON.stringify(s.leagueChats||{})]);
  await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});if(e.code==='55P03'||e.code==='57014')throw Object.assign(Error('Il bar è occupato per qualche secondo. Riprova: la richiesta non è stata duplicata.'),{status:503});throw e;}finally{c.release();}
}
// Authentication never transfers fixtures, images or reward history to the Function.
export async function authTransaction(fn,{connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');
  await c.query("SELECT set_config('lock_timeout','5s',true),set_config('statement_timeout','12s',true),set_config('idle_in_transaction_session_timeout','15s',true)");
  const {rows}=await c.query("SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(payload) WHERE key=ANY($1::text[])) AS payload FROM fanta_state WHERE id=1 FOR UPDATE",[AUTH_FIELDS]);
  if(!rows.length)throw Error('Database non inizializzato');
  const s=rows[0].payload||{};s.users??=[];s.sessions??=[];
  const before=JSON.stringify(s),result=await fn(s,c),patch=Object.fromEntries(AUTH_FIELDS.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
  if(JSON.stringify(s)!==before)await c.query("UPDATE fanta_state SET payload=(payload-'platformOwnerId')||$1::jsonb WHERE id=1",[JSON.stringify(patch)]);
  await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});if(e.code==='55P03'||e.code==='57014')throw Object.assign(Error('Accesso momentaneamente occupato. Riprova tra pochi secondi.'),{status:503});throw e;}finally{c.release();}
}
// Snapshot reads never acquire the game-state write lock or serialize assets/history.
export async function readSnapshot(fn,{kind='chat',league,competition,team,assetKind,tokenHash,connect=connection,sportsStorage='snapshot'}={}){
 const rowStorage=sportsStorage==='rows';
 const rowSql={game:tokenHash?ROW_LOGIN_GAME_SNAPSHOT_SQL:ROW_GAME_SNAPSHOT_SQL,live:ROW_LIVE_SNAPSHOT_SQL,
  results:ROW_RESULTS_SNAPSHOT_SQL,match:ROW_MATCH_SNAPSHOT_SQL,analysis:ROW_ANALYSIS_SNAPSHOT_SQL}[kind];
 if(rowStorage&&!rowSql)throw Error('Unsupported row snapshot');
 const c=await connect();
 try{
  const sql=kind==='platform'?'SELECT payload FROM fanta_state WHERE id=1':kind==='live'?LIVE_SNAPSHOT_SQL:kind==='results'?RESULTS_SNAPSHOT_SQL:kind==='match'?MATCH_SNAPSHOT_SQL:kind==='analysis'?ANALYSIS_SNAPSHOT_SQL:kind==='game'?(tokenHash?LOGIN_GAME_SNAPSHOT_SQL:GAME_SNAPSHOT_SQL):kind==='player-auth'?`SELECT jsonb_build_object('systemAdminId',payload->'systemAdminId','sessions',(SELECT coalesce(jsonb_agg(a),'[]'::jsonb) FROM jsonb_array_elements(payload->'sessions') a WHERE a->>'token'=$1),'users',(SELECT coalesce(jsonb_agg(u),'[]'::jsonb) FROM jsonb_array_elements(payload->'users') u WHERE u->>'id' IN (SELECT a->>'uid' FROM jsonb_array_elements(payload->'sessions') a WHERE a->>'token'=$1))) AS payload FROM fanta_state WHERE id=1`:kind==='asset'
   ? `SELECT jsonb_build_object('users',payload->'users','sessions',payload->'sessions','leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1),'barAsset',(SELECT data FROM fanta.bar_assets WHERE league_id=$1 AND competition_key=$2 AND team_id=$3 AND kind=$4)) AS payload FROM fanta_state WHERE id=1`
   : `SELECT jsonb_build_object('users',payload->'users','sessions',payload->'sessions','leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1),'leagueChats',jsonb_build_object($1::text,payload->'leagueChats'->$1::text),'chatReaders',payload->'chatReaders','chatPushKeys',payload->'chatPushKeys') AS payload FROM fanta_state WHERE id=1`;
  const params=kind==='live'?[league]:kind==='results'?[league,competition]:kind==='analysis'?[league,competition]:kind==='match'?[league,competition,team]:kind==='player-auth'||kind==='game'&&tokenHash?[tokenHash]:['game','platform'].includes(kind)?[]:kind==='asset'?[league,competition,team,assetKind]:[league];
  const load=async()=>{
   const s=(await c.query(rowStorage?rowSql:sql,params)).rows[0]?.payload||emptyState();
   if(!['platform','player-auth'].includes(kind))for(const u of s.users||[]){
    if(kind==='game')u.hasLocalPassword=!!u.password;
    for(const key of ['password','salt','resetToken','verificationToken','mfaSecret'])delete u[key];
   }
   return s;
  };
  // xmin changes on every committed game/auth/membership mutation, also when
  // another Function instance writes. Never reuse a writable transaction state.
  const payload=rowStorage||['platform','player-auth'].includes(kind)?await load():await databaseReadCache().read(JSON.stringify(['bar-read-v1',kind,params]),(await c.query('SELECT xmin::text AS revision FROM fanta_state WHERE id=1')).rows[0]?.revision||'missing',load,{ttl:kind==='results'||kind==='live'?60000:300000});
  return fn(payload);
 }finally{c.release();}
}
export async function chatTransaction(fn,{league=null}={}){
 const c=await connection();
 try{
  await c.query('BEGIN');
  const keys=['users','sessions','leagues','chatReaders','chatSubscriptions','chatPushKeys','chatPushOutbox','platformStats','externalStats','adminProvisioned','systemAdminId'];
  const {rows}=await c.query(`SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(payload) WHERE key=ANY($1::text[])) || jsonb_build_object('leagueChats',CASE WHEN $2::text IS NULL THEN coalesce(payload->'leagueChats','{}'::jsonb) ELSE jsonb_build_object($2::text,coalesce(payload->'leagueChats'->$2::text,'{"sequence":0,"messages":[]}'::jsonb)) END) AS payload FROM fanta_state WHERE id=1 FOR UPDATE`,[keys,league]);
  if(!rows.length)throw Error('Database non inizializzato');
  const s=rows[0].payload,result=await fn(s,c),patch={};
  for(const key of ['users','chatReaders','chatSubscriptions','chatPushKeys','chatPushOutbox','platformStats','externalStats'])if(s[key]!==undefined)patch[key]=s[key];
  if(league===null){patch.leagueChats=s.leagueChats;await c.query('UPDATE fanta_state SET payload=payload || $1::jsonb WHERE id=1',[JSON.stringify(patch)]);}
  else await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload || $1::jsonb || jsonb_build_object('leagueChats',coalesce(payload->'leagueChats','{}'::jsonb)),ARRAY['leagueChats',$2::text],$3::jsonb,true) WHERE id=1`,[JSON.stringify(patch),league,JSON.stringify(s.leagueChats[league])]);
  await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
// Reminders never load cached images, match detail or message history.
export async function reminderTransaction(fn){
 const c=await connection();try{
  await c.query('BEGIN');const keys=['users','leagues','chatSubscriptions','chatPushKeys','leagueAlerts','reminderOutbox','reminderRegistry','mailOutbox','mailDeliveryLog','supportMessages','emailReminderRegistry','externalStats','platformStats'];
  const {rows}=await c.query(`SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(payload) WHERE key=ANY($1::text[])) || jsonb_build_object('rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->'id','league',r->'league','title',r->'title','source',r->'source','competitionName',r->'competitionName','kickoff',r->'kickoff','deadline',r->'deadline','settled',r->'settled','closed',r->'closed','calculated',r->'calculated','sourceConflict',r->'sourceConflict','matchCount',jsonb_array_length(coalesce(r->'matches','[]'::jsonb)),'slips',(SELECT coalesce(jsonb_agg(jsonb_build_object('uid',sl->'uid')),'[]'::jsonb) FROM jsonb_array_elements(coalesce(r->'slips','[]'::jsonb)) sl))),'[]'::jsonb) FROM jsonb_array_elements(coalesce(payload->'rounds','[]'::jsonb)) r WHERE NOT coalesce((r->>'settled')::boolean,false))) AS payload FROM fanta_state WHERE id=1 FOR UPDATE`,[keys]);
  if(!rows.length){const result=await fn(emptyState(),c);await c.query('COMMIT');return result;}const s=rows[0].payload,before=JSON.stringify(s),result=await fn(s,c),patch={};for(const k of ['users','chatSubscriptions','chatPushKeys','leagueAlerts','reminderOutbox','reminderRegistry','mailOutbox','mailDeliveryLog','supportMessages','emailReminderRegistry','externalStats','platformStats'])if(s[k]!==undefined)patch[k]=s[k];if(JSON.stringify(s)!==before)await c.query('UPDATE fanta_state SET payload=payload || $1::jsonb WHERE id=1',[JSON.stringify(patch)]);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
// Game writers serialize with each other, without holding the auth row during external work.
export async function transaction(fn,{connect=connection}={}) {
  const c = await connect();
  try {
    await c.query("BEGIN");
    await c.query('SELECT pg_advisory_xact_lock(826501)');
    await c.query(
      "INSERT INTO fanta_state(id,payload) VALUES(1,$1) ON CONFLICT DO NOTHING",
      [JSON.stringify(emptyState())],
    );
    const { rows } = await c.query(
      "SELECT payload,(SELECT jsonb_object_agg(key,md5(value::text)) FROM jsonb_each(payload)) AS fingerprints FROM fanta_state WHERE id=1",
    );
    let s = rows[0].payload;
    const before=new Map(Object.entries(s).map(([k,v])=>[k,JSON.stringify(v)]));
    ensureCalendar(s);
    const result = await fn(s, c);
    syncRoundRewards(s);
    const patch=Object.fromEntries(Object.entries(s).filter(([k,v])=>JSON.stringify(v)!==before.get(k))),removed=[...before.keys()].filter(k=>!(k in s)),keys=[...Object.keys(patch),...removed];
    if(keys.length){
      const current=(await c.query("SELECT (SELECT jsonb_object_agg(key,md5(value::text)) FROM jsonb_each(payload) WHERE key=ANY($1::text[])) AS fingerprints FROM fanta_state WHERE id=1 FOR UPDATE",[keys])).rows[0].fingerprints||{};
      if(keys.some(k=>current[k]!==rows[0].fingerprints?.[k]))throw Object.assign(Error('Dati aggiornati durante l’operazione. Riprova.'),{status:409});
      await c.query('UPDATE fanta_state SET payload=(payload-$1::text[])||$2::jsonb WHERE id=1',[removed,JSON.stringify(patch)]);
    }
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
