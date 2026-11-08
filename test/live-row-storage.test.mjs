import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {runOperation} from '../lib/operations/workflows.mjs';
import {readBarRows} from '../lib/operations/bar-rows.mjs';

test('replaying a final settles once and resumes interrupted rewards on row storage',async()=>{
 const db=new PGlite();
 const kickoff='2026-11-08T19:45:00.000Z';
 const fixtureId='seriea:2026:11:2',roundId='round-11',leagueId='league',userId='user';
 const rules={mode:'classic',correct:1,wrong:-1};
 const match={id:fixtureId,home:'Fiorentina',away:'Juventus',status:'NS',score:null,kickoff,odds:{1:3},frozen:{}};
 const slip={uid:userId,stake:10,picks:{[fixtureId]:'1'},acceptedOdds:{[fixtureId]:2.5}};
 const original={
  users:[{id:userId,name:'Test'}],
  leagues:[{id:leagueId,name:'Test',rules,members:[{uid:userId,credits:490,points:0}]}],
  rounds:[{id:roundId,league:leagueId,title:'Giornata 11',source:'seriea',number:11,
   kickoff,deadline:'2000-01-01T00:00:00Z',rules,requiresOfficialScores:true,matches:[match],slips:[slip]}],
  ledger:[],football:{calendar:{season:2026,rounds:[{number:11,matches:[match]}]}},
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
  for(const name of ['017_live_storage_backfill','018_live_storage_accounts']){
   await db.exec(await readFile(new URL('../netlify/database/migrations/'+name+'.sql',import.meta.url),'utf8'));
  }

  await assert.rejects(batch,/reward write interrupted/);
  const settled=await state(),ledger=await movements();
  assert.equal(settled.leagues[0].members[0].credits,515);
  assert.equal(settled.rounds[0].slips[0].prize,25);
  assert.deepEqual(settled.rounds[0].slips[0].acceptedOdds,slip.acceptedOdds);
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
  const replay=await batch();
  assert.equal(replay.metrics.dbWrites,0);
  assert.equal(replay.metrics.cacheWrites,0);
  assert.deepEqual(await state(),awarded);
  assert.deepEqual(await movements(),ledger);
  assert.deepEqual(await rewards(),awards);
  assert.deepEqual((await db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload,original);
 }finally{await db.close();}
});
