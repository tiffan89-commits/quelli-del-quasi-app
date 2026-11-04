import test from 'node:test';import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {emptyState} from '../lib/db.mjs';import {ensureCalendar} from '../lib/calendar.mjs';
import {apiFootballClient,apiFootballMatch,apiFootballTimeline,apiFootballPenalties,applyApiFootball,collectApiFootball,apiFootballDue} from '../lib/api-football.mjs';
import {runFootballFullRefresh,fullFootballDue,footballRefreshTicket,validFootballRefreshTicket} from '../lib/api-football-refresh.mjs';
import {runFootballSync} from '../netlify/functions/sync-football.mjs';
import {applyMatchSummary} from '../lib/match-data.mjs';
import {footballStatistics} from '../public/src/football-statistics.mjs';
import {matchEventLabel} from '../public/match-events.mjs';
import {liveSnapshot} from '../lib/live-snapshot.mjs';
import {mergeLiveSnapshot,patchRegion} from '../public/src/live-channel.mjs';
const now=new Date('2026-10-31T20:50:00Z');
function setup(){const s=emptyState(),cal=ensureCalendar(s);for(const r of cal.rounds)for(const m of r.matches){m.kickoff=null;m.status='FT';m.details={complete:true,events:[]};}
 const m=cal.rounds.flatMap(r=>r.matches).find(m=>m.home==='Milan'&&m.away==='Inter');Object.assign(m,{kickoff:'2026-10-31T19:45:00Z',status:'NS',score:null,officialConfirmed:false});delete m.details;delete m.espnId;return{s,m};}
const event=(type,detail,side='home',extra={})=>({time:{elapsed:33,extra:null},team:{id:side==='home'?1:2,name:side==='home'?'Milan':'Inter'},player:{id:side==='home'?10:20,name:side==='home'?'Attaccante':'Portiere'},assist:{id:null,name:null},type,detail,...extra});
function fixture(m,{id=111,status='2H',date=m.kickoff,...extra}={}){return {fixture:{id,date,referee:'Arbitro',status:{short:status,long:'Second Half',elapsed:65,extra:null}},league:{id:135,season:2026},teams:{home:{id:1,name:m.home},away:{id:2,name:m.away}},goals:{home:2,away:1},score:{halftime:{home:1,away:0},fulltime:{home:2,away:1}},events:[event('Goal','Normal Goal'),event('Goal','Penalty','home',{time:{elapsed:45,extra:2}}),event('Goal','Normal Goal','away'),event('Goal','Missed Penalty'),event('Card','Yellow Card'),event('Card','Red Card','away'),event('subst','Substitution 1','home',{assist:{id:11,name:'Entrante'}}),event('Var','Goal cancelled')],statistics:[{team:{id:1,name:m.home},statistics:[{type:'Ball Possession',value:'60%'},{type:'Goalkeeper Saves',value:0}]},{team:{id:2,name:m.away},statistics:[{type:'Ball Possession',value:'40%'},{type:'Goalkeeper Saves',value:3}]}],players:[{team:{id:1,name:m.home},players:[{player:{id:10,name:'Attaccante'},statistics:[{games:{minutes:65,rating:'7.2'},goals:{total:2,assists:0},cards:{yellow:1,red:0},penalty:{scored:1,missed:1,saved:null}}]}]},{team:{id:2,name:m.away},players:[{player:{id:20,name:'Portiere'},statistics:[{games:{minutes:65},goals:{saves:3,total:0},cards:{yellow:0,red:0},penalty:{scored:null,missed:null,saved:1}}]}]}],lineups:[],...extra};}
const env={API_FOOTBALL_KEY:'private-test-key',API_FOOTBALL_FULL_REFRESH:'operation-1',MAIL_ENCRYPTION_KEY:'ticket-test-key',CONTEXT:'production'};

test('API-FOOTBALL authenticates only on its fixed server host, accepts batched IDs and sanitizes failures',async()=>{
 let calls=0;const client=apiFootballClient({env,fetcher:async(url,options)=>{calls++;assert.equal(url,'https://v3.football.api-sports.io/fixtures?ids=1-2');assert.equal(options.headers['x-apisports-key'],env.API_FOOTBALL_KEY);assert.equal(options.redirect,'error');return {ok:true,status:200,headers:new Headers({'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7400'}),json:async()=>({response:[],errors:[]})};}});
 await client.get('fixtures?ids=1-2');assert.equal(calls,1);assert.equal(client.quota.limit,7500);assert.equal(client.quota.remaining,7400);
 await assert.rejects(client.get('fixtures?ids='+Array.from({length:21},(_,i)=>i+1).join('-')),/non consentito/);
 await assert.rejects(client.get('https://other.test'),/non consentito/);
 const bad=apiFootballClient({env,fetcher:async()=>({ok:true,status:200,headers:new Headers(),json:async()=>({errors:{key:env.API_FOOTBALL_KEY},response:[]})})});
 await assert.rejects(bad.get('fixtures?ids=1'),e=>!e.message.includes(env.API_FOOTBALL_KEY));
});

test('missed and saved penalties never become goals; VAR, substitutions and stoppage time survive DB normalization',()=>{
 const{s,m}=setup(),e=fixture(m),events=apiFootballTimeline(e);
 assert.equal(events.filter(x=>x.kind==='goal').length,3);assert.equal(events.filter(x=>x.kind==='penalty-missed').length,1);assert.equal(events.find(x=>x.penalty).minute,"45+2'");
 assert.equal(events.find(x=>x.kind==='substitution').incoming,'Entrante');
 e.events.push(event('Goal','Missed Penalty','home',{comments:'Saved by goalkeeper',time:{elapsed:81}}));
 applyApiFootball(s,[e],now.toISOString());ensureCalendar(s);
 assert.ok(m.details.events.some(x=>x.kind==='penalty-saved'));assert.ok(m.details.events.some(x=>x.kind==='var'));
 assert.equal(matchEventLabel({kind:'penalty-saved'}),'🧤 Rigore parato');assert.equal(matchEventLabel({kind:'goal',penalty:true}),'⚽ Rigore segnato');
 const saved=apiFootballPenalties(e).find(p=>p.player==='Portiere');assert.equal(saved.saved,1);assert.equal(saved.missed,null);
});

test('full payload persists events, team and player statistics without replacing existing lineup services',()=>{
 const{s,m}=setup();m.lineups={kind:'probable',teams:[{players:[{name:'Giocatore'}]}]};const old=m.lineups;
 const report=applyApiFootball(s,[fixture(m)],now.toISOString());assert.equal(report.updated,1);assert.deepEqual(m.liveScore,[2,1]);assert.equal(m.details.statistics.length,2);assert.equal(m.details.players.length,2);assert.equal(m.details.playerStats.length,2);assert.equal(m.details.scoreBreakdown.halftime.home,1);assert.equal(m.lineups,old);assert.equal(m.liveSource,'API-FOOTBALL');
 const copy=structuredClone(m.details);assert.equal(applyApiFootball(s,[fixture(m)],now.toISOString()).unchanged,1);assert.deepEqual(m.details,copy);
});

test('different seasons, opponents and invalid scores cannot modify a canonical match; old finals never roll back',()=>{
 for(const bad of [{league:{id:140,season:2026}},{league:{id:135,season:2025}},{teams:{home:{name:'Inter'},away:{name:'Milan'}}},{goals:{home:null,away:1}}]){const{s,m}=setup();const e=fixture(m,bad);const n=applyApiFootball(s,[e],now.toISOString());assert.equal(n.updated,0);assert.equal(m.status,'NS');}
 const{s,m}=setup();applyApiFootball(s,[fixture(m,{status:'FT'})],now.toISOString());applyApiFootball(s,[fixture(m,{goals:{home:0,away:0}})],now.toISOString());assert.deepEqual(m.score,[2,1]);assert.equal(m.status,'FT');
 assert.equal(apiFootballMatch(s.football,fixture(m,{date:'2025-10-31T19:45:00Z'})),null);
});

test('live fixtures share one bulk call per minute; a complete final archive never calls the provider again',async()=>{
 const{s,m}=setup();m.apiFootballId=111;let paths=[];const client={quota:{calls:0},get:async path=>{paths.push(path);return {response:[fixture(m)]};}};
 const b=await collectApiFootball(s.football,client,now);assert.deepEqual(paths,['fixtures?ids=111']);applyApiFootball(s,b.matches,b.at);s.football.lastLiveAttempt=b.at;
 assert.equal(apiFootballDue(s.football,new Date('2026-10-31T20:50:59Z')),false);assert.equal(apiFootballDue(s.football,new Date('2026-10-31T20:51:00Z')),true);
 applyApiFootball(s,[fixture(m,{status:'FT'})],now.toISOString());assert.equal(m.details.complete,false);
 applyApiFootball(s,[fixture(m,{status:'FT'})],new Date(+now+15*60000).toISOString());assert.equal(m.details.complete,true);
 paths=[];assert.equal(await collectApiFootball(s.football,client,new Date(+now+16*60000)),null);assert.deepEqual(paths,[]);
});

test('initial full refresh batches twenty fixtures, saves all details and is idempotent for its operation ID',async()=>{
 const{s}=setup(),matches=s.football.calendar.rounds.flatMap(r=>r.matches).slice(0,25);
 for(const m of matches)Object.assign(m,{status:'NS',score:null,kickoff:'2026-10-30T18:00:00Z',officialConfirmed:false,details:null});
 const rows=matches.map((m,i)=>fixture(m,{id:i+1,status:'FT'})),paths=[];
 const client={quota:{calls:0},get:async path=>{paths.push(path);client.quota.calls++;if(path==='status')return {response:{subscription:{plan:'Pro',active:true},requests:{limit_day:7500}}};if(path.startsWith('fixtures?league'))return {response:rows};return {response:path.split('=')[1].split('-').map(id=>rows.find(x=>x.fixture.id===+id))};}};
 const opts={transact:async fn=>fn(s),env,client,now:()=>+now};const report=await runFootballFullRefresh(opts);
 assert.equal(report.status,'complete');assert.equal(report.processed,25);assert.equal(report.saved.matches,25);assert.equal(report.saved.statistics,25);assert.equal(report.saved.players,25);assert.equal(report.saved.penaltyRecords,50);
 assert.equal(paths.length,4);assert.equal(paths[2].split('=')[1].split('-').length,20);assert.equal(paths[3].split('=')[1].split('-').length,5);
 assert.equal((await runFootballFullRefresh(opts)).cached,true);assert.equal(paths.length,4);assert.equal(fullFootballDue(s.football,env,+now),false);
 assert.ok(!JSON.stringify(s).includes(env.API_FOOTBALL_KEY));
});

test('full refresh records a failed subscription without clearing existing DB data and retries later',async()=>{
 const{s,m}=setup();m.details={source:'old',events:[{kind:'yellow',players:['Old player']}],complete:false};const old=structuredClone(m.details);
 const report=await runFootballFullRefresh({transact:async fn=>fn(s),env,now:()=>+now,client:{quota:{calls:1},get:async()=>({response:{subscription:{active:false}}})}});
 assert.equal(report.status,'failed');assert.deepEqual(m.details,old);assert.equal(fullFootballDue(s.football,env,+now+1000),false);assert.equal(fullFootballDue(s.football,env,+now+16*60000),true);
});

test('refresh tickets are operation-scoped, expire, and reject an old cache-worker ticket',()=>{
 const ticket=footballRefreshTicket(env.API_FOOTBALL_FULL_REFRESH,env,+now);assert.equal(validFootballRefreshTicket(ticket,env,+now+60000),true);assert.equal(validFootballRefreshTicket(ticket,env,+now+120001),false);assert.equal(validFootballRefreshTicket(ticket,{...env,API_FOOTBALL_FULL_REFRESH:'other'},+now),false);assert.equal(validFootballRefreshTicket('bad',env,+now),false);
});

test('API-FOOTBALL has priority over SportAPI and the scheduled worker is dispatched only while needed',async()=>{
 const at=new Date(),{s,m}=setup();m.kickoff=new Date(+at-3600000).toISOString();s.football.lastOddsAttempt=at.toISOString();
 let full=0,calls=0;const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected network');};
 try{const response=await runFootballSync({transact:async fn=>fn(s),env:{...env,SPORTAPI_KEY:'old-provider'},dispatchFull:async()=>full++,collectProvider:async()=>{throw Error('Old live provider must stop');},collectApiProvider:async()=>{calls++;return {matches:[fixture(m)],errors:[],at:at.toISOString(),quota:{calls:1}};}});assert.equal(response.status,200);assert.equal(full,1);assert.equal(calls,1);assert.equal(m.liveSource,'API-FOOTBALL');assert.deepEqual(m.liveScore,[2,1]);}finally{globalThis.fetch=old;}
});

test('statistics render correct zeroes and keeper penalties in collapsible mobile sections; live patches preserve lineups and accordion state',()=>{
 const{s,m}=setup();applyApiFootball(s,[fixture(m)],now.toISOString());m.details.playerStats[0].name='<script>bad</script>';
 const html=footballStatistics(m);assert.match(html,/Rigori parati: <b>1<\/b>/);assert.match(html,/Rigori sbagliati: <b>1<\/b>/);assert.match(html,/Possesso palla/);assert.match(html,/>0<\/td>/);assert.doesNotMatch(html,/<script>/);
 const{document}=parseHTML('<html><body><div id="stats">'+html+'</div><section class="lineup-section"><img src="/old-image"></section></body></html>');const stats=document.querySelector('#stats'),formation=document.querySelector('.lineup-section'),accordion=stats.querySelector('details');accordion.setAttribute('open','');
 m.details.statistics[0].statistics[0].value='61%';patchRegion(stats,'<div id="stats">'+footballStatistics(m)+'</div>');assert.equal(stats.querySelector('details'),accordion);assert.equal(accordion.hasAttribute('open'),true);assert.equal(document.querySelector('.lineup-section'),formation);assert.match(stats.textContent,/61%/);
});

test('DB live snapshot exposes compact statistics and penalties but never the full player provider payload',()=>{
 const{s,m}=setup();applyApiFootball(s,[fixture(m)],new Date().toISOString());const user={id:'u',demo:true};s.users=[user];s.leagues=[{id:'l',demo:true,members:[{uid:'u',points:0,credits:500}]}];
 const snapshot=liveSnapshot(s,user,'l'),live=snapshot.calendar.find(x=>x.id===m.id);assert.equal(live.statistics.length,2);assert.equal(live.penalties[1].saved,1);assert.equal(live.playerStats.length,2);assert.equal(live.players,undefined);
 const formations={teams:[{players:[{name:'Old'}]}]},state={leagues:[{id:'l',members:[],rounds:[{id:'r',matches:[{id:m.id,lineups:formations}]}]}]};mergeLiveSnapshot(state,{league:'l',rounds:[{id:'r',matches:[live]}]});const target=state.leagues[0].rounds[0].matches[0];assert.equal(target.lineups,formations);assert.equal(target.details.penalties[1].saved,1);assert.equal(target.detailRevision,m.details.updatedAt);
});
