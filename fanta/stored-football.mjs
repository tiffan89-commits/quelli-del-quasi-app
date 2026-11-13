import {connection} from '../lib/db.mjs';
import {ingestFixture} from './ingest.mjs';
import {fixtureFingerprint} from './votes.mjs';
import {configuredVotes,currentModelKey} from './statistical-votes/repository.mjs';
import {normalizeTeam} from '../lib/calendar.mjs';
import {barCalendarRows,barStorageMode} from '../lib/storage-mode.mjs';
export async function seedStoredFixtures({connect=connection,env=process.env}={}){
 const c=await connect();try{
  const clubs=(await c.query('SELECT id,name FROM fanta.clubs')).rows,byName=new Map(clubs.map(t=>[normalizeTeam(t.name),t.id]));
  const rows=(await c.query(`SELECT (r->>'number')::int AS round,jsonb_build_object('id',m->'apiFootballId','home',m->'home','away',m->'away','kickoff',m->'kickoff','status',m->'status','score',m->'score','liveScore',m->'liveScore') AS m FROM ${barCalendarRows(barStorageMode(env),{round:true})} WHERE m->>'apiFootballId' IS NOT NULL AND m->>'kickoff' IS NOT NULL`)).rows;
  const fixtures=rows.filter(r=>byName.has(normalizeTeam(r.m.home))&&byName.has(normalizeTeam(r.m.away))).map(({round,m})=>({id:'af:'+m.id,api_id:Number(m.id),season:Number(env.FANTA_SEASON||2026),round,kickoff:m.kickoff,status:m.status==='LIVE'?'LIVE':m.status==='FT'?'FT':'NS',home_id:byName.get(normalizeTeam(m.home)),away_id:byName.get(normalizeTeam(m.away)),data:{teams:{home:{name:m.home},away:{name:m.away}},goals:{home:(m.liveScore||m.score)?.[0]??null,away:(m.liveScore||m.score)?.[1]??null}}}));
  if(fixtures.length)await c.query(`INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text,api_id int,season int,round int,kickoff timestamptz,status text,home_id text,away_id text,data jsonb) ON CONFLICT(id) DO UPDATE SET kickoff=EXCLUDED.kickoff WHERE fanta.fixtures.kickoff IS DISTINCT FROM EXCLUDED.kickoff AND fanta.fixtures.frozen_at IS NULL`,[JSON.stringify(fixtures)]);return {fixtures:fixtures.length};
 }finally{c.release();}
}
export async function syncStoredFootball({connect=connection,env=process.env,now=Date.now}={}){
 const c=await connect();let rows,prior;try{
  rows=(await c.query(`SELECT jsonb_build_object('fixture',m#>'{details,matchInfo,fixture}','league',m#>'{details,matchInfo,league}','teams',m#>'{details,matchInfo,teams}','goals',jsonb_build_object('home',(coalesce(NULLIF(m->'liveScore','null'::jsonb),m->'score'))->0,'away',(coalesce(NULLIF(m->'liveScore','null'::jsonb),m->'score'))->1),'events',coalesce(m#>'{details,sourceEvents}','[]'),'lineups',coalesce(m#>'{details,sourceLineups}','[]'),'players',m#>'{details,players}','statistics',m#>'{details,statistics}') AS raw FROM ${barCalendarRows(barStorageMode(env),{round:true})} WHERE m#>>'{details,source}'='API-FOOTBALL' AND jsonb_array_length(coalesce(m#>'{details,players}','[]'))>0 AND EXISTS(SELECT 1 FROM fanta.rounds f JOIN fanta.leagues l ON l.id=f.league_id WHERE l.rules->>'disabledAt' IS NULL AND NOT f.official AND f.seriea_round=(r->>'number')::int AND l.season=$1)`,[Number(env.FANTA_SEASON||2026)])).rows;
  prior=new Map((await c.query('SELECT api_id,digest,checked_at,frozen_at,vote_model_key FROM fanta.fixtures WHERE season=$1',[Number(env.FANTA_SEASON||2026)])).rows.map(f=>[f.api_id,f]));
 }finally{c.release();}
 const report={available:[],fixtures:0,players:0,cached:0};
 for(const {raw}of rows){if(!raw.fixture?.id||!raw.teams?.home||!raw.teams?.away||!raw.players?.some(t=>t.players?.some(p=>p.statistics?.[0]?.games?.minutes!=null)))continue;report.available.push(raw.fixture.id);const old=prior.get(raw.fixture.id),final=['FT','AET','PEN'].includes(raw.fixture.status.short);
  if(old?.vote_model_key===currentModelKey(configuredVotes(env))&&(old?.frozen_at||old?.digest===fixtureFingerprint(raw)&&(!final||now()-Date.parse(old.checked_at)<20*60000))){report.cached++;continue;}
  const r=await ingestFixture(raw,{connect,env,now,deferAi:true});report.fixtures++;report.players+=r.players||0;
 }return report;
}
