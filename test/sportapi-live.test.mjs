import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../lib/db.mjs';
import {ensureCalendar} from '../lib/calendar.mjs';
import {sportApiEnabled, requestSportApi, sportApiDue, sportApiCandidates, collectSportApi, applySportApi, sportApiTimeline} from '../lib/sportapi-live.mjs';
import {applyScoreEvents, applyMatchSummary, collectLiveDetails} from '../lib/match-data.mjs';
import {liveSnapshot} from '../lib/live-snapshot.mjs';
import {runFootballSync} from '../netlify/functions/sync-football.mjs';
import {runMatchCache} from '../lib/match-cache.mjs';
const now = new Date('2026-10-31T20:24:00Z');
function setup(at = now) {
  const s = emptyState(), cal = ensureCalendar(s);
  for (const r of cal.rounds) for (const m of r.matches) { m.kickoff=null; m.status='FT'; }
  const m = cal.rounds.flatMap(r=>r.matches).find(m=>m.home==='Milan' && m.away==='Inter');
  Object.assign(m,{kickoff:new Date(+at-35*60000).toISOString(),status:'NS',score:null,officialConfirmed:false});
  for (const k of ['espnId','details','lineups','providerId']) delete m[k];
  return {s,m};
}
const goal = (extra={}) => ({event_type:'goal',team_side:'home',player_name:'C. Pulisic',minute:"4'",extra_info:'Goal',...extra});
const fixture = (m,extra={}) => ({id:15328871,league_id:3,league_geo:'IT',home_team:'AC Milan',away_team:'Inter Milan',kickoff_utc:m.kickoff,status:'LIVE',minute:"35'",home_score:2,away_score:1,updated_at:now.toISOString(),events:[goal(),goal({player_name:'A. Rabiot',minute:"10'"}),goal({team_side:'away',player_name:'A. Bastoni',minute:"22'"})],...extra});
const apply = (s,m,extra={},at=now) => applySportApi(s,{matches:[{matchId:m.id,fixture:fixture(m,extra)}],at:at.toISOString(),errors:[]});

test('SportAPI authentication stays in the server header and provider errors cannot expose its key',async()=>{
  assert.equal(sportApiEnabled({}),false);
  const env={SPORTAPI_KEY:'test-private-key'};
  let calls=0;
  await requestSportApi('fixtures/15328871',{env,fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://sportapi.ai/api/fixtures/15328871');assert.equal(options.headers['X-Api-Key'],env.SPORTAPI_KEY);assert.equal(options.redirect,'error');
    return {ok:true,status:200,json:async()=>({success:true,fixture:{}})};
  }});
  assert.equal(calls,1);
  await assert.rejects(requestSportApi('https://other.test',{env}),/non consentito/);
  await assert.rejects(requestSportApi('fixtures/1',{env,fetcher:async()=>{throw Error(env.SPORTAPI_KEY);}}),e=>!e.message.includes(env.SPORTAPI_KEY));
  await assert.rejects(requestSportApi('fixtures/1',{env,fetcher:async()=>({ok:false,status:429,json:async()=>({key:env.SPORTAPI_KEY})})}),/HTTP 429/);
});

test('discovery is shared per date, then one minute request per known match includes score and events',async()=>{
  const {s,m}=setup();let paths=[];
  const fetcher=async path=>{paths.push(path);return path.includes('/date/')?{data:[fixture(m),fixture(m,{league_id:24})]}:{fixture:fixture(m)};};
  let batch=await collectSportApi(s.football,fetcher,now);
  assert.deepEqual(paths,['fixtures/date/2026-10-31','fixtures/15328871']);assert.equal(batch.requests,2);
  applySportApi(s,batch);assert.deepEqual(m.liveScore,[2,1]);assert.equal(m.clock,"35'");assert.equal(m.details.events.length,3);
  assert.equal(sportApiDue(s.football,new Date(+now+59999)),false);
  assert.equal(await collectSportApi(s.football,fetcher,new Date(+now+59999)),null);
  paths=[];batch=await collectSportApi(s.football,fetcher,new Date(+now+60000));
  assert.deepEqual(paths,['fixtures/15328871']);assert.equal(batch.requests,1);
  assert.equal(m.lineups,undefined);
});

test('simultaneous fixtures share discovery and failed match details retain other successes',async()=>{
  const {s,m}=setup(), other=s.football.calendar.rounds.flatMap(r=>r.matches).find(x=>x.home==='Roma'&&x.away==='Udinese');
  Object.assign(other,{kickoff:m.kickoff,status:'NS',score:null,officialConfirmed:false});
  const f2=fixture(other,{id:222,home_team:other.home,away_team:other.away});let dates=0;
  const batch=await collectSportApi(s.football,async path=>{
    if(path.includes('/date/')){dates++;return {data:[fixture(m),f2]};}
    if(path==='fixtures/222')throw Error('private upstream response');
    return {fixture:fixture(m)};
  },now);
  assert.equal(dates,1);assert.equal(batch.matches.length,2);assert.equal(batch.errors.length,1);
  applySportApi(s,batch);assert.deepEqual(m.liveScore,[2,1]);assert.deepEqual(other.liveScore,[2,1]);assert.equal(other.sportApiId,222);
});

test('live updates expose goal events from the DB snapshot and preserve existing formations',()=>{
  const {s,m}=setup();m.lineups={kind:'official',teams:[{name:'Milan',players:[{name:'Player'}]}]};const before=structuredClone(m.lineups);
  apply(s,m);const user={id:'u',demo:true};s.users=[user];s.leagues=[{id:'l',demo:true,members:[{uid:'u',credits:500,points:0}]}];
  const snapshot=liveSnapshot(s,user,'l'),record=snapshot.calendar.find(x=>x.id===m.id);
  assert.deepEqual(record.liveScore,[2,1]);assert.equal(record.events[0].players[0],'C. Pulisic');assert.equal(record.events[0].minute,"4'");assert.deepEqual(m.lineups,before);
  apply(s,m,{minute:'HT'});assert.equal(m.clock,'Intervallo');
});

test('timeline normalizes stoppage time, goals, penalties, cards and rejects cancelled events',()=>{
  const events=sportApiTimeline({home_team:'Milan',away_team:'Inter',events:[goal(),goal(),goal({event_type:'yellow_card',minute:"45+2'",team_side:'away'}),goal({event_type:'second_yellow_card',minute:"46'"}),goal({event_type:'goal',extra_info:'Own Goal',minute:"30'"}),goal({event_type:'penalty_goal',minute:"90+5'"}),goal({extra_info:'Disallowed Goal'}),goal({event_type:'substitution'})]});
  assert.deepEqual(events.map(e=>e.kind),['goal','own-goal','red','yellow','goal']);
  assert.equal(events.find(e=>e.kind==='yellow').seconds,47*60);assert.equal(events.at(-1).penalty,true);
});

test('wrong league, pairing, dates, null scores and stale responses cannot corrupt results',()=>{
  for(const extra of [{league_geo:'BR'},{league_id:24},{away_team:'Roma'},{kickoff_utc:'2025-10-31T19:45:00Z'},{home_score:null},{home_score:-1},{status:'Cancelled'}]){
    const {s,m}=setup();assert.equal(apply(s,m,extra),0);assert.equal(m.status,'NS');assert.equal(m.liveScore,undefined);
  }
  const {s,m}=setup();apply(s,m);apply(s,m,{home_score:0,away_score:0,updated_at:'2026-10-31T20:00:00Z'});assert.deepEqual(m.liveScore,[2,1]);
  apply(s,m,{status:'Scheduled',home_score:null,away_score:null});assert.equal(m.status,'LIVE');
});

test('completed finals settle, finish their event archive and stop all external refreshes',async()=>{
  const {s,m}=setup();apply(s,m,{status:'FT'});
  assert.equal(m.officialConfirmed,true);assert.deepEqual(m.score,[2,1]);assert.equal(m.details.complete,false);
  assert.equal(sportApiDue(s.football,new Date(+now+60000)),false);
  assert.equal(sportApiDue(s.football,new Date(+now+15*60000)),true);
  apply(s,m,{status:'FT',updated_at:new Date(+now+3600000).toISOString()},new Date(+now+3600000));
  assert.equal(m.details.complete,true);let calls=0;
  assert.equal(await collectSportApi(s.football,async()=>{calls++;},new Date(+now+3660000)),null);assert.equal(calls,0);
  apply(s,m,{status:'LIVE',home_score:3});assert.equal(m.status,'FT');assert.deepEqual(m.score,[2,1]);
  const blank=setup();apply(blank.s,blank.m,{status:'FT',events:[]});apply(blank.s,blank.m,{status:'FT',events:[]},new Date(+now+3600000));assert.equal(blank.m.details.complete,false);
});

test('ESPN and Odds API cannot overwrite SportAPI results or events while official formations still import',async()=>{
  const {s,m}=setup();apply(s,m);const saved=structuredClone(m.details);
  const c={status:{displayClock:"20'",type:{state:'in'}},competitors:['home','away'].map((side,i)=>({id:side,homeAway:side,team:{displayName:i?m.away:m.home},score:'0'}))};
  const rosters=['home','away'].map((side,i)=>({homeAway:side,team:{displayName:i?m.away:m.home},formation:'4-3-3',roster:Array.from({length:11},(_,i)=>({starter:true,athlete:{displayName:'Player '+i}}))}));
  applyMatchSummary(s,m,{header:{competitions:[c]},keyEvents:[],rosters},now);
  applyScoreEvents(s,[{id:'espn1',date:m.kickoff,competitions:[c]}],{at:now.toISOString()});
  assert.deepEqual(m.liveScore,[2,1]);assert.equal(m.clock,"35'");assert.deepEqual(m.details,saved);assert.equal(m.lineups.kind,'official');assert.equal(m.lineups.teams[0].players.length,11);
  let calls=0;await collectLiveDetails(s.football,[],async()=>{calls++;},now);assert.equal(calls,0);
});

test('shared cron lease and cooldown prevent duplicate provider runs and never call old score sources',async()=>{
  const at=new Date(),{s,m}=setup(at);s.football.lastOddsAttempt=at.toISOString();
  let release,started,calls=0;const gate=new Promise(r=>{release=r;}),begun=new Promise(r=>{started=r;});
  const transact=async fn=>fn(s),collectProvider=async()=>{calls++;started();await gate;return {matches:[{matchId:m.id,fixture:fixture(m,{updated_at:at.toISOString()})}],at:at.toISOString()};};
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('External request outside injected shared provider');};
  try{
    const running=runFootballSync({transact,collectProvider,env:{SPORTAPI_KEY:'test',CONTEXT:'production'}});await begun;
    const duplicate=await runFootballSync({transact,collectProvider,env:{SPORTAPI_KEY:'test',CONTEXT:'production'}});assert.equal(await duplicate.text(),'Already running');
    release();assert.equal((await running).status,200);assert.equal(calls,1);assert.deepEqual(m.liveScore,[2,1]);
    assert.equal((await runFootballSync({transact,collectProvider,env:{SPORTAPI_KEY:'test',CONTEXT:'production'}})).status,200);assert.equal(calls,1);assert.equal(s.football.lease,0);
  }finally{release();globalThis.fetch=original;}
});

test('no requests are planned outside kickoff windows or after a completed archive',()=>{
  const {s,m}=setup();m.kickoff=new Date(+now+6*3600000).toISOString();assert.equal(sportApiDue(s.football,now),false);
  m.kickoff=new Date(+now-9*3600000).toISOString();m.status='FT';m.liveSource='SportAPI.ai';m.details={complete:false};assert.deepEqual(sportApiCandidates(s.football,now),[]);
});

test('minute cron jitter cannot suppress every second refresh or duplicate a call in the same minute',()=>{
  const {s}=setup();s.football.lastLiveAttempt='2026-10-31T20:24:01.500Z';
  assert.equal(sportApiDue(s.football,new Date('2026-10-31T20:24:59.999Z')),false);
  assert.equal(sportApiDue(s.football,new Date('2026-10-31T20:25:00.100Z')),true);
});

test('a concurrent old cache worker imports formations without rolling back newer SportAPI scores and events',async()=>{
  const {s,m}=setup();
  for(const r of s.football.calendar.rounds)for(const x of r.matches)if(x!==m)x.details={complete:true,events:[]};
  m.kickoff=new Date(+now+15*60000).toISOString();m.lineups={kind:'probable'};
  const oldScore={id:'old-espn',date:m.kickoff,competitions:[{status:{type:{completed:true,state:'post'}},competitors:['home','away'].map((side,i)=>({id:side,homeAway:side,team:{displayName:i?m.away:m.home},score:'0'}))}]};
  const rosters=['home','away'].map((side,i)=>({homeAway:side,team:{displayName:i?m.away:m.home},formation:'4-3-3',roster:Array.from({length:11},(_,i)=>({starter:true,athlete:{displayName:'Player '+i}}))}));
  await runMatchCache({transact:async fn=>fn(s),now:()=>now,maxTasks:1,lineupFetcher:async()=>{throw Error('No forecast expected');},fetcher:async path=>{
    if(path.startsWith('scoreboard')){apply(s,m);return {events:[oldScore]};}
    return {header:{competitions:oldScore.competitions},keyEvents:[],rosters};
  }});
  assert.equal(m.status,'LIVE');assert.deepEqual(m.liveScore,[2,1]);assert.equal(m.details.source,'SportAPI.ai');assert.equal(m.details.events.length,3);assert.equal(m.lineups.kind,'official');
});
