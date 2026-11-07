import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';import {teamLogo,logoSvg,normalizeLogo} from '../public/src/fanta/team-logo.mjs';import {auctionAction} from '../fanta/auction.mjs';
test('team logos persist designs and optimized images, enforce size/type and ownership, and stay lazy in views',async()=>{
 const f=await fixtureDb();try{const api=createFantaApi({store:sqlFantaStore(f),env:{FANTA_BETA_USERS:'frankwood'}}),call=(path,body,token='token1')=>api(new Request('https://example.test/fanta-api/'+path,{method:body?'POST':'GET',headers:{cookie:'sid='+token},body:body?JSON.stringify({league:'fanta-lucas-a',...body}):undefined}));
  let r=await call('team/logo',{type:'design',design:{shape:'hexagon',symbol:'monkey',text:'FLY',caption:'Quasi <forti>'}});assert.equal(r.status,200);let branding=(await r.json()).branding;assert.equal(branding.design.shape,'hexagon');assert.equal((await call('team/logo',{team:'t2',type:'design',design:{shape:'circle'}})).status,403);assert.ok(!logoSvg(branding.design).includes('<forti>'));
  const team=await(await call('team?league=fanta-lucas-a')).json();assert.equal(team.team.branding.design.text,'FLY');assert.match(teamLogo(team.team),/svg/);
  r=await call('team/logo',{type:'image',image:'data:image/png;base64,'+'a'.repeat(350000)});assert.equal(r.status,413);
  assert.equal((await call('team/logo',{type:'image',image:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
  const png=await fs.readFile(new URL('../public/assets/icons/icon-192.png',import.meta.url));assert.ok(png.length<250*1024);r=await call('team/logo',{type:'image',image:'data:image/png;base64,'+png.toString('base64')});assert.equal(r.status,200);branding=(await r.json()).branding;
  r=await call('team/logo',{name:'Real Divano'});assert.equal(r.status,200);assert.deepEqual((await r.json()).branding,branding);
  const image=await call(branding.imageUrl.replace('/fanta-api/',''));assert.equal(image.status,200);assert.ok(Number(image.headers.get('content-length')||1)>0);assert.match(image.headers.get('content-type'),/^image\//);
  assert.equal((await call(branding.imageUrl.replace('/fanta-api/',''),null,'unknown')).status,403);assert.match(teamLogo({name:'Team',branding}),/loading="lazy"/);assert.ok(!JSON.stringify(branding).includes(png.toString('base64')));
  await call('team/logo',{type:'design',design:{shape:'circle'}});assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.team_logos')).rows[0].n,0);
 }finally{await f.close();}
});
test('members can rename only their own team before the first kickoff across league competitions',async()=>{
 const f=await fixtureDb();
 try{
  const kickoff='2026-11-07T14:00:00.000Z',deadline=Date.parse(kickoff);let clock=deadline-1;
  const api=createFantaApi({store:sqlFantaStore(f),now:()=>clock});
  const call=(path,body)=>api(new Request('https://example.test/fanta-api/'+path,{method:body?'POST':'GET',headers:{cookie:'sid=token2'},body:body?JSON.stringify({league:'fanta-lucas-a',...body}):undefined}));
  await f.db.query("INSERT INTO fanta.competitions(id,league_id,name,kind,status,start_round) VALUES('cup','fanta-lucas-a','Coppa','knockout','active',2)");
  await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff) VALUES('first-cup',901,2026,2,$1)",[kickoff]);
  const home=await (await call('home?league=fanta-lucas-a')).json();assert.equal(home.teamNameDeadline,kickoff);
  assert.equal((await call('team/logo',{team:'t1',name:'Altro Nome'})).status,403);
  assert.equal((await call('team/logo',{name:'squàdra 1'})).status,409);
  assert.equal((await call('team/logo',{name:'x'})).status,400);
  const renamed=await call('team/logo',{name:'  Atlético   Poco  ',type:'design',design:{shape:'circle'}});
  assert.equal(renamed.status,200);assert.equal((await renamed.json()).name,'Atlético Poco');
  clock=deadline;
  assert.equal((await call('team/logo',{name:'Nuovo Nome',type:'design',design:{shape:'hexagon'}})).status,409);
  const row=(await f.db.query("SELECT name,branding FROM fanta.teams WHERE id='t2'")).rows[0];
  assert.equal(row.name,'Atlético Poco');assert.equal(row.branding.design.shape,'circle');
  const logoOnly=await call('team/logo',{type:'design',design:{shape:'hexagon'}});
  assert.equal(logoOnly.status,200);assert.equal((await logoOnly.json()).branding.design.shape,'hexagon');
 }finally{await f.close();}
});
test('a president can open a physical auction immediately with complete rosters; every linked player can watch, but cannot assign',async()=>{
 const f=await fixtureDb();try{const store=sqlFantaStore(f),env={FANTA_BETA_USERS:'frankwood'},api=createFantaApi({store,env}),call=(path,p,token='token1')=>api(new Request('https://example.test/fanta-api/'+path,{method:p?'POST':'GET',headers:{cookie:'sid='+token},body:p?JSON.stringify({league:'fanta-lucas-a',...p}):undefined}));
  assert.equal((await call('auction/start-now',{mode:'manual',type:'iniziale'},'token2')).status,403);let started=await(await call('auction/start-now',{mode:'manual',type:'iniziale'})).json();assert.equal(started.status,'running');assert.equal(started.mode,'manual');
  const watched=await(await call('auction?league=fanta-lucas-a',null,'token2')).json();assert.equal(watched.status,'running');assert.equal(watched.isAdmin,false);assert.equal((await call('auction/assign',{playerId:'free',teamId:'t2',price:1},'token2')).status,403);
  assert.equal((await call('auction/table',{playerId:'free'})).status,200);assert.equal((await call('auction/assign',{playerId:'free',teamId:'t2',price:1})).status,200);
  assert.equal((await call('auction/close',{})).status,200);
  await f.db.query(`INSERT INTO fanta.players VALUES('free-online',1999,'c1','Libero online','D','{}')`);
  const online=await(await call('auction/start-now',{mode:'live',type:'iniziale'})).json(),caller=online.caller==='t1'?'token1':'token2',bidder=caller==='token1'?'token2':'token1';
  const lot=await(await call('auction/nominate',{playerId:'free-online',amount:1},caller)).json();assert.ok(lot.lot?.id);const bid=await call('auction/bid',{lotId:lot.lot.id,amount:2},bidder);assert.equal(bid.status,200);assert.equal((await bid.json()).lot.leader,caller==='token1'?'t2':'t1');
  await store.league('u1','fanta-lucas-a',s=>{for(const t of s.teams){for(const [role,max]of Object.entries(s.rules.roster)){while(t.roster.filter(p=>p.role===role).length<max)t.roster.push({id:t.id+'-'+t.roster.length,role,price:1});}}s.auction.status='none';const opened=auctionAction(s,'start-now',{mode:'manual',type:'iniziale'},'u1',{admin:true});assert.equal(opened.auction.status,'running');});
 }finally{await f.close();}
});

test('president can cancel or close an occupied table without selling; other players cannot and stale cancellations are rejected',async()=>{
 const f=await fixtureDb();try{const store=sqlFantaStore(f),api=createFantaApi({store,env:{FANTA_BETA_USERS:'frankwood'}}),call=(path,p,token='token1')=>api(new Request('https://example.test/fanta-api/'+path,{method:'POST',headers:{cookie:'sid='+token},body:JSON.stringify({league:'fanta-lucas-a',...p})}));
  await call('auction/start-now',{mode:'manual',type:'iniziale'});await call('auction/table',{playerId:'free'});assert.equal((await call('auction/cancel-lot',{playerId:'free'},'token2')).status,403);
  assert.equal((await call('auction/cancel-lot',{playerId:'other'})).status,409);assert.equal((await call('auction/cancel-lot',{playerId:'free'})).status,200);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.rosters WHERE player_id='free'")).rows[0].n,0);await call('auction/table',{playerId:'free'});const closed=await(await call('auction/close',{})).json();assert.equal(closed.status,'ended');assert.equal(closed.table,null);assert.equal(closed.lot,null);assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.sales')).rows[0].n,0);
  await store.league('u1','fanta-lucas-a',s=>{const original=structuredClone(s.teams),lot={id:'expired',player:s.players.find(p=>p.id==='free'),leader:'t1',bid:1,endsAt:'2000-01-01T00:00Z',history:[]};s.auction={...s.auction,status:'running',mode:'live',caller:'t1',lot,table:null};const stopped=auctionAction(s,'close',{},'u1',{admin:true});assert.deepEqual(stopped.teams,original);assert.equal(stopped.auction.lot,null);const cancelled=auctionAction(s,'cancel-lot',{lotId:'expired',playerId:'free'},'u1',{admin:true});assert.equal(cancelled.auction.status,'running');assert.deepEqual(cancelled.teams,original);assert.equal(cancelled.auction.caller,'t1');assert.equal(cancelled.auction.cancellations.at(-1).playerId,'free');});
 }finally{await f.close();}
});
