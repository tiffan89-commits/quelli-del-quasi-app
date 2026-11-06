import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../netlify/functions/api.mjs';
import {emptyState} from '../lib/db.mjs';
import {decodeMail} from '../lib/mail.mjs';
import {inviteInfo} from '../lib/public-area.mjs';
test('anonymous landing/features need no DB; wrong-email correction requires the original password and revokes old links',async()=>{
 const s=emptyState(),env={RESEND_API_KEY:'synthetic-mail-key',APP_BASE_URL:'https://example.test',ENABLE_DEMO:'false'},client={query:async()=>({rows:[{attempts:1}]})};let reads=0;
 const api=createApi({transact:async fn=>{reads++;return fn(s,client);},read:fn=>{reads++;return fn(s);},env,deliverMail:async()=> 'queued'});
 const call=(path,p)=>api(new Request('https://example.test/api/'+path,{method:p?'POST':'GET',headers:p?{'Content-Type':'application/json'}:{},body:p?JSON.stringify(p):undefined}),{ip:'127.0.0.1'});
 assert.deepEqual(await(await call('features')).json(),{barDemo:true});assert.equal((await(await call('state')).json()).user,null);assert.equal(reads,0);
 const registration={email:'sbagliata@example.test',password:'Password-sintetica!'};
 assert.equal((await call('register',registration)).status,200);
 const token=()=>new URL(decodeMail(s.mailOutbox.at(-1),env).text.match(/https:\/\/example\.test\/account\.html#[^\s]+/)[0]).hash.slice(1);
 const old=new URLSearchParams(token()).get('token');
 assert.equal((await call('register',{...registration,email:'corretta@example.test',correctEmail:true,previousEmail:registration.email,password:'Sbagliata-sintetica!'})).status,400);
 assert.equal((await call('register',{...registration,email:'corretta@example.test',correctEmail:true,previousEmail:registration.email})).status,200);assert.equal(s.users.length,1);assert.equal(s.users[0].username,undefined);
 const current=new URLSearchParams(token()).get('token');assert.notEqual(current,old);
 assert.equal((await call('activate',{token:old})).status,400);
 const login=await(await call('login',{email:'corretta@example.test',password:registration.password})).json();assert.equal(login.pendingVerification,true);assert.equal(login.identity,'corretta@example.test');
 assert.equal((await call('activate',{token:current})).status,200);assert.equal(s.users[0].email,'corretta@example.test');
 assert.equal((await call('register',{...registration,email:'altro@example.test',correctEmail:true,previousEmail:registration.email})).status,400);
});
test('public invite preview returns only safe display fields and limits enumeration',async()=>{
 let attempts=1,queries=0;const connect=async()=>({query:async sql=>{queries++;return sql.startsWith('INSERT')?{rows:[{attempts}]}:{rows:[{league:'Il bar',inviter:'Il mister',members:8,email:'must-not-leak'}]};},release(){}});
 const result=await inviteInfo('abc123',{connect,ip:'synthetic'});assert.deepEqual(result.data,{code:'ABC123',league:'Il bar',inviter:'Il mister',members:8,maxMembers:null});
 attempts=31;assert.equal((await inviteInfo('ABC123',{connect})).status,429);queries=0;assert.equal((await inviteInfo('<bad>',{connect})).status,404);assert.equal(queries,0);
});
