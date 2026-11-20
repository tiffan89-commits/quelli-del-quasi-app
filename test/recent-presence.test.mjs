import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatePresence,presenceProbability,roundPresenceEstimate,PRESENCE_MODEL} from '../public/src/fanta/presence-probability.mjs';
import {refreshPresenceEstimates} from '../fanta/presence-estimates.mjs';
import {fixtureDb} from './fanta/helpers.mjs';
const recent=(count,extra={})=>Array.from({length:count},(_,i)=>({fixtureId:'f'+i,known:true,minutes:90,starter:true,baseVote:6,...extra}));
const player=(rows,minutes=270)=>({clubId:'c1',stats:{minutes,teamMatches:20,recentPresence:rows}});
test('recent starts dominate seasonal history exponentially, good own grades and decisive contributions help, official remains definitive',()=>{
 const one=estimatePresence(player(recent(1))),three=estimatePresence(player(recent(3)));
 assert.equal(three.pct,90);assert.ok(three.pct>one.pct);
 const normal=estimatePresence(player(recent(1))),good=estimatePresence(player(recent(1,{baseVote:6.3}))),decisive=estimatePresence(player(recent(1,{baseVote:6,decisiveAssist:true})));
 assert.ok(good.pct>normal.pct);assert.ok(decisive.pct>normal.pct);
 assert.equal(estimatePresence(player(recent(1,{baseVote:6.2}))).pct,normal.pct);
 assert.ok(estimatePresence(player(recent(3,{minutes:0,starter:false}),1530)).pct<10);
 assert.equal(estimatePresence(player(recent(3,{known:false,minutes:null}),900)).pct,50);
 assert.deepEqual(presenceProbability({...player(recent(3)),status:{type:'injured'}}),{source:'unavailable',pct:0});
 assert.deepEqual(presenceProbability({...player(recent(3)),status:{type:'suspended'},play:{source:'official',pct:100}}),{source:'unavailable',pct:0});
 assert.equal(presenceProbability({...player([]),presenceEstimate:{model:PRESENCE_MODEL,clubId:'old',pct:95}}).pct,15);
});
test('presence refresh uses existing own grades and verified evidence, leaves protected tables intact, rerun performs no writes',async()=>{
 const f=await fixtureDb();try{
  // Simulate three fully covered matches: missing player rows are known DNPs.
  for(let i=1;i<=3;i++){
   const raw={players:[{team:{id:1},players:Array.from({length:11},()=>({statistics:[{games:{minutes:90}}]}))}]};
   await f.db.query(`INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES($1,$2,2026,$2,$3,'FT','c1','c2',$4)`,['f'+i,i,`2026-10-0${i}T12:00Z`,JSON.stringify(raw)]);
   await f.db.query(`INSERT INTO fanta.player_stats VALUES($1,'p1-1',$2,$1)`,['f'+i,JSON.stringify({minutes:90,clubId:'c1',presence:{starter:true},context:{marqueeEvidence:{timelineVerified:true,decisive:[{kind:'assist'}]}}})]);
   await f.db.query(`INSERT INTO fanta.votes(fixture_id,player_id,version,input_hash,input,data) VALUES($1,'p1-1','test',$1,'{}','{"vote":6.5,"fantavote":10}')`,['f'+i]);
  }
  const protectedRows=async()=>JSON.stringify((await f.db.query(`SELECT (SELECT jsonb_agg(v) FROM fanta.votes v) AS votes,(SELECT jsonb_agg(s) FROM fanta.player_stats s) AS stats,(SELECT payload FROM fanta_state WHERE id=1) AS state,(SELECT jsonb_agg(l) FROM fanta.lineups l) AS lineups`)).rows);
  const before=await protectedRows(),writes=[];
  const connect=async()=>{const c=await f.connect();return {...c,query:(sql,args)=>{if(/^(UPDATE|INSERT)/.test(sql))writes.push(sql);return c.query(sql,args);}};};
  const first=await refreshPresenceEstimates({connect,season:2026,now:Date.parse('2026-11-04')});assert.ok(first.changed>0);assert.equal(first.providerCalls,0);
  const estimate=(await f.db.query(`SELECT data->'presenceEstimate' AS value FROM fanta.players WHERE id='p1-1'`)).rows[0].value;
  assert.equal(estimate.pct,90);assert.equal(estimate.evidence.starterStreak,3);assert.ok(estimate.evidence.goodForm>1);
  const dnp=(await f.db.query(`SELECT data->'presenceEstimate' AS value FROM fanta.players WHERE id='p1-2'`)).rows[0].value;assert.equal(dnp.pct,0);
  writes.length=0;const repeat=await refreshPresenceEstimates({connect,season:2026,now:Date.parse('2026-11-05')});assert.equal(repeat.changed,0);assert.equal(writes.length,0);assert.equal(await protectedRows(),before);
 }finally{await f.close();}
});
test('estimates always round upwards to five-point steps, capped at 90; official remains 100 or zero',()=>{
 for(const [raw,result] of [[0,0],[.1,5],[20,20],[20.1,25],[21,25],[24.9,25],[25,25],[86,90],[90,90],[97,90],[100,90]])assert.equal(roundPresenceEstimate(raw),result);
 assert.equal(roundPresenceEstimate(null),null);assert.equal(roundPresenceEstimate(NaN),null);
 for(const pct of [0,21,97,100])assert.deepEqual(presenceProbability({play:{pct,source:'minutes-estimate'}}),{pct:roundPresenceEstimate(pct),source:'minutes-estimate'});
 assert.deepEqual(presenceProbability({play:{pct:100,source:'official'}}),{pct:100,source:'official'});
});
