import test from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import {EventEmitter} from 'node:events';
import {io as client} from 'socket.io-client';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';
import {attachAuctionSocket} from '../runtime/auction-socket.mjs';
import {createHash} from 'node:crypto';

const waitFor=(check,ms=3000)=>new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(check()){clearInterval(timer);resolve();}else if(Date.now()-start>ms){clearInterval(timer);reject(Error('Socket condition timed out'));}},10);});
test('Socket.IO pushes committed snapshots, isolates rooms, acknowledges all peers and restores the newest state after reconnect',async()=>{
 const f=await fixtureDb(),bus=new EventEmitter(),base=sqlFantaStore(f),server=http.createServer((req,res)=>res.end('test')),sockets=[];let hub;
 const store={...base,league:async(uid,id,fn,options)=>{const result=await base.league(uid,id,fn,options);if(options?.write)bus.emit('change',id);return result;}};
 try{
  const users=Array.from({length:4},(_,i)=>({id:'u'+(i+3),username:'socket-player-'+(i+3),name:'Socket participant '+(i+3),emailVerified:true})),sessions=users.map(u=>({uid:u.id,token:createHash('sha256').update('token'+u.id.slice(1)).digest('hex'),expires:Date.now()+3600000}));
  await f.db.query("UPDATE fanta_state SET payload=jsonb_set(jsonb_set(payload,'{users}',payload->'users'||$1::jsonb),'{sessions}',payload->'sessions'||$2::jsonb)",[JSON.stringify(users),JSON.stringify(sessions)]);
  for(const u of users)await f.db.query('INSERT INTO fanta.teams(id,league_id,user_id,name,manager) VALUES($1,$2,$3,$4,$4)',['t'+u.id.slice(1),'fanta-lucas-a',u.id,u.name]);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  hub=await attachAuctionSocket(server,{store,origin,subscribe:change=>{bus.on('change',change);return()=>bus.off('change',change);},log(){}});
  const api=createFantaApi({store}),call=async(route,input={})=>{const r=await api(new Request(origin+'/fanta-api/'+route,{method:'POST',headers:{cookie:'sid=token1'},body:JSON.stringify({league:'fanta-lucas-a',...input})}));assert.equal(r.status,200,await r.clone().text());return r.json();};
  const connect=(token,league='fanta-lucas-a',site=origin)=>{const s=client(origin,{transports:['websocket'],auth:{league},extraHeaders:{Origin:site,Cookie:'sid='+token},forceNew:true,reconnection:false});s.last=null;s.on('auction:update',(msg,ack)=>{s.last=msg.data;ack({version:msg.data.version});});sockets.push(s);return s;};
  const peers=Array.from({length:6},(_,i)=>connect('token'+(i+1))),[a,b]=peers;await waitFor(()=>peers.every(s=>s.last));assert.equal(a.last.me,'t1');assert.equal(b.last.me,'t2');assert.ok(peers.every(s=>s.last.version===a.last.version));
  const denied=connect('invalid');await new Promise(r=>denied.once('connect_error',r));assert.equal(denied.connected,false);
  const wrong=connect('token2','another-league');await new Promise(r=>wrong.once('connect_error',r));assert.equal(wrong.connected,false);
  const hostile=connect('token1','fanta-lucas-a','https://hostile.test');await new Promise(r=>hostile.once('connect_error',r));assert.equal(hostile.connected,false);
  let state=await call('auction/start-now',{mode:'manual',type:'iniziale'});await waitFor(()=>peers.every(s=>s.last.version===state.version));
  state=await call('auction/table',{playerId:'free'});await waitFor(()=>peers.every(s=>s.last.table?.id==='free'));assert.ok(peers.every(s=>s.last.version===a.last.version));assert.equal(b.last.isAdmin,false);
  await waitFor(()=>hub.stats()[0]?.acknowledged===6);
  b.disconnect();state=await call('auction/assign',{playerId:'free',teamId:'t1',price:5});await waitFor(()=>a.last.version===state.version);
  b.last=null;b.connect();await waitFor(()=>b.last?.version===state.version);assert.equal(b.last.teams.find(t=>t.team.id==='t1').spent,a.last.teams.find(t=>t.team.id==='t1').spent);assert.equal(b.last.lastSale.player.id,'free');
  const stamp=await new Promise((resolve,reject)=>a.timeout(1000).emit('auction:clock',(err,data)=>err?reject(err):resolve(data)));assert.ok(Math.abs(Date.now()-Date.parse(stamp.serverTime))<500);
 }finally{for(const s of sockets)s.disconnect();if(hub)await hub.close();else await new Promise(r=>server.close(r));await f.close();}
});

test('server advances an auction deadline without any connected client or client tick',async()=>{
 const f=await fixtureDb(),bus=new EventEmitter(),base=sqlFantaStore(f),server=http.createServer((req,res)=>res.end()),store={...base,league:async(uid,id,fn,options)=>{const result=await base.league(uid,id,fn,options);if(options?.write)bus.emit('change',id);return result;}};let hub;
 try{
  await f.db.query("UPDATE fanta.leagues SET rules=rules||'{\"callSeconds\":0.15}' WHERE id='fanta-lucas-a'");
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  hub=await attachAuctionSocket(server,{store,origin,subscribe:cb=>{bus.on('change',cb);return()=>bus.off('change',cb);},log(){}});
  const api=createFantaApi({store}),r=await api(new Request(origin+'/fanta-api/auction/start-now',{method:'POST',headers:{cookie:'sid=token1'},body:JSON.stringify({league:'fanta-lucas-a',mode:'live',type:'iniziale'})}));assert.equal(r.status,200);const started=await r.json();
  await waitFor(()=>hub.stats()[0]?.version>started.version);assert.equal(hub.stats()[0].devices,0);
  const saved=(await f.db.query("SELECT data FROM fanta.auctions WHERE league_id='fanta-lucas-a'")).rows[0].data;assert.ok(saved.skipped);assert.ok(saved.version>started.version);
 }finally{if(hub)await hub.close();else await new Promise(r=>server.close(r));await f.close();}
});

test('a mixed auction records a computer counterbid and pushes it to two distinct players',async()=>{
 const f=await fixtureDb(),bus=new EventEmitter(),base=sqlFantaStore(f),server=http.createServer((req,res)=>res.end()),sockets=[];let hub;
 const store={...base,league:async(uid,id,fn,options)=>{const result=await base.league(uid,id,fn,options);if(options?.write)bus.emit('change',id);return result;}};
 try{
  await f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES('t3','fanta-lucas-a','Real Divano','Computer')");
  await f.db.query(`UPDATE fanta.players SET data='{"value":100}' WHERE id='free'`);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  hub=await attachAuctionSocket(server,{store,origin,subscribe:change=>{bus.on('change',change);return()=>bus.off('change',change);},log(){}});
  for(const token of ['token1','token2']){
   const socket=client(origin,{transports:['websocket'],auth:{league:'fanta-lucas-a'},extraHeaders:{Origin:origin,Cookie:'sid='+token},forceNew:true,reconnection:false});
   socket.on('auction:update',(msg,ack)=>{socket.last=msg.data;ack({version:msg.data.version});});sockets.push(socket);
  }
  await waitFor(()=>sockets.every((s,i)=>s.last?.me==='t'+(i+1)));
  const api=createFantaApi({store}),call=async(route,input,token='token1')=>api(new Request(origin+'/fanta-api/auction/'+route,{method:'POST',headers:{cookie:'sid='+token},body:JSON.stringify({league:'fanta-lucas-a',...input})}));
  const response=await call('start-now',{mode:'live',type:'iniziale',computerTeams:true});assert.equal(response.status,200);const started=await response.json();
  assert.equal(started.singlePlayer,false);assert.equal(started.computerTeamsActive,true);
  if(started.caller!=='t3')assert.equal((await call('nominate',{playerId:'free',amount:1},'token'+started.caller.slice(1))).status,200);
  await waitFor(()=>sockets.every(s=>s.last?.lot?.player.id==='free'),12000);
  const first=sockets[0].last.lot;
  if(first.leader==='t3'&&first.history.length===1)assert.equal((await call('bid',{lotId:first.id,amount:2},'token2')).status,200);
  assert.equal((await call('bid',{lotId:first.id,amount:100,computerTeam:'t3'},'invalid-token')).status,403);
  await waitFor(()=>sockets.every(s=>s.last?.lot?.history.some(h=>h.team==='t3'&&!h.call&&!h.pass)),12000);
  const [a,b]=sockets.map(s=>s.last);
  assert.equal(a.version,b.version);assert.deepEqual(a.lot,b.lot);assert.equal(a.lot.leader,'t3');assert.equal(a.lot.timerSeconds,30);
  assert.equal(Date.parse(a.lot.endsAt)-Date.parse(a.lot.history.at(-1).at),30000);
  await waitFor(()=>hub.stats()[0]?.acknowledged===2);
  const rows=(await f.db.query("SELECT kind,lot_id,data FROM fanta.auction_actions WHERE actor='computer' AND kind='bid'")).rows;
  assert.deepEqual(rows,[{kind:'bid',lot_id:a.lot.id,data:{source:'computer',teamId:'t3',lotId:a.lot.id,amount:a.lot.bid}}]);
 }finally{for(const s of sockets)s.disconnect();if(hub)await hub.close();else await new Promise(r=>server.close(r));await f.close();}
});
