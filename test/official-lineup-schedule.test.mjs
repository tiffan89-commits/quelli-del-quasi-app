import test from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {newPlan,claimWork,completeWork,refreshPlan} from '../lib/operations/calendar.mjs';
import {runOfficialLineups} from '../lib/operations/official-lineups.mjs';
import {parseSkyLineups} from '../lib/lineups.mjs';
const kickoff=Date.parse('2026-11-10T19:45Z'),minute=60000;
const calendar=[{number:12,matches:[{id:'m',apiFootballId:123,home:'Venezia',away:'Udinese',kickoff:new Date(kickoff).toISOString(),status:'NS'}]}];
test('official XI starts at T-60, retries on minute boundaries and stops after the primary feed saves',()=>{
 let p=newPlan(calendar,{now:kickoff-90*minute});
 p.jobs.find(j=>j.kind==='official-lineups').at=new Date(kickoff-30*minute).toISOString();
 assert.equal(claimWork(p,{now:kickoff-61*minute}).jobs.some(j=>j.kind==='official-lineups'),false);
 let claim=claimWork(p,{now:kickoff-60*minute,nonce:'a'}),job=claim.jobs.find(j=>j.kind==='official-lineups');assert.equal(Date.parse(job.at),kickoff-60*minute);
 assert.equal(claimWork(claim.plan,{now:kickoff-60*minute,nonce:'duplicate'}).jobs.length,0);
 p=completeWork(claim.plan,job,{ok:false,pendingFixtureIds:['m']},{now:kickoff-60*minute+2417});const retry=p.jobs.find(j=>j.retryOf===job.id);assert.equal(Date.parse(retry.at),kickoff-58*minute);
 claim=claimWork(p,{now:kickoff-58*minute,nonce:'b'});p=completeWork(claim.plan,claim.jobs.find(j=>j.id===retry.id),{ok:true,fixtures:[{id:'m',officialLineups:true}]},{now:kickoff-58*minute});
 assert.equal(p.fixtures[0].officialLineups,true);assert.equal(refreshPlan(p,[],{now:kickoff-20*minute}).jobs.filter(j=>j.kind==='official-lineups'&&j.status==='queued').length,0);
});
test('a late install catches up once, transport errors retry, postponed games cancel queued XI requests',()=>{
 let p=newPlan(calendar,{now:kickoff-10*minute}),claim=claimWork(p,{now:kickoff-10*minute,nonce:'a'}),job=claim.jobs.find(j=>j.kind==='official-lineups');assert.ok(job);
 p=completeWork(claim.plan,job,{ok:false,error:'temporarily unavailable'},{now:kickoff-10*minute});assert.equal(p.jobs.filter(j=>j.kind==='official-lineups'&&j.status==='queued').length,1);
 p=refreshPlan(p,[{id:'m',status:'PST'}],{now:kickoff-8*minute});assert.equal(p.jobs.filter(j=>j.kind==='official-lineups'&&j.status==='queued').length,0);
});
test('after a missed window or expired lease, officials retry soon before kickoff and less often during the match',()=>{
 const p=newPlan(calendar,{now:kickoff-3600000});
 const missed=claimWork(p,{now:kickoff-9*minute,nonce:'missed'}).plan.jobs.find(j=>j.retryOf?.startsWith('official-lineups'));
 assert.equal(Date.parse(missed.at),kickoff-7*minute);
 const claimed=claimWork(p,{now:kickoff-60*minute,nonce:'stalled'}).plan;
 const expired=claimWork(claimed,{now:kickoff-51*minute,nonce:'recovered'}).plan.jobs.find(j=>j.retryOf?.startsWith('official-lineups'));
 assert.equal(Date.parse(expired.at),kickoff-49*minute);
 const plan=newPlan(calendar,{now:kickoff}),claim=claimWork(plan,{now:kickoff,nonce:'late'}),job=claim.jobs.find(j=>j.kind==='official-lineups');
 const result=completeWork(claim.plan,job,{ok:false},{now:kickoff+1876});
 assert.equal(Date.parse(result.jobs.find(j=>j.retryOf===job.id).at),kickoff+5*minute);
});

function skyPage({title='Formazioni ufficiali',away='Udinese',starters=11,benchJersey=12}={}){
 const player=n=>`<div class="ftbl__match-formation-player"><span class="ftbl__match-formation-player--jerseyNum">${n}</span><a class="ftbl__match-formation-player--name">Editoriale ${n}</a></div>`;
 const section=(label,players)=>`<tr class="ftbl__report-tabs-panel__header"><td>${label}</td></tr><tr><td>${players}</td></tr>`;
 const team=name=>`<section class="ftbl__match-startup-formation"><header class="ftbl__team-header"><span class="ftbl__team__name">${name}</span></header><span class="ftbl__team-formation-number">4-4-2</span><table>${section('Titolari',Array.from({length:starters},(_,i)=>player(i+1)).join(''))}${section('Riserve',player(benchJersey))}</table></section>`;
 return `<title>${title}</title><div class="ftbl__match-startup-formations">${team('Venezia')}${team(away)}</div>`;
}

test('the editorial fallback requires an explicit confirmation, matching teams and two complete distinct squads',()=>{
 const match=calendar[0].matches[0];
 for(const bad of [{title:'Probabili formazioni'},{away:'Roma'},{starters:10},{benchJersey:2}])assert.notEqual(parseSkyLineups(skyPage(bad),match)?.kind,'official');
 const official=parseSkyLineups(skyPage(),match);
 assert.equal(official.kind,'official');
 assert.deepEqual(official.teams.map(t=>[t.team,t.formation,t.players.length,t.players[0].grid,t.bench[0].jersey]),[['Venezia','4-4-2',11,'1:1','12'],['Udinese','4-4-2',11,'1:1','12']]);
});

test('editorial officials are pushed while the API is unavailable, then the primary replaces them and updates the native fixture',async()=>{
 const db=new PGlite(),connect=async()=>({query:(q,p)=>q.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(q,p),release(){}});
 try{await db.exec('CREATE TABLE fanta_state(id int,payload jsonb);CREATE SCHEMA fanta;CREATE TABLE fanta.fixtures(api_id int,data jsonb,frozen_at timestamptz)');
  const match={...calendar[0].matches[0],lineups:{kind:'probable',teams:[]}},s={football:{calendar:{rounds:[{number:12,matches:[match]}]}},rounds:[],leagues:[],ledger:[],users:[]};await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(s)]);await db.query('INSERT INTO fanta.fixtures VALUES(123,$1)',[JSON.stringify({untouched:'keep'})]);
  const team=(id,name)=>({team:{id,name},formation:'4-4-2',startXI:Array.from({length:11},(_,i)=>({player:{id:id*100+i,name:'Giocatore '+i,number:i+1,pos:i?'D':'G',grid:'1:1'}})),substitutes:[]});let data=[team(1,'Venezia')],calls=0;
  const provider={quota:{calls:0},get:async path=>{assert.equal(path,'fixtures/lineups?fixture=123');calls++;if(data===null)throw Error('Temporary upstream failure');return {response:data};}},plan={fixtures:[{...match,round:12,apiId:123}]},job={fixtureIds:['m']};
  assert.equal((await runOfficialLineups(job,plan,{connect,provider})).ok,false);assert.deepEqual((await db.query('SELECT payload FROM fanta_state')).rows[0].payload,s);
  const notified=[];
  const onSaved=async items=>{
   const {rows}=await db.query("SELECT payload#>>'{football,calendar,rounds,0,matches,0,lineups,kind}' AS kind FROM fanta_state");
   assert.equal(rows[0].kind,'official');
   notified.push(...items);
  };
  const complete=[...data,team(2,'Udinese')];data=null;
  let skyCalls=0;const skyFetcher=async url=>{assert.match(url,/\/2026\/giornata-12\/venezia-udinese\/formazioni$/);skyCalls++;return {ok:true,text:async()=>skyPage()};};
  const fallback=await runOfficialLineups(job,plan,{connect,provider,now:()=>kickoff-30*minute,onSaved,skyFetcher});
  assert.equal(fallback.ok,false);assert.equal(fallback.metrics.apiUnavailable,1);assert.equal(fallback.metrics.skyPublished,1);
  assert.deepEqual(fallback.pendingFixtureIds,['m']);
  assert.equal((await db.query("SELECT payload#>>'{football,calendar,rounds,0,matches,0,lineups,source}' AS source FROM fanta_state")).rows[0].source,'Sky Sport');
  assert.deepEqual((await db.query('SELECT data FROM fanta.fixtures')).rows[0].data,{untouched:'keep'});
  data=complete;
  const failNative=async()=>{const client=await connect();return {...client,query:(sql,values)=>sql.startsWith('UPDATE fanta.fixtures')?Promise.reject(Error('Native write failed')):client.query(sql,values)};};
  await assert.rejects(runOfficialLineups(job,plan,{connect:failNative,provider,now:()=>kickoff,onSaved,skyFetcher}),/Native write failed/);
  assert.equal(notified.length,1);
  assert.equal((await db.query("SELECT payload#>>'{football,calendar,rounds,0,matches,0,lineups,source}' AS source FROM fanta_state")).rows[0].source,'Sky Sport');
  const saved=await runOfficialLineups(job,plan,{connect,provider,now:()=>kickoff,onSaved,skyFetcher});assert.equal(saved.ok,true);assert.equal(calls,4);assert.equal(skyCalls,1);
  assert.equal((await db.query("SELECT payload#>>'{football,calendar,rounds,0,matches,0,lineups,kind}' AS kind FROM fanta_state")).rows[0].kind,'official');assert.equal((await db.query('SELECT data FROM fanta.fixtures')).rows[0].data.lineups.length,2);
  const cached=await runOfficialLineups(job,plan,{connect,provider,onSaved,skyFetcher});assert.equal(cached.metrics.saved,0);assert.equal(calls,4);
  assert.deepEqual(notified,[{id:'m',revision:new Date(kickoff-30*minute).toISOString()},{id:'m',revision:new Date(kickoff).toISOString()}]);
 }finally{await db.close();}
});
