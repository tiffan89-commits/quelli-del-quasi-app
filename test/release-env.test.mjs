import test from'node:test';import assert from'node:assert/strict';import{randomBytes}from'node:crypto';
import{appEnv,isProduction,schedulesEnabled,recipientAllowed}from'../lib/release-env.mjs';
import{queueMail,sendMail}from'../lib/mail.mjs';import{deliverChatPush}from'../lib/league-chat.mjs';
import{deliverLeagueReminders}from'../lib/league-reminders.mjs';
const preview={CONTEXT:'deploy-preview',BRANCH:'feature/test',STAGING_EMAIL_ALLOWLIST:'allowed@example.test'};
test('context mapping fails closed and schedules require explicit opt-in outside production',()=>{
 assert.equal(appEnv({CONTEXT:'production'}),'production');assert.equal(appEnv({CONTEXT:'branch-deploy',BRANCH:'staging'}),'staging');for(const CONTEXT of ['','dev','deploy-preview','unknown'])assert.equal(appEnv({CONTEXT}),'preview');assert.equal(isProduction(preview),false);assert.equal(schedulesEnabled(preview),false);assert.equal(schedulesEnabled({...preview,STAGING_ENABLE_SCHEDULES:'1'}),true);assert.equal(schedulesEnabled({CONTEXT:'production'}),true);assert.equal(recipientAllowed(' ALLOWED@example.test ',preview),true);assert.equal(recipientAllowed('other@example.test',preview),false);
});
test('email blocks unlisted recipients before network and filters cc/bcc as well',async()=>{
 const env={...preview,APP_BASE_URL:'https://preview.example.test',RESEND_API_KEY:randomBytes(32).toString('hex')},s={},logs=[],original=console.info;console.info=x=>logs.push(x);
 try{
 const id=queueMail(s,{to:['other@example.test'],subject:'Test',text:'Not sent'},env);let calls=0;assert.equal((await sendMail(s.mailOutbox.find(x=>x.id===id),()=>{calls++;throw Error('network forbidden');},env)).blocked,true);assert.equal(calls,0);assert.ok(logs.some(x=>x.includes('NONPRODUCTION_DELIVERY_BLOCKED')));assert.ok(logs.every(x=>!x.includes('other@example.test')));
 const second=queueMail(s,{to:['allowed@example.test','other@example.test'],cc:['other@example.test'],bcc:['allowed@example.test'],text:'Test'},env);await sendMail(s.mailOutbox.find(x=>x.id===second),async(_,request)=>{const payload=JSON.parse(request.body);assert.deepEqual(payload.to,['allowed@example.test']);assert.equal(payload.cc,undefined);assert.deepEqual(payload.bcc,['allowed@example.test']);return Response.json({id:'test-only-id'});},env);
 }finally{console.info=original;}
});
test('chat push validates the recipient user email against the allowlist',async()=>{
 for(const email of ['other@example.test','allowed@example.test']){
 const s={users:[{id:'author',name:'Author'},{id:'u',email}],leagues:[{id:'l',name:'L',members:[{uid:'u'}]}],leagueChats:{l:{messages:[{id:'m',seq:1}]}},chatReaders:{'l:u':{notify:true,read:0}},chatSubscriptions:[{id:'d',uid:'u',subscription:{endpoint:'https://push.example.test'}}],chatPushKeys:{publicKey:'test-public',privateKey:'test-private'},chatPushOutbox:[{id:'j',league:'l',message:'m',author:'author',expires:Date.now()+60000,attempts:0,next:0,recipients:['d']}]};let calls=0;
 await deliverChatPush({transact:async fn=>fn(s),env:preview,sendPush:async()=>calls++});assert.equal(calls,email==='allowed@example.test'?1:0);
 }
});
test('reminder push never sends to a device belonging to an unlisted user',async()=>{
 const deadline=Date.now()+3600000,s={users:[{id:'u',email:'other@example.test',emailVerified:true}],leagues:[{id:'l',name:'L',members:[{uid:'u'}]}],rounds:[{id:'r',league:'l',kickoff:new Date(deadline).toISOString(),matches:[{}],slips:[]}],chatSubscriptions:[{id:'d',uid:'u',subscription:{endpoint:'https://push.example.test'}}],chatPushKeys:{publicKey:'test-public',privateKey:'test-private'}};let calls=0;await deliverLeagueReminders({transact:async fn=>fn(s),env:preview,sendPush:async()=>calls++});assert.equal(calls,0);
});
test('all scheduled and dispatched job entrypoints stop before DB or network outside production',async()=>{
 const previous=process.env.CONTEXT,oldFetch=globalThis.fetch;process.env.CONTEXT='deploy-preview';delete process.env.STAGING_ENABLE_SCHEDULES;globalThis.fetch=()=>{throw Error('Network forbidden');};
 try{for(const name of ['sync-football','send-mail','send-chat-push','send-reminders','sync-match-cache','match-cache-background','api-football-refresh-background']){const {default:handler}=await import('../netlify/functions/'+name+'.mjs');await handler(new Request('https://preview.example.test'));}}finally{process.env.CONTEXT=previous;globalThis.fetch=oldFetch;}
});
