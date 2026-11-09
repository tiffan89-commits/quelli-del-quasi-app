import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {createFantaApi} from '../fanta/api.mjs';
import {probabilityFor,readPlayProbabilities} from '../fanta/play-probabilities.mjs';
import {applySlipReceipt} from '../public/src/slip-receipt.mjs';
import {createApi} from '../netlify/functions/api.mjs';
import {emptyState} from '../lib/db.mjs';
import {newLeague,session} from '../lib/game.mjs';
import {homeView} from '../fanta/views.mjs';

test('targeted lineup save is atomic, idempotent, own-roster only and rejects deadlines; never loads vote history',async()=>{
 const f=await fixtureDb();try{
  const queries=[],connect=async()=>{const c=await f.connect();return {release:c.release,query:(sql,args)=>{queries.push(sql);return c.query(sql,args);}};};
  const store=sqlFantaStore({connect}),input={round:1,...f.lineup('t1')},before=(await f.db.query('SELECT payload FROM fanta_state')).rows;
  const one=await store.saveLineup('u1','fanta-lucas-a',input,{now:Date.parse('2026-11-03')});
  const firstRevision=(await f.db.query('SELECT xmin::text AS revision FROM fanta.lineups')).rows[0].revision;
  const two=await store.saveLineup('u1','fanta-lucas-a',input,{now:Date.parse('2026-11-04')});assert.deepEqual(two,one);
  assert.equal((await f.db.query('SELECT xmin::text AS revision FROM fanta.lineups')).rows[0].revision,firstRevision);
  assert.ok(queries.every(sql=>!sql.includes('fanta.votes')&&!sql.includes('fanta.fixtures')&&!sql.includes('SELECT p.*,c.name')));
  await assert.rejects(store.saveLineup('u2','fanta-lucas-a',input),/tua rosa/);
  await assert.rejects(store.saveLineup('stranger','fanta-lucas-a',input),/accessibile/);
  await assert.rejects(store.saveLineup('u1','fanta-lucas-a',input,{competition:'other'}),/accessibile/);
  assert.deepEqual(await store.saveLineup('u1','fanta-lucas-a',input,{now:Date.parse('2100-01-01')}),one,'a late retry acknowledges an already committed identical lineup');
  await assert.rejects(store.saveLineup('u1','fanta-lucas-a',{...input,bench:[...input.bench].reverse()},{now:Date.parse('2100-01-01')}),/scaduto/);
  assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state')).rows,before);
  assert.equal((await f.db.query('SELECT count(*)::int AS count FROM fanta.lineups')).rows[0].count,1);
 }finally{await f.close();}
});

test('explicit Bar probabilities project by stable ID or unambiguous club/name, ignore previous rounds and old consensus, never infer booleans',async()=>{
 const f=await fixtureDb();try{
  const p={id:'af:99',name:'Éderson',club:'Club 1'},lineups={kind:'official',teams:[{team:'Club 1',players:[{name:'Ederson',probability:100},{name:'Other',playerId:'af:100',probability:0},{name:'No percentage',starter:true}],bench:[]}]};
  await f.db.query(`UPDATE fanta_state SET payload=payload||$1::jsonb`,[JSON.stringify({football:{calendar:{season:2026,rounds:[{number:10,matches:[{id:'m10',lineups}]}]},rounds:{11:{matches:[]}}}})]);
  const data=await f.connect();let rounds;
  try{
   rounds=await readPlayProbabilities(data,11,2026);
   for(const file of ['017_live_storage_backfill.sql','020_live_storage_round_cache.sql']){
    await f.db.exec(await readFile(new URL('../netlify/database/migrations/'+file,import.meta.url),'utf8'));
   }
   await f.db.query(`UPDATE public.fanta_state SET payload=payload #- '{football,calendar,rounds}' #- '{football,rounds}'`);
   const previous=process.env.SELFHOST_BAR_STORAGE;process.env.SELFHOST_BAR_STORAGE='rows';
   try{
    assert.deepEqual(await readPlayProbabilities(data,11,2026),rounds);
    assert.deepEqual(await readPlayProbabilities(data,11,2025),[]);
   }finally{if(previous===undefined)delete process.env.SELFHOST_BAR_STORAGE;else process.env.SELFHOST_BAR_STORAGE=previous;}
  }finally{data.release();}
  assert.equal(probabilityFor(p,rounds,11),null);assert.deepEqual(probabilityFor(p,rounds,10),{pct:100,source:'official'});
  assert.deepEqual(probabilityFor({...p,id:'af:100',name:'Alias'},rounds,10),{pct:0,source:'official'});
  assert.equal(probabilityFor({...p,club:'Different club'},rounds,11),null);
  assert.equal(probabilityFor({...p,status:{type:'injured'}},rounds,11),null);
  assert.equal(probabilityFor({...p,name:'No percentage'},rounds,11),null);
  assert.equal(probabilityFor(p,[{number:11,players:[{name:'Ederson',club:p.club,pct:20},{name:'Ederson',club:p.club,pct:80}]}],11),null);
 }finally{await f.close();}
});

test('lite bootstrap returns just the initial screen, team DTO reuses DB probabilities, actual vote counts are server-side',async()=>{
 const f=await fixtureDb();try{
  const api=createFantaApi({store:sqlFantaStore(f),now:()=>Date.parse('2026-11-03')}),get=async path=>{const r=await api(new Request('https://example.test/fanta-api/'+path,{headers:{cookie:'sid=token1'}}));assert.equal(r.status,200,await r.clone().text());return r.json();};
  const b=await get('bootstrap?lite=1&league=fanta-lucas-a');assert.deepEqual(Object.keys(b).sort(),['choiceLeagueId','home','leagues','me','teamChoices']);assert.equal(b.team,undefined);assert.deepEqual(b.teamChoices,[]);assert.equal(b.choiceLeagueId,null);
  const full=await get('bootstrap?league=fanta-lucas-a');assert.ok(full.team&&full.league&&full.round);
  const t=await get('team?league=fanta-lucas-a');assert.equal(t.roster.length,15);assert.ok(t.roster.every(p=>p.play===null));
  await f.db.query(`UPDATE fanta.rounds SET deadline='2026-11-01'`);await sqlFantaStore(f).saveLineup('u1','fanta-lucas-a',{round:1,...f.lineup('t1')},{now:Date.parse('2026-10-31')});
  const h=await get('home?league=fanta-lucas-a');assert.equal(h.match.live.home.withVote,0);assert.equal(h.match.live.home.played,0);
  const actual=await sqlFantaStore(f).league('u1','fanta-lucas-a',s=>{s.votes=f.lineup('t1').starters.slice(0,3).map(id=>({player_id:id,data:{vote:6,fantavote:6,status:'voted'}}));return homeView(s,'u1',Date.parse('2026-11-03'));});assert.equal(actual.match.live.home.withVote,3);assert.equal(actual.match.live.home.points,18);
 }finally{await f.close();}
});

test('compact slip receipt updates only its authenticated wallet and round, rejects cross-user and older acknowledgements',()=>{
 const state={user:{id:'u'},leagues:[{id:'l',members:[{uid:'u',credits:500},{uid:'other',credits:500}],rounds:[{id:'r'},{id:'other'}]}]},receipt={uid:'u',league:'l',round:'r',member:{credits:490},slip:{uid:'u',savedAt:'2026-11-03T12:00:00Z',picks:{m:'1'},stake:10},ledger:[]};
 assert.equal(applySlipReceipt(state,{receipt}),true);assert.equal(state.leagues[0].members[0].credits,490);assert.equal(state.leagues[0].members[1].credits,500);assert.equal(state.leagues[0].rounds[1].slip,undefined);
 assert.equal(applySlipReceipt(state,{receipt:{...receipt,uid:'other'}}),false);
 assert.equal(applySlipReceipt(state,{receipt:{...receipt,slip:{...receipt.slip,savedAt:'2026-11-02'}}}),false);
});

test('Bar save returns confirmed slip, balances, rewards and own ledger in one response; stale writes keep conflict protection',async()=>{
 const s=emptyState(),u={id:'u',username:'synthetic',name:'Sintetico',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Ricevuta sintetica'),token=session(s,u.id);
 const round={id:'receipt-round',league:l.id,source:'seriea',kickoff:'2099-01-01T15:00Z',rules:l.rules,slips:[],matches:[{id:'m',odds:{1:2,X:3,2:4}}]};s.rounds.push(round);
 let reads=0;const api=createApi({transact:async fn=>fn(s,{query:async()=>({rows:[{attempts:1}]})}),read:async()=>{reads++;throw Error('Extra read');},env:{}});
 const save=baseSavedAt=>api(new Request('https://example.test/api/slip',{method:'POST',headers:{cookie:'sid='+token,'content-type':'application/json'},body:JSON.stringify({league:l.id,round:round.id,stake:10,picks:{m:'1'},baseSavedAt})}));
 const response=await save(null);assert.equal(response.status,200,await response.clone().text());const result=await response.json();assert.equal(result.receipt.slip.picks.m,'1');assert.equal(result.receipt.member.credits,490);assert.equal(result.receipt.member.committedCredits,10);assert.equal(result.receipt.ledger.length,1);assert.ok(Array.isArray(result.receipt.user.rewards));assert.equal(reads,0);
 assert.equal((await save(null)).status,409);assert.equal(l.members[0].credits,490);assert.equal(s.ledger.length,1);
});
