import test from 'node:test';
import assert from 'node:assert/strict';
import {watchAuction,auctionClockOffset} from '../public/src/fanta/auction-watch.mjs';
import {createHash} from 'node:crypto';
import {fixtureDb} from './fanta/helpers.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {createFantaApi} from '../fanta/api.mjs';
import {parseHTML} from 'linkedom';
import {mountFanta} from '../public/src/fanta/app.mjs';
import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';

test('room discovery sees another participant opening and changing an auction, using one small read',async()=>{
 const f=await fixtureDb();try{
  let reads=0;const connect=async()=>{const c=await f.connect();return {...c,query:(...a)=>{reads++;return c.query(...a);}};};
  const store=sqlFantaStore({connect}),api=createFantaApi({store});
  const call=(token,path,body)=>api(new Request('https://example.test/fanta-api/'+path,{headers:{cookie:'sid='+token},...(body?{method:'POST',body:JSON.stringify(body)}:{})}));
  const status=()=>call('token2','auction/status?league=fanta-lucas-a');
  const initial=await status();assert.equal(initial.status,200);assert.equal((await initial.json()).status,'none');assert.equal(reads,1);
  assert.equal((await call('invalid','auction/status?league=fanta-lucas-a')).status,403);
  assert.equal((await call('token2','auction/status?league=other')).status,403);
  assert.equal((await call('token1','auction/start-now',{league:'fanta-lucas-a',mode:'manual',type:'iniziale'})).status,200);
  reads=0;const live=await(await status()).json();assert.equal(live.status,'running');assert.equal(live.mode,'manual');assert.equal(reads,1);
  const notices=(await f.db.query("SELECT user_id,data FROM fanta.notifications WHERE kind='auction'")).rows;assert.equal(notices.length,2);assert.deepEqual(notices.map(n=>n.user_id).sort(),['u1','u2']);assert.ok(notices.every(n=>n.data.url.includes('#/fanta/asta')));
  await call('token1','auction/tick',{league:'fanta-lucas-a'});assert.equal((await f.db.query("SELECT count(*)::int n FROM fanta.notifications WHERE kind='auction'")).rows[0].n,2);
  assert.ok(!('teams'in live));assert.ok(!('players'in live));assert.ok(JSON.stringify(live).length<500);
  assert.equal((await call('token1','auction/table',{league:'fanta-lucas-a',playerId:'free'})).status,200);
  const updated=await(await status()).json();assert.ok(updated.version>live.version);
  assert.equal((await call('token1','auction/close',{league:'fanta-lucas-a'})).status,200);assert.equal((await(await status()).json()).status,'ended');
 }finally{await f.close();}
});

test('discovery starts immediately, polls every second, resumes and drops stale or overlapping replies',async()=>{
 let interval,resolve,calls=0,opened=0,stopped=false,ctx={active:true,league:'a'};
 const watch=watchAuction({context:()=>ctx,read:()=>{calls++;return new Promise(r=>resolve=r);},onRunning:()=>opened++,setTimer:(fn,ms)=>{assert.equal(ms,1000);interval=fn;return 9;},clearTimer:id=>{assert.equal(id,9);stopped=true;}});
 assert.equal(calls,1);await interval();assert.equal(calls,1);
 ctx={active:true,league:'b'};resolve({status:'running',version:1});await new Promise(r=>setImmediate(r));assert.equal(opened,0);
 const next=watch.check();resolve({status:'running',version:2});await next;assert.equal(opened,1);
 ctx.active=false;await interval();assert.equal(calls,2);
 ctx.active=true;const final=watch.check();watch.stop();resolve({status:'running',version:3});await final;assert.equal(opened,1);assert.equal(stopped,true);
});

test('an auction only updates its banner; unrelated versions preserve the page and entry requires a click',async()=>{
 const {window,document}=parseHTML('<html><head></head><body><div id="app"></div><div id="v2-sheet-root" hidden></div></body></html>');
 const keys=['Event','window','document','location','history','localStorage','scrollTo','requestAnimationFrame','setInterval','clearInterval'],old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),checks=[];
 Object.assign(globalThis,{Event:window.Event,window,document,location:{hash:'',pathname:'/',search:''},history:{pushState(){},replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},scrollTo(){},requestAnimationFrame:fn=>fn(),setInterval:(fn,ms)=>{if(fn.name==='check')checks.push(fn);return 1;},clearInterval(){}});
 let instance;const settle=()=>new Promise(r=>setImmediate(r));
 try{
  const base=createDemoFantaApi({delay:0,fullRosters:false});await base.auctionClose('lega-quasi');let reads=0;
  const api={...base,auctionStatus:async id=>{const a=await base.auction(id);return {status:a.status,startsAt:a.startsAt,version:a.version};},auction:async id=>{reads++;return {...await base.auction(id),isAdmin:false};}},root=document.getElementById('app');
  instance=mountFanta(root,{api,initialTab:'oggi'});await instance.ready;await settle();assert.ok(root.querySelector('.fanta-home'));
  const home=root.querySelector('.fanta-home');
  await base.auctionStartNow('lega-quasi','manual',undefined,{type:'iniziale'});await checks[0]();await settle();
  assert.equal(root.querySelector('.fanta-home'),home);assert.equal(reads,0);
  const banner=home.querySelector('[data-go="asta"]');assert.ok(banner);assert.equal(home.querySelectorAll('[data-go="asta"]').length,1);
  const players=await base.auctionPlayers('lega-quasi');await base.auctionTable('lega-quasi',players[0].id);await checks[0]();
  assert.equal(home.querySelector('[data-go="asta"]'),banner);assert.equal(reads,0);
  banner.dispatchEvent(new window.Event('click',{bubbles:true}));await settle();assert.ok(root.querySelector('.fanta-asta'));assert.ok(reads>0);
  instance.destroy();location.hash='#/fanta/asta';reads=0;instance=mountFanta(root,{api});await instance.ready;await settle();assert.ok(reads>0);assert.ok(root.querySelector('.fanta-asta'));
 }finally{instance?.destroy();for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});

test('all six participants receive identical version, price and deadlines after each bid, with 60/60/30 timers',async()=>{
 const f=await fixtureDb();try{
  let stamp=Date.now();const users=Array.from({length:4},(_,i)=>({id:'u'+(i+3),username:'participant'+(i+3),name:'Participant '+(i+3),emailVerified:true})),sessions=users.map(u=>({uid:u.id,token:createHash('sha256').update('token'+u.id.slice(1)).digest('hex'),expires:stamp+3600000}));
  await f.db.query("UPDATE fanta_state SET payload=jsonb_set(jsonb_set(payload,'{users}',payload->'users'||$1::jsonb),'{sessions}',payload->'sessions'||$2::jsonb)",[JSON.stringify(users),JSON.stringify(sessions)]);
  for(const u of users)await f.db.query('INSERT INTO fanta.teams(id,league_id,user_id,name,manager) VALUES($1,$2,$3,$4,$4)',['t'+u.id.slice(1),'fanta-lucas-a',u.id,u.name]);
  const api=createFantaApi({store:sqlFantaStore(f),now:()=>stamp});
  const call=async(n,route,body={})=>{const response=await api(new Request('https://example.test/fanta-api/'+route,{method:'POST',headers:{cookie:'sid=token'+n},body:JSON.stringify({league:'fanta-lucas-a',...body})}));assert.equal(response.status,200,await response.clone().text());return response.json();};
  const peers=async()=>{const all=await Promise.all(Array.from({length:6},(_,i)=>call(i+1,'auction/tick')));const view=a=>({version:a.version,status:a.status,caller:a.caller,deadline:a.callDeadline,lot:a.lot});for(const a of all)assert.deepEqual(view(a),view(all[0]));return all[0];};
  let a=await call(1,'auction/start-now',{mode:'live',type:'iniziale'});assert.equal(Date.parse(a.callDeadline)-stamp,60000);await peers();
  a=await call(Number(a.caller.slice(1)),'auction/nominate',{playerId:'free',amount:1});assert.equal(Date.parse(a.lot.endsAt)-stamp,60000);await peers();
  for(let n=2;n<=6;n++){
   stamp+=1000;const bidder=a.lot.leader==='t'+n?1:n;a=await call(bidder,'auction/bid',{lotId:a.lot.id,amount:a.lot.bid+1});assert.equal(Date.parse(a.lot.endsAt)-stamp,30000);assert.equal(a.lot.timerSeconds,30);await peers();
  }
 }finally{await f.close();}
});

test('server deadline display compensates device clock skew and round-trip latency',()=>{
 const server=Date.parse('2026-11-05T20:00:00Z');
 for(const skew of [-180000,0,240000]){const sent=server+skew,received=sent+200,offset=auctionClockOffset(new Date(server+100).toISOString(),sent,received);assert.equal(received+offset,server+200);}
 assert.equal(auctionClockOffset('invalid',1,2),0);
});
