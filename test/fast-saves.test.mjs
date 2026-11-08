import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb} from './fanta/helpers.mjs';import {saveBarSlip} from '../lib/bar-slip-save.mjs';
import {emptyState} from '../lib/db.mjs';import {newLeague,session} from '../lib/game.mjs';
import {identifySlipSave} from '../public/src/save-guard.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';
import {applySlipReceipt} from '../public/src/slip-receipt.mjs';
test('slip retry keys are stable for identical drafts and differ across users or changes',()=>{
 const input={league:'l',round:'r',picks:{b:'X',a:'1'},stake:10,baseSavedAt:null};let n=0;
 const options={user:'u',makeId:()=>String(++n).padStart(20,'0'),now:1};
 const first=identifySlipSave(input,options);assert.equal(identifySlipSave({...input,picks:{a:'1',b:'X'}},options).requestId,first.requestId);
 assert.notEqual(identifySlipSave({...input,stake:11},options).requestId,first.requestId);assert.notEqual(identifySlipSave(input,{...options,user:'other'}).requestId,first.requestId);
});
test('targeted Bar saves preserve unrelated data, replay without duplicate debit, reject stale changes and foreign users',async()=>{
 const f=await fixtureDb();try{
  const s=emptyState(),u={id:'u1',username:'frankwood',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Test salvataggio'),token=session(s,u.id);l.members.push({uid:'u2',credits:500,initial:500,points:0});
  const other={uid:'u2',stake:5,picks:{m:'2'},secretExample:'retained',savedAt:'2026-11-01'};
  const r={id:'fast-round',league:l.id,source:'seriea',number:11,title:'Giornata 11',kickoff:'2099-01-01T15:00Z',rules:l.rules,slips:[other],matches:[{id:'m',odds:{1:2,X:3,2:4},details:{large:'x'.repeat(100000)}}]};s.rounds.push(r,...[12,13].map(number=>({...r,id:'future-'+number,number,kickoff:null,slips:[],matches:[{id:'future-match-'+number}]})));s.football.extra='retained';
  await f.db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[JSON.stringify(s)]);
  let bytes=0;const connect=async()=>{const c=await f.connect();return {...c,query:async(sql,args)=>{const value=await c.query(sql,args);if(sql.startsWith('WITH base'))bytes=Buffer.byteLength(JSON.stringify(value.rows));return value;}};};
  const input={league:l.id,round:r.id,picks:{m:'1'},stake:10,baseSavedAt:null,requestId:'request_first_00001'};
  await assert.rejects(saveBarSlip(token,{...input,stake:499},{connect}),/un credito per ogni giornata/);
  const first=await saveBarSlip(token,input,{connect});assert.equal(first.receipt.member.credits,490);assert.equal(first.receipt.ledger.length,1);assert.ok(bytes<20000);
  const payload=async()=>(await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
  const saved=await payload();assert.equal(saved.rounds[0].matches[0].details.large.length,100000);assert.deepEqual(saved.rounds[0].slips.find(x=>x.uid==='u2'),other);assert.equal(saved.football.extra,'retained');
  const replay=await saveBarSlip(token,input,{connect});assert.equal(replay.replayed,true);assert.equal(replay.receipt.member.credits,490);assert.equal(replay.receipt.ledger.length,0);assert.deepEqual(await payload(),saved);
  await assert.rejects(saveBarSlip(token,{...input,picks:{m:'2'}},{connect}),/Identificativo/);
  await assert.rejects(saveBarSlip(token,{...input,picks:{m:'2'},requestId:'request_second_0001'},{connect}),/altro dispositivo/);
  await assert.rejects(saveBarSlip('foreign',input,{connect}),/Accedi/);assert.deepEqual(await payload(),saved);
 }finally{await f.close();}
});
test('Fanta session save bypasses full league/catalog reads and authenticates verified membership',async()=>{
 const f=await fixtureDb();try{
  const store=sqlFantaStore(f);store.leagues=async()=>{throw Error('Unnecessary league list');};store.identity=async()=>{throw Error('Unnecessary separate identity read');};
  const api=createFantaApi({store}),input={league:'fanta-lucas-a',round:1,...f.lineup('t1')};
  const post=(token,data=input)=>api(new Request('https://example.test/fanta-api/lineup',{method:'POST',headers:{cookie:'sid='+token,'content-type':'application/json'},body:JSON.stringify(data)}));
  const one=await post('token1');assert.equal(one.status,200,await one.clone().text());assert.equal((await post('token1')).status,200);
  assert.equal((await post('token2')).status,400);assert.equal((await post('bad')).status,403);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.lineups')).rows[0].n,1);
 }finally{await f.close();}
});
test('native Fanta slip keeps per-league wallets isolated and migrates only the saving member',async()=>{
 const f=await fixtureDb();try{
  await f.db.query('ALTER TABLE fanta.leagues ADD COLUMN IF NOT EXISTS slips_enabled boolean NOT NULL DEFAULT true');
  const s=emptyState(),u={id:'u1',username:'frankwood',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Bar Fanta'),token=session(s,u.id),m=l.members[0];m.fantasyWallet={initial:500,credits:550};l.members.push({uid:'u2',credits:500,initial:500,points:0});
  const round=(id,key,native)=>({id,league:l.id,source:'fantacalcio',competitionKey:key,nativeFanta:{leagueId:native,competitionId:key},virtualBookmaker:true,number:11,title:'Giornata 11',kickoff:'2099-01-01T15:00Z',rules:l.rules,matches:[{id:'m'+id,status:'NS',odds:{1:2,X:3,2:4}}],slips:[]});
  const current=round('current','camp','fanta-lucas-a'),other=round('old','elsewhere','other-league');other.slips=[{uid:'u1',stake:50,creditsSettled:true,prize:100}];s.rounds.push(current,other);
  await f.db.query('INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES($1,$2,$3,$4)',[l.id,'fanta-lucas-a','fanta-lucas-a:main','camp']);
  await f.db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[JSON.stringify(s)]);
  const result=await saveBarSlip(token,{league:l.id,round:current.id,picks:{mcurrent:'1'},stake:10,baseSavedAt:null},{connect:f.connect});
  const saved=(await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload,member=saved.leagues[0].members[0];
  assert.equal(member.credits,500);assert.equal(member.fantasyWallets['fanta-lucas-a'].credits,490);assert.equal(member.fantasyWallets['other-league'].credits,550);assert.equal(member.fantasyWalletMigration.version,2);
  assert.deepEqual(saved.leagues[0].members[1],l.members[1]);assert.deepEqual(saved.rounds[1],other);assert.equal(result.receipt.fantasyRanking.groups.length,2);
 }finally{await f.close();}
});

test('one-credit save immediately acknowledges the reward and objective, including a retry without another DB write',async()=>{
 const f=await fixtureDb();try{
  const s=emptyState(),u={id:'u1',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Premio test'),token=session(s,u.id),r={id:'one-credit',league:l.id,source:'seriea',number:11,title:'Giornata 11',kickoff:'2099-01-01T15:00Z',rules:l.rules,slips:[],matches:[{id:'m',odds:{1:2,X:3,2:4}}]};s.rounds.push(r);
  await f.db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[JSON.stringify(s)]);
  const input={league:l.id,round:r.id,picks:{m:'1'},stake:1,baseSavedAt:null},first=await saveBarSlip(token,input,{connect:f.connect}),before=(await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
  assert.ok(before.playerRewards.u1.some(a=>a.achievement==='minimum'&&a.ids.includes('starter-coin')));
  const client={user:{id:'u1',rewards:[]},leagues:[{id:l.id,members:[{uid:'u1',credits:500}],rounds:[structuredClone(r)],progression:{objectives:[{round:'other',goals:[]}]}}]};
  const retry=await saveBarSlip(token,input,{connect:f.connect});assert.ok(retry.replayed);assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload,before);
  for(const result of [first,retry,retry])assert.ok(applySlipReceipt(client,result));
  assert.equal(client.user.rewards.filter(a=>a.achievement==='minimum').length,1);assert.equal(client.leagues[0].progression.objectives.find(g=>g.round===r.id).goals.find(g=>g.id==='minimum').earned,true);assert.equal(client.leagues[0].progression.objectives.length,2);
 }finally{await f.close();}
});

test('each changed Serie A draft atomically persists its own risk and joke; retry does not debit or rewrite them',async()=>{
 const f=await fixtureDb();try{const s=emptyState(),u={id:'u1',name:'Il Mister',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Rischio test'),token=session(s,u.id),r={id:'portrait-round',league:l.id,source:'seriea',number:12,title:'Giornata 12',kickoff:'2099-01-01T15:00Z',rules:l.rules,slips:[],matches:[{id:'m',home:'Milan',away:'Inter',odds:{1:2,X:3,2:5}}]};s.rounds.push(r);await f.db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[JSON.stringify(s)]);
 const input={league:l.id,round:r.id,picks:{m:'1'},stake:1,baseSavedAt:null},first=await saveBarSlip(token,input,{connect:f.connect});assert.ok(first.receipt.slip.portrait.headline);const second=await saveBarSlip(token,{...input,stake:20,baseSavedAt:first.receipt.slip.savedAt},{connect:f.connect});assert.ok(second.receipt.slip.portrait.risk>first.receipt.slip.portrait.risk);assert.notEqual(second.receipt.slip.portrait.short,first.receipt.slip.portrait.short);
 const changed={...input,picks:{m:'2'},stake:20,baseSavedAt:second.receipt.slip.savedAt},third=await saveBarSlip(token,changed,{connect:f.connect});assert.ok(third.receipt.slip.portrait.risk>second.receipt.slip.portrait.risk);const saved=(await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;assert.deepEqual(saved.rounds[0].slips[0].portrait,third.receipt.slip.portrait);await saveBarSlip(token,changed,{connect:f.connect});assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload,saved);assert.equal(saved.leagues[0].members[0].credits,480);
 }finally{await f.close();}
});
