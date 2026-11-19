import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {membershipTransaction,authTransaction,LOGIN_GAME_SNAPSHOT_SQL,GAME_SNAPSHOT_SQL,emptyState} from '../lib/db.mjs';
import {createApi} from '../netlify/functions/api.mjs';import {sha} from '../lib/game.mjs';
import {currentRound} from '../fanta/views.mjs';
import {renderHome} from '../public/src/fanta/home.mjs';
import {readBarRows} from '../lib/operations/bar-rows.mjs';

for(const sportsStorage of ['snapshot','rows'])test(`create/join preserve archives and attach only future lightweight rounds once (${sportsStorage})`,async()=>{
 const db=new PGlite();try{
  await db.exec(await fs.readFile(new URL('../netlify/database/migrations/001_initial.sql',import.meta.url),'utf8'));
  for(const file of ['003_native_fanta','004_imported_lineups','005_roster_entries','006_team_identity','007_competitions','008_account_cleanup','009_statistical_votes','010_identity_cache','011_native_pilot_market','012_random_leagues','016_league_creation_mode'])await db.exec(await fs.readFile(new URL('../netlify/database/migrations/'+file+'.sql',import.meta.url),'utf8'));
  const state=emptyState();state.users=[{id:'one',username:'one',name:'One',emailVerified:true},{id:'two',username:'two',name:'Two',emailVerified:true}];state.sessions=state.users.map(u=>({uid:u.id,token:sha(u.id),expires:Date.now()+3600000}));
  const source={id:'next',number:11,title:'Giornata 11',kickoff:'2099-01-01T12:00:00Z',bookable:true,ready:true,matches:[{id:'m',home:'A',away:'B',kickoff:'2099-01-01T12:00:00Z',details:{heavy:'x'.repeat(100000)},lineups:{heavy:'do not transfer'},odds:{1:2}}]};
  state.football={rounds:{next:source,past:{...source,id:'past',kickoff:'2000-01-01T12:00:00Z'}},heavy:'retained'};state.rounds=[{id:'archive',league:'other',slips:[{uid:'other',stake:99}]}];state.playerRewards={keep:['retained']};await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(state)]);
  if(sportsStorage==='rows')for(const file of ['017_live_storage_backfill','018_live_storage_accounts','019_live_storage_read_views','020_live_storage_round_cache','021_live_storage_league_order'])await db.exec(await fs.readFile(new URL('../netlify/database/migrations/'+file+'.sql',import.meta.url),'utf8'));
  const raw=async()=>(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;
  const read=async(id)=>{
   const current=await raw();
   if(sportsStorage==='snapshot')return current;
   const {leagues,rounds}=await readBarRows(db,{leagueIds:['other',...(id?[id]:[])]});
   return {...current,leagues,rounds};
  };
  const connect=async()=>({query:(...args)=>db.query(...args),release(){}});let full=0,membership=0;
  const api=createApi({transact:async()=>{full++;throw Error('heavy game path forbidden');},authTransact:fn=>authTransaction(fn,{connect}),membershipTransact:fn=>membershipTransaction((s,c)=>{membership++;assert.equal(s.playerRewards,undefined);assert.equal(s.football.rounds.next.matches[0].details,undefined);assert.equal(s.football.rounds.past,undefined);assert.deepEqual(s.rounds,[]);return fn(s,c);},{connect,sportsStorage})});
  const call=(route,p,uid='one')=>api(new Request('https://example.test/api/'+route,{method:'POST',headers:{cookie:'sid='+uid},body:JSON.stringify(p)}));
  const created=await call('create',{name:'Il bar nuovo'});assert.equal(created.status,200,await created.clone().text());const id=(await created.json()).league;
  assert.equal((await(await call('create',{name:'Il bar nuovo'})).json()).reused,true);
  let saved=await read(id),code=saved.leagues.find(l=>l.id===id).code;
  assert.equal((await call('join',{code},'two')).status,200);assert.equal((await call('join',{code},'two')).status,200);
  saved=await read(id);assert.equal(saved.leagues.length,1);assert.equal(saved.leagues[0].members.length,2);assert.equal(saved.rounds.length,2);assert.deepEqual(saved.rounds[0],state.rounds[0]);assert.deepEqual(saved.football,state.football);assert.deepEqual(saved.playerRewards,state.playerRewards);assert.equal(full,0);assert.equal(membership,4);
  const before=JSON.stringify(saved);assert.equal((await call('join',{code:'INVALID'},'two')).status,400);assert.equal(JSON.stringify(await read(id)),before);assert.equal(full,0);
  if(sportsStorage==='rows'){const current=await raw();assert.deepEqual(current.leagues,[]);assert.deepEqual(current.rounds,state.rounds);}
 }finally{await db.close();}
});

test('login loads onboarding data and then only the leagues, rewards and chat counters visible to the actor',async()=>{
 const db=new PGlite();try{await db.exec('CREATE TABLE fanta_state(id int,payload jsonb)');const base={...emptyState(),users:[{id:'new',username:'new',emailVerified:true}],sessions:[{uid:'new',token:'hash',expires:Date.now()+3600000}],football:{calendar:{huge:'x'.repeat(100000)}},playerRewards:{new:['owned'],other:['private']}};await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(base)]);
  const s=(await db.query(LOGIN_GAME_SNAPSHOT_SQL,['hash'])).rows[0].payload;assert.deepEqual(s.football,{});assert.deepEqual(s.rounds,[]);assert.equal(s.users[0].id,'new');assert.deepEqual(s.playerRewards,{new:['owned']});assert.ok(JSON.stringify(s).length<2000);
  const anonymous=(await db.query(LOGIN_GAME_SNAPSHOT_SQL,['invalid'])).rows[0].payload;assert.deepEqual(anonymous.users,[]);assert.deepEqual(anonymous.sessions,[]);
  base.leagues=[{id:'existing',members:[{uid:'new'}]},{id:'private',members:[{uid:'other'}]}];
  base.leagueChats={existing:{sequence:4,revision:5,messages:[
   {uid:'other',seq:1,text:'read'},{uid:'other',seq:2,text:'unread'},
   {uid:'new',seq:3,text:'own'},{uid:'other',seq:4,deleted:true},
  ]},private:{messages:[{seq:1,text:'private'}]}};
  base.chatReaders={'existing:new':{read:1,notify:true},'private:other':{read:1}};
  await db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(base)]);
  const scoped=(await db.query(LOGIN_GAME_SNAPSHOT_SQL,['hash'])).rows[0].payload;
  const original=(await db.query(GAME_SNAPSHOT_SQL)).rows[0].payload;
  assert.deepEqual(scoped.football,original.football);
  assert.deepEqual(scoped.leagues,[base.leagues[0]]);
  assert.deepEqual(scoped.playerRewards,{new:['owned']});
  assert.deepEqual(scoped.leagueChats,{existing:{sequence:4,revision:5,unread:1}});
  assert.deepEqual(scoped.chatReaders,{'existing:new':{read:1,notify:true}});
 }finally{await db.close();}
});

test('current live day wins over an old unverified day; homepage links carry its explicit number',()=>{
 const now=Date.parse('2026-11-01T18:00Z'),rounds=[{number:1,seriea_round:3,deadline:'2026-09-01T12:00Z',official:false},{number:8,seriea_round:10,deadline:'2026-10-31T12:00Z',official:false},{number:9,seriea_round:11,deadline:'2026-11-07T12:00Z',official:false}],s={rounds,fixtures:[{round:10,status:'2H'}]};
 assert.equal(currentRound(s,now).number,8);s.fixtures[0].status='FT';assert.equal(currentRound(s,now).number,8);rounds[1].official=true;assert.equal(currentRound(s,now).number,9);assert.equal(rounds[0].official,false);
 const home={league:{name:'Lega',season:'2026/27'},me:{teamName:'Quasi',manager:'Mister',position:1,points:0,fantapoints:0,form:[]},round:{number:8,state:'in-corso',matchesDone:5,matchesTotal:10},lineup:{},standings:[],auction:{status:'ended'}};
 assert.match(renderHome(home,now),/data-go="giornata" data-round="8"[^>]*><span>Giornata 8 live/);
});

test('failed initial state reads return promptly without starting a full game write just to record the error',async()=>{
 let writes=0;const api=createApi({transact:async()=>{writes++;throw Error('no heavy fallback');},read:async()=>{throw Object.assign(Error('Temporaneamente occupato'),{status:503});}});
 const response=await api(new Request('https://example.test/api/state?lite=1',{headers:{cookie:'sid=synthetic'}}));assert.equal(response.status,503);assert.equal(writes,0);
});
