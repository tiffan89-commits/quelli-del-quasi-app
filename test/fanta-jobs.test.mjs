import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureDb,apiFixture} from './fanta/helpers.mjs';
import {saveBetaImport,matchImportedPlayer} from '../docs/history/legacy-data-tools/import.mjs';
import {createFantaApi} from '../fanta/api.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {queueFantaNotifications,deliverFantaNotifications} from '../fanta/notifications.mjs';
import {runFantaJob,probeLive,jobTicket,validJobTicket} from '../fanta/jobs.mjs';
import {fantaProvider} from '../fanta/provider.mjs';
import {ingestFixture,computeRounds,dailyCatalog} from '../fanta/ingest.mjs';

test('Fanta: concurrent bids have one winner; manual assignments/undo persist with audit and admin permission',async()=>{
 const f=await fixtureDb();try{
  let stamp=Date.now();const env={FANTA_BETA_USERS:'frankwood,amico'},api=createFantaApi({store:sqlFantaStore(f),env,now:()=>stamp});
  const call=(route,body,uid=1)=>api(new Request('https://example.test/fanta-api/'+route,{method:body?'POST':'GET',headers:{cookie:'sid=token'+uid},body:body?JSON.stringify({league:'fanta-lucas-a',...body}):undefined}));
  assert.equal((await call('auction/schedule',{type:'iniziale',mode:'live',startsAt:new Date(stamp+10000).toISOString()},2)).status,403);
  assert.equal((await call('auction/schedule',{type:'iniziale',mode:'live',startsAt:new Date(stamp+10000).toISOString()})).status,200);
  let a=await(await call('auction/start',{})).json();const caller=a.caller==='t1'?1:2,other=caller===1?2:1;
  a=await(await call('auction/nominate',{playerId:'free',amount:1},caller)).json();const lotId=a.lot.id;
  const responses=await Promise.all([call('auction/bid',{lotId,amount:2},other),call('auction/bid',{lotId,amount:2},other)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  stamp+=13000;const snapshot=await(await call('auction?league=fanta-lucas-a')).json();assert.equal(snapshot.lastSale,undefined);a=await(await call('auction/tick',{},other)).json();assert.equal(a.lastSale.price,2);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.rosters WHERE player_id='free'")).rows[0].n,1);
  stamp+=3000;await call('auction/mode',{mode:'manual'});
  assert.equal((await call('auction/undo',{saleId:a.lastSale.id})).status,200);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.rosters WHERE player_id='free'")).rows[0].n,0);
  await call('auction/table',{playerId:'free'});assert.equal((await call('auction/assign',{playerId:'free',teamId:'t1',price:600})).status,400);
  assert.equal((await call('auction/assign',{playerId:'free',teamId:'t1',price:8})).status,200);
  assert.ok((await f.db.query('SELECT count(*)::int AS n FROM fanta.auction_actions')).rows[0].n>=7);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.sales WHERE undone')).rows[0].n,1);
 }finally{await f.close();}
});

test('Fanta: migration keeps historical scores, imports complete lineups, reports uncertainty and links only the beta owner',async()=>{
 const f=await fixtureDb();try{
  const players=(await f.db.query('SELECT p.id,p.name,p.role,c.name AS club FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id')).rows;
  const teams=['t1','t2'].map((id,i)=>({sourceId:id,name:i?'Avversari':'Fly Emigrates',manager:'Allenatore '+i,roster:f.rosters[id].map(p=>({...p,name:p.name,club:'Club '+(i+1),sourceId:p.id,price:2}))}));
  teams[1].roster.push({sourceId:'unknown',name:'Nome sconosciuto',club:'Club 2',role:'A',price:3});
  const sheets=teams.map((t,i)=>({name:t.name,formation:'4-4-2',players:f.rosters['t'+(i+1)].map((p,j)=>({...p,club:'Club '+(i+1),starter:j<11}))}));
  const migrated={teams,rounds:[{number:1,serieARound:1,deadline:'2026-10-01T12:00:00Z',calculated:true,matches:[{home:'Fly Emigrates',away:'Avversari',score:[2,1],fantasyPoints:[72.5,69],details:{teams:sheets}}]},{number:2,serieARound:2,deadline:'2026-11-08T12:00:00Z',calculated:false,matches:[{home:'Avversari',away:'Fly Emigrates'}]}]};
  const opts={migrated,players,uid:'u1',leagueId:'import-test',operation:'migration-test',connect:f.connect,now:()=>Date.parse('2026-11-01T12:00:00Z')};
  const result=await saveBetaImport(opts);assert.deepEqual(result,{teams:2,players:30,unmatched:1,rounds:2,formations:2});
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.teams WHERE league_id='import-test' AND user_id IS NOT NULL")).rows[0].n,1);
  const historical=(await f.db.query("SELECT data FROM fanta.results WHERE historical")).rows[0].data;assert.equal(historical.home.points,72.5);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.lineups WHERE league_id='import-test'")).rows[0].n,2);
  assert.equal((await f.db.query("SELECT data FROM fanta.import_issues WHERE league_id='import-test'")).rows[0].data.name,'Nome sconosciuto');
  assert.equal((await saveBetaImport(opts)).cached,true);
  assert.ok(matchImportedPlayer({name:'Mario Rossi',role:'A',club:'Wrong'},players).issue);
 }finally{await f.close();}
});

test('Fanta: reminder is idempotent, only missing lineups receive it; nonproduction delivery and preferences prevent sends',async()=>{
 const f=await fixtureDb();try{
  const now=()=>Date.parse('2026-11-01T12:00:00Z');await f.db.query("UPDATE fanta.rounds SET deadline='2026-11-01T13:00:00Z'");
  const l=f.lineup('t1');await f.db.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES($1,1,$2,$3,$4,$5)',['fanta-lucas-a','t1',l.formation,JSON.stringify(l.starters),JSON.stringify(l.bench)]);
  await queueFantaNotifications({connect:f.connect,now});await queueFantaNotifications({connect:f.connect,now});
  const notes=(await f.db.query('SELECT * FROM fanta.notifications')).rows;assert.equal(notes.length,1);assert.equal(notes[0].user_id,'u2');assert.equal(notes[0].kind,'lineupReminder');
  let sends=0;await deliverFantaNotifications({connect:f.connect,now,env:{CONTEXT:'deploy-preview'},sendPush:()=>sends++,deliverMail:()=>sends++});assert.equal(sends,0);
  assert.ok((await f.db.query('SELECT delivered_at FROM fanta.notifications')).rows[0].delivered_at);
 }finally{await f.close();}
});

test('Fanta: provider is server-only, whitelisted and budgeted; authenticated jobs fail closed and probe samples twice per minute',async()=>{
 let calls=0;const provider=fantaProvider({env:{API_FOOTBALL_KEY:'synthetic-key'},maxCalls:1,fetcher:async(url,o)=>{calls++;assert.equal(o.headers['x-apisports-key'],'synthetic-key');assert.equal(url,'https://v3.football.api-sports.io/fixtures?ids=777');return Response.json({response:[],errors:[]});}});
 await assert.rejects(provider.get('https://invalid.test/'),/consentito/);await provider.get('fixtures?ids=777');await assert.rejects(provider.get('fixtures?ids=777'),/Budget/);assert.equal(calls,1);
 const env={FANTA_ENABLED:'true',FANTA_BETA_USERS:'frankwood',MAIL_ENCRYPTION_KEY:'synthetic-ticket-test',FANTA_PROBE_FIXTURE_ID:'777'};const ticket=jobTicket('probe',env,1000);assert.equal(validJobTicket(ticket,env,2000),'probe');assert.equal(validJobTicket(ticket,env,122000),null);
 assert.equal((await runFantaJob('live',{env:{}})).disabled,true);
 const f=await fixtureDb();try{let stamp=Date.parse('2026-11-01T12:30:00Z'),samples=0;const source={get calls(){return samples;},get:async()=>{samples++;return {response:[apiFixture({status:'2H',minutes:60})]};}};
  const report=await runFantaJob('probe',{connect:f.connect,env,provider:source,now:()=>stamp,sleep:async ms=>{assert.equal(ms,30000);stamp+=ms;}});assert.equal(report.status,'complete');assert.equal(samples,2);
  const saved=(await f.db.query("SELECT data FROM fanta.jobs WHERE id='probe:777'")).rows[0].data;assert.equal(Date.parse(saved.samples[1].at)-Date.parse(saved.samples[0].at),30000);
 }finally{await f.close();}
});

test('Fanta: old events do not send notifications; live updates retain event identity; incomplete final data stays provisional',async()=>{
 const f=await fixtureDb();try{let stamp=Date.parse('2026-11-01T12:30:00Z');const raw=apiFixture({status:'2H',minutes:60});
  await ingestFixture(raw,{connect:f.connect,env:{},now:()=>stamp});assert.equal((await f.db.query('SELECT notify FROM fanta.events')).rows[0].notify,false);
  raw.events.push({type:'Card',detail:'Yellow Card',time:{elapsed:61},player:{id:3},team:{id:10}});stamp+=60000;await ingestFixture(raw,{connect:f.connect,env:{},now:()=>stamp});
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.events')).rows[0].n,2);assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.events WHERE notify')).rows[0].n,1);
  raw.fixture.status.short='FT';raw.players[1].players=[];for(let i=0;i<3;i++){stamp+=21*60000;await ingestFixture(raw,{connect:f.connect,env:{},now:()=>stamp});}
  assert.equal((await f.db.query("SELECT frozen_at FROM fanta.fixtures WHERE id='af:777'")).rows[0].frozen_at,null);
  await f.db.query("UPDATE fanta.rounds SET deadline='2026-11-01T11:00:00Z'");await computeRounds({connect:f.connect,now:()=>stamp});
  assert.equal((await f.db.query('SELECT official FROM fanta.rounds')).rows[0].official,false);
 }finally{await f.close();}
});

test('Fanta: successive round calculations use new votes rather than the previous saved score, then freeze results',async()=>{
 const f=await fixtureDb();try{
  const now=()=>Date.parse('2026-11-01T14:00:00Z');await f.db.query("UPDATE fanta.rounds SET deadline='2026-11-01T12:00:00Z'");
  for(const id of ['t1','t2']){const l=f.lineup(id);await f.db.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES($1,1,$2,$3,$4,$5)',['fanta-lucas-a',id,l.formation,JSON.stringify(l.starters),JSON.stringify(l.bench)]);}
  for(let i=0;i<10;i++)await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id) VALUES($1,$2,2026,1,'2026-11-01T12:00:00Z','2H','c1','c2')",['calc'+i,10000+i]);
  for(const t of ['t1','t2'])for(const p of f.rosters[t])await f.db.query("INSERT INTO fanta.votes(fixture_id,player_id,version,input_hash,input,data) VALUES('calc0',$1,'test','one','{}',$2)",[p.id,JSON.stringify({...p,vote:6,fantavote:6,status:'playing'})]);
  await computeRounds({connect:f.connect,now});let result=(await f.db.query("SELECT * FROM fanta.results WHERE matchup_id='m1'")).rows[0];assert.equal(result.data.home.points,67);assert.equal(result.official,false);
  const p=f.rosters.t1[10];await f.db.query("INSERT INTO fanta.votes(fixture_id,player_id,version,input_hash,input,data) VALUES('calc0',$1,'test','two','{}',$2)",[p.id,JSON.stringify({...p,vote:6,fantavote:12,status:'voted'})]);
  await computeRounds({connect:f.connect,now});result=(await f.db.query("SELECT * FROM fanta.results WHERE matchup_id='m1'")).rows[0];assert.equal(result.data.home.points,73);assert.equal(result.data.home.goals,2);
  await f.db.query('UPDATE fanta.fixtures SET frozen_at=now()');await computeRounds({connect:f.connect,now});assert.equal((await f.db.query("SELECT official FROM fanta.results WHERE matchup_id='m1'")).rows[0].official,true);
 }finally{await f.close();}
});

test('Fanta: live ingestion never waits for AI; a separate worker enriches saved statistics without advancing final reads',async()=>{
 const f=await fixtureDb();try{let aiCalls=0;const raw=apiFixture({status:'2H',minutes:60}),env={ANTHROPIC_API_KEY:'synthetic'};
  await ingestFixture(raw,{connect:f.connect,env,deferAi:true,ai:()=>{throw Error('The live path must never call AI');}});
  const before=(await f.db.query("SELECT final_reads,checked_at FROM fanta.fixtures WHERE id='af:777'")).rows[0];
  const result=await runFantaJob('ai',{connect:f.connect,env:{...env,FANTA_ENABLED:'true',FANTA_BETA_USERS:'frankwood'},ai:async p=>{aiCalls++;return {delta:0,note:'60 minuti',evidence:[{metric:'minutes',value:p.minutes}]};}});
  assert.equal(result.status,'complete');assert.equal(aiCalls,0);assert.equal(result.disabled,true);
  const after=(await f.db.query("SELECT final_reads,checked_at FROM fanta.fixtures WHERE id='af:777'")).rows[0];assert.deepEqual(after,before);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.votes WHERE data->'ai'->>'delta'='0'")).rows[0].n,0);
 }finally{await f.close();}
});

test('Fanta: daily catalog joins club/role/season statistics, excludes old injuries and runs only once per day',async()=>{
 const f=await fixtureDb();try{let calls=0;const clubs=Array.from({length:20},(_,i)=>({team:{id:100+i,name:'Club sintetico '+i}})),roles=['Goalkeeper',...Array(4).fill('Defender'),...Array(4).fill('Midfielder'),...Array(3).fill('Attacker')];
  const fixtureRows=Array.from({length:10},(_,i)=>({fixture:{id:3000+i,date:'2026-11-08T12:00:00Z',status:{short:'NS'}},league:{round:'Regular Season - 2'},teams:{home:clubs[2*i].team,away:clubs[2*i+1].team}}));
  const provider={get calls(){return calls;},get:async path=>{calls++;if(path.startsWith('teams?'))return {response:clubs};if(path.startsWith('fixtures?'))return {response:fixtureRows};if(path.startsWith('injuries?'))return {response:[{player:{id:10000,type:'Missing Fixture',reason:'Vecchio infortunio'},fixture:{date:'2026-01-01'}}]};if(path.startsWith('players/squads')){const id=Number(path.split('=')[1]);return {response:[{team:{id},players:roles.map((position,i)=>({id:id*100+i,name:'Giocatore '+id+' '+i,position}))}]};}return {response:[],paging:{total:1}};}};
  const opts={connect:f.connect,provider,env:{},now:()=>Date.parse('2026-11-01T12:00:00Z')};const result=await dailyCatalog(opts);assert.equal(result.players,240);assert.equal(calls,24);
  const player=(await f.db.query("SELECT data FROM fanta.players WHERE id='af:10000'")).rows[0].data;assert.equal(player.status.type,'ok');assert.equal(player.value>=1,true);assert.ok(player.valueWhy);
  assert.equal((await dailyCatalog(opts)).cached,true);assert.equal(calls,24);
 }finally{await f.close();}
});
