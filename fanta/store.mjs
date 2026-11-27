import {barStorageRoot} from '../lib/storage-mode.mjs';
import {fantaAccessSql} from '../lib/league-game-access.mjs';
import {readSerieARoundWindows} from '../lib/seriea-round-window.mjs';
import {saveLineup} from './lineup-save.mjs';
import {activateCompletedLeague} from './competition-activation.mjs';
import {readyRosters} from './competitions.mjs';
import {applyRosterRows,persistRosterBatch,persistRosterChanges} from './roster-persistence.mjs';
import {applyRosterBatch,inverseRosterOrder,rosterEditorView} from './roster-editor.mjs';
import {readTradeStatus} from './trades.mjs';
import {connection} from '../lib/db.mjs';
import {databaseReadCache} from '../lib/read-cache.mjs';
import {resolveLeagueBindings} from './player-identities.mjs';
import {createHash} from 'node:crypto';
import {DEFAULT_RULES,fail} from './rules.mjs';
import {teamBudget} from './auction.mjs';
import {currentRound,currentRoundNumberSQL,teamLineupRound} from './round-selection.mjs';
const iso=x=>x instanceof Date?x.toISOString():x;
const selectCompetition=param=>`SELECT c.* FROM fanta.competitions c WHERE c.league_id=l.id AND (${param}::text IS NULL OR c.id=${param}) ORDER BY CASE WHEN c.id=l.id||':main' THEN 0 ELSE 1 END,c.created_at,c.id LIMIT 1`;
// A team's name is shared by every competition in the league.
const FIRST_TEAM_KICKOFF=`(SELECT min(coalesce(
 (SELECT min(f.kickoff) FROM fanta.fixtures f WHERE f.season=l.season AND f.round=coalesce(first_round.seriea_round,c.start_round)),
 first_round.deadline))
 FROM fanta.competitions c LEFT JOIN LATERAL(
  SELECT r.seriea_round,r.deadline FROM fanta.rounds r WHERE r.competition_id=c.id ORDER BY r.number LIMIT 1
 ) first_round ON true
 WHERE c.league_id=l.id AND (c.status<>'draft' OR first_round.deadline IS NOT NULL)) AS team_name_deadline`;
// One consistent read replaces a transaction with a round trip for every table.
function leagueReadSQL(roundOnly){
 const matchRound=roundOnly?' AND m.round=$3::int':'';
 const lineupRound=roundOnly?' AND round=$3::int AND competition_id=selected.id':'';
 const serieARound=roundOnly?' AND f.round=(SELECT seriea_round FROM fanta.rounds WHERE competition_id=selected.id AND number=$3::int)':'';
 // The other days only need a submission marker for the round selector.
 const lineup=roundOnly?`CASE WHEN r.round=$3::int THEN to_jsonb(r) ELSE jsonb_build_object(
  'round',r.round,'team_id',r.team_id,'inherited_from',r.inherited_from,'starters','[]'::jsonb,'bench','[]'::jsonb) END`:'r';
 return `SELECT l.*,row_to_json(selected) AS competition,${FIRST_TEAM_KICKOFF},(SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model') AS vote_model_key,
 (SELECT coalesce(jsonb_agg(c ORDER BY c.created_at,c.id),'[]') FROM fanta.competitions c WHERE c.league_id=l.id) AS competitions,
 (SELECT coalesce(jsonb_agg(t ORDER BY t.id),'[]') FROM fanta.teams t WHERE t.league_id=l.id) AS teams,
 (SELECT coalesce(jsonb_agg(p.data||jsonb_build_object('id',p.id,'name',p.name,'shirtName',p.shirt_name,'role',p.role,'club',c.name,'clubId',p.club_id)),'[]') FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id WHERE $5::boolean OR p.id IN(SELECT player_id FROM fanta.rosters WHERE league_id=$1 UNION SELECT player_id FROM fanta.roster_entries WHERE league_id=$1 AND player_id IS NOT NULL UNION SELECT player_id FROM fanta.player_bindings WHERE league_id=$1 UNION SELECT jsonb_array_elements_text(starters||bench) FROM fanta.lineups WHERE league_id=$1${lineupRound})) AS players,
 (SELECT coalesce(jsonb_agg(r),'[]') FROM fanta.rosters r WHERE r.league_id=l.id) AS rosters,
 (SELECT coalesce(jsonb_agg(e),'[]') FROM fanta.roster_entries e WHERE e.league_id=l.id) AS entries,
 (SELECT data FROM fanta.auctions WHERE league_id=l.id) AS auction,
 (SELECT coalesce(jsonb_agg(r ORDER BY r.number),'[]') FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id) AS rounds,
 (SELECT coalesce(jsonb_agg(m ORDER BY m.round,m.id),'[]') FROM fanta.matchups m WHERE m.league_id=l.id AND m.competition_id=selected.id${matchRound}) AS matchups,
 (SELECT coalesce(jsonb_agg(r ORDER BY m.round),'[]') FROM fanta.results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=l.id AND m.competition_id=selected.id${matchRound}) AS results,
 (SELECT coalesce(jsonb_agg(r),'[]') FROM fanta.reference_results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=l.id AND m.competition_id=selected.id${matchRound}) AS references,
 (SELECT coalesce(jsonb_agg(${lineup} ORDER BY r.round),'[]') FROM fanta.lineups r WHERE r.league_id=l.id AND r.competition_id=selected.id) AS lineups,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'round',f.round,'kickoff',f.kickoff,'status',f.status,'home_id',f.home_id,'away_id',f.away_id,'frozen_at',f.frozen_at,'data',jsonb_build_object('goals',f.data->'goals','teams',f.data->'teams'))),'[]') FROM fanta.fixtures f WHERE f.season=l.season${serieARound}) AS fixtures,
 (SELECT coalesce(jsonb_agg(v),'[]') FROM (SELECT DISTINCT ON(v.player_id) v.player_id,CASE WHEN $6::boolean THEN v.data ELSE jsonb_build_object('status',v.data->'status','vote',v.data->'vote','fantavote',v.data->'fantavote','events',v.data->'events','needsReview',v.data->'needsReview') END AS data,v.official FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE f.season=l.season AND (NOT EXISTS(SELECT 1 FROM fanta.jobs WHERE id='votes:active-model') OR v.model_key=(SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model')) AND f.round=(SELECT seriea_round FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id AND r.number=${currentRoundNumberSQL} LIMIT 1) ORDER BY v.player_id,v.id DESC) v) AS votes,
 (SELECT coalesce(jsonb_agg(i.data),'[]') FROM fanta.import_issues i WHERE i.league_id=l.id) AS review,
 (SELECT coalesce(jsonb_agg(b),'[]') FROM fanta.player_bindings b WHERE b.league_id=l.id) AS bindings
 FROM fanta.leagues l JOIN LATERAL(${selectCompetition('$4')}) selected ON true WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND ${fantaAccessSql('l','$2')} AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)`;
}
const READ_LEAGUE_SQL=leagueReadSQL(false),READ_ROUND_SQL=leagueReadSQL(true);
function readState(l){
 const teams=l.teams.map(t=>({id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{},creditAdjustment:t.credit_adjustment||0,coachName:t.coach_name,userId:t.user_id,joinedAt:t.joined_at,roster:[]})),byId=new Map(l.players.map(p=>[p.id,p]));
 for(const r of l.rosters)teams.find(t=>t.id===r.team_id)?.roster.push({...byId.get(r.player_id),price:r.price});
 applyEntries(teams,byId,l.entries||[]);
 return {voteModel:l.vote_model_key,teamNameDeadline:iso(l.team_name_deadline),league:{id:l.id,name:l.name,season:l.season,kind:l.kind,accessEnabled:l.rules?.accessEnabled!==false,slipsEnabled:l.slips_enabled!==false,pilotNumber:l.pilot_number,autoLineupsFrom:l.auto_lineups_from,adminUid:l.admin_uid,accent:l.accent,branding:l.rules?.leagueIdentity,maxMembers:l.max_members,inviteCode:l.invite_code},competition:l.competition,competitions:l.competitions,rules:{...DEFAULT_RULES,...l.rules,benchMax:null},teams,players:l.players,auction:{status:'none',mode:'live',version:1,log:[],order:[],lot:null,table:null,...l.auction},rounds:l.rounds,matchups:l.matchups,results:l.results,references:l.references,lineups:l.lineups,fixtures:l.fixtures,votes:l.votes,importReview:l.review};
}
function applyEntries(teams,byId,entries){for(const t of teams){const own=entries.filter(e=>e.team_id===t.id);if(!own.length)continue;const extra=t.roster.filter(p=>!own.some(e=>e.player_id===p.id));t.roster=[...own.map(e=>({...byId.get(e.player_id),id:e.player_id||e.source_id,name:e.name,role:e.role,club:byId.get(e.player_id)?.club||e.data.club||'',price:e.price,unmapped:!e.player_id})),...extra];}}

const rosterAdmin=`l.id=$1 AND l.admin_uid=$2 AND l.rules->>'disabledAt' IS NULL
 AND EXISTS(SELECT 1 FROM fanta.teams WHERE league_id=l.id AND user_id=$2)`;
const assignedPlayer=`SELECT player_id FROM fanta.rosters WHERE league_id=$1
 UNION SELECT player_id FROM fanta.roster_entries WHERE league_id=$1 AND player_id IS NOT NULL`;
const ROSTER_EDITOR_SQL=`SELECT l.id,l.kind,l.season,l.max_members,l.rules,
 (SELECT coalesce(jsonb_agg(t ORDER BY t.name,t.id),'[]') FROM fanta.teams t WHERE t.league_id=l.id) AS teams,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'shirtName',p.shirt_name,'role',p.role,'club',c.name,
  'active',p.data->'active',
  'jersey',COALESCE(p.data->>'jersey',p.data->>'number',p.data#>>'{seasonStats,games,number}'))),'[]')
  FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id WHERE p.id=ANY($3::text[]) OR p.id IN (${assignedPlayer})) AS players,
 (SELECT coalesce(jsonb_agg(r),'[]') FROM fanta.rosters r WHERE r.league_id=l.id) AS rosters,
 (SELECT coalesce(jsonb_agg(e),'[]') FROM fanta.roster_entries e WHERE e.league_id=l.id) AS entries,
 (SELECT CASE WHEN $4::boolean THEN a.data ELSE jsonb_build_object('status',a.data->'status') END FROM fanta.auctions a WHERE a.league_id=l.id) AS auction
 FROM fanta.leagues l WHERE ${rosterAdmin}`;
async function readRosterEditor(c,id,uid,playerIds=[],write=false){
 const {rows:[row]}=await c.query(ROSTER_EDITOR_SQL,[id,uid,playerIds,write]);
 if(!row)fail('Serve il presidente di lega',403);
 return readState(row);
}
const rosterAdditions=input=>input.changes.filter(change=>change.kind==='add').map(change=>change.playerId);
async function rosterReceipt(c,id,uid,input){
 const {rows:[receipt]}=await c.query(`SELECT data->'input'=$4::jsonb AS same FROM fanta.roster_changes
  WHERE league_id=$1 AND actor=$2 AND kind='batch' AND data->'input'->>'requestId'=$3 LIMIT 1`,[id,uid,input.requestId,JSON.stringify(input)]);
 if(receipt&&!receipt.same)fail('Identificativo di salvataggio già usato',409);
 return receipt;
}
async function requireRosterAdmin(c,id,uid,lock=false){
 if(!(await c.query(`SELECT l.id FROM fanta.leagues l WHERE ${rosterAdmin}${lock?' FOR UPDATE':''}`,[id,uid])).rows.length)fail('Serve il presidente di lega',403);
}
async function writeRoster(c,id,uid,fn){
 await c.query('BEGIN');
 try{
  // The same league lock serializes corrections, auctions and trades.
  await requireRosterAdmin(c,id,uid,true);
  const result=await fn();
  await c.query('COMMIT');
  return result;
 }catch(error){await c.query('ROLLBACK');throw error;}
}
async function finishRoster(c,state,now,{activate=true}={}){
 if(activate){
  const activation=await activateCompletedLeague(c,state,{now});
  if(activation.status==='active')state.auction.competitionActivation=activation;
 }
 await c.query('UPDATE fanta.auctions SET version=$2,data=$3 WHERE league_id=$1',[state.league.id,state.auction.version,JSON.stringify(state.auction)]);
 if(process.env.SELFHOST_RUNTIME==='true')await c.query("SELECT pg_notify('quasi_auction',$1)",[JSON.stringify({league:state.league.id,version:state.auction.version})]);
}
export const AUTH_SQL=`SELECT u->>'id' AS id,u->>'username' AS username,u->>'name' AS name,(u->>'emailVerified')::boolean AS verified,(u->>'demo')::boolean AS demo,(u->>'adminOnly')::boolean AS admin_only FROM ${barStorageRoot()} s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'sessions') a JOIN LATERAL jsonb_array_elements(s.payload->'users') u ON u->>'id'=a->>'uid' WHERE a->>'token'=$1 AND (a->>'expires')::numeric>$2 LIMIT 1`;
export function sqlFantaStore({connect=connection,readCache=connect===connection?databaseReadCache():null}={}){
 const use=async fn=>{const c=await connect();try{return await fn(c);}finally{c.release();}};
 return {
  auctionStatusForSession:(token,league)=>use(async c=>{
   const row=(await c.query(`WITH actor AS (${AUTH_SQL}) SELECT coalesce(a.data->>'status','none') AS status,coalesce(a.version,1) AS version,a.data->>'mode' AS mode,a.data->>'type' AS type,a.data->>'startsAt' AS "startsAt" FROM actor u JOIN fanta.teams t ON t.user_id=u.id JOIN fanta.leagues l ON l.id=t.league_id LEFT JOIN fanta.auctions a ON a.league_id=l.id WHERE l.id=$3 AND u.verified AND NOT coalesce(u.demo,false) AND NOT coalesce(u.admin_only,false) AND l.rules->>'disabledAt' IS NULL AND ${fantaAccessSql('l','u.id')} AND (l.source_key IS NULL OR lower(u.username)='frankwood') LIMIT 1`,[createHash('sha256').update(token||'').digest('hex'),Date.now(),league])).rows[0];
   if(!row)fail('Lega non accessibile',403);return row;
  }),
  identity:token=>use(async c=>(await c.query(AUTH_SQL,[createHash('sha256').update(token||'').digest('hex'),Date.now()])).rows[0]||null),
  logo:(uid,league,team)=>use(async c=>(await c.query('SELECT a.data,a.mime,a.digest FROM fanta.team_logos a JOIN fanta.teams t ON t.id=a.team_id WHERE t.id=$3 AND t.league_id=$2 AND EXISTS(SELECT 1 FROM fanta.teams own WHERE own.league_id=$2 AND own.user_id=$1)',[uid,league,team])).rows[0]||null),
  leagues:uid=>use(async c=>(await c.query(`SELECT l.*,t.id AS team_id,t.name AS team_name,
    EXISTS(SELECT 1 FROM fanta.bar_links b WHERE b.fanta_league_id=l.id AND b.active) AS linked
    FROM fanta.leagues l JOIN fanta.teams t ON t.league_id=l.id AND t.user_id=$1 WHERE l.rules->>'disabledAt' IS NULL ORDER BY l.id`,[uid])).rows.map(x=>({id:x.id,name:x.name,season:x.season+'/'+String(x.season+1).slice(-2),role:x.admin_uid===uid?'admin':'member',accessEnabled:x.rules?.accessEnabled!==false,accent:x.accent,branding:x.rules?.leagueIdentity,linked:x.linked,teamName:x.team_name,teamId:x.team_id,kind:x.kind,sourceKey:x.source_key,slipsEnabled:x.slips_enabled!==false}))),
  saveLeagueIdentity:(uid,id,{name,accent,branding})=>use(async c=>{
   const {rows}=await c.query(`UPDATE fanta.leagues l SET name=$3,accent=$4,rules=jsonb_set(rules,'{leagueIdentity}',$5::jsonb)
     WHERE l.id=$1 AND l.admin_uid=$2 AND l.rules->>'disabledAt' IS NULL
      AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)
      AND NOT EXISTS(SELECT 1 FROM fanta.bar_links b WHERE b.fanta_league_id=l.id AND b.active)
     RETURNING l.id`,[id,uid,name,accent,JSON.stringify(branding)]);
   if(!rows.length)fail('Modifica l’identità dal pannello della lega collegata',409);
   return (await c.query('SELECT user_id FROM fanta.teams WHERE league_id=$1 AND user_id IS NOT NULL',[id])).rows.map(row=>row.user_id);
  }),
  settings:(uid,next)=>use(async c=>{if(next)await c.query('INSERT INTO fanta.notification_settings VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data',[uid,JSON.stringify(next)]);return (await c.query('SELECT data FROM fanta.notification_settings WHERE user_id=$1',[uid])).rows[0]?.data||{notify:{lineupReminder:true,roundStart:true,liveEvents:true,results:true,auction:true}};}),
  tradeStatus:(id,uid,now)=>use(c=>readTradeStatus(c,id,uid,now)),
  rosterEditor:(uid,id)=>use(async c=>rosterEditorView(await readRosterEditor(c,id,uid))),
  rosterPlayers:(uid,id)=>use(async c=>{
   const {rows:[row]}=await c.query(`SELECT (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'role',p.role,'club',c.name,'value',p.data->'value')),'[]')
    FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id
    WHERE COALESCE(p.data->'active','true'::jsonb)<>'false'::jsonb AND p.id NOT IN (${assignedPlayer})) AS players
    FROM fanta.leagues l WHERE ${rosterAdmin}`,[id,uid]);
   if(!row)fail('Serve il presidente di lega',403);
   return row.players;
  }),
  checkRosterBatch:(uid,id,input)=>use(async c=>{
   const state=await readRosterEditor(c,id,uid,rosterAdditions(input));
   if(!await rosterReceipt(c,id,uid,input))applyRosterBatch(state,input.changes,{validateLimits:false});
   return {ok:true};
  }),
  saveRosterBatch:(uid,id,input,now)=>use(c=>writeRoster(c,id,uid,async()=>{
    const receipt=await rosterReceipt(c,id,uid,input);
    const before=await readRosterEditor(c,id,uid,receipt?[]:rosterAdditions(input),!receipt);
    let after=before;
    if(!receipt){
     const result=applyRosterBatch(before,input.changes);after=result.state;
     await persistRosterBatch(c,id,uid,input,result.audit,now);
     await finishRoster(c,after,now);
    }
    return rosterEditorView(after);
  })),
  rosterOrders:(uid,id,before)=>use(async c=>{
   await requireRosterAdmin(c,id,uid);
   const {rows}=await c.query(`SELECT a.id::text AS id,a.created_at AS "createdAt",a.data->'changes' AS changes
    FROM fanta.roster_changes a WHERE a.league_id=$1 AND a.kind='batch' AND NOT (a.data ? 'reversedAt')
    AND ($2::bigint IS NULL OR a.id<$2) ORDER BY a.id DESC LIMIT 21`,[id,before]);
   const orders=rows.slice(0,20);
   return {orders,next:rows.length>20?orders.at(-1).id:null};
  }),
  undoRosterOrder:(uid,id,orderId,now)=>use(c=>writeRoster(c,id,uid,async()=>{
   const {rows:[order]}=await c.query(`SELECT data,created_at FROM fanta.roster_changes
    WHERE league_id=$1 AND id=$2 AND kind='batch'`,[id,orderId]);
   if(!order)fail('Ordine di correzione non trovato',404);
   if(order.data.reversedAt)return rosterEditorView(await readRosterEditor(c,id,uid));
   const playerIds=order.data.changes.map(change=>(change.before||change.after).id);
   const {rows:[conflict]}=await c.query(`SELECT (EXISTS(
    SELECT 1 FROM fanta.roster_changes newer CROSS JOIN LATERAL jsonb_array_elements(newer.data->'changes') AS entries(change)
    WHERE newer.league_id=$1 AND newer.id>$2 AND NOT (newer.data ? 'reversedAt')
      AND COALESCE(change->>'id',change->'before'->>'id',change->'after'->>'id')=ANY($3::text[])
    ) OR EXISTS(SELECT 1 FROM fanta.sales WHERE league_id=$1 AND created_at>$4 AND NOT undone AND player_id=ANY($3::text[]))) AS found`,[id,orderId,playerIds,order.created_at]);
   if(conflict.found)fail('Una correzione o un acquisto successivo riguarda gli stessi calciatori. Annulla prima le correzioni successive coinvolte.',409);
   const before=await readRosterEditor(c,id,uid,playerIds,true);
   const {state,audit,restore}=inverseRosterOrder(before,order.data);
   try{await applyRosterRows(c,id,audit,now,restore);}
   catch(error){if(['23503','23505'].includes(error.code))fail('Alcune assegnazioni sono cambiate e la rosa precedente non è più ripristinabile.',409);throw error;}
   await finishRoster(c,state,now,{activate:false});
   await c.query(`UPDATE fanta.roster_changes SET data=data||jsonb_build_object('reversedAt',$3::text,'reversedBy',$4::text)
    WHERE league_id=$1 AND id=$2`,[id,orderId,new Date(now).toISOString(),uid]);
   return rosterEditorView(state);
  })),
  async teamLineupWatch(id,competition,now){return use(async c=>{
   const {rows:[league]}=await c.query(`SELECT l.season,l.source_key,l.admin_uid,l.rules->>'accessEnabled' IS DISTINCT FROM 'false' AS access_enabled,
    (SELECT data->>'revision' FROM fanta.jobs WHERE id='availability:current:'||l.season::text) AS availability_revision,
    ARRAY(SELECT t.user_id FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id IS NOT NULL) AS members,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('number',r.number,'seriea_round',r.seriea_round,'deadline',r.deadline,'official',r.official,
     'data',jsonb_build_object('archivedWithoutResults',r.data->'archivedWithoutResults'))),'[]') FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id) AS rounds
    FROM fanta.leagues l JOIN LATERAL(${selectCompetition('$2')}) selected ON true WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL`,[id,competition||null]);
   if(!league)return null;
   const submissionWindows=await readSerieARoundWindows(c,{season:league.season});
   const {round,...lineupRound}=teamLineupRound({...league,submissionWindows},now);
   return {sourceKey:league.source_key,members:league.members,accessEnabled:league.access_enabled,adminUid:league.admin_uid,lineupRound:{...lineupRound,availabilityRevision:league.availability_revision}};
  });},
  async league(uid,id,fn,{write=false,auction=false,market=false,number,competition,catalog=true,detailedVotes=true,roundOnly=false,teamIdentity=false,calculation=false,submissionWindows=false}={}){return use(async c=>{
   if(!write&&!auction&&!market){
    const scope=roundOnly&&!!number;
    const load=async()=>(await c.query(scope?READ_ROUND_SQL:READ_LEAGUE_SQL,[id,uid,number?Number(number):null,competition||null,catalog,detailedVotes])).rows[0];let l;
    if(readCache){const access=(await c.query(`SELECT l.admin_uid,r.revision::text AS revision FROM fanta.leagues l CROSS JOIN fanta.cache_revision r WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND ${fantaAccessSql('l','$2')} AND r.id=1 AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)`,[id,uid])).rows[0];if(!access)fail('Lega non accessibile',403);l=await readCache.read(JSON.stringify([scope?'fanta-round-v1':'fanta-read-v3',id,number||null,competition||null,catalog,detailedVotes]),access.revision,load,{ttl:60000});}
    else l=await load();if(!l)fail('Lega non accessibile',403);const s=resolveLeagueBindings({...readState(l),bindings:l.bindings||[]});if(s.league.adminUid!==uid)s.importReview=[];
    if(submissionWindows)s.submissionWindows=await readSerieARoundWindows(c,{season:s.league.season});
    return fn(s,c);
   }
   await c.query('BEGIN');try{
    const l=(await c.query(`SELECT l.* FROM fanta.leagues l WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND ${fantaAccessSql('l','$2')} AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)${write?' FOR UPDATE':market?' FOR SHARE':''}`,[id,uid])).rows[0];if(!l)fail('Lega non accessibile',403);
    const teamNameDeadline=teamIdentity?iso((await c.query(`SELECT ${FIRST_TEAM_KICKOFF} FROM fanta.leagues l WHERE l.id=$1`,[id])).rows[0].team_name_deadline):null;
    const league={id:l.id,name:l.name,season:l.season,kind:l.kind,accessEnabled:l.rules?.accessEnabled!==false,slipsEnabled:l.slips_enabled!==false,pilotNumber:l.pilot_number,autoLineupsFrom:l.auto_lineups_from,adminUid:l.admin_uid,accent:l.accent,maxMembers:l.max_members,inviteCode:l.invite_code};
    const rules={...DEFAULT_RULES,...l.rules,benchMax:null};
    const competitions=market?[]:(await c.query('SELECT * FROM fanta.competitions WHERE league_id=$1 ORDER BY created_at,id',[id])).rows,selected=competitions.find(x=>x.id===(competition||id+':main'))||(!competition?competitions[0]:null);if(!selected&&!market)fail('Competizione non accessibile',403);
    const teams=(await c.query('SELECT * FROM fanta.teams WHERE league_id=$1 ORDER BY id'+(market&&write?' FOR UPDATE':''),[id])).rows.map(t=>({id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{},creditAdjustment:t.credit_adjustment||0,coachName:t.coach_name,userId:t.user_id,joinedAt:iso(t.joined_at),roster:[]}));
    const players=market||calculation&&!number?[]:(await c.query(calculation?`SELECT p.*,c.name AS club FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id WHERE p.id IN(
     SELECT player_id FROM fanta.rosters WHERE league_id=$1 UNION SELECT player_id FROM fanta.roster_entries WHERE league_id=$1
     UNION SELECT player_id FROM fanta.player_bindings WHERE league_id=$1
     UNION SELECT jsonb_array_elements_text(starters||bench) FROM fanta.lineups WHERE competition_id=$2 AND round=$3
    ) ORDER BY p.id`:'SELECT p.*,c.name AS club FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id ORDER BY p.id',calculation?[id,selected.id,number]:[])).rows.map(p=>({...p.data,id:p.id,name:p.name,shirtName:p.shirt_name,role:p.role,club:p.club,clubId:p.club_id}));
    const byId=new Map(players.map(p=>[p.id,p]));if(!calculation||number){
     const rosterRows=(await c.query(market?`SELECT r.*,p.name,p.role FROM fanta.rosters r JOIN fanta.players p ON p.id=r.player_id WHERE r.league_id=$1`:'SELECT * FROM fanta.rosters WHERE league_id=$1',[id])).rows;
     for(const r of rosterRows){
      const player=market?{id:r.player_id,name:r.name,role:r.role}:byId.get(r.player_id);
      teams.find(t=>t.id===r.team_id)?.roster.push({...player,price:r.price});
     }
     applyEntries(teams,byId,(await c.query('SELECT * FROM fanta.roster_entries WHERE league_id=$1',[id])).rows);
    }
    let row=calculation?null:(await c.query(`SELECT * FROM fanta.auctions WHERE league_id=$1${auction?' FOR UPDATE':''}`,[id])).rows[0];
    if(!row&&auction){await c.query(`INSERT INTO fanta.auctions(id,league_id,data) VALUES($1,$1,$2) ON CONFLICT(league_id) DO NOTHING`,[id,JSON.stringify({status:'none',mode:'live',version:1,log:[],order:[],lot:null,table:null})]);row=(await c.query('SELECT * FROM fanta.auctions WHERE league_id=$1 FOR UPDATE',[id])).rows[0];}
    const a={status:'none',mode:'live',version:1,log:[],order:[],lot:null,table:null,...row?.data};if(auction&&a.lot)await c.query('SELECT id FROM fanta.lots WHERE id=$1 FOR UPDATE',[a.lot.id]);
    const state={voteModel:market||calculation&&!number?null:(await c.query("SELECT data->>'key' AS key FROM fanta.jobs WHERE id='votes:active-model'")).rows[0]?.key,teamNameDeadline,league,rules,teams,players,competition:selected,competitions,auction:a,rounds:[],matchups:[],results:[],lineups:[],fixtures:[],votes:[]};
    if(l.admin_uid===uid&&!auction&&!calculation&&!market)state.importReview=(await c.query('SELECT data FROM fanta.import_issues WHERE league_id=$1 ORDER BY id',[id])).rows.map(x=>x.data);
    if(!auction&&!market){
     state.rounds=(await c.query('SELECT * FROM fanta.rounds WHERE league_id=$1 AND competition_id=$2 ORDER BY number',[id,selected.id])).rows.map(r=>({...r,deadline:iso(r.deadline)}));
     state.matchups=(await c.query('SELECT * FROM fanta.matchups WHERE league_id=$1 AND competition_id=$2 ORDER BY round,id',[id,selected.id])).rows;
     state.results=(await c.query('SELECT r.* FROM fanta.results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=$1 AND m.competition_id=$2 ORDER BY m.round',[id,selected.id])).rows;
     if(!calculation)state.references=(await c.query('SELECT r.matchup_id,r.data FROM fanta.reference_results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=$1 AND m.competition_id=$2',[id,selected.id])).rows;
     if(!calculation||number){
      state.lineups=(await c.query('SELECT * FROM fanta.lineups WHERE league_id=$1 AND competition_id=$2 AND ($3::int IS NULL OR round=$3) ORDER BY round',[id,selected.id,calculation?number:null])).rows.map(x=>({...x,saved_at:iso(x.saved_at)}));
      state.fixtures=(await c.query(`SELECT id,round,kickoff,status,home_id,away_id,frozen_at,jsonb_build_object('goals',data->'goals','teams',data->'teams') AS data FROM fanta.fixtures WHERE season=$1 AND ($2::int IS NULL OR round=$2) ORDER BY kickoff`,[l.season,calculation?state.rounds.find(r=>r.number===Number(number))?.seriea_round:null])).rows.map(f=>({...f,kickoff:iso(f.kickoff)}));
      const voteRound=number?state.rounds.find(r=>r.number===Number(number)):currentRound(state);
      if(voteRound)state.votes=(await c.query('SELECT DISTINCT ON(v.player_id) v.player_id,v.data,v.official FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE f.season=$1 AND f.round=$2 AND ($3::text IS NULL OR v.model_key=$3) ORDER BY v.player_id,v.id DESC',[l.season,voteRound.seriea_round,state.voteModel||null])).rows;
     }
    }
    if(!market&&(!calculation||number)){
     state.bindings=(await c.query('SELECT * FROM fanta.player_bindings WHERE league_id=$1',[id])).rows;resolveLeagueBindings(state);
    }
    const result=await fn(state,c);await c.query('COMMIT');return result;
   }catch(e){await c.query('ROLLBACK');throw e;}
  });},
  async persistAuction(c,before,after,actor,kind,input){
   const a=after.auction,id=after.league.id;
   if(before.rules.budget!==after.rules.budget)await c.query("UPDATE fanta.leagues SET rules=jsonb_set(rules,'{budget}',to_jsonb($2::integer),true) WHERE id=$1",[id,after.rules.budget]);
   if(kind==='undo'){const removed=before.teams.flatMap(t=>t.roster).filter(p=>!after.teams.some(t=>t.roster.some(x=>x.id===p.id)));for(const p of removed){const used=await c.query("SELECT 1 FROM fanta.lineups l JOIN fanta.rounds r ON r.competition_id=l.competition_id AND r.number=l.round WHERE l.league_id=$1 AND r.deadline<=now() AND (l.starters ? $2 OR l.bench ? $2) LIMIT 1",[id,p.id]);if(used.rows.length)fail('Il giocatore è già in una formazione chiusa: acquisto non annullabile',409);}}
   await persistRosterChanges(c,before,after,{actor,kind,input});
   if(['assign','tick','read','close','releases-done'].includes(kind)&&readyRosters(after)){
    const activation=await activateCompletedLeague(c,after);
    if(activation.status!=='unchanged'&&activation.status!=='incomplete')a.competitionActivation=activation;
    if(activation.status==='active'||a.phase!=='releases'&&kind==='assign')Object.assign(a,{status:'ended',lot:null,table:null,caller:null,callDeadline:null,pausedUntil:null});
   }
   await c.query('UPDATE fanta.auctions SET version=$2,data=$3 WHERE league_id=$1',[id,a.version,JSON.stringify(a)]);
   if(process.env.SELFHOST_RUNTIME==='true')await c.query("SELECT pg_notify('quasi_auction',$1)",[JSON.stringify({league:id,version:a.version})]);
   if(a.lot)await c.query('INSERT INTO fanta.lots(id,auction_id,player_id,ends_at,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET ends_at=EXCLUDED.ends_at,data=EXCLUDED.data',[a.lot.id,id,a.lot.player.id,a.lot.endsAt,JSON.stringify(a.lot)]);
   if(kind!=='release-batch')for(const sale of a.log)await c.query('INSERT INTO fanta.sales(id,auction_id,league_id,team_id,player_id,price,undone,released) VALUES($1,$2,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET undone=EXCLUDED.undone,released=EXCLUDED.released',[sale.id,id,sale.team,sale.player.id,sale.price,!!sale.undone,!!sale.released]);
   await c.query('INSERT INTO fanta.auction_actions(auction_id,lot_id,actor,kind,data) VALUES($1,$2,$3,$4,$5)',[id,a.lot?.id||before.auction.lot?.id||null,actor,kind,JSON.stringify(input)]);
  },
  async persistRoster(c,before,after,options){const result=await persistRosterChanges(c,before,after,options);if(options.kind!=='trade'){const activation=await activateCompletedLeague(c,after);if(activation.status==='active')after.auction.competitionActivation=activation;}await c.query('UPDATE fanta.auctions SET version=$2,data=$3 WHERE league_id=$1',[after.league.id,after.auction.version,JSON.stringify(after.auction)]);if(process.env.SELFHOST_RUNTIME==='true')await c.query("SELECT pg_notify('quasi_auction',$1)",[JSON.stringify({league:after.league.id,version:after.auction.version})]);return result;},
  saveLineup:(uid,id,input,options)=>use(c=>saveLineup(c,uid,id,input,options)),
  saveLineupForSession:(token,id,input,options)=>use(async c=>{const u=token?(await c.query(AUTH_SQL,[createHash('sha256').update(token).digest('hex'),Date.now()])).rows[0]:null;if(!u||!u.verified||u.demo||u.admin_only)fail('Accedi e conferma la tua email per entrare nel Fanta.',403);return saveLineup(c,u.id,id,input,{...options,username:u.username});}),
  connect,
  use,
 };
}
export function auctionTeams(state){return state.teams.map(t=>({team:{id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{}},...teamBudget(t,state.rules)}));}
