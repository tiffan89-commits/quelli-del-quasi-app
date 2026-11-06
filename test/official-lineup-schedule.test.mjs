import test from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {newPlan,claimWork,completeWork,refreshPlan} from '../lib/operations/calendar.mjs';
import {runOfficialLineups} from '../lib/operations/official-lineups.mjs';
const kickoff=Date.parse('2026-11-10T19:45Z'),minute=60000;
const calendar=[{number:12,matches:[{id:'m',apiFootballId:123,home:'Venezia',away:'Udinese',kickoff:new Date(kickoff).toISOString(),status:'NS'}]}];
test('official XI starts at T-30, retries at five minutes only for missing data, and stops after saving',()=>{
 let p=newPlan(calendar,{now:kickoff-3600000});assert.equal(claimWork(p,{now:kickoff-31*minute}).jobs.some(j=>j.kind==='official-lineups'),false);
 let claim=claimWork(p,{now:kickoff-30*minute,nonce:'a'}),job=claim.jobs.find(j=>j.kind==='official-lineups');assert.ok(job);
 assert.equal(claimWork(claim.plan,{now:kickoff-30*minute,nonce:'duplicate'}).jobs.length,0);
 p=completeWork(claim.plan,job,{ok:false,pendingFixtureIds:['m']},{now:kickoff-30*minute});const retry=p.jobs.find(j=>j.retryOf===job.id);assert.equal(Date.parse(retry.at),kickoff-25*minute);
 claim=claimWork(p,{now:kickoff-25*minute,nonce:'b'});p=completeWork(claim.plan,claim.jobs.find(j=>j.id===retry.id),{ok:true,fixtures:[{id:'m',officialLineups:true}]},{now:kickoff-25*minute});
 assert.equal(p.fixtures[0].officialLineups,true);assert.equal(refreshPlan(p,[],{now:kickoff-20*minute}).jobs.filter(j=>j.kind==='official-lineups'&&j.status==='queued').length,0);
});
test('a late install catches up once, transport errors retry, postponed games cancel queued XI requests',()=>{
 let p=newPlan(calendar,{now:kickoff-10*minute}),claim=claimWork(p,{now:kickoff-10*minute,nonce:'a'}),job=claim.jobs.find(j=>j.kind==='official-lineups');assert.ok(job);
 p=completeWork(claim.plan,job,{ok:false,error:'temporarily unavailable'},{now:kickoff-10*minute});assert.equal(p.jobs.filter(j=>j.kind==='official-lineups'&&j.status==='queued').length,1);
 p=refreshPlan(p,[{id:'m',status:'PST'}],{now:kickoff-8*minute});assert.equal(p.jobs.filter(j=>j.kind==='official-lineups'&&j.status==='queued').length,0);
});
test('partial API data keeps predictions, complete XI is cached in both stores and is never downloaded again',async()=>{
 const db=new PGlite(),connect=async()=>({query:(q,p)=>q.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(q,p),release(){}});
 try{await db.exec('CREATE TABLE fanta_state(id int,payload jsonb);CREATE SCHEMA fanta;CREATE TABLE fanta.fixtures(api_id int,data jsonb)');
  const match={...calendar[0].matches[0],lineups:{kind:'probable',teams:[]}},s={football:{calendar:{rounds:[{number:12,matches:[match]}]}},rounds:[],leagues:[],ledger:[],users:[]};await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(s)]);await db.query('INSERT INTO fanta.fixtures VALUES(123,$1)',[JSON.stringify({untouched:'keep'})]);
  const team=(id,name)=>({team:{id,name},formation:'4-4-2',startXI:Array.from({length:11},(_,i)=>({player:{id:id*100+i,name:'Giocatore '+i,number:i+1,pos:i?'D':'G',grid:'1:1'}})),substitutes:[]});let data=[team(1,'Venezia')],calls=0;
  const provider={quota:{calls:0},get:async path=>{assert.equal(path,'fixtures/lineups?fixture=123');calls++;return {response:data};}},plan={fixtures:[{...match,apiId:123}]},job={fixtureIds:['m']};
  assert.equal((await runOfficialLineups(job,plan,{connect,provider})).ok,false);assert.deepEqual((await db.query('SELECT payload FROM fanta_state')).rows[0].payload,s);
  data=[...data,team(2,'Udinese')];assert.equal((await runOfficialLineups(job,plan,{connect,provider})).ok,true);assert.equal(calls,2);
  assert.equal((await db.query("SELECT payload#>>'{football,calendar,rounds,0,matches,0,lineups,kind}' AS kind FROM fanta_state")).rows[0].kind,'official');assert.equal((await db.query('SELECT data FROM fanta.fixtures')).rows[0].data.lineups.length,2);
  assert.equal((await runOfficialLineups(job,plan,{connect,provider})).metrics.saved,0);assert.equal(calls,2);
 }finally{await db.close();}
});
