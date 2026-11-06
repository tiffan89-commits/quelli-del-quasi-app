import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {Server} from 'socket.io';import {io as client} from 'socket.io-client';
import {attachSportsSocket,sportsIdentities} from '../runtime/sports-socket.mjs';import {createSportsPush} from '../public/src/sports-push.mjs';import {fixtureDb} from './fanta/helpers.mjs';
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
 const updates=[once(a,'sports:update'),once(b,'sports:update')];await Promise.all(updates);assert.equal(reads,2);
 for(const p of peers)p.disconnect();await new Promise(r=>setTimeout(r,30));assert.equal(hub.stats().rooms,0);assert.equal(hub.stats().clients,0);
 }finally{for(const p of peers)p.disconnect();await hub.close();await new Promise(r=>io.close(r));}
});
test('sports client uses push only, drops stale contexts, and never creates an HTTP poll',async()=>{
 const sockets=[],timers=[],doc={hidden:false,addEventListener(){},removeEventListener(){}},win={addEventListener(){},removeEventListener(){}};let c={mode:'bar',league:'one'},applied=[];
 const factory=async()=> (_url,options)=>{const handlers=new Map(),socket={options,on:(k,v)=>handlers.set(k,v),removeAllListeners:()=>{},disconnect(){},fire:(k,m)=>handlers.get(k)?.(m)};sockets.push(socket);return socket;};
 const stream=createSportsPush({context:()=>c,apply:data=>applied.push(data),factory,doc,win,setTimer:fn=>{timers.push(fn);return 1;},clearTimer(){}});stream.start();await new Promise(r=>setImmediate(r));assert.equal(sockets.length,1);assert.deepEqual(sockets[0].options.transports,['websocket']);
 sockets[0].fire('sports:update',{context:c,revision:'1',data:{score:1}});sockets[0].fire('sports:update',{context:c,revision:'1',data:{score:1}});assert.equal(applied.length,1);c={mode:'bar',league:'two'};await stream.wake();sockets[0].fire('sports:update',{context:{mode:'bar',league:'one'},revision:'2',data:{score:99}});assert.equal(applied.length,1);sockets[1].fire('sports:update',{context:c,revision:'2',data:{score:2}});assert.equal(applied[1].score,2);stream.stop();
});
