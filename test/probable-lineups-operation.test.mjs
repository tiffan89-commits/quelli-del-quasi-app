import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {runProbableLineups} from '../lib/operations/probable-lineups.mjs';
import {collectAvailability,refreshPlayerAvailability} from '../fanta/player-availability.mjs';
import {lineupAvailability,probabilityFor} from '../fanta/play-probabilities.mjs';
import {probableLineupsDue} from '../lib/lineups.mjs';

const now=Date.parse('2026-11-11T08:00:00Z'),kickoff='2026-11-21T14:00:00.000Z';
const lineupRow=(side)=>`<tr data-panel-${side}="true">${Array.from({length:11},(_,i)=>
 `<span class="ftbl__match-formation-player--jerseyNum">${i+1}</span><a class="ftbl__match-formation-player--name" href="/">Giocatore ${i+1}</a>`).join('')}</tr>`;
const skyPage=`<title>Probabili formazioni</title><span class="ftbl__team__name">Como</span><span class="ftbl__team__name">Cagliari</span>
 <span class="ftbl__team-formation-number">4-4-2</span><span class="ftbl__team-formation-number">4-4-2</span>
 <h2>Titolari</h2>${lineupRow('left')}${lineupRow('right')}`;

test('recent injuries bridge an empty match feed, but suspensions and recovered players do not carry',()=>{
 const prior={id:'af:10',api_id:10,home_id:'af:1',away_id:'af:2'};
 const next={...prior,id:'af:20',api_id:20};
 const players=[1,2,3].map(id=>({id:'af:'+id,api_id:id,club_id:'af:1'}));
 const row=(id,reason)=>({fixture:{id:10},team:{id:1},player:{id,type:'Missing Fixture',reason}});
 const injuries=[row(1,'Hamstring Injury'),row(2,'Yellow Cards'),row(3,'Personal Reasons')];
 const check=(forecasts=[],reports=injuries)=>collectAvailability([next],players,reports,forecasts,{recentFixtures:[prior]});
 const first=check();
 assert.deepEqual(first.map(p=>p.status.type),['injured','ok','ok']);
 assert.equal(first[0].status.fixtureId,next.id);
 assert.equal(first[0].status.sourceFixtureId,prior.id);
 const official={apiFootballId:20,lineups:{kind:'official',teams:[{players:[],bench:[{apiId:1}]}]}};
 assert.equal(check([official])[0].status.type,'ok');
 assert.equal(check([],[...injuries,{fixture:{id:20},team:{id:1},player:{id:1,type:'Questionable',reason:'Knock'}}])[0].status.type,'doubtful');
});

test('scheduled slots tolerate dispatcher jitter without repeating a check in the same slot',()=>{
 const slot=Date.parse(kickoff)-3600000;
 const m={kickoff,lineupCheckedAt:new Date(slot-3560000).toISOString()};
 assert.equal(probableLineupsDue(m,new Date(slot),{scheduledAt:slot}),true);
 m.lineupCheckedAt=new Date(slot+60000).toISOString();
 assert.equal(probableLineupsDue(m,new Date(slot+120000),{scheduledAt:slot}),false);
});

test('availability refresh reconciles fixture-specific feed rows and editorial absences, and clears recovered players',async()=>{
 const db=new PGlite();
 const connect=async()=>({query:(sql,args)=>db.query(sql,args),release(){}});
 try{
  await db.exec(`CREATE SCHEMA fanta;
   CREATE TABLE fanta.fixtures(id text,api_id int,season int,kickoff timestamptz,home_id text,away_id text);
   CREATE TABLE fanta.clubs(id text,name text);
   CREATE TABLE fanta.players(id text,api_id int,club_id text,name text,data jsonb);
   CREATE TABLE fanta.jobs(id text primary key,data jsonb);
   INSERT INTO fanta.fixtures VALUES ('af:321',321,2026,'2026-11-21T14:00:00Z','af:11','af:22');
   INSERT INTO fanta.clubs VALUES ('af:11','Como'),('af:22','Cagliari');
   INSERT INTO fanta.players VALUES
    ('af:1',1,'af:11','Test Player','{"price":42}'),
    ('af:2',2,'af:22','Other Player','{}'),
    ('af:3',3,'af:11','Doubtful Player','{}');`);
  const provider={get:async path=>{
   assert.equal(path,'injuries?fixture=321');
   return {response:[
    {player:{id:1,type:'Questionable',reason:'Thigh Injury'},fixture:{id:321}},
    {player:{id:3,type:'Questionable',reason:'Knock'},fixture:{id:321}},
    {player:{id:2,type:'Missing Fixture',reason:'Yellow Cards'},team:{id:22},fixture:{id:321}},
    {player:{id:3,type:'Missing Fixture',reason:'Injury'},fixture:{id:322}},
   ]};
  }};
  const match={apiFootballId:321,kickoff,status:'NS',lineups:{kind:'probable',teams:[
   {team:'Como',unavailable:[{name:'T. Player',status:'Infortunato',note:'Problema muscolare'}]},
  ]}};
  const read=async()=>(await db.query('SELECT data FROM fanta.players ORDER BY api_id')).rows.map(p=>p.data);
  assert.deepEqual(await refreshPlayerAvailability([match],{connect,provider,now,season:2026}),{fixtures:1,players:3,changed:3,providerCalls:1});
  let rows=await read();
  assert.deepEqual(rows.map(p=>p.status.type),['injured','suspended','doubtful']);
  assert.equal(rows[0].price,42);
  const fixtures=[{id:'af:321',round:12,home_id:'af:11',away_id:'af:22'},{id:'af:322',round:13,home_id:'af:11',away_id:'af:22'}];
  const player={id:'af:1',clubId:'af:11',status:rows[0].status},official=[{number:12,players:[{id:'af:1',kind:'official',pct:100}]}];
  assert.deepEqual(probabilityFor({...player,...lineupAvailability(player,fixtures,12)},official,12),{pct:0,source:'unavailable'});
  assert.equal(lineupAvailability(player,fixtures,13).status.type,'ok');
  assert.equal((await refreshPlayerAvailability([match],{connect,provider,now:now+3600000,season:2026})).changed,0);
  await assert.rejects(refreshPlayerAvailability([match],{connect,provider:{get:async()=>({response:[],paging:{total:2}})},now:now+7200000,season:2026}),/incompleti/);
  assert.deepEqual(await read(),rows);
  await refreshPlayerAvailability([{...match,lineups:null}],{connect,provider:{get:async()=>({response:[]})},now:now+7200000,season:2026});
  rows=await read();
  assert.deepEqual(rows.map(p=>p.status.type),['ok','ok','ok']);
  const recent='2026-11-09T14:00:00.000Z';
  await db.query("INSERT INTO fanta.fixtures VALUES ('af:320',320,2026,$1,'af:11','af:23')",[recent]);
  await refreshPlayerAvailability([{...match,lineups:null}],{connect,season:2026,now:now+10800000,
   recentFixtures:[{apiId:320,kickoff:recent,status:'FT'}],provider:{get:async path=>{
    assert.equal(path,'injuries?ids=321-320');
    return {response:[{player:{id:1,type:'Missing Fixture',reason:'Hamstring Injury'},team:{id:11},fixture:{id:320}}]};
   }}});
  assert.equal((await read())[0].status.sourceFixtureId,'af:320');
 }finally{await db.close();}
});

test('forecast batch saves both XIs and keeps lost races and betting state intact',async()=>{
 const db=new PGlite();
 const connect=async()=>({query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args),release(){}});
 const match={id:'fixture',home:'Como',away:'Cagliari',kickoff,status:'NS',odds:{1:2.15,X:3.2,2:4.1}};
 const league={id:'l',members:[{uid:'coach',credits:50}]};
 const slip={uid:'coach',stake:5,picks:{fixture:'1'}};
 const round={id:'round',league:'l',deadline:kickoff,matches:[match],slips:[slip]};
 const snapshot={football:{calendar:{season:2026,rounds:[{number:12,matches:[match]}]}},rounds:[round],leagues:[league],ledger:[]};
 const state=async()=>(await db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
 const fetcher=async url=>new URL(url).hostname==='sport.sky.it'?new Response(skyPage):new Response(null,{status:404});
 const options={connect,now:()=>now,sportsStorage:'snapshot',fetcher};
 try{
  await db.exec('CREATE TABLE fanta_state(id int,payload jsonb)');
  await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(snapshot)]);
  const result=await runProbableLineups({fixtureIds:[match.id]},options);
  assert.deepEqual(result.metrics,{scope:'editorial-lineups-only',attempted:1,available:1,saved:1,missing:0});
  let saved=await state(),lineups=saved.football.calendar.rounds[0].matches[0].lineups;
  assert.equal(lineups.kind,'probable');
  assert.deepEqual(lineups.teams.map(t=>t.players.length),[11,11]);
  assert.deepEqual(saved.rounds[0].matches[0].lineups,lineups);
  assert.deepEqual(saved.rounds[0].slips,[slip]);
  assert.deepEqual(saved.rounds[0].matches[0].odds,match.odds);
  assert.deepEqual(saved.leagues,[league]);
  assert.deepEqual(saved.ledger,[]);
  assert.equal((await runProbableLineups({fixtureIds:[match.id]},options)).metrics.attempted,0);
  const official={kind:'official',updatedAt:new Date(now+90*60000).toISOString(),teams:lineups.teams};
  const racingFetch=async url=>{
   if(new URL(url).hostname==='sport.sky.it')await db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{football,calendar,rounds,0,matches,0,lineups}',$1)",[JSON.stringify(official)]);
   return fetcher(url);
  };
  const race=await runProbableLineups({fixtureIds:[match.id]},{...options,now:()=>now+90*60000,fetcher:racingFetch});
  assert.equal(race.metrics.saved,0);
  saved=await state();
  assert.deepEqual(saved.football.calendar.rounds[0].matches[0].lineups,official);
 }finally{await db.close();}
});
