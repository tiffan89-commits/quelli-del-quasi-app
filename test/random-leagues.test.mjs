import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';
import {queueRandom,runRandomCreation,claimRandom,setSlips} from '../fanta/random-leagues.mjs';
import {balancedRandomRosters} from '../fanta/auto-coach.mjs';
const migration=()=>fs.readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8');
test('random: creation snapshot, idempotency, real rosters, concurrent claims and admin switch',async()=>{
 const f=await fixtureDb();try{
 await f.db.exec(await migration());
 await f.db.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',$1)`,[JSON.stringify([{id:'bar-test',name:'Bar test',admin:'u1',members:[{uid:'u1'},{uid:'u2'}],rules:{initial:500,maxStake:20}}])]);
 for(const [j,role]of ['P','D','C','A'].entries())for(let i=0;i<30;i++)await f.db.query('INSERT INTO fanta.players(id,api_id,club_id,name,role,data) VALUES($1,$2,$3,$1,$4,$5)',['extra'+j+'-'+i,10000+j*100+i,'c1',role,JSON.stringify({value:Math.max(1,30-i),active:true})]);
 for(let i=0;i<10;i++)await f.db.query('INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,home_id,away_id) VALUES($1,$2,2026,2,$3,$4,$5)',['fixture-'+i,20000+i,'2099-01-02T15:00:00Z','c1','c2']);
 await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key,active) VALUES('bar-test','fanta-lucas-a','fanta-lucas-a:main','retired-import',false)");
 const user={id:'u1',username:'frankwood'},other={id:'u2',username:'amico'};
 await assert.rejects(()=>queueRandom(other,{barId:'bar-test'},{connect:f.connect}),/presidente/);
 const j=await queueRandom(user,{barId:'bar-test',size:12},{connect:f.connect});assert.equal(j.size,2);
 const again=await queueRandom(user,{barId:'bar-test'},{connect:f.connect});assert.equal(j.id,again.id);
 const created=await runRandomCreation(j.id,{connect:f.connect,now:Date.parse('2026-11-02'),env:{FANTA_SEASON:'2026'}});
 const league=created.league;assert.ok(league.startsWith('random:'));
 const link=(await f.db.query("SELECT fanta_league_id,active FROM fanta.bar_links WHERE bar_league_id='bar-test'")).rows[0];assert.equal(link.fanta_league_id,league);assert.equal(link.active,true);
 assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.rosters WHERE league_id=$1',[league])).rows[0].n,50);
 assert.equal((await f.db.query('SELECT kind FROM fanta.leagues WHERE id=$1',[league])).rows[0].kind,'random');
 await assert.rejects(()=>claimRandom({id:'stranger'},league,{connect:f.connect}),/Bar/);
 const claims=await Promise.all([claimRandom(user,league,{connect:f.connect}),claimRandom(other,league,{connect:f.connect})]);assert.notEqual(claims[0].team.id,claims[1].team.id);
 assert.equal((await claimRandom(user,league,{connect:f.connect})).team.id,claims[0].team.id);
 await assert.rejects(()=>setSlips(other,league,false,{connect:f.connect}),/presidente/);
 await setSlips(user,league,false,{connect:f.connect});assert.equal((await f.db.query('SELECT slips_enabled FROM fanta.leagues WHERE id=$1',[league])).rows[0].slips_enabled,false);
 assert.equal((await runRandomCreation(j.id,{connect:f.connect})).reused,true);
 }finally{await f.close();}
});
test('balanced random distributes top role tiers without duplicate players at multiple sizes',()=>{
 const players=['P','D','C','A'].flatMap(role=>Array.from({length:120},(_,i)=>({id:role+i,role,value:Math.max(1,15-Math.floor(i/4))})));
 for(const teams of [2,3,8,10,12,15]){const rosters=balancedRandomRosters(players,{teams,seed:'test'});assert.equal(new Set(rosters.flat().map(p=>p.id)).size,teams*25);for(const r of rosters){assert.equal(r.length,25);assert.ok(r.reduce((n,p)=>n+p.price,0)<=500);}const values=rosters.map(r=>r.reduce((n,p)=>n+p.value,0));assert.ok(Math.max(...values)-Math.min(...values)<=20);}
});
test('imported leagues are accessible only to frankwood; native team owners are not beta-gated',async()=>{
 const {createFantaApi}=await import('../fanta/api.mjs'),{sqlFantaStore}=await import('../fanta/store.mjs');
 const f=await fixtureDb();try{await f.db.exec(await migration());await f.db.query("UPDATE fanta.leagues SET source_key='external:test' WHERE id='fanta-lucas-a'");const api=createFantaApi({store:sqlFantaStore({connect:f.connect}),env:{}});
 const request=token=>api(new Request('https://example.test/fanta-api/leagues',{headers:{cookie:'sid='+token}}));
 assert.equal((await (await request('token1')).json()).length,1);assert.equal((await (await request('token2')).json()).length,0);
 await f.db.query("UPDATE fanta.leagues SET source_key=NULL,kind='random' WHERE id='fanta-lucas-a'");assert.equal((await (await request('token2')).json()).length,1);
 }finally{await f.close();}
});
test('Bar visibility excludes imported rounds and disabled or non-coached Fanta',async()=>{
 const {visibleBarRounds}=await import('../lib/bar-fanta-access.mjs');const league={id:'bar',nativeFantaLink:{coachIds:['coach']}},state={rounds:[{id:'seriea',league:'bar',source:'seriea'},{id:'imported',league:'bar',source:'fantacalcio'},{id:'native',league:'bar',source:'fantacalcio',nativeFanta:{leagueId:'random'}}]};
 assert.deepEqual(visibleBarRounds(state,league,{id:'coach'}).map(x=>x.id),['seriea','native']);assert.deepEqual(visibleBarRounds(state,league,{id:'spectator'}).map(x=>x.id),['seriea']);assert.deepEqual(visibleBarRounds(state,{...league,fantaSlipsEnabled:false},{id:'coach'}).map(x=>x.id),['seriea']);
});
test('legacy Lucas B deletion removes its refunded slips and wallets while preserving Serie A and other leagues',async()=>{
 const f=await fixtureDb();try{
 const key='fc:2026:1366161:730462',member={uid:'u1',credits:123,points:7,competitionPoints:{[key]:0,other:3},fantasyWallets:{[key]:{credits:500},other:{credits:480}}};
 await f.db.query('UPDATE fanta_state SET payload=payload||$1::jsonb',[JSON.stringify({leagues:[{id:'bar',name:'Lucas Bar',admin:'u1',members:[member]}],rounds:[{id:'b',league:'bar',competitionKey:key,slips:[{uid:'u1',stake:20,prize:20,creditsSettled:true,settled:true}]},{id:'seriea',league:'bar',source:'seriea',slips:[]}],ledger:[{id:'lb',round:'b'},{id:'keep',round:'seriea'}]})]);
 await f.db.exec(await migration());const s=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;
 assert.deepEqual(s.rounds.map(r=>r.id),['seriea']);assert.deepEqual(s.ledger.map(r=>r.id),['keep']);assert.equal(s.leagues[0].members[0].credits,123);assert.deepEqual(s.leagues[0].members[0].fantasyWallets,{other:{credits:480}});
 }finally{await f.close();}
});
