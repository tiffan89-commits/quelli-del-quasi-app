import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import{fixtureDb,apiFixture}from'./fanta/helpers.mjs';import{importRosters,rosterMatch,seedStoredCatalog,linkStoredLineups}from'../docs/history/legacy-data-tools/rosters.mjs';import{syncStoredFootball,seedStoredFixtures}from'../fanta/stored-football.mjs';import{hashInput,normalizeFixture,calculateVote}from'../fanta/votes.mjs';import{sqlFantaStore}from'../fanta/store.mjs';import{teamView}from'../fanta/views.mjs';import{runFantaJob}from'../fanta/jobs.mjs';
test('archived lineups can use live player statistics before a purchase workbook is available',async()=>{
 const f=await fixtureDb();try{const source={players:[{id:'legacy',name:'Giocatore 1 0',role:'P',club:'Club 1'}]};await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,source_data) VALUES('fanta-lucas-a',1,'t1','4-4-2',$1,'[]',$2)",[JSON.stringify(['legacy']),JSON.stringify(source)]);
  assert.equal((await linkStoredLineups({connect:f.connect})).changed,1);assert.deepEqual((await f.db.query("SELECT starters FROM fanta.lineups WHERE team_id='t1'")).rows[0].starters,['p1-0']);assert.equal((await linkStoredLineups({connect:f.connect})).changed,0);
 }finally{await f.close();}
});
test('confirmed starters begin the live at six even before the provider increments their minutes',()=>{
 const raw=apiFixture({status:'1H',minutes:0}),p=normalizeFixture(raw).find(p=>p.apiId===1),v=calculateVote(p);assert.equal(p.onField,true);assert.equal(v.status,'playing');assert.equal(v.vote,6);
});
test('catalog and fixtures reuse stored provider data, including players absent from the photo roster',async()=>{
 const f=await fixtureDb();try{await f.db.exec('CREATE TABLE football_player_catalog(season text,team text,player_id text,metadata jsonb)');
  await f.db.query('INSERT INTO football_player_catalog VALUES($1,$2,$3,$4)',['2026','cluba','apifootball:99999',JSON.stringify({providerId:'99999',id:'apifootball:99999',position:'Attacker',team:'cluba',name:'Cached',placeholder:true})]);
  const raw=apiFixture(),payload=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;payload.football={calendar:{rounds:[{number:1,matches:[{apiFootballId:777,kickoff:raw.fixture.date,status:'FT',home:'Club A',away:'Club B',score:[1,0],details:{source:'API-FOOTBALL',matchInfo:{teams:raw.teams},players:raw.players}}]}]}};await f.db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(payload)]);
  const seeded=await seedStoredCatalog({connect:f.connect});assert.equal(seeded.players,23);assert.equal((await f.db.query("SELECT name FROM fanta.players WHERE id='af:3'")).rows[0].name,'Punta');assert.equal((await seedStoredCatalog({connect:f.connect})).cached,true);
  assert.equal((await seedStoredFixtures({connect:f.connect,env:{FANTA_SEASON:'2026'}})).fixtures,1);assert.equal((await f.db.query("SELECT round FROM fanta.fixtures WHERE id='af:777'")).rows[0].round,1);
  const opts={connect:f.connect,env:{FANTA_ENABLED:'true',FANTA_BETA_USERS:'frankwood'},provider:{get:async()=>{throw Error('No external source');},calls:0}};
  const job=await runFantaJob('live',opts);assert.equal(job.status,'complete');assert.equal(job.initialization.catalog.cached,true);assert.equal((await runFantaJob('live',opts)).initialization,undefined);
 }finally{await f.close();}
});
test('roster import preserves all real prices, unresolved identities and is idempotent without resetting lineups',async()=>{
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET source_key='lucas-bar:548867'");for(let i=3;i<=10;i++)await f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES($1,'fanta-lucas-a',$2,'')",['t'+i,'Squadra '+i]);
  const snapshot={origin:'leghe-import',players:[{id:'source-p',name:'Giocatore 1 0',role:'P',club:'Club 1',starter:true}]};await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,source_data) VALUES('fanta-lucas-a',1,'t1','4-4-2',$1,'[]',$2)",[JSON.stringify(['source-p']),JSON.stringify(snapshot)]);
  const roles=[...Array(3).fill('P'),...Array(8).fill('D'),...Array(8).fill('C'),...Array(6).fill('A')],teams=Array.from({length:10},(_,i)=>({name:'Squadra '+(i+1),total:25,players:roles.map((role,j)=>({name:i===0&&j===0?'Giocatore 1 0':'Fonte '+i+' '+j,role,price:1}))})),parsed={teams,digest:hashInput(teams)};
  const report=await importRosters(parsed,{connect:f.connect});assert.equal(report.players,250);assert.equal(report.linked,1);assert.equal(report.unmatched,249);
  const line=(await f.db.query("SELECT starters FROM fanta.lineups WHERE team_id='t1'")).rows[0];assert.deepEqual(line.starters,['p1-0']);
  await sqlFantaStore(f).league('u1','fanta-lucas-a',s=>{assert.equal(s.teams[0].roster.length,25);assert.equal(teamView(s,'u1').budget.spent,25);assert.equal(s.teams[0].roster.filter(p=>p.unmapped).length,24);});
  assert.equal((await importRosters(parsed,{connect:f.connect})).cached,true);assert.deepEqual((await f.db.query("SELECT starters FROM fanta.lineups WHERE team_id='t1'")).rows[0],line);
 }finally{await f.close();}
});
test('stored API-FOOTBALL statistics immediately yield votes; unchanged reads are skipped and changed metrics update votes',async()=>{
 const f=await fixtureDb();try{const raw=apiFixture(),payload=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;
  payload.football={calendar:{rounds:[{number:1,matches:[{score:[1,0],liveScore:null,details:{source:'API-FOOTBALL',matchInfo:{fixture:raw.fixture,league:raw.league,teams:raw.teams},players:raw.players,statistics:[],sourceEvents:raw.events,sourceLineups:raw.lineups}}]}]}};
  await f.db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(payload)]);const options={connect:f.connect,env:{FANTA_SEASON:'2026'},now:()=>Date.parse('2026-11-01T15:00Z')};
  const first=await syncStoredFootball(options);assert.equal(first.fixtures,1);assert.equal(first.players,22);assert.equal((await syncStoredFootball(options)).cached,1);
  assert.deepEqual((await f.db.query("SELECT data->'goals' AS score FROM fanta.fixtures WHERE id='af:777'")).rows[0].score,{home:1,away:0});
  const before=(await f.db.query("SELECT data FROM fanta.votes WHERE player_id='af:1' ORDER BY id DESC LIMIT 1")).rows[0].data;
  payload.football.calendar.rounds[0].matches[0].details.players[0].players[0].statistics[0].goals.saves=8;await f.db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(payload)]);await syncStoredFootball(options);
  const after=(await f.db.query("SELECT data FROM fanta.votes WHERE player_id='af:1' ORDER BY id DESC LIMIT 1")).rows[0].data;assert.ok(after.rawVote>before.rawVote);assert.ok(after.vote>=before.vote);assert.equal(after.status,'voted');
 }finally{await f.close();}
});
test('provider mapping requires unambiguous club identity',()=>{
 const players=[{id:'a',name:'C. Pulisic',club:'Milan',role:'A'},{id:'b',name:'C. Pulisic',club:'Roma',role:'C'}];assert.equal(rosterMatch({name:'Pulisic',club:'MIL',role:'C'},players),null);assert.equal(rosterMatch({name:'C. Pulisic',club:'MIL',role:'C'},players)?.id,'a');assert.equal(rosterMatch({name:'C. Pulisic',club:'MIL',role:'C'},[...players,players[0]]),null);
});
