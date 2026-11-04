import {finalReadiness} from './final-readiness.mjs';
import {saveCompetitionSummary} from './summaries.mjs';
import {connection} from '../lib/db.mjs';
import {hashInput,fixtureFingerprint,withoutRatings,normalizeFixture,calculateVote,calibrateBaselines,priceList,ROLE,MODEL} from './votes.mjs';
import {configuredVotes,currentModelKey,storedOdds,fixtureBaseline,calculationFingerprint,appendVotes} from './statistical-votes/repository.mjs';
import {validTimestamp} from './statistical-votes/math.mjs';
import {fantaProvider} from './provider.mjs';
import {DEFAULT_RULES} from './rules.mjs';
import {sqlFantaStore} from './store.mjs';
import {roundView} from './views.mjs';
import {advanceCup} from './competitions.mjs';
const transaction=async(connect,fn)=>{const c=await connect();try{await c.query('BEGIN');const x=await fn(c);await c.query('COMMIT');return x;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
export async function ingestFixture(source,{connect=connection,env=process.env,now=Date.now,force=false,rebuildKey=null,finalVerification=false,config=configuredVotes(env),...unused}={}){
 const raw=structuredClone(source),id='af:'+raw.fixture.id,stamp=new Date(now()).toISOString(),modelKey=currentModelKey(config),fixtureRound=Number(raw.league.round?.match(/(\d+)$/)?.[1]),digest=fixtureFingerprint(raw);
 if(raw.league.id!==135||raw.league.season!==Number(env.FANTA_SEASON||2026)||!fixtureRound||fixtureRound>38)throw Error('Partita di un altro campionato o stagione');
 const before=await transaction(connect,async c=>{
  const existing=(await c.query('SELECT * FROM fanta.fixtures WHERE id=$1 FOR UPDATE',[id])).rows[0],sameModel=existing?.vote_model_key===modelKey;
  if(existing?.frozen_at&&sameModel&&(!force||finalVerification&&existing.digest===digest))return {cached:true};
  const final=['FT','AET','PEN'].includes(raw.fixture.status.short),elapsed=now()-Date.parse(existing?.checked_at||'1970-01-01T00:00:00Z');
  if(existing?.digest===digest&&sameModel&&!force&&(!final||elapsed<20*60000))return {cached:true};
  for(const t of [raw.teams.home,raw.teams.away])await c.query('INSERT INTO fanta.clubs(id,api_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name',['af:'+t.id,t.id,t.name]);
  const reads=(existing?.final_reads||0)+(final&&(!existing?.checked_at||elapsed>=20*60000)?1:0),kickoff=validTimestamp(raw.fixture.date)||existing?.kickoff||null;
  await c.query(`INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data,digest,final_reads,checked_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET kickoff=EXCLUDED.kickoff,status=EXCLUDED.status,data=EXCLUDED.data,digest=EXCLUDED.digest,final_reads=EXCLUDED.final_reads,checked_at=EXCLUDED.checked_at`,[id,raw.fixture.id,raw.league.season,fixtureRound,kickoff,raw.fixture.status.short,'af:'+raw.teams.home.id,'af:'+raw.teams.away.id,JSON.stringify(raw),digest,reads,stamp]);
  const odds=await storedOdds(c,raw.fixture.id);if(odds?.available)await c.query('INSERT INTO fanta.vote_odds_snapshots(signature,fixture_id,captured_at,data) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[odds.signature,id,odds.capturedAt,JSON.stringify(odds)]);
  const baseline=await fixtureBaseline(c,raw,config),catalog=(await c.query("SELECT id,role,data->'careerContext' AS career FROM fanta.players WHERE api_id=ANY($1::int[])",[(raw.players||[]).flatMap(t=>(t.players||[]).map(p=>p.player.id))])).rows,roles=Object.fromEntries(catalog.map(p=>[p.id,p.role])),playerProfiles=Object.fromEntries(catalog.filter(p=>p.career).map(p=>[p.id,p.career]));
  const complete=[raw.teams.home.id,raw.teams.away.id].every(id=>(raw.players||[]).find(t=>t.team.id===id)?.players?.filter(p=>Number(p.statistics?.[0]?.games?.minutes)>0).length>=11);
  return {digest,first:!existing?.digest,unchanged:existing?.digest===digest,reads,official:final&&(finalVerification||reads>=3||!!existing?.frozen_at)&&complete,baseline,roles,odds,playerProfiles};
 });
 if(before.cached){if(rebuildKey)await transaction(connect,c=>c.query('UPDATE fanta.fixtures SET vote_rebuild_key=$2,vote_rebuilt_at=$3 WHERE id=$1 AND vote_model_key=$2 AND vote_rebuild_key IS DISTINCT FROM $2',[id,rebuildKey,stamp]));return {cached:true};}
 const normalized=normalizeFixture(raw,before.roles,{config,odds:before.odds,playerProfiles:before.playerProfiles}),votes=normalized.filter(p=>p.role).map(p=>{const vote=calculateVote(p,{config,baselines:before.baseline?.data,baselineVersion:before.baseline?.id});return {p,vote,hash:calculationFingerprint(p,{config,baseline:before.baseline,rules:DEFAULT_RULES.bonus})};});
 before.official=before.official&&normalized.every(p=>!p.onField||p.role&&!p.needsReview)&&votes.every(x=>!x.vote.needsReview);
 return transaction(connect,async c=>{
  const current=(await c.query('SELECT digest FROM fanta.fixtures WHERE id=$1 FOR UPDATE',[id])).rows[0];if(current.digest!==before.digest)return {superseded:true};let revisions=0;
  if(votes.length){const players=votes.map(({p})=>({id:p.id,api_id:p.apiId,club_id:p.clubId,name:p.name,role:p.role}));await c.query('INSERT INTO fanta.players(id,api_id,club_id,name,role) SELECT id,api_id,club_id,name,role FROM jsonb_to_recordset($1::jsonb) AS r(id text,api_id int,club_id text,name text,role text) ON CONFLICT(id) DO UPDATE SET club_id=coalesce(fanta.players.club_id,EXCLUDED.club_id),name=EXCLUDED.name',[JSON.stringify(players)]);
   const stats=votes.map(({p})=>({player_id:p.id,data:p,digest:hashInput(p)}));await c.query('INSERT INTO fanta.player_stats(fixture_id,player_id,data,digest) SELECT $2,player_id,data,digest FROM jsonb_to_recordset($1::jsonb) AS r(player_id text,data jsonb,digest text) ON CONFLICT(fixture_id,player_id) DO UPDATE SET data=EXCLUDED.data,digest=EXCLUDED.digest WHERE fanta.player_stats.digest<>EXCLUDED.digest',[JSON.stringify(stats),id]);
   revisions=await appendVotes(c,{fixtureId:id,votes,official:before.official,modelKey,at:stamp});
  }
  if(!before.unchanged){const ids=[];for(const e of raw.events||[]){const eid=hashInput(e);ids.push(eid);await c.query('INSERT INTO fanta.events(fixture_id,id,data,seen_at,notify) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,eid,JSON.stringify(e),stamp,!before.first&&!rebuildKey]);}await c.query('DELETE FROM fanta.events WHERE fixture_id=$1 AND NOT(id=ANY($2::text[]))',[id,ids]);}
  await c.query('UPDATE fanta.fixtures SET frozen_at=$2,vote_model_key=$3,vote_rebuild_key=coalesce($4,vote_rebuild_key),vote_rebuilt_at=$5 WHERE id=$1',[id,before.official?stamp:null,modelKey,rebuildKey,stamp]);
  return {fixture:id,players:votes.length,revisions,official:before.official,needsReview:votes.filter(x=>x.vote.needsReview).map(x=>x.p.id),readiness:finalReadiness(raw,normalized,votes),modelKey};
 });
}
export async function dailyCatalog({connect=connection,provider=fantaProvider(),env=process.env,now=Date.now}={}){
 const season=Number(env.FANTA_SEASON||2026),day=new Date(now()).toISOString().slice(0,10),id='daily:'+day;
 const c=await connect();try{if((await c.query('SELECT 1 FROM fanta.jobs WHERE id=$1',[id])).rows.length)return {cached:true};}finally{c.release();}
 const teams=await provider.get(`teams?league=135&season=${season}`),fixtures=await provider.get(`fixtures?league=135&season=${season}`),injuries=await provider.get(`injuries?league=135&season=${season}`);
 const rosters=[];for(const t of teams.response){const s=await provider.get('players/squads?team='+t.team.id);rosters.push(...s.response);}
 const seasonal=[];for(let page=1,pages=1;page<=pages;page++){const x=await provider.get(`players?league=135&season=${season}&page=${page}`);pages=Math.min(60,x.paging?.total||1);seasonal.push(...x.response);}
 if(teams.response.length!==20||rosters.flatMap(t=>t.players||[]).length<200||fixtures.response.length<10)throw Error('Catalogo incompleto: conservati i dati precedenti');
 return transaction(connect,async c=>{
  for(const t of teams.response)await c.query('INSERT INTO fanta.clubs VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name',['af:'+t.team.id,t.team.id,t.team.name]);
  const ownVotes=(await c.query("SELECT player_id,avg((data->>'vote')::numeric)::float AS vote,avg((data->>'fantavote')::numeric)::float AS fanta,count(*)::int AS played FROM (SELECT DISTINCT ON(fixture_id,player_id) * FROM fanta.votes ORDER BY fixture_id,player_id,id DESC) latest WHERE official AND data->>'vote' IS NOT NULL GROUP BY player_id")).rows;
  const values=priceList(rosters.flatMap(t=>(t.players||[]).filter(p=>ROLE[p.position]).map(p=>{const stats=seasonal.find(s=>s.player.id===p.id)?.statistics?.find(s=>s.league?.id===135),injury=injuries.response.filter(x=>x.player?.id===p.id&&Date.parse(x.fixture?.date)>=now()-3*86400000&&Date.parse(x.fixture?.date)<=now()+10*86400000).at(-1),own=ownVotes.find(x=>x.player_id==='af:'+p.id),matches=fixtures.response.filter(f=>['FT','AET','PEN'].includes(f.fixture.status.short)&&[f.teams.home.id,f.teams.away.id].includes(t.team.id)).length;return {id:'af:'+p.id,apiId:p.id,name:p.name,jersey:p.number??stats?.games?.number??'',surname:seasonal.find(s=>s.player.id===p.id)?.player?.lastname||null,active:true,role:ROLE[p.position],clubId:'af:'+t.team.id,played:stats?.games?.appearences||0,starts:stats?.games?.lineups||0,matches:Math.max(1,matches),avgFanta:own?.fanta??null,fm:own?.fanta??null,stats:{played:own?.played||0,avgVote:own?.vote??null,avgFanta:own?.fanta??null,goals:stats?.goals?.total||0,assists:stats?.goals?.assists||0},status:injury?{type:injury.player.type==='Questionable'?'doubtful':'injured',note:injury.player.reason||'Indisponibile'}:{type:'ok',note:''},seasonStats:stats||null};})));
  await c.query("UPDATE fanta.players SET data=jsonb_set(data,'{active}','false') WHERE NOT(id=ANY($1::text[])) AND coalesce((data->>'active')::boolean,true)",[values.map(p=>p.id)]);
  for(const p of values)await c.query(`INSERT INTO fanta.players(id,api_id,club_id,name,role,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET club_id=CASE WHEN fanta.players.data ? 'clubIdentity' THEN fanta.players.club_id ELSE EXCLUDED.club_id END,name=EXCLUDED.name,data=fanta.players.data||EXCLUDED.data`,[p.id,p.apiId,p.clubId,p.name,p.role,JSON.stringify(p)]);
  for(const f of fixtures.response){const round=Number(f.league.round?.match(/(\d+)$/)?.[1]);if(!round||round>38)continue;await c.query('INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET kickoff=EXCLUDED.kickoff WHERE fanta.fixtures.frozen_at IS NULL',['af:'+f.fixture.id,f.fixture.id,season,round,f.fixture.date,f.fixture.status.short,'af:'+f.teams.home.id,'af:'+f.teams.away.id,JSON.stringify(f)]);}
  const stats=(await c.query('SELECT data FROM fanta.player_stats')).rows.map(x=>x.data),baseline=calibrateBaselines(stats,{asOf:new Date(now()).toISOString()});await c.query('INSERT INTO fanta.baselines(id,model,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[hashInput(baseline),MODEL,JSON.stringify(baseline)]);
  await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,JSON.stringify({players:values.length,calls:provider.calls})]);return {players:values.length,calls:provider.calls};
 });
}
export async function computeRounds({connect=connection,now=Date.now,recalculate=false,modelKey=currentModelKey(),serieARounds=null,correctionReason='owner-authorized-full-statistical-rebuild'}={}){
 const c=await connect();let leagues;try{leagues=(await c.query(`SELECT l.id,l.admin_uid,c.id AS competition_id,c.kind FROM fanta.leagues l JOIN fanta.competitions c ON c.league_id=l.id WHERE l.rules->>'disabledAt' IS NULL`)).rows;}finally{c.release();}
 const store=sqlFantaStore({connect});let count=0;
 for(const l of leagues){const c=await connect();let rounds;try{rounds=(await c.query('SELECT number FROM fanta.rounds WHERE competition_id=$1 AND ($3 OR NOT official) AND deadline<=$2 AND ($4::int[] IS NULL OR seriea_round=ANY($4::int[])) ORDER BY number',[l.competition_id,new Date(now()).toISOString(),recalculate,serieARounds])).rows;}finally{c.release();}
  for(const r of rounds)await store.league(l.admin_uid,l.id,async(s,c)=>{
   const round=s.rounds.find(x=>x.number===r.number);if(recalculate)round.official=false;const fixtures=s.fixtures.filter(f=>f.round===round.seriea_round),official=fixtures.length===10&&fixtures.every(f=>f.frozen_at);

   const view=roundView(s,round,l.admin_uid,now(),true),complete=view.matchups.length>0&&view.matchups.every(m=>!m.home.pending&&!m.away.pending&&Number.isFinite(m.home.points)&&Number.isFinite(m.away.points)),closed=official&&complete,calculated=fixtures.length===10&&fixtures.every(f=>['FT','AET','PEN'].includes(f.status))&&view.matchups.length>0&&view.matchups.every(m=>!m.unmapped&&Number.isFinite(m.home.points)&&Number.isFinite(m.away.points));
   for(const m of view.matchups){const prior=s.results.find(x=>x.matchup_id===m.id);if(!calculated&&(prior?.official||prior?.data.calculation?.complete))continue;m.calculation={complete:calculated,modelKey,verified:closed,missingLineupPolicy:'zero-v1'};if(recalculate){const previous=s.results.find(x=>x.matchup_id===m.id);await c.query('INSERT INTO fanta.result_revisions(matchup_id,model_key,input_hash,previous_data,next_data,previous_official,next_official,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',[m.id,modelKey,hashInput({before:previous?.data||null,after:m}),previous?JSON.stringify(previous.data):null,JSON.stringify(m),previous?.official??null,closed,correctionReason]);}await c.query('INSERT INTO fanta.results(matchup_id,official,data) VALUES($1,$2,$3) ON CONFLICT(matchup_id) DO UPDATE SET historical=CASE WHEN $4 THEN false ELSE fanta.results.historical END,official=EXCLUDED.official,data=EXCLUDED.data,updated_at=now() WHERE ($4 OR NOT fanta.results.historical AND NOT fanta.results.official) AND (fanta.results.data IS DISTINCT FROM EXCLUDED.data OR fanta.results.official<>EXCLUDED.official OR ($4 AND fanta.results.historical))',[m.id,closed,JSON.stringify(m),recalculate]);}if(closed||recalculate)await c.query('UPDATE fanta.rounds SET official=$3 WHERE competition_id=$1 AND number=$2',[l.competition_id,r.number,closed]);count++;
   await saveCompetitionSummary(s,c);
  },{write:true,number:r.number,competition:l.competition_id});
  if(l.kind!=='league')await store.league(l.admin_uid,l.id,(s,c)=>advanceCup(s,c),{write:true,competition:l.competition_id});
 }
 return count;
}
