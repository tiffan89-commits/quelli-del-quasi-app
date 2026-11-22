import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb,apiFixture} from './fanta/helpers.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';
import {renderHome} from '../public/src/fanta/home.mjs';import {renderLega} from '../public/src/fanta/lega.mjs';import {renderSquadra} from '../public/src/fanta/squadra.mjs';
import {renderGiornata} from '../public/src/fanta/giornata.mjs';import {renderIo} from '../public/src/fanta/io.mjs';import {renderAsta} from '../public/src/fanta/asta.mjs';
import {ingestFixture} from '../fanta/ingest.mjs';
const env={FANTA_BETA_USERS:'frankwood',FANTA_BETA_LEAGUES:'fanta-lucas-a'};
test('auction ticks use read cache until an authoritative timer transition is due',async()=>{
 const f=await fixtureDb();try{let time=Date.now(),writes=0;const base=sqlFantaStore(f),store={...base,league:(uid,id,fn,options={})=>{if(options.write)writes++;return base.league(uid,id,fn,options);}},api=createFantaApi({store,env,now:()=>time}),call=async(path,body={})=>{const r=await api(new Request('https://example.test/fanta-api/'+path,{method:'POST',headers:{cookie:'sid=token1'},body:JSON.stringify({league:'fanta-lucas-a',...body})}));assert.equal(r.status,200,await r.clone().text());return r.json();};
  await call('auction/start-now',{mode:'manual',type:'iniziale'});writes=0;for(let i=0;i<3;i++)await call('auction/tick');assert.equal(writes,0);
  await call('auction/mode',{mode:'live',type:'iniziale'});writes=0;const before=await call('auction/tick');assert.equal(writes,0);time+=61000;const after=await call('auction/tick');assert.equal(writes,1);assert.ok(after.version>before.version);assert.ok(after.skipped);
 }finally{await f.close();}
});
test('Fanta: real SQL schema enforces membership cap; all routes enforce server beta and league membership',async()=>{
 const f=await fixtureDb();try{
 const api=createFantaApi({store:sqlFantaStore(f),env}),call=(route,token='token1',body)=>api(new Request('https://example.test/fanta-api/'+route,{method:body?'POST':'GET',headers:{cookie:'sid='+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));
 assert.equal((await(await call('me','token2')).json()).access,'full');assert.equal((await(await call('me','')).json()).access,'demo');
 for(const route of ['leagues','home?league=fanta-lucas-a','auction?league=fanta-lucas-a'])assert.equal((await call(route,'token2')).status,200);
 await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");assert.equal((await call('auction?league=fanta-lucas-a','token2')).status,403);
 assert.equal((await call('home?league=other')).status,403);for(let i=3;i<=12;i++)await f.db.query('INSERT INTO fanta.teams(id,league_id,name,manager) VALUES($1,$2,$1,$1)',['t'+i,'fanta-lucas-a']);
 await assert.rejects(f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES('t13','fanta-lucas-a','13','13')"),/completo/);
 }finally{await f.close();}
});
test('Studio Live returns the chosen matchup and the whole round in one scoped read',async t=>{
 const f=await fixtureDb();t.after(f.close);
 const base=sqlFantaStore(f),reads=[];
 const store={...base,league:(uid,id,fn,options)=>base.league(uid,id,(state,c)=>{
  if(options.roundOnly)reads.push({number:options.number,lineups:state.lineups,matchups:state.matchups});
  return fn(state,c);
 },options)};
 const api=createFantaApi({store,env,now:()=>Date.parse('2026-11-22')});
 const league='fanta-lucas-a',query='league='+league+'&number=1';
 const call=(route,token='token1')=>api(new Request('https://example.test/fanta-api/'+route,{headers:{cookie:'sid='+token}}));
 const get=async route=>{const response=await call(route);assert.equal(response.status,200,await response.clone().text());return response.json();};
 await f.db.query("INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline) VALUES($1,2,2,'2099-01-08')",[league]);
 await f.db.query("INSERT INTO fanta.matchups(id,league_id,round,home_id,away_id) VALUES('m2',$1,2,'t2','t1')",[league]);
 const {formation,starters,bench}=f.lineup('t1');
 for(const number of [1,2])await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES($1,$2,'t1',$3,$4,$5)",[league,number,formation,JSON.stringify(starters),JSON.stringify(bench)]);
 const studio=await get('studio?'+query);
 assert.equal(reads.length,1);
 assert.deepEqual(reads[0].matchups.map(m=>m.id),['m1']);
 assert.equal(reads[0].lineups.find(l=>l.round===2).starters.length,0);
 assert.equal(studio.round.rounds.find(r=>r.number===2).state,'schierata');
 assert.equal(studio.matchup.home.starters.length,11);
 assert.deepEqual(studio,{round:await get('round?'+query),matchup:await get('matchup?'+query+'&id=m1')});
 assert.equal((await get('studio?'+query+'&id=m2')).matchup,null);
 assert.equal((await call('studio?'+query,'invalid')).status,403);
});
test('standalone Fanta identity updates the shared league without allowing members to edit',async t=>{
 const f=await fixtureDb();t.after(f.close);
 const updates=[],api=createFantaApi({store:sqlFantaStore(f),env}),league='fanta-lucas-a';
 const call=(path,token,body)=>api(new Request('https://example.test/fanta-api/'+path,{
  method:body?'POST':'GET',headers:{cookie:'sid='+token},body:body?JSON.stringify(body):undefined,
 }),{leagueUpdate:event=>updates.push(event)});
 const branding={name:'Coppa degli amici 🏆',accent:'#b699ff',emblem:'CA',motto:'Ogni punto conta'};
 assert.equal((await call('league/identity','token2',{league,branding})).status,403);
 const saved=await call('league/identity','token1',{league,branding});
 assert.equal(saved.status,200,await saved.clone().text());
 const [view]=await (await call('leagues','token2')).json();
 assert.equal(view.name,branding.name);
 assert.equal(view.accent,branding.accent);
 assert.deepEqual(view.branding,{emblem:branding.emblem,motto:branding.motto});
 assert.equal(updates.length,1);
 assert.deepEqual({...updates[0],recipients:updates[0].recipients.toSorted()},{league,change:'fanta-identity',recipients:['u1','u2']});
});
test('manual Fanta reminder validates the intended coach and builds the lineup deep link',async t=>{
 const f=await fixtureDb();t.after(f.close);
 const league='fanta-lucas-a',competition=league+':main',sent=[];
 await f.db.query("UPDATE fanta.competitions SET status='active' WHERE id=$1",[competition]);
 const api=createFantaApi({store:sqlFantaStore(f),env,sendSubmissionReminder:(channel,message,target)=>{sent.push({channel,message,target});return {ok:true};}});
 const call=(token,channel)=>api(new Request('https://example.test/fanta-api/league/reminder',{method:'POST',headers:{cookie:'sid='+token},
  body:JSON.stringify({league,competition,round:1,uid:'u2',channel})}));
 assert.equal((await call('token2','email')).status,403);
 const pushed=await call('token1','push');
 assert.equal(pushed.status,200,await pushed.clone().text());
 assert.equal(sent[0].target.user.id,'u2');
 assert.equal(sent[0].message.url,'/#/fanta/squadra/studio?lega=fanta-lucas-a&giornata=1&competizione=fanta-lucas-a%3Amain');
 const {formation,starters,bench}=f.lineup('t2');
 await f.db.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES($1,1,$2,$3,$4,$5)',[league,'t2',formation,JSON.stringify(starters),JSON.stringify(bench)]);
 assert.equal((await call('token1','email')).status,409);
 assert.equal(sent.length,1);
});
test('Fanta: native API satisfies delivered home, league, lineup and team contracts without modifying the Bar blob',async()=>{
 const f=await fixtureDb();try{const original=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;
 const api=createFantaApi({store:sqlFantaStore(f),env}),call=(route,body)=>api(new Request('https://example.test/fanta-api/'+route,{method:body?'POST':'GET',headers:{cookie:'sid=token1','content-type':'application/json'},body:body?JSON.stringify(body):undefined}));
 let response=await call('lineup',{league:'fanta-lucas-a',round:1,...f.lineup('t1')});assert.equal(response.status,200,await response.clone().text());
 assert.equal((await call('lineup',{league:'fanta-lucas-a',round:1,...f.lineup('t2')})).status,400);
 const home=await(await call('home?league=fanta-lucas-a')).json();assert.ok(renderHome(home).includes('Squadra 1'));
 const league=await(await call('league?league=fanta-lucas-a')).json();for(const sub of ['classifica','calendario','regole','partecipanti','asta'])assert.doesNotThrow(()=>renderLega(league,{sub}));
 const round=await(await call('round?league=fanta-lucas-a&number=1')).json(),matchup=await(await call('matchup?league=fanta-lucas-a&number=1&id=m1')).json();for(const view of ['lista','campo'])assert.doesNotThrow(()=>renderGiornata({round,matchup,side:'home',view}));
 assert.doesNotThrow(()=>renderIo({user:{username:'frankwood',name:'Test'},settings:{notify:{}}},[league.league],league.league.id));
 const auction=await(await call('auction?league=fanta-lucas-a')).json();assert.doesNotThrow(()=>renderAsta({...auction,status:'ended'}));
 const team=await(await call('team?league=fanta-lucas-a')).json();assert.equal(team.lineup.starters.length,11);assert.doesNotThrow(()=>renderSquadra({data:team,draft:{formation:'4-4-2',slots:{},bench:[]},sub:'rosa'}));
 await f.db.query("UPDATE fanta.rounds SET deadline='2000-01-01' WHERE league_id='fanta-lucas-a'");assert.equal((await call('lineup',{league:'fanta-lucas-a',round:1,...f.lineup('t1')})).status,200);
 assert.equal((await call('lineup',{league:'fanta-lucas-a',round:1,...f.lineup('t1'),bench:[...f.lineup('t1').bench].reverse()})).status,409);
 assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload,original);
 }finally{await f.close();}
});
test('Fanta: versioned votes finalize after three postmatch reads; frozen official votes never change',async()=>{
 const f=await fixtureDb();let stamp=Date.parse('2026-11-01T14:00:00Z');try{
 const complete=apiFixture();for(const t of complete.players)for(const p of t.players){p.statistics[0].passes={total:20,accuracy:18,key:0};p.statistics[0].tackles={total:1,interceptions:0};}
 for(let i=0;i<3;i++){await ingestFixture(complete,{connect:f.connect,env:{FANTA_SEASON:'2026'},now:()=>stamp,ai:async()=>null});stamp+=21*60000;}
 const first=(await f.db.query("SELECT data FROM fanta.votes WHERE official AND player_id='af:2'")).rows;assert.equal(first.length,1);assert.equal(first[0].data.events.conceded,1);assert.ok((await f.db.query("SELECT frozen_at FROM fanta.fixtures WHERE id='af:777'")).rows[0].frozen_at);
 const changed=apiFixture();changed.players[1].players[0].statistics[0].goals.saves=20;assert.equal((await ingestFixture(changed,{connect:f.connect,now:()=>stamp})).cached,true);assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.votes WHERE official')).rows[0].n,22);
 }finally{await f.close();}
});

test('Fanta: only the president can link a beta account, and one user cannot own two teams in the same league',async()=>{
 const f=await fixtureDb();try{const api=createFantaApi({store:sqlFantaStore(f),env:{FANTA_BETA_USERS:'frankwood,amico'}}),call=(body,token='token1')=>api(new Request('https://example.test/fanta-api/team/link',{method:'POST',headers:{cookie:'sid='+token},body:JSON.stringify({league:'fanta-lucas-a',...body})}));
 assert.equal((await call({team:'t2',username:'amico'},'token2')).status,403);
 await f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES('new','fanta-lucas-a','Altra squadra','Allenatore')");
 assert.equal((await call({team:'new',username:'frankwood'})).status,409);
 await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");assert.equal((await call({team:'t2',username:'amico'})).status,200);
 assert.equal((await f.db.query("SELECT user_id FROM fanta.teams WHERE id='t2'")).rows[0].user_id,'u2');
 }finally{await f.close();}
});

test('Fanta: saves and reloads an empty or partial bench without filling it or enforcing obsolete caps',async()=>{
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET rules=rules||'{\"benchMax\":1}'::jsonb WHERE id='fanta-lucas-a'");
  const api=createFantaApi({store:sqlFantaStore(f),env}),base=f.lineup('t1');
  for(const n of [0,1,3,4]){const response=await api(new Request('https://example.test/fanta-api/lineup',{method:'POST',headers:{cookie:'sid=token1','content-type':'application/json'},body:JSON.stringify({league:'fanta-lucas-a',round:1,...base,bench:base.bench.slice(0,n)})}));assert.equal(response.status,200,await response.clone().text());const saved=(await f.db.query("SELECT bench FROM fanta.lineups WHERE league_id='fanta-lucas-a' AND team_id='t1' AND round=1")).rows[0];assert.deepEqual(saved.bench,base.bench.slice(0,n));}
  const view=await(await api(new Request('https://example.test/fanta-api/team?league=fanta-lucas-a',{headers:{cookie:'sid=token1'}}))).json();assert.equal(view.rules.benchMax,null);
 }finally{await f.close();}
});
