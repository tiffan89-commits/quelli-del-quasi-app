import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {patchSports} from '../lib/operations/sports-db.mjs';
import {compensateSettlement} from '../lib/settlement-corrections.mjs';
import {createPublicFootball} from '../netlify/functions/public-football.mjs';
import {sportsWindowActive} from '../public/src/sports-window.mjs';
import {publishMatches} from '../lib/operations/workflows.mjs';
import {updateDerived} from '../lib/operations/derived-db.mjs';
import {DEFAULT_RULES} from '../lib/game.mjs';
import fs from 'node:fs';
test('targeted sports patches preserve concurrent private fields and unrelated fixtures; unchanged input has no writes',async()=>{
 const db=new PGlite();let writes=0;const connect=async()=>({query:async(q,p)=>{if(q.includes('pg_advisory_xact_lock'))return {rows:[]};if(q.startsWith('UPDATE'))writes++;return db.query(q,p);},release(){}});
 try{
  await db.exec('CREATE TABLE fanta_state(id int PRIMARY KEY,payload jsonb)');
  const m={id:'m',home:'A',away:'B',kickoff:'2099-01-01T12:00:00Z',status:'NS'},other={id:'other',status:'FT',details:{secretOfAnotherFixture:'preserved'}};
  const original={users:[{id:'u',email:'private@example.test'}],sessions:[{token:'private-session'}],fantasyConnections:[{secret:'encrypted-private-source'}],leagues:[],rounds:[],ledger:[],football:{calendar:{season:2026,rounds:[{number:1,matches:[m,other]}]},rounds:{r:{matches:[m,other]}}}};
  await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(original)]);
  const first=await patchSports(['m'],s=>{s.football.calendar.rounds[0].matches[0].status='LIVE';},{connect});assert.equal(first.changed,true);
  const saved=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.deepEqual(saved.users,original.users);assert.deepEqual(saved.sessions,original.sessions);assert.deepEqual(saved.fantasyConnections,original.fantasyConnections);assert.deepEqual(saved.football.calendar.rounds[0].matches[1],other);assert.equal(saved.football.rounds.r.matches[0].status,'LIVE');assert.deepEqual(saved.rounds,[]);
  writes=0;const again=await patchSports(['m'],()=>{},{connect});assert.equal(again.changed,false);assert.equal(writes,0);
 }finally{await db.close();}
});
test('official corrections compensate only differences, preserve accepted stake/odds and are idempotent even across A→B→A',()=>{
 const member={uid:'u',points:1,credits:500},l={id:'l',members:[member]},r={id:'r',settled:true,rules:{mode:'classic',correct:1,wrong:-1},matches:[{id:'m',status:'FT',score:[0,1],officialConfirmed:true}],slips:[{uid:'u',settled:true,points:1,prize:20,stake:10,odds:2,picks:{m:'1'},pointTerms:{m:{correct:1,wrong:-1}}}]},s={ledger:[]};
 assert.equal(compensateSettlement(s,l,r),true);assert.equal(member.credits,480);assert.equal(member.points,-1);assert.equal(compensateSettlement(s,l,r),false);assert.equal(s.ledger.length,1);
 r.matches[0].score=[1,0];assert.equal(compensateSettlement(s,l,r),true);assert.equal(member.credits,500);assert.equal(member.points,1);assert.equal(s.ledger.length,2);assert.notEqual(s.ledger[0].id,s.ledger[1].id);assert.equal(r.slips[0].stake,10);assert.equal(r.slips[0].odds,2);
});
test('settlement-derived awards and profiles are computed by backend once without replacing users or slips',async()=>{
 const db=new PGlite(),connect=async()=>({query:(q,p)=>q.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(q,p),release(){}});
 try{
  await db.exec('CREATE TABLE fanta_state(id int PRIMARY KEY,payload jsonb)');
  const matches=Array.from({length:10},(_,i)=>({id:'m'+i,home:'Casa',away:'Ospiti',status:'FT',score:[1,0],odds:{1:2},kickoff:'2026-10-31T12:00:00Z'}));
  const slip={uid:'u',stake:10,odds:1024,points:10,prize:10240,settled:true,picks:Object.fromEntries(matches.map(m=>[m.id,'1']))},users=[{id:'u',name:'Sintetico',email:'private@example.test'}],s={users,leagues:[{id:'l',members:[{uid:'u',credits:500,points:10}],rules:DEFAULT_RULES}],rounds:[{id:'r',league:'l',number:1,title:'Giornata 1',source:'seriea',settled:true,kickoff:'2026-10-31T12:00:00Z',rules:DEFAULT_RULES,matches,slips:[slip]}],playerProfiles:{},playerRewards:{}};
  await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(s)]);assert.equal((await updateDerived(['m0'],{connect})).changed,true);
  const saved=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.deepEqual(saved.users,users);assert.deepEqual(saved.rounds[0].slips,[slip]);assert.equal(saved.playerProfiles['l:u'].history.length,1);assert.ok(saved.playerRewards.u.length);assert.equal(saved.rounds[0].rewardVersion,1);
  const again=await updateDerived(['m0'],{connect});assert.equal(again.changed,false,JSON.stringify(again));
 }finally{await db.close();}
});
test('100 clients read the shared public cache without DB/provider access; private top-level fields cannot leak',async()=>{
 const payload={matches:[{id:'m',status:'LIVE',liveScore:[1,0]}],revision:'rev',users:[{email:'private@example.test'}]},handler=createPublicFootball({scores:()=>({get:async()=>payload}),calendar:()=>({get:async()=>null})});
 const responses=await Promise.all(Array.from({length:100},()=>handler(new Request('https://example.test/.netlify/functions/public-football'))));
 for(const r of responses){assert.equal(r.status,200);assert.match(r.headers.get('Netlify-CDN-Cache-Control'),/durable/);const body=await r.json();assert.equal(body.users,undefined);assert.equal(body.matches[0].liveScore[0],1);}
 const r=await handler(new Request('https://example.test/.netlify/functions/public-football',{headers:{'If-None-Match':responses[0].headers.get('etag')}}));assert.equal(r.status,304);
});
test('public cache writes only changed whitelisted content, omitting formations, portraits and credentials',async()=>{
 let data=null,writes=0;const store={getWithMetadata:async()=>data?{data,etag:'v'}:null,setJSON:async(_k,v)=>{data=v;writes++;return {modified:true};}},m={id:'m',status:'FT',score:[1,0],details:{events:[],sourceSession:'private',players:['heavy']},lineups:['heavy']};
 await publishMatches([m],{store});await publishMatches([m],{store});assert.equal(writes,1);assert.ok(!JSON.stringify(data).includes('private'));assert.ok(!JSON.stringify(data).includes('heavy'));
});
test('client sport window stops outside matches and after final status; no email cron or nine legacy schedules survive',()=>{
 const start=Date.parse('2026-11-01T17:00:00Z'),matches=[{kickoff:new Date(start).toISOString(),status:'NS'}];assert.equal(sportsWindowActive([{matches}],start-3600000),false);assert.equal(sportsWindowActive([{matches}],start+60000),true);matches[0].status='FT';assert.equal(sportsWindowActive([{matches}],start+60000),false);
 const config=fs.readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');assert.equal((config.match(/schedule = /g)||[]).length,1);assert.match(config,/functions\."operational-dispatch"/);
 for(const name of ['send-mail','send-chat-push','send-reminders'])assert.doesNotMatch(fs.readFileSync(new URL('../netlify/functions/'+name+'.mjs',import.meta.url),'utf8'),/config\s*=\s*\{\s*schedule\s*:/);
});
