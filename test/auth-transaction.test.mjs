import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {authTransaction,transaction,emptyState} from '../lib/db.mjs';import {createApi} from '../netlify/functions/api.mjs';import {hash,userFor} from '../lib/game.mjs';import {decodeMail} from '../lib/mail.mjs';

test('background game work does not lock authentication while waiting and preserves newer sessions',async()=>{
 const db=new PGlite();try{await db.exec(await fs.readFile(new URL('../netlify/database/migrations/001_initial.sql',import.meta.url),'utf8'));await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(emptyState())]);
  const queries=[],connect=async()=>({query:(sql,...p)=>{queries.push(sql);return db.query(sql,...p);},release(){}});
  await transaction(async(s,c)=>{assert.ok(queries.some(q=>q.includes('pg_advisory_xact_lock')));assert.ok(!queries.some(q=>q.includes('FOR UPDATE')));s.football.custom='new-data';await c.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{sessions}',$1)",[JSON.stringify([{token:'new-session'}])]);},{connect});
  const state=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(state.football.custom,'new-data');assert.equal(state.sessions[0].token,'new-session');
  await assert.rejects(transaction(async(s,c)=>{s.users.push({id:'game'});await c.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{users}',$1)",[JSON.stringify([{id:'newer-auth'}])]);},{connect}),e=>e.status===409);
 }finally{await db.close();}
});
test('login, logout and administrator MFA use only auth fields and preserve heavy game data',async()=>{
 const db=new PGlite();try{await db.exec(await fs.readFile(new URL('../netlify/database/migrations/001_initial.sql',import.meta.url),'utf8'));
  const salt='synthetic-salt',password='Synthetic-only-password!',users=[{id:'p',username:'tester',name:'Test',emailVerified:true,password:hash(password,salt),salt},{id:'a',username:'tiffano',role:'system-admin',adminOnly:true,password:hash(password,salt),salt}];
  const football={large:'fixture'.repeat(150000)},rewards={keep:['synthetic']};await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify({users,sessions:[],football,playerRewards:rewards,systemAdminId:'a',leagues:[{id:'keep'}]})]);
  const connect=async()=>({query:(...args)=>db.query(...args),release(){}});let fullCalls=0,authCalls=0,mailCalls=0;
  const authTransact=fn=>authTransaction(async(s,c)=>{authCalls++;assert.equal(s.football,undefined);assert.equal(s.playerRewards,undefined);assert.equal(s.leagues,undefined);assert.ok(JSON.stringify(s).length<20000);return fn(s,c);},{connect});
  const env={RESEND_API_KEY:'test-only-key',MAIL_FROM:'Test <test@example.test>',APP_BASE_URL:'https://example.test'},api=createApi({transact:async()=>{fullCalls++;throw Error('full blob forbidden');},authTransact,env,deliverMail:async args=>{mailCalls++;assert.equal(args.transactionFn,authTransact);return 'sent';}});
  const call=(route,body,cookie='')=>api(new Request('https://example.test/api/'+route,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)}));
  assert.equal((await call('login',{username:'tester',password:'wrong'})).status,401);
  const login=await call('login',{username:'tester',password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],token=cookie.slice(4);
  let state=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(userFor(state,token).id,'p');assert.equal(state.users[0].lastLoginAt!=null,true);
  assert.equal((await call('logout',{},cookie)).status,200);state=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(userFor(state,token),undefined);
  const challengeResponse=await call('admin-login',{username:'tiffano',password});assert.equal(challengeResponse.status,200);const challenge=await challengeResponse.json();assert.equal(challenge.requireAdminCode,true);assert.equal(mailCalls,1);
  state=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;const code=decodeMail(state.mailOutbox[0],env).text.match(/\b\d{8}\b/)[0];
  const verified=await call('admin-verify',{challenge:challenge.challenge,code});assert.equal(verified.status,200);const adminToken=verified.headers.get('set-cookie').split(';')[0].slice(4);state=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(userFor(state,adminToken).id,'a');assert.deepEqual(state.football,football);assert.deepEqual(state.playerRewards,rewards);assert.deepEqual(state.leagues,[{id:'keep'}]);assert.equal(fullCalls,0);assert.equal(authCalls,5);
 }finally{await db.close();}
});
test('an auth failure responds without retrying a full game transaction to log the error',async()=>{
 let calls=0;const api=createApi({transact:async()=>{calls++;throw Error('forbidden');},authTransact:async()=>{throw Object.assign(Error('busy'),{status:503});}});
 const response=await api(new Request('https://example.test/api/login',{method:'POST',body:'{}'}));assert.equal(response.status,503);assert.equal(calls,0);
});

test('registration, verification and recovery use light transactions, persist tokens, and retry safely',async()=>{
 const db=new PGlite();try{await db.exec(await fs.readFile(new URL('../netlify/database/migrations/001_initial.sql',import.meta.url),'utf8'));
  const heavy={unchanged:'large fixture'.repeat(100000)};await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify({...emptyState(),football:heavy})]);
  const connect=async()=>({query:(...args)=>db.query(...args),release(){}}),env={RESEND_API_KEY:'synthetic-mail-key',APP_BASE_URL:'https://example.test'};let full=0;
  const api=createApi({env,transact:async()=>{full++;throw Error('Heavy game path');},authTransact:fn=>authTransaction((s,c)=>{assert.equal(s.football,undefined);return fn(s,c);},{connect}),deliverMail:async()=> 'queued'});
  const call=(route,body,cookie='')=>api(new Request('https://example.test/api/'+route,{method:'POST',headers:{cookie},body:JSON.stringify(body)}));
  const profile={username:'TestFlow',name:'Test Flow',email:'flow@example.test',password:'Synthetic-only-password!',requestId:'register-request-1234'};
  assert.equal((await call('register',profile)).status,200);assert.equal((await call('register',profile)).status,200);
  let s=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(s.users.length,1);assert.equal(s.accountTokens.length,1);assert.equal(s.mailOutbox.length,1);
  const raw=job=>new URLSearchParams(decodeMail(job,env).text.match(/https:\/\/\S+/)[0].split('#')[1]).get('token');
  const activation={token:raw(s.mailOutbox[0]),requestId:'activate-request-1234'};assert.equal((await call('activate',activation)).status,200);assert.equal((await call('activate',activation)).status,200);
  const old=await call('login',{username:profile.email,password:profile.password});assert.equal(old.status,200);const cookie=old.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('forgot-password',{identity:profile.email,requestId:'recovery-request-1234'})).status,200);
  s=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;const token=s.accountTokens.find(t=>t.purpose==='reset'),job=s.mailOutbox.find(j=>j.id===token.mailId),reset={token:raw(job),password:'Updated-only-password!',requestId:'reset-request-123456'};
  assert.equal((await call('reset-password',reset)).status,200);assert.equal((await call('reset-password',reset)).status,200);
  assert.equal((await call('login',{username:profile.username,password:profile.password})).status,401);assert.equal((await call('login',{username:profile.email,password:reset.password})).status,200);
  s=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(userFor(s,cookie.slice(4)),undefined);assert.deepEqual(s.football,heavy);assert.equal(full,0);assert.ok(!JSON.stringify(s).includes(reset.password));
 }finally{await db.close();}
});
