import {saveLineup} from './lineup-save.mjs';
import {persistRosterChanges} from './roster-persistence.mjs';
import {connection} from '../lib/db.mjs';
import {databaseReadCache} from '../lib/read-cache.mjs';
import {resolveLeagueBindings} from './player-identities.mjs';
import {createHash} from 'node:crypto';
import {DEFAULT_RULES,fail} from './rules.mjs';
import {teamBudget} from './auction.mjs';
import {currentRound,currentRoundNumberSQL} from './round-selection.mjs';
const iso=x=>x instanceof Date?x.toISOString():x;
// One consistent read replaces a transaction with a round trip for every table.
const READ_LEAGUE_SQL=`SELECT l.*,row_to_json(selected) AS competition,(SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model') AS vote_model_key,
 (SELECT coalesce(jsonb_agg(c ORDER BY c.created_at,c.id),'[]') FROM fanta.competitions c WHERE c.league_id=l.id) AS competitions,
 (SELECT coalesce(jsonb_agg(t ORDER BY t.id),'[]') FROM fanta.teams t WHERE t.league_id=l.id) AS teams,
 (SELECT coalesce(jsonb_agg(p.data||jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'club',c.name,'clubId',p.club_id)),'[]') FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id WHERE $5::boolean OR p.id IN(SELECT player_id FROM fanta.rosters WHERE league_id=$1 UNION SELECT player_id FROM fanta.roster_entries WHERE league_id=$1 AND player_id IS NOT NULL UNION SELECT player_id FROM fanta.player_bindings WHERE league_id=$1 UNION SELECT jsonb_array_elements_text(starters||bench) FROM fanta.lineups WHERE league_id=$1)) AS players,
 (SELECT coalesce(jsonb_agg(r),'[]') FROM fanta.rosters r WHERE r.league_id=l.id) AS rosters,
 (SELECT coalesce(jsonb_agg(e),'[]') FROM fanta.roster_entries e WHERE e.league_id=l.id) AS entries,
 (SELECT data FROM fanta.auctions WHERE league_id=l.id) AS auction,
 (SELECT coalesce(jsonb_agg(r ORDER BY r.number),'[]') FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id) AS rounds,
 (SELECT coalesce(jsonb_agg(m ORDER BY m.round,m.id),'[]') FROM fanta.matchups m WHERE m.league_id=l.id AND m.competition_id=selected.id) AS matchups,
 (SELECT coalesce(jsonb_agg(r ORDER BY m.round),'[]') FROM fanta.results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=l.id AND m.competition_id=selected.id) AS results,
 (SELECT coalesce(jsonb_agg(r),'[]') FROM fanta.reference_results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=l.id AND m.competition_id=selected.id) AS references,
 (SELECT coalesce(jsonb_agg(r ORDER BY r.round),'[]') FROM fanta.lineups r WHERE r.league_id=l.id AND r.competition_id=selected.id) AS lineups,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'round',f.round,'kickoff',f.kickoff,'status',f.status,'home_id',f.home_id,'away_id',f.away_id,'frozen_at',f.frozen_at,'data',jsonb_build_object('goals',f.data->'goals','teams',f.data->'teams'))),'[]') FROM fanta.fixtures f WHERE f.season=l.season) AS fixtures,
 (SELECT coalesce(jsonb_agg(v),'[]') FROM (SELECT DISTINCT ON(v.player_id) v.player_id,CASE WHEN $6::boolean THEN v.data ELSE jsonb_build_object('status',v.data->'status','vote',v.data->'vote','fantavote',v.data->'fantavote','events',v.data->'events','needsReview',v.data->'needsReview') END AS data,v.official FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE f.season=l.season AND (NOT EXISTS(SELECT 1 FROM fanta.jobs WHERE id='votes:active-model') OR v.model_key=(SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model')) AND f.round=(SELECT seriea_round FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id AND r.number=${currentRoundNumberSQL} LIMIT 1) ORDER BY v.player_id,v.id DESC) v) AS votes,
 (SELECT coalesce(jsonb_agg(i.data),'[]') FROM fanta.import_issues i WHERE i.league_id=l.id) AS review,
 (SELECT coalesce(jsonb_agg(b),'[]') FROM fanta.player_bindings b WHERE b.league_id=l.id) AS bindings
 FROM fanta.leagues l JOIN LATERAL(SELECT c.* FROM fanta.competitions c WHERE c.league_id=l.id AND ($4::text IS NULL OR c.id=$4) ORDER BY CASE WHEN c.id=l.id||':main' THEN 0 ELSE 1 END,c.created_at,c.id LIMIT 1) selected ON true WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)`;
function readState(l){
 const teams=l.teams.map(t=>({id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{},creditAdjustment:t.credit_adjustment||0,coachName:t.coach_name,userId:t.user_id,joinedAt:t.joined_at,roster:[]})),byId=new Map(l.players.map(p=>[p.id,p]));
 for(const r of l.rosters)teams.find(t=>t.id===r.team_id)?.roster.push({...byId.get(r.player_id),price:r.price});
 applyEntries(teams,byId,l.entries||[]);
 return {voteModel:l.vote_model_key,league:{id:l.id,name:l.name,season:l.season,kind:l.kind,slipsEnabled:l.slips_enabled!==false,pilotNumber:l.pilot_number,autoLineupsFrom:l.auto_lineups_from,adminUid:l.admin_uid,accent:l.accent,maxMembers:l.max_members,inviteCode:l.invite_code},competition:l.competition,competitions:l.competitions,rules:{...DEFAULT_RULES,...l.rules},teams,players:l.players,auction:{status:'none',mode:'live',version:1,log:[],order:[],lot:null,table:null,...l.auction},rounds:l.rounds,matchups:l.matchups,results:l.results,references:l.references,lineups:l.lineups,fixtures:l.fixtures,votes:l.votes,importReview:l.review};
}
function applyEntries(teams,byId,entries){for(const t of teams){const own=entries.filter(e=>e.team_id===t.id);if(!own.length)continue;const extra=t.roster.filter(p=>!own.some(e=>e.player_id===p.id));t.roster=[...own.map(e=>({...byId.get(e.player_id),id:e.player_id||e.source_id,name:e.name,role:e.role,club:byId.get(e.player_id)?.club||e.data.club||'',price:e.price,unmapped:!e.player_id})),...extra];}}
export const AUTH_SQL=`SELECT u->>'id' AS id,u->>'username' AS username,u->>'name' AS name,(u->>'emailVerified')::boolean AS verified,(u->>'demo')::boolean AS demo,(u->>'adminOnly')::boolean AS admin_only FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'sessions') a JOIN LATERAL jsonb_array_elements(s.payload->'users') u ON u->>'id'=a->>'uid' WHERE a->>'token'=$1 AND (a->>'expires')::numeric>$2 LIMIT 1`;
export function sqlFantaStore({connect=connection,readCache=connect===connection?databaseReadCache():null}={}){
 const use=async fn=>{const c=await connect();try{return await fn(c);}finally{c.release();}};
 return {
  identity:token=>use(async c=>(await c.query(AUTH_SQL,[createHash('sha256').update(token||'').digest('hex'),Date.now()])).rows[0]||null),
  logo:(uid,league,team)=>use(async c=>(await c.query('SELECT a.data,a.mime,a.digest FROM fanta.team_logos a JOIN fanta.teams t ON t.id=a.team_id WHERE t.id=$3 AND t.league_id=$2 AND EXISTS(SELECT 1 FROM fanta.teams own WHERE own.league_id=$2 AND own.user_id=$1)',[uid,league,team])).rows[0]||null),
  leagues:uid=>use(async c=>(await c.query(`SELECT l.*,t.id AS team_id,t.name AS team_name FROM fanta.leagues l JOIN fanta.teams t ON t.league_id=l.id AND t.user_id=$1 WHERE l.rules->>'disabledAt' IS NULL ORDER BY l.id`,[uid])).rows.map(x=>({id:x.id,name:x.name,season:x.season+'/'+String(x.season+1).slice(-2),role:x.admin_uid===uid?'admin':'member',accent:x.accent,teamName:x.team_name,teamId:x.team_id,kind:x.kind,sourceKey:x.source_key,slipsEnabled:x.slips_enabled!==false}))),
  settings:(uid,next)=>use(async c=>{if(next)await c.query('INSERT INTO fanta.notification_settings VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data',[uid,JSON.stringify(next)]);return (await c.query('SELECT data FROM fanta.notification_settings WHERE user_id=$1',[uid])).rows[0]?.data||{notify:{lineupReminder:true,roundStart:true,liveEvents:true,results:true,auction:true}};}),
  async league(uid,id,fn,{write=false,auction=false,number,competition,catalog=true,detailedVotes=true}={}){return use(async c=>{
   if(!write&&!auction){
    const load=async()=>(await c.query(READ_LEAGUE_SQL,[id,uid,number?Number(number):null,competition||null,catalog,detailedVotes])).rows[0];let l;
    if(readCache){const access=(await c.query(`SELECT l.admin_uid,r.revision::text AS revision FROM fanta.leagues l CROSS JOIN fanta.cache_revision r WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND r.id=1 AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)`,[id,uid])).rows[0];if(!access)fail('Lega non accessibile',403);l=await readCache.read(JSON.stringify(['fanta-read-v3',id,number||null,competition||null,catalog,detailedVotes]),access.revision,load,{ttl:60000});}
    else l=await load();if(!l)fail('Lega non accessibile',403);const s=resolveLeagueBindings({...readState(l),bindings:l.bindings||[]});if(s.league.adminUid!==uid)s.importReview=[];return fn(s,c);
   }
   await c.query('BEGIN');try{
    const l=(await c.query(`SELECT l.* FROM fanta.leagues l WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2)${write?' FOR UPDATE':''}`,[id,uid])).rows[0];if(!l)fail('Lega non accessibile',403);
    const league={id:l.id,name:l.name,season:l.season,kind:l.kind,slipsEnabled:l.slips_enabled!==false,pilotNumber:l.pilot_number,autoLineupsFrom:l.auto_lineups_from,adminUid:l.admin_uid,accent:l.accent,maxMembers:l.max_members,inviteCode:l.invite_code};
    const rules={...DEFAULT_RULES,...l.rules};
    const competitions=(await c.query('SELECT * FROM fanta.competitions WHERE league_id=$1 ORDER BY created_at,id',[id])).rows,selected=competitions.find(x=>x.id===(competition||id+':main'))||(!competition?competitions[0]:null);if(!selected)fail('Competizione non accessibile',403);
    const teams=(await c.query('SELECT * FROM fanta.teams WHERE league_id=$1 ORDER BY id',[id])).rows.map(t=>({id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{},creditAdjustment:t.credit_adjustment||0,coachName:t.coach_name,userId:t.user_id,joinedAt:iso(t.joined_at),roster:[]}));
    const players=(await c.query('SELECT p.*,c.name AS club FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id ORDER BY p.id')).rows.map(p=>({...p.data,id:p.id,name:p.name,role:p.role,club:p.club,clubId:p.club_id}));
    const byId=new Map(players.map(p=>[p.id,p]));for(const r of (await c.query('SELECT * FROM fanta.rosters WHERE league_id=$1',[id])).rows)teams.find(t=>t.id===r.team_id)?.roster.push({...byId.get(r.player_id),price:r.price});
    applyEntries(teams,byId,(await c.query('SELECT * FROM fanta.roster_entries WHERE league_id=$1',[id])).rows);
    let row=(await c.query(`SELECT * FROM fanta.auctions WHERE league_id=$1${auction?' FOR UPDATE':''}`,[id])).rows[0];
    if(!row&&auction){await c.query(`INSERT INTO fanta.auctions(id,league_id,data) VALUES($1,$1,$2) ON CONFLICT(league_id) DO NOTHING`,[id,JSON.stringify({status:'none',mode:'live',version:1,log:[],order:[],lot:null,table:null})]);row=(await c.query('SELECT * FROM fanta.auctions WHERE league_id=$1 FOR UPDATE',[id])).rows[0];}
    const a={status:'none',mode:'live',version:1,log:[],order:[],lot:null,table:null,...row?.data};if(auction&&a.lot)await c.query('SELECT id FROM fanta.lots WHERE id=$1 FOR UPDATE',[a.lot.id]);
    const state={voteModel:(await c.query("SELECT data->>'key' AS key FROM fanta.jobs WHERE id='votes:active-model'")).rows[0]?.key,league,rules,teams,players,competition:selected,competitions,auction:a,rounds:[],matchups:[],results:[],lineups:[],fixtures:[],votes:[]};
    if(l.admin_uid===uid&&!auction)state.importReview=(await c.query('SELECT data FROM fanta.import_issues WHERE league_id=$1 ORDER BY id',[id])).rows.map(x=>x.data);
    if(!auction){
     state.rounds=(await c.query('SELECT * FROM fanta.rounds WHERE league_id=$1 AND competition_id=$2 ORDER BY number',[id,selected.id])).rows.map(r=>({...r,deadline:iso(r.deadline)}));
     state.matchups=(await c.query('SELECT * FROM fanta.matchups WHERE league_id=$1 AND competition_id=$2 ORDER BY round,id',[id,selected.id])).rows;
     state.results=(await c.query('SELECT r.* FROM fanta.results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=$1 AND m.competition_id=$2 ORDER BY m.round',[id,selected.id])).rows;
     state.references=(await c.query('SELECT r.matchup_id,r.data FROM fanta.reference_results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.league_id=$1 AND m.competition_id=$2',[id,selected.id])).rows;
     state.lineups=(await c.query('SELECT * FROM fanta.lineups WHERE league_id=$1 AND competition_id=$2 ORDER BY round',[id,selected.id])).rows.map(x=>({...x,saved_at:iso(x.saved_at)}));
     state.fixtures=(await c.query(`SELECT id,round,kickoff,status,home_id,away_id,frozen_at,jsonb_build_object('goals',data->'goals','teams',data->'teams') AS data FROM fanta.fixtures WHERE season=$1 ORDER BY kickoff`,[l.season])).rows.map(f=>({...f,kickoff:iso(f.kickoff)}));
     const voteRound=number?state.rounds.find(r=>r.number===Number(number)):currentRound(state);
     if(voteRound)state.votes=(await c.query('SELECT DISTINCT ON(v.player_id) v.player_id,v.data,v.official FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE f.season=$1 AND f.round=$2 AND ($3::text IS NULL OR v.model_key=$3) ORDER BY v.player_id,v.id DESC',[l.season,voteRound.seriea_round,state.voteModel||null])).rows;
    }
    state.bindings=(await c.query('SELECT * FROM fanta.player_bindings WHERE league_id=$1',[id])).rows;resolveLeagueBindings(state);
    const result=await fn(state,c);await c.query('COMMIT');return result;
   }catch(e){await c.query('ROLLBACK');throw e;}
  });},
  async persistAuction(c,before,after,actor,kind,input){
   const a=after.auction,id=after.league.id;
   await c.query('UPDATE fanta.auctions SET version=$2,data=$3 WHERE league_id=$1',[id,a.version,JSON.stringify(a)]);
   if(a.lot)await c.query('INSERT INTO fanta.lots(id,auction_id,player_id,ends_at,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET ends_at=EXCLUDED.ends_at,data=EXCLUDED.data',[a.lot.id,id,a.lot.player.id,a.lot.endsAt,JSON.stringify(a.lot)]);
   if(kind==='undo'){const removed=before.teams.flatMap(t=>t.roster).filter(p=>!after.teams.some(t=>t.roster.some(x=>x.id===p.id)));for(const p of removed){const used=await c.query("SELECT 1 FROM fanta.lineups l JOIN fanta.rounds r ON r.competition_id=l.competition_id AND r.number=l.round WHERE l.league_id=$1 AND r.deadline<=now() AND (l.starters ? $2 OR l.bench ? $2) LIMIT 1",[id,p.id]);if(used.rows.length)fail('Il giocatore è già in una formazione chiusa: acquisto non annullabile',409);}}
   await persistRosterChanges(c,before,after,{actor,kind,input});
   for(const sale of a.log)await c.query('INSERT INTO fanta.sales(id,auction_id,league_id,team_id,player_id,price,undone,released) VALUES($1,$2,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET undone=EXCLUDED.undone,released=EXCLUDED.released',[sale.id,id,sale.team,sale.player.id,sale.price,!!sale.undone,!!sale.released]);
   await c.query('INSERT INTO fanta.auction_actions(auction_id,lot_id,actor,kind,data) VALUES($1,$2,$3,$4,$5)',[id,a.lot?.id||before.auction.lot?.id||null,actor,kind,JSON.stringify(input)]);
  },
  async persistRoster(c,before,after,options){const result=await persistRosterChanges(c,before,after,options);await c.query('UPDATE fanta.auctions SET version=$2,data=$3 WHERE league_id=$1',[after.league.id,after.auction.version,JSON.stringify(after.auction)]);return result;},
  saveLineup:(uid,id,input,options)=>use(c=>saveLineup(c,uid,id,input,options)),
  saveLineupForSession:(token,id,input,options)=>use(async c=>{const u=token?(await c.query(AUTH_SQL,[createHash('sha256').update(token).digest('hex'),Date.now()])).rows[0]:null;if(!u||!u.verified||u.demo||u.admin_only)fail('Accedi e conferma la tua email per entrare nel Fanta.',403);return saveLineup(c,u.id,id,input,{...options,username:u.username});}),
  connect,
  use,
 };
}
export function auctionTeams(state){return state.teams.map(t=>({team:{id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{}},...teamBudget(t,state.rules)}));}
