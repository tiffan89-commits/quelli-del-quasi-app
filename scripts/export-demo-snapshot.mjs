// Manual, read-only export. Never imported by the app, workers or scheduled jobs.
import fs from 'node:fs/promises';
import {Client} from 'pg';
import {createHash} from 'node:crypto';

if(!process.env.DATABASE_URL)throw Error('DATABASE_URL obbligatoria: usare il file ambiente privato del server');
const c=new Client({connectionString:process.env.DATABASE_URL});
const normalizeClub=name=>({'AC Milan':'Milan','AS Roma':'Roma','Verona':'Verona'}[name]||name);
const clean=value=>value instanceof Date?value.toISOString():Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k,v])=>!/(photo|logo|image|token|secret|password)/i.test(k)&&!(typeof v==='string'&&/^https?:\/\//.test(v))).map(([k,v])=>[k,clean(v)])):value;
try{
 await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const {season,round}= (await c.query(`SELECT season,round FROM fanta.fixtures GROUP BY season,round HAVING count(*)=10 AND bool_and(status IN('FT','AET','PEN')) AND EXISTS(SELECT 1 FROM fanta.votes v JOIN fanta.fixtures x ON x.id=v.fixture_id WHERE x.season=fanta.fixtures.season AND x.round=fanta.fixtures.round) ORDER BY season DESC,round DESC LIMIT 1`)).rows[0]||{};
 if(!round)throw Error('Nessuna giornata completa con voti disponibile');
 const fixtures=(await c.query(`SELECT f.id,f.round,f.kickoff,f.status,f.home_id,f.away_id,f.data->'goals' AS goals,f.data->'teams' AS teams,f.data->'lineups' AS lineups,f.data->'events' AS events,f.data->'statistics' AS statistics FROM fanta.fixtures f WHERE season=$1 AND round BETWEEN $2 AND $2+3 ORDER BY round,kickoff,id`,[season,round])).rows.map(f=>clean({...f,teams:Object.fromEntries(Object.entries(f.teams).map(([k,t])=>[k,{id:t.id,name:normalizeClub(t.name)}]))}));
 const votes=(await c.query(`SELECT DISTINCT ON(v.player_id) v.player_id,v.fixture_id,v.official,jsonb_build_object('status',v.data->'status','vote',v.data->'vote','fantavote',v.data->'fantavote','minutes',v.data->'minutes','events',v.data->'events','stats',v.data->'stats','breakdown',v.data->'breakdown','why',v.data->'why','model',v.data->'model') AS performance FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE f.season=$1 AND f.round=$2 AND v.model_key=(SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model') ORDER BY v.player_id,v.id DESC`,[season,round])).rows;
 const byVote=new Map(votes.map(v=>[v.player_id,v]));
 const players=(await c.query(`SELECT p.id,p.api_id,p.name,p.role,c.name AS club,p.data#>>'{seasonStats,games,number}' AS jersey,p.data->'stats' AS stats,p.data->'status' AS availability,p.data->'presenceEstimate'->'pct' AS probability FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id WHERE p.club_id IN(SELECT home_id FROM fanta.fixtures WHERE season=$1 AND round=$2 UNION SELECT away_id FROM fanta.fixtures WHERE season=$1 AND round=$2) AND p.role IN('P','D','C','A') ORDER BY p.api_id`,[season,round])).rows;
 const latest=fixtures.filter(f=>f.round===round),appearances=new Map();
 for(const f of latest)for(const t of f.lineups||[])for(const kind of ['startXI','substitutes'])for(const item of t[kind]||[]){const p=item.player;appearances.set(p.id,{jersey:p.number,starter:kind==='startXI',fixture:f});}
 const pool=players.map(p=>{const v=byVote.get(p.id),appearance=appearances.get(p.api_id),fixture=latest.find(f=>f.id===v?.fixture_id)||appearance?.fixture,home=fixture?.teams.home.name===normalizeClub(p.club);return {apiId:p.api_id,name:p.name,role:p.role,club:normalizeClub(p.club),jersey:appearance?.jersey??(p.jersey?Number(p.jersey):null),stats:p.stats||{},availability:p.availability||{type:'ok'},probability:p.probability,performance:v?clean({...v.performance,official:v.official,sourceRound:round,opponent:fixture?.teams[home?'away':'home'].name,home,score:fixture?[fixture.goals[home?'home':'away'],fixture.goals[home?'away':'home']]:null,ai:null}):null};});
 const selected=[];
 for(const [role,count]of Object.entries({P:34,D:74,C:74,A:58})){
  const candidates=pool.filter(p=>p.role===role).sort((a,b)=>Number(b.performance?.vote!=null)-Number(a.performance?.vote!=null)||(b.performance?.minutes||0)-(a.performance?.minutes||0)||a.apiId-b.apiId);
  if(candidates.length<count)throw Error('Anagrafiche insufficienti per il ruolo '+role);
  selected.push(...candidates.slice(0,count));
 }
 const snapshot={meta:{season,round,exportedAt:new Date().toISOString(),fixtureCount:latest.length,playerCount:selected.length,gradedPlayers:selected.filter(p=>p.performance?.vote!=null).length,source:'archivio locale · snapshot dimostrativo'},fixtures,players:selected};
 await c.query('ROLLBACK');
 const content='// Public football data only. Generated manually; no credentials, users, photographs or external URLs.\nexport const DEMO_FOOTBALL='+JSON.stringify(snapshot)+';\n';
 await fs.writeFile(new URL('../public/src/fanta/demo-football-data.mjs',import.meta.url),content);
 console.log(JSON.stringify({season,round,fixtures:latest.length,players:selected.length,gradedPlayers:snapshot.meta.gradedPlayers,bytes:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex')}));
}finally{await c.end();}
