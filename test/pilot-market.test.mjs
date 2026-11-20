import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb} from './fanta/helpers.mjs';import {chooseAutoLineup,balancedPilotRosters} from '../fanta/auto-coach.mjs';import {ensurePilot,pilotTeams,claimPilot} from '../fanta/pilot.mjs';import {auctionAction,teamBudget} from '../fanta/auction.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';import {rosterAction} from '../fanta/roster-market.mjs';import {writeAutoLineups} from '../fanta/auto-lineups.mjs';
const stamp=Date.parse('2026-11-02T12:00:00Z');
async function pilotFixture(){const f=await fixtureDb();await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES('pilot-fixture',70000,2026,10,'2026-11-03T15:00Z','NS','c1','c2','{}')");for(let j=1;j<10;j++)await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES($1,$2,2026,10,'2026-11-03T15:00Z','NS','c1','c2','{}')",['pilot-fixture-'+j,70000+j]);let n=71000;for(const [role,count]of [['P',45],['D',110],['C',110],['A',90]])for(let i=0;i<count;i++){const id='pilot-player:'+n;await f.db.query('INSERT INTO fanta.players(id,api_id,club_id,name,role,data) VALUES($1,$2,$3,$4,$5,$6)',[id,n++,'c'+(i%2+1),'Synthetic '+role+' '+i,role,JSON.stringify({value:role==='P'?8:role==='D'?7:role==='C'?10:20,fm:6.5,played:8,status:{type:'ok'}})]);}return f;}
test('automatic coach is deterministic, respects roles and excludes unavailable players; pilot draft is balanced and unique',()=>{
 let id=0;const pool=['P','D','C','A'].flatMap(role=>Array.from({length:role==='P'?40:100},(_,i)=>({id:String(id++).padStart(4,'0'),name:'Synthetic',role,value:role==='A'?20:8,fm:6+i/100,startProbability:80,status:{type:'ok'}}))),rosters=balancedPilotRosters(pool);
 assert.equal(rosters.length,10);assert.equal(new Set(rosters.flat().map(p=>p.id)).size,250);assert.ok(rosters.every(r=>r.length===25&&r.reduce((n,p)=>n+p.price,0)<=500));assert.equal(new Set(rosters.map(r=>r.reduce((n,p)=>n+p.price,0))).size,1);
 const r=rosters[0];r.find(p=>p.role==='A').status={type:'injured'};r.find(p=>p.role==='D').status={type:'suspended'};const a=chooseAutoLineup(r);assert.ok(a);assert.deepEqual(chooseAutoLineup(r),a);assert.equal(a.starters.length,11);assert.ok(!a.starters.some(id=>['injured','suspended'].includes(r.find(p=>p.id===id).status.type)));
});
test('pilot persists ten real rosters, owner, one claim per user, concurrent contention and immediate successor league',async()=>{
 const f=await pilotFixture();try{const opts={connect:f.connect,now:stamp,env:{FANTA_SEASON:'2026'}},first=await ensurePilot(opts),offer=await pilotTeams('new-user',opts);assert.equal(first.id,offer.league.id);assert.equal(offer.coached,1);assert.equal(offer.teams.length,10);assert.equal(offer.teams.filter(t=>t.coach.isAdmin).length,1);assert.ok(offer.teams.every(t=>t.roster.length===25));assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.lineups WHERE league_id=$1',[first.id])).rows[0].n,10);
  const free=offer.teams.find(t=>!t.coach.human),race=await Promise.allSettled([claimPilot({id:'a',name:'Alpha'},{teamId:free.id},opts),claimPilot({id:'b',name:'Beta'},{teamId:free.id},opts)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.status,409);
  const winner=race[0].status==='fulfilled'?'a':'b';assert.equal((await claimPilot({id:winner},{random:true},opts)).reused,true);
  for(let i=0;i<8;i++)await claimPilot({id:'extra-'+i,name:'Synthetic '+i},{random:true},{...opts,random:()=>0});assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.leagues WHERE kind='pilot'")).rows[0].n,2);
  const next=await pilotTeams('unassigned',opts);assert.notEqual(next.league.id,first.id);assert.equal(next.coached,1);assert.equal((await pilotTeams(winner,opts)).league.id,first.id);
  const store=sqlFantaStore(f),api=createFantaApi({store:{...store,identity:async()=>({id:winner,name:'Synthetic',username:'synthetic',verified:true})},env:{FANTA_BETA_USERS:'frankwood'}}),request=path=>api(new Request('https://example.test/fanta-api/'+path,{headers:{cookie:'sid=test'}}));assert.equal((await(await request('me')).json()).access,'full');assert.equal((await request('pilot/teams')).status,410);assert.equal((await api(new Request('https://example.test/fanta-api/pilot/claim',{method:'POST',headers:{cookie:'sid=test','Content-Type':'application/json'},body:'{}'}))).status,410);assert.equal((await request('league?league='+next.league.id)).status,403);assert.equal((await request('auction?league='+first.id)).status,200);assert.equal((await request('league?league='+first.id)).status,200);
 }finally{await f.close();}
});
test('automatic lineups preserve manual submission, use zero extra provider calls and skip unchanged writes',async()=>{
 const f=await pilotFixture();try{const opts={connect:f.connect,now:stamp,env:{FANTA_SEASON:'2026'}},p=await ensurePilot(opts);const c=await f.connect();try{await c.query('BEGIN');const a=await writeAutoLineups(c,{now:stamp+1000,leagueIds:[p.id],initial:true});assert.equal(a.saved,0);assert.equal(a.unchanged,10);await c.query('COMMIT');}finally{c.release();}
  await f.db.query("UPDATE fanta.lineups SET source_data='{}',formation='3-4-3' WHERE team_id=$1",[p.id+':4']);const c2=await f.connect();try{await c2.query('BEGIN');const b=await writeAutoLineups(c2,{now:stamp+2000,leagueIds:[p.id],initial:true});assert.equal(b.manual,1);await c2.query('COMMIT');}finally{c2.release();}assert.equal((await f.db.query('SELECT formation FROM fanta.lineups WHERE team_id=$1',[p.id+':4'])).rows[0].formation,'3-4-3');
 }finally{await f.close();}
});
test('Lucas automates both owned teams only before future deadlines and preserves the owner manual lineup and all played rounds',async()=>{
 const f=await fixtureDb();try{await f.db.query("UPDATE fanta.leagues SET auto_lineups_from=$1",[new Date(stamp-3600000).toISOString()]);await f.db.query("UPDATE fanta.rounds SET deadline=$1",[new Date(stamp-86400000).toISOString()]);const old=f.lineup('t1');await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES('fanta-lucas-a',1,'t1',$1,$2,$3)",[old.formation,JSON.stringify(old.starters),JSON.stringify(old.bench)]);const history=(await f.db.query('SELECT * FROM fanta.lineups')).rows[0];await f.db.query("INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline) VALUES('fanta-lucas-a',2,2,$1)",[new Date(stamp+7200000).toISOString()]);
  let c=await f.connect();try{await c.query('BEGIN');assert.equal((await writeAutoLineups(c,{now:stamp})).saved,2);await c.query('COMMIT');}finally{c.release();}await f.db.query("UPDATE fanta.lineups SET source_data='{}',formation=$1,starters=$2,bench=$3 WHERE round=2 AND team_id='t1'",[old.formation,JSON.stringify(old.starters),JSON.stringify(old.bench)]);c=await f.connect();try{await c.query('BEGIN');const r=await writeAutoLineups(c,{now:stamp+60000});assert.equal(r.saved,0);assert.equal(r.manual,1);assert.equal(r.unchanged,1);await c.query('COMMIT');}finally{c.release();}assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups WHERE round=1')).rows[0],history);
 }finally{await f.close();}
});
test('repair release phase blocks purchases, refunds only selected credits, undo restores balance and phase closure locks releases',async()=>{
 const f=await fixtureDb();try{const store=sqlFantaStore(f);await store.league('u1','fanta-lucas-a',async(s,c)=>{for(const mode of ['live','manual']){
   let next=auctionAction(s,'start-now',{mode,type:'riparazione'},'u1',{admin:true,now:stamp});assert.equal(next.auction.phase,'releases');assert.throws(()=>auctionAction(next,'nominate',{playerId:'free'},'u1',{admin:true,now:stamp}),/svincoli/);
   const owner=next.teams[0],p=owner.roster[0],before=teamBudget(owner,next.rules).credits;next=auctionAction(next,'release',{playerId:p.id,refund:0},'u1',{admin:true,now:stamp});assert.equal(teamBudget(next.teams[0],next.rules).credits,before);assert.ok(!next.teams[0].roster.some(x=>x.id===p.id));next=auctionAction(next,'release-undo',{playerId:p.id},'u1',{admin:true,now:stamp});assert.equal(teamBudget(next.teams[0],next.rules).credits,before);assert.equal(next.teams[0].roster.find(x=>x.id===p.id).price,p.price);
   next=auctionAction(next,'releases-done',{},'u1',{admin:true,now:stamp});assert.equal(next.auction.phase,'bidding');assert.throws(()=>auctionAction(next,'release',{playerId:p.id,refund:0},'u1',{admin:true,now:stamp}),/chiusa/);
  }});
 }finally{await f.close();}
});
test('roster corrections enforce membership, budget and roles and preserve closed lineups during DB persistence',async()=>{
 const f=await fixtureDb();try{const store=sqlFantaStore(f);await f.db.query("UPDATE fanta.rounds SET deadline='2000-01-01'");const l=f.lineup('t1');await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES('fanta-lucas-a',1,'t1',$1,$2,$3)",[l.formation,JSON.stringify(l.starters),JSON.stringify(l.bench)]);const before=(await f.db.query('SELECT * FROM fanta.lineups')).rows;
  await store.league('u1','fanta-lucas-a',async(s,c)=>{assert.throws(()=>rosterAction(s,'remove',{teamId:'t1',playerId:l.starters[0]},'u2'),/presidente/);assert.throws(()=>rosterAction(s,'add',{teamId:'t1',playerId:'free',price:500},'u1'),/budget/);const next=rosterAction(s,'move',{teamId:'t1',playerId:l.starters[0],toTeamId:'t2',price:4},'u1');await store.persistRoster(c,s,next,{actor:'u1',kind:'move',input:{}});},{write:true});
  assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups')).rows,before);assert.equal((await f.db.query('SELECT team_id,price FROM fanta.rosters WHERE player_id=$1',[l.starters[0]])).rows[0].team_id,'t2');assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.roster_changes')).rows[0].n,1);
 }finally{await f.close();}
});
test('a purchased player can be released, restored, released again and purchased by another team with exact SQL balances and immutable sale history',async()=>{
 const f=await fixtureDb();try{const store=sqlFantaStore(f),api=createFantaApi({store,env:{FANTA_BETA_USERS:'frankwood'}}),call=async(path,p,token='token1')=>{const response=await api(new Request('https://example.test/fanta-api/'+path,{method:p?'POST':'GET',headers:{cookie:'sid='+token},...(p?{body:JSON.stringify({league:'fanta-lucas-a',...p})}:{})}));return {status:response.status,data:await response.json()};};
  await call('auction/start-now',{mode:'manual',type:'iniziale'});await call('auction/table',{playerId:'free'});const bought=await call('auction/assign',{playerId:'free',teamId:'t1',price:8});assert.equal(bought.status,200);const original=bought.data.log[0].id,balance=bought.data.teams.find(t=>t.team.id==='t1').credits;await call('auction/close',{});assert.equal((await call('auction/start-now',{mode:'manual',type:'riparazione'})).data.phase,'releases');
  assert.equal((await call('auction/assigned?league=fanta-lucas-a',null,'token2')).status,403);assert.equal((await call('auction/release',{playerId:'free',refund:1},'token2')).status,403);
  let released=await call('auction/release',{playerId:'free',refund:1});assert.equal(released.status,200);assert.equal(released.data.teams.find(t=>t.team.id==='t1').credits,balance+1);assert.equal((await f.db.query('SELECT released FROM fanta.sales WHERE id=$1',[original])).rows[0].released,true);
  const undo=await call('auction/release-undo',{playerId:'free'});assert.equal(undo.status,200);assert.equal(undo.data.teams.find(t=>t.team.id==='t1').credits,balance);assert.equal((await f.db.query('SELECT released FROM fanta.sales WHERE id=$1',[original])).rows[0].released,false);
  await call('auction/release',{playerId:'free',refund:4});await call('auction/releases-done',{});await call('auction/table',{playerId:'free'});const second=await call('auction/assign',{playerId:'free',teamId:'t2',price:3});assert.equal(second.status,200);assert.equal(second.data.teams.find(t=>t.team.id==='t1').credits,balance+4);assert.equal((await f.db.query("SELECT count(*)::int n FROM fanta.sales WHERE player_id='free'")).rows[0].n,2);assert.equal((await call('auction/undo',{saleId:original})).status,409);
 }finally{await f.close();}
});

test('one repair auction confirmation releases players across teams atomically and preserves imported entries on undo',async()=>{
 const f=await fixtureDb();
 try{
  const store=sqlFantaStore(f),api=createFantaApi({store,env:{FANTA_BETA_USERS:'frankwood'}});
  const call=async(path,body,token='token1')=>{
   const response=await api(new Request('https://example.test/fanta-api/auction/'+path,{
    method:'POST',headers:{cookie:'sid='+token},body:JSON.stringify({league:'fanta-lucas-a',...body}),
   }));
   return {status:response.status,data:await response.json()};
  };
  const {rows:[imported]}=await f.db.query(`INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price,data)
   VALUES('fanta-lucas-a','t1','legacy-keeper','Portiere importato','P',12,'{"club":"Squadra storica"}') RETURNING *`);
  const started=await call('start-now',{mode:'manual',type:'riparazione'});
  assert.equal(started.data.phase,'releases');
  const first=started.data.teams.find(t=>t.team.id==='t1'),second=started.data.teams.find(t=>t.team.id==='t2');
  const p=second.releaseRoster.find(player=>player.price>=1);
  const payload={batchId:started.data.releaseBatchId,requestId:'release-test-1',entries:[
   {teamId:'t1',playerId:'legacy-keeper',refund:5},{teamId:'t2',playerId:p.id,refund:1},
  ]};
  const invalid={...payload,entries:[payload.entries[0],{...payload.entries[1],refund:p.price+1}]};
  assert.equal((await call('release-batch',invalid)).status,400);
  assert.equal((await call('release-batch',payload,'token2')).status,403);
  assert.equal((await call('release-batch',{...payload,batchId:'stale'})).status,409);
  assert.equal((await f.db.query("SELECT count(*)::int n FROM fanta.roster_entries WHERE source_id='legacy-keeper'")).rows[0].n,1);
  const confirmed=await call('release-batch',payload);
  assert.equal(confirmed.status,200);
  assert.equal(confirmed.data.version,started.data.version+1);
  assert.equal(confirmed.data.teams.find(t=>t.team.id==='t1').roles.P.have,first.roles.P.have-1);
  assert.equal(confirmed.data.teams.find(t=>t.team.id==='t1').credits,first.credits+5);
  assert.equal(confirmed.data.teams.find(t=>t.team.id==='t2').credits,second.credits+1);
  assert.equal(confirmed.data.teams.find(t=>t.team.id==='t2').roles[p.role].have,second.roles[p.role].have-1);
  assert.equal((await call('release-batch',payload)).data.version,confirmed.data.version);
  assert.equal((await f.db.query("SELECT count(*)::int n FROM fanta.roster_changes WHERE kind='release-batch'")).rows[0].n,1);
  assert.equal((await f.db.query("SELECT count(*)::int n FROM fanta.roster_entries WHERE source_id='legacy-keeper'")).rows[0].n,0);
  const undo=await call('release-undo',{playerId:'legacy-keeper'});
  assert.equal(undo.status,200);
  assert.equal(undo.data.teams.find(t=>t.team.id==='t1').credits,first.credits);
  assert.deepEqual((await f.db.query("SELECT * FROM fanta.roster_entries WHERE source_id='legacy-keeper'")).rows[0],imported);
  const spectator=await api(new Request('https://example.test/fanta-api/auction?league=fanta-lucas-a',{headers:{cookie:'sid=token2'}}));
  assert.ok((await spectator.json()).teams.every(t=>!Object.hasOwn(t,'releaseRoster')));
 }finally{await f.close();}
});
