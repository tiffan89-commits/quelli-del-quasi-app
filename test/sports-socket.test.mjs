import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {Server} from 'socket.io';import {io as client} from 'socket.io-client';
import {attachSportsSocket,sportsIdentities} from '../runtime/sports-socket.mjs';import {createSportsPush} from '../public/src/sports-push.mjs';import {fixtureDb} from './fanta/helpers.mjs';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {listenSportsSaved,notifySportsSaved} from '../runtime/sports-notifications.mjs';
import {parseHTML} from 'linkedom';
import {mergeLiveSnapshot} from '../public/src/live-channel.mjs';
import {patchSlipResults} from '../public/src/slip-results.mjs';
const once=(s,event)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Missing '+event)),3000);s.once(event,v=>{clearTimeout(t);resolve(v);});});
test('session revalidation is a single SQL projection for all viewers and observes revocation',async()=>{
 const f=await fixtureDb();try{let queries=0;const connect=async()=>{const c=await f.connect();return {...c,query:(...args)=>{queries++;return c.query(...args);}};};const users=await sportsIdentities(['token1','token2','invalid'],{connect});assert.equal(queries,1);assert.equal(users.size,2);assert.equal(users.get('token1').id,'u1');assert.deepEqual(Object.keys(users.get('token1')).sort(),['expires','id','username']);await f.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{sessions}','[]')");assert.equal((await sportsIdentities(['token1','token2'],{connect})).size,0);}finally{await f.close();}
});
test('sports push shares one DB read across all viewers, catches up reconnects, and rejects outsiders',async()=>{
 const server=http.createServer(),io=new Server(server,{transports:['websocket']}),s={league:{id:'l'},rules:{},teams:[{id:'a',name:'A',roster:[],userId:'u1'},{id:'b',name:'B',roster:[],userId:'u2'}],rounds:[{number:1,seriea_round:1,deadline:'2026-01-01'}],matchups:[{id:'m',round:1,home_id:'a',away_id:'b'}],players:[],fixtures:[],lineups:[],votes:[],results:[]};let reads=0,release;
 const hub=attachSportsSocket(io,{identify:async token=>({id:token,expires:Date.now()+60000}),store:{league:async(uid,id,fn)=>{reads++;if(reads===1)await new Promise(r=>release=r);return fn(s);}},intervalMs:200});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port,open=(id,round=1)=>client(url+'/sports',{transports:['websocket'],auth:{mode:'fanta',league:'l',round,matchup:'m'},extraHeaders:{cookie:'sid='+id},reconnection:false});const peers=[];
 try{const a=open('u1'),b=open('u2');peers.push(a,b);const first=[once(a,'sports:update'),once(b,'sports:update')];while(!release)await new Promise(r=>setImmediate(r));release();await Promise.all(first);assert.equal(reads,1);
 const c=open('u1');peers.push(c);const snap=await once(c,'sports:update');assert.equal(snap.data.round.matchups[0].isMine,true);assert.equal(reads,1);
 const outsider=open('stranger');peers.push(outsider);await once(outsider,'disconnect');assert.equal(reads,1);
 const updates=[once(a,'sports:update'),once(b,'sports:update')];s.rounds[0].official=true;await Promise.all(updates);assert.equal(reads,2);
 for(const p of peers)p.disconnect();await new Promise(r=>setTimeout(r,30));assert.equal(hub.stats().rooms,0);assert.equal(hub.stats().clients,0);
 }finally{for(const p of peers)p.disconnect();await hub.close();await new Promise(r=>io.close(r));}
});
test('sports client uses push only, drops stale contexts, and never creates an HTTP poll',async()=>{
 const sockets=[],timers=[],doc={hidden:false,addEventListener(){},removeEventListener(){}},win={addEventListener(){},removeEventListener(){}};let c={mode:'bar',league:'one'},applied=[],lineups=[];
 const factory=async()=> (_url,options)=>{const handlers=new Map(),socket={options,connected:true,on:(k,v)=>handlers.set(k,v),removeAllListeners:()=>{},disconnect(){},fire:(k,m)=>handlers.get(k)?.(m),
  timeout:()=>({emitWithAck:async(event,payload)=>{assert.equal(event,'sports:lineup');return payload;}})};sockets.push(socket);return socket;};
 const stream=createSportsPush({context:()=>c,apply:data=>applied.push(data),applyLineups:data=>lineups.push(data),factory,doc,win,setTimer:fn=>{timers.push(fn);return 1;},clearTimer(){}});stream.start();await new Promise(r=>setImmediate(r));assert.equal(sockets.length,1);assert.deepEqual(sockets[0].options.transports,['websocket']);
 const update={id:'seriea:2026:12:4',revision:'2026-11-22T11:06:01.000Z'};
 sockets[0].fire('sports:lineup-saved',[update]);
 assert.deepEqual(lineups,[[update]]);
 assert.deepEqual(await stream.requestLineup(update.id,update.revision),update);
 sockets[0].fire('sports:update',{context:c,revision:'1',data:{score:1}});sockets[0].fire('sports:update',{context:c,revision:'1',data:{score:1}});assert.equal(applied.length,1);c={mode:'bar',league:'two'};await stream.wake();sockets[0].fire('sports:update',{context:{mode:'bar',league:'one'},revision:'2',data:{score:99}});assert.equal(applied.length,1);sockets[1].fire('sports:update',{context:c,revision:'2',data:{score:2}});assert.equal(applied[1].score,2);stream.stop();
});

test('Squadra receives the next formation window after the committed Serie A update',async()=>{
 const server=http.createServer(),io=new Server(server,{transports:['websocket']});
 const previous={number:3,deadline:'2026-11-21T14:00:00Z',started:true,open:false,official:false};
 const next={number:4,deadline:'2026-11-27T19:45:00Z',started:false,open:true,official:false};
 let status=previous,reads=0;
 const hub=attachSportsSocket(io,{identify:async id=>({id,expires:Date.now()+60000}),store:{async teamLineupWatch(league,competition){
  assert.equal(league,'l');assert.equal(competition,'main');reads++;
  return {members:['u1','u2'],lineupRound:status};
 }}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const open=id=>client('http://127.0.0.1:'+server.address().port+'/sports',{transports:['websocket'],auth:{mode:'fanta-lineup',league:'l',competition:'main'},extraHeaders:{cookie:'sid='+id},reconnection:false});
 const members=['u1','u2'].map(open),outsider=open('outsider');
 try{
  const [a,b]=await Promise.all([...members.map(s=>once(s,'sports:update')),once(outsider,'disconnect')]);
  assert.deepEqual([a.data,b.data],[{lineupRound:previous},{lineupRound:previous}]);
  assert.equal(reads,1);
  const updates=members.map(s=>once(s,'sports:update'));
  status=next;
  await hub.refresh('bar');
  assert.deepEqual((await Promise.all(updates)).map(m=>m.data),[{lineupRound:next},{lineupRound:next}]);
  assert.equal(reads,2);
 }finally{[...members,outsider].forEach(s=>s.disconnect());await hub.close();await new Promise(resolve=>io.close(resolve));}
});

test('committed results wake all viewers immediately without per-device reads or waiting a minute',async()=>{
 const server=http.createServer(),io=new Server(server,{transports:['websocket']}),s={league:{id:'l'},rules:{},teams:[{id:'a',name:'A',roster:[],userId:'u1'},{id:'b',name:'B',roster:[],userId:'u2'}],rounds:[{number:1,seriea_round:1,deadline:'2026-01-01'}],matchups:[{id:'m',round:1,home_id:'a',away_id:'b'}],players:[],fixtures:[],lineups:[],votes:[],results:[]};let reads=0;
 const hub=attachSportsSocket(io,{identify:async token=>({id:token,expires:Date.now()+60000}),store:{league:async(uid,id,fn)=>{reads++;return fn(s);}},intervalMs:60000});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const peers=['u1','u2'].map(id=>client('http://127.0.0.1:'+server.address().port+'/sports',{transports:['websocket'],auth:{mode:'fanta',league:'l',round:1,matchup:'m'},extraHeaders:{cookie:'sid='+id},reconnection:false}));
 try{await Promise.all(peers.map(p=>once(p,'sports:update')));assert.equal(reads,1);const old=Date.now();s.rounds[0].official=true;const updates=peers.map(p=>once(p,'sports:update'));await hub.refresh();await Promise.all(updates);assert.equal(reads,2);assert.ok(Date.now()-old<2000);}finally{peers.forEach(p=>p.disconnect());await hub.close();await new Promise(r=>io.close(r));}
});

test('sports room refreshes use one database connection at a time',async()=>{
 const server=http.createServer(),io=new Server(server,{transports:['websocket']});
 let active=0,peak=0,reads=0;
 const hub=attachSportsSocket(io,{
  identify:async token=>({id:token,expires:Date.now()+60000}),
  store:{async league(uid,id,fn){
   reads++;
   peak=Math.max(peak,++active);
   await new Promise(resolve=>setTimeout(resolve,15));
   active--;
   return fn({league:{id},teams:[{id:'t',userId:uid}],rounds:[{number:1,deadline:'2026-01-01'}],matchups:[],fixtures:[],results:[],lineups:[]});
  }},
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const peers=['a','b','c'].map(id=>client('http://127.0.0.1:'+server.address().port+'/sports',{
  transports:['websocket'],auth:{mode:'fanta',league:id,round:1},extraHeaders:{cookie:'sid='+id},reconnection:false,
 }));
 try{
  await Promise.all(peers.map(peer=>once(peer,'sports:update')));
  await hub.refresh();
  assert.equal(reads,6);
  assert.equal(peak,1);
 }finally{peers.forEach(peer=>peer.disconnect());await hub.close();await new Promise(resolve=>io.close(resolve));}
});

test('official XI save reaches open Bar clients over Socket.IO without refreshing the shared sports snapshot',async()=>{
 const server=http.createServer(),io=new Server(server,{transports:['websocket']});
 const id='seriea:2026:12:4',revision='2026-11-22T11:06:01.000Z';
 const lineup={id,lineupRevision:revision,lineups:{kind:'official',updatedAt:revision,teams:[]}};
 const users=['one','two'].map(id=>({id,emailVerified:true}));
 const sessions=users.map(({id})=>({uid:id,token:createHash('sha256').update(id).digest('hex'),expires:Date.now()+60000}));
 const state={users,sessions,leagues:[{id:'l',members:users.map(({id})=>({uid:id,credits:100}))}],rounds:[],football:{calendar:{rounds:[{matches:[{id}]}]}}};
 let snapshots=0,reads=0,finishRead;
 const hub=attachSportsSocket(io,{
  identify:async token=>({id:token,expires:Date.now()+60000}),
  read:async fn=>{snapshots++;return fn(state);},
  readLineup:async requested=>{
   assert.equal(requested,id);reads++;
   await new Promise(resolve=>{finishRead=resolve;});
   return lineup;
  },
 });
 const receiver=Object.assign(new EventEmitter(),{query:async()=>{},release(){}});
 const listener=listenSportsSaved(hub.refresh,{lineupsSaved:hub.lineupsSaved,connect:async()=>receiver});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const peers=users.map(({id})=>client('http://127.0.0.1:'+server.address().port+'/sports',{
  transports:['websocket'],auth:{mode:'bar',league:'l'},extraHeaders:{cookie:'sid='+id},reconnection:false,
 }));
 try{
  await Promise.all(peers.map(peer=>once(peer,'sports:update')));
  const pending=peers.map(peer=>once(peer,'sports:lineup-saved'));
  await notifySportsSaved({lineups:[{id,revision}],connect:async()=>({
   query:async(_sql,[payload])=>receiver.emit('notification',{channel:'quasi_sports_saved',payload}),release(){},
  })});
  assert.deepEqual(await Promise.all(pending),peers.map(()=>[{id,revision}]));
  assert.equal(snapshots,1);
  const acks=peers.map(peer=>peer.timeout(2000).emitWithAck('sports:lineup',{id,revision}));
  assert.deepEqual(await Promise.all(peers.map(peer=>peer.timeout(2000).emitWithAck('sports:lineup',{id:'unrelated'}))),[null,null]);
  finishRead();
  assert.deepEqual(await Promise.all(acks),[lineup,lineup]);
  assert.equal(reads,1);
 }finally{peers.forEach(peer=>peer.disconnect());await listener.close();await hub.close();await new Promise(resolve=>io.close(resolve));}
});

test('a Bar kickoff committed during an in-flight snapshot is pushed immediately with a fresh read',async()=>{
 const server=http.createServer(),io=new Server(server,{transports:['websocket']});
 const id='seriea:2026:12:4',uid='viewer',match={id,status:'NS',kickoff:'2026-11-22T11:30:00Z'};
 const state={users:[{id:uid,emailVerified:true}],
  sessions:[{uid,token:createHash('sha256').update(uid).digest('hex'),expires:Date.now()+60000}],
  leagues:[{id:'l',members:[{uid,credits:100}]}],rounds:[],football:{calendar:{rounds:[{matches:[match]}]}}};
 const {document}=parseHTML(`<main><article data-match-card="${id}"><span data-inline-result></span></article><input id="stake" value="12"></main>`);
 const page=document.querySelector('main'),row=page.querySelector('article'),stake=page.querySelector('#stake');
 const ticket={matches:[{...match}]},clientState={leagues:[{id:'l',members:[],rounds:[ticket]}]};
 let reads=0;
 const {promise:firstRead,resolve:reading}=Promise.withResolvers();
 const {promise:resume,resolve:finish}=Promise.withResolvers();
 const hub=attachSportsSocket(io,{
  identify:async token=>({id:token,expires:Date.now()+60000}),
  async read(fn,options){
   assert.deepEqual(options,{kind:'live',league:'l',fresh:true});
   const snapshot=structuredClone(state);
   if(++reads===1){reading();await resume;}
   return fn(snapshot);
  },
 });
 const receiver=Object.assign(new EventEmitter(),{query:async()=>{},release(){}});
 const listener=listenSportsSaved(hub.refresh,{lineupsSaved:hub.lineupsSaved,connect:async()=>receiver});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const peer=client('http://127.0.0.1:'+server.address().port+'/sports',{
  transports:['websocket'],auth:{mode:'bar',league:'l'},extraHeaders:{cookie:'sid='+uid},reconnection:false,
 });
 try{
  const notified=new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Kickoff not received over Socket.IO')),3000);
   peer.on('sports:update',({data})=>{mergeLiveSnapshot(clientState,data);patchSlipResults(page,ticket,{},false);
    const update=data.calendar[0];if(update.status==='LIVE'){clearTimeout(timeout);resolve(update);}});
  });
  await firstRead;
  Object.assign(match,{status:'LIVE',liveScore:[0,0],clock:"1'"});
  await notifySportsSaved({barOnly:true,connect:async()=>({
   query:async(_sql,[payload])=>receiver.emit('notification',{channel:'quasi_sports_saved',payload}),release(){},
  })});
  finish();
  const update=await notified;
  assert.deepEqual(update.liveScore,[0,0]);
  assert.equal(update.clock,"1'");
  assert.equal(document.querySelector('main'),page);
  assert.equal(page.querySelector('article'),row);
  assert.equal(page.querySelector('#stake'),stake);
  assert.equal(stake.value,'12');
  assert.match(row.textContent,/LIVE.*0 – 0.*1'/);
  assert.equal(reads,2);
 }finally{finish();peer.disconnect();await listener.close();await hub.close();await new Promise(resolve=>io.close(resolve));}
});
