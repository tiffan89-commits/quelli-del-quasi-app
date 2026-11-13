import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {runOperation} from '../lib/operations/workflows.mjs';
import {readBarRows} from '../lib/operations/bar-rows.mjs';
import {saveBarSlip} from '../lib/bar-slip-save.mjs';
import {sha} from '../lib/game.mjs';
import {readSnapshot} from '../lib/db.mjs';
import {persistApiOdds,readOddsSnapshot} from '../lib/operations/odds-db.mjs';
import {refreshFutureCalendar} from '../lib/operations/future-calendar.mjs';
import {changeBarStorage} from '../runtime/bar-storage.mjs';
import {storedOdds} from '../fanta/statistical-votes/repository.mjs';
import {runMatchCache} from '../lib/match-cache.mjs';

test('replaying a final settles once and resumes interrupted rewards on row storage',async()=>{
 const db=new PGlite();
 const kickoff='2026-11-08T19:45:00.000Z';
 const fixtureId='seriea:2026:11:2',roundId='round-11',leagueId='league',userId='user';
 const rules={mode:'classic',correct:1,wrong:-1};
 const match={id:fixtureId,home:'Fiorentina',away:'Juventus',status:'NS',score:null,kickoff,odds:{1:2.5},frozen:{}};
 const token='synthetic-session',input={league:leagueId,round:roundId,stake:10,picks:{[fixtureId]:'1'},baseSavedAt:null};
 const original={
  users:[{id:userId,name:'Test',emailVerified:true}],
  sessions:[{uid:userId,token:sha(token),expires:Date.now()+3600000}],
  leagues:[{id:leagueId,name:'Test',rules,members:[{uid:userId,credits:500,points:0}]},
   {id:'unrelated',name:'Unrelated',rules,members:[{uid:'other',credits:500,points:0}]}],
  rounds:[{id:roundId,league:leagueId,title:'Giornata 11',source:'seriea',number:11,
   kickoff,deadline:'2000-01-01T00:00:00Z',rules,requiresOfficialScores:true,matches:[match],slips:[]}],
  ledger:[],football:{calendar:{season:2026,rounds:[{number:11,matches:[match]}]},rounds:{bookable:{matches:[match]}}},
 };
 const final={
  fixture:{id:123456,date:kickoff,status:{short:'FT'}},
  league:{id:135,season:2026},
  teams:{home:{id:1,name:match.home},away:{id:2,name:match.away}},
  goals:{home:1,away:0},
 };
 let failRewards=true,cache;
 const connect=async()=>({
  async query(sql,values){
   if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
   if(failRewards&&sql.startsWith('INSERT INTO fanta.bar_player_rewards'))throw Error('reward write interrupted');
   const result=await db.query(sql,values);
   return {...result,rowCount:result.affectedRows};
  },
  release(){},
 });
 const options={
  connect,env:{},sportsStorage:'rows',now:()=>Date.parse('2026-11-09T00:00:00Z'),
  provider:{async get(){return {response:[final]};}},
  scoreStore:{
   async getWithMetadata(){return cache;},
   async setJSON(_key,data){cache={data,etag:'saved'};return {modified:true};},
  },
 };
 const batch=()=>runOperation({kind:'live',fixtureIds:[fixtureId]},
  {fixtures:[{id:fixtureId,apiId:123456,round:11,kickoff}]},options);
 const state=()=>readBarRows(db,{leagueIds:[leagueId]});
 const movements=async()=>(await db.query('SELECT data FROM fanta.bar_credit_ledger ORDER BY position')).rows;
 const rewards=async()=>(await db.query('SELECT data FROM fanta.bar_player_rewards WHERE user_id=$1',[userId])).rows;
 try{
  await db.exec('CREATE SCHEMA fanta; CREATE TABLE fanta_state(id int PRIMARY KEY,payload jsonb)');
  await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(original)]);
  for(const name of ['017_live_storage_backfill','018_live_storage_accounts','019_live_storage_read_views','020_live_storage_round_cache','021_live_storage_league_order']){
   await db.exec(await readFile(new URL('../netlify/database/migrations/'+name+'.sql',import.meta.url),'utf8'));
  }
  const snapshot=(kind,sportsStorage,other={})=>readSnapshot(state=>state,{
   kind,league:leagueId,competition:roundId,team:fixtureId,connect,sportsStorage,...other,
  });
  for(const kind of ['live','results','match','analysis']){
   assert.deepEqual(await snapshot(kind,'rows'),await snapshot(kind,'snapshot'),kind);
  }
  const loginSnapshot=(storage,sessionToken)=>snapshot('game',storage,{tokenHash:sha(sessionToken)});
  assert.deepEqual(await loginSnapshot('rows','unknown'),await loginSnapshot('snapshot','unknown'));
  assert.deepEqual((await loginSnapshot('rows',token)).leagues.map(l=>l.id),[leagueId]);
  const saved=await saveBarSlip(token,input,{connect,sportsStorage:'rows',now:()=>Date.parse('2026-11-08T19:00:00Z')});
  assert.equal(saved.receipt.member.credits,490);
  assert.equal((await state()).rounds[0].slips[0].acceptedOdds[fixtureId],2.5);
  const appSnapshot=()=>readSnapshot(state=>state,{kind:'game',connect,sportsStorage:'rows'});
  assert.equal((await appSnapshot()).rounds[0].slips[0].acceptedOdds[fixtureId],2.5);
  const oddsOptions={connect,sportsStorage:'rows',now:Date.parse('2026-11-08T19:15:00Z')};
  const quote={value:3,provider:'API-FOOTBALL',acquiredAt:new Date(oddsOptions.now).toISOString()};
  const updateQuotes=()=>persistApiOdds([{id:fixtureId,quotes:{1:quote},refresh:true}],oddsOptions);
  assert.equal((await updateQuotes()).changed,1);
  assert.equal((await readOddsSnapshot([fixtureId],oddsOptions)).matches[0].odds[1],3);
  assert.equal((await state()).rounds[0].matches[0].odds[1],3);
  assert.equal((await updateQuotes()).changed,0);

  await assert.rejects(batch,/reward write interrupted/);
  const settled=await state(),ledger=await movements();
  assert.equal(settled.leagues[0].members[0].credits,515);
  assert.equal(settled.rounds[0].slips[0].prize,25);
  assert.deepEqual(settled.rounds[0].slips[0].acceptedOdds,saved.receipt.slip.acceptedOdds);
  assert.equal(ledger.filter(row=>row.data.amount===25).length,1);
  assert.deepEqual(await rewards(),[]);
  assert.deepEqual(cache.data.matches[0].score,[1,0]);

  failRewards=false;
  const retry=await batch();
  assert.equal(retry.ok,true);
  assert.equal(retry.metrics.derived.changed,true);
  const awarded=await state(),awards=await rewards();
  assert.equal(awarded.rounds[0].rewardVersion,1);
  assert.equal(awards[0].data.filter(award=>award.round===roundId).length,1);
  const app=await appSnapshot();
  assert.equal(app.rounds[0].slips[0].prize,25);
  assert.equal(app.leagues[0].members[0].credits,515);
  const withLedger=await loginSnapshot('rows',token);
  const withoutLedger=await snapshot('game','rows',{tokenHash:sha(token),includeLedger:false});
  assert.ok(withLedger.ledger.length>0);
  assert.deepEqual(withoutLedger,{...withLedger,ledger:[]});
  assert.equal((await snapshot('live','rows')).rounds[0].slips[0].prize,25);
  assert.deepEqual((await snapshot('results','rows')).rounds[0].matches[0].score,[1,0]);
  assert.deepEqual((await snapshot('match','rows')).football.calendar.rounds[0].matches[0].score,[1,0]);
  assert.deepEqual((await db.query("SELECT data#>'{matches,0,score}' AS score FROM fanta.bar_football_round_cache WHERE cache_key='bookable'")).rows[0].score,[1,0]);
  assert.equal((await snapshot('analysis','rows')).rounds[0].slips[0].odds,2.5);
  const replay=await batch();
  assert.equal(replay.metrics.dbWrites,0);
  assert.equal(replay.metrics.cacheWrites,0);
  assert.equal(replay.metrics.derived,undefined);
  assert.deepEqual(await state(),awarded);
  assert.deepEqual(await movements(),ledger);
  assert.deepEqual(await rewards(),awards);
  const newKickoff='2026-11-08T20:00:00.000Z';
  const future={fixture:{id:1550189,date:newKickoff,status:{short:'NS'}}};
  const refresh=await refreshFutureCalendar({get:async()=>({response:[future]})},oddsOptions);
  assert.equal(refresh[0].id,fixtureId);
  assert.equal((await snapshot('match','rows')).football.calendar.rounds[0].matches[0].kickoff,newKickoff);
  assert.equal((await state()).rounds[0].matches[0].kickoff,kickoff);
  assert.deepEqual((await db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload,original);
  for(const name of ['022_live_storage_cutover','023_live_storage_membership_view']){
   await db.exec(await readFile(new URL('../netlify/database/migrations/'+name+'.sql',import.meta.url),'utf8'));
  }
  assert.equal((await changeBarStorage('enable',{connect})).after.active,true);
  assert.deepEqual((await db.query('SELECT payload FROM fanta.fanta_state WHERE id=1')).rows[0].payload,original);
  await db.query(`UPDATE fanta.bar_seriea_matches SET data=data||jsonb_build_object('apiFootballId',123456,'frozen',$2::jsonb) WHERE id=$1`,
   [fixtureId,JSON.stringify(Object.fromEntries([['1',2.5],['X',3.1],['2',3.2]].map(([pick,value])=>[pick,{value,acquiredAt:'2026-11-08T19:10:00Z'}])))]);
  const direct=await storedOdds(db,123456,{sportsStorage:'rows'});
  assert.equal(direct.available,true);
  // The old public snapshot has no odds after cutover, so this would fail if it were used.
  assert.equal(await storedOdds(db,123456,{sportsStorage:'snapshot'}),null);
  await db.query("UPDATE fanta.bar_seriea_matches SET data=$2::jsonb WHERE id=$1",[fixtureId,JSON.stringify(match)]);
  const statements=[];
  const cacheConnect=async()=>{
   const c=await connect();
   return {...c,query(sql,args){statements.push(sql);return c.query(sql,args);}};
  };
  const cacheReport=await runMatchCache({
   connect:cacheConnect,sportsStorage:'rows',recordAccuracy:null,
   now:()=>new Date('2026-11-08T17:00:00Z'),
   lineupFetcher:async()=>new Response(null,{status:503}),
   fetcher:async()=>{throw Error('Archive fetch was not due');},
  });
  assert.equal(cacheReport.processed,1);
  assert.ok(!statements.some(sql=>sql.includes('bar_matchday_documents')||sql.includes('bar_replace_calendar')));
  assert.equal((await db.query("SELECT data->>'lineupCheckedAt' AS at FROM fanta.bar_seriea_matches WHERE id=$1",[fixtureId])).rows[0].at,'2026-11-08T17:00:00.000Z');
  await db.query("UPDATE fanta.bar_seriea_matches SET data=$2::jsonb WHERE id=$1",[fixtureId,JSON.stringify(match)]);
  await db.query("UPDATE fanta.bar_matchday_matches SET data=$2::jsonb WHERE id=$1",[fixtureId,JSON.stringify(match)]);
  await db.query("UPDATE fanta.bar_football_round_cache SET data=$1::jsonb WHERE cache_key='bookable'",[JSON.stringify(original.football.rounds.bookable)]);
  await db.query("UPDATE fanta.bar_membership_document SET payload=jsonb_set(payload,'{leagues,0,name}',to_jsonb('New name'::text)) WHERE id=1");
  assert.equal((await snapshot('live','rows')).leagues[0].name,'New name');
  assert.equal((await changeBarStorage('disable',{connect})).after.active,false);
  const restored=(await db.query('SELECT payload FROM public.fanta_state WHERE id=1')).rows[0].payload;
  assert.equal(restored.football.matchCacheReport.processed,1);
  delete restored.football.matchCacheReport;
  delete restored.football.forecastSourceCache;
  original.leagues[0].name='New name';
  assert.deepEqual(restored,original);
 }finally{await db.close();}
});
