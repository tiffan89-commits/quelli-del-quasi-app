import test from 'node:test';import assert from 'node:assert/strict';
import {queueLeagueReminders,deliverLeagueReminders} from '../lib/league-reminders.mjs';
import {queueEmailReminders,disableEmailReminders,unsubscribeToken} from '../lib/reminder-email.mjs';
import {decodeMail} from '../lib/mail.mjs';import {deliverPendingMail} from '../lib/mail-delivery.mjs';
import {emptyState} from '../lib/db.mjs';import {session} from '../lib/game.mjs';import {createApi} from '../netlify/functions/api.mjs';
import {sendAdminSubmissionReminder} from '../lib/submission-reminders.mjs';
const now=Date.parse('2026-10-30T12:00:00Z'),deadline=now+2*3600000,env={RESEND_API_KEY:'test-key',APP_BASE_URL:'https://example.test',MAIL_FROM:'Test <test@example.test>'};
function fixture(){return {users:[{id:'a',name:'A',email:'a@example.test',emailVerified:true},{id:'b',name:'B',email:'b@example.test',emailVerified:true},{id:'admin',adminOnly:true,emailVerified:true}],leagues:[{id:'l',name:'Bar',members:[{uid:'a'},{uid:'b'},{uid:'admin'}]}],rounds:[{id:'r',source:'seriea',league:'l',title:'Giornata 1',kickoff:new Date(deadline).toISOString(),matches:[{}],slips:[{uid:'a'}]},{id:'r2',source:'seriea',league:'l',title:'Giornata 2',kickoff:new Date(deadline).toISOString(),matches:[{}],slips:[]}],chatSubscriptions:[{id:'da',uid:'a',subscription:{}},{id:'db',uid:'b',subscription:{}}],chatPushKeys:{publicKey:'test',privateKey:'test'}};}
test('four push alerts target only missing slips once per scheduled time',()=>{
 const s=fixture();s.rounds.pop();
 Object.assign(s.rounds[0],{source:null,provider:'API-FOOTBALL'});
 for(const hours of [24,12,6,3]){
  const at=deadline-hours*3600000;
  assert.equal(queueLeagueReminders(s,at-1),0);
  assert.equal(queueLeagueReminders(s,at),1);
  assert.equal(queueLeagueReminders(s,at+1000),0);
 }
 assert.equal(s.leagueAlerts.length,4);
 assert.ok(s.leagueAlerts.every(a=>a.uid==='b'&&a.url==='/#/bar/schedina?lega=l&giornata=r'));
 assert.equal(new Set(s.reminderOutbox.map(j=>j.tag)).size,4);
});
test('push does not resend a delivered device and checks preference and submitted slips before delivery',async()=>{
 const s=fixture(),transact=async fn=>fn(s),calls=[],at=deadline-3*3600000;
 s.users[1].remindersEnabled=false;
 await deliverLeagueReminders({transact,now:()=>at,sendPush:async(sub,payload)=>calls.push(JSON.parse(payload))});
 assert.equal(calls.length,1);
 assert.equal(calls[0].kind,'slip-reminder');
 assert.equal(calls[0].url,'/#/bar/schedina?lega=l&giornata=r2');
 await deliverLeagueReminders({transact,now:()=>at+1000,sendPush:async()=>calls.push({})});
 assert.equal(calls.length,1);
 queueLeagueReminders(s,deadline-6*3600000);
 s.rounds[1].slips.push({uid:'a'});
 await deliverLeagueReminders({transact,queue:false,now:()=>at+2000,sendPush:async()=>calls.push({})});
 assert.equal(calls.length,1);
});
test('email is opt-in, runs at two hours, ignores completed slips and groups only missing schedules',()=>{const s=fixture();assert.deepEqual(queueEmailReminders(s,env,now),[]);s.users[0].emailRemindersEnabled=true;s.users[1].emailRemindersEnabled=true;assert.deepEqual(queueEmailReminders(s,env,now-1),[]);assert.equal(queueEmailReminders(s,env,now).length,2);const a=s.mailOutbox.find(j=>j.reminder.uid==='a'),mail=decodeMail(a,env);assert.doesNotMatch(mail.text,/Campionato · Giornata 1/);assert.match(mail.text,/Giornata 2/);assert.match(mail.text,/disattivare questo promemoria/);assert.equal(queueEmailReminders(s,env,now+3601000).length,0);assert.equal(JSON.stringify(s).includes('a@example.test')&&JSON.stringify(s.mailOutbox).includes('a@example.test'),false);});
test('mail delivery cancels when the user saved after queuing, opted out, left or the match already began',async()=>{for(const change of [s=>s.rounds.forEach(r=>r.slips.push({uid:'b'})),s=>s.users[1].emailRemindersEnabled=false,s=>s.leagues[0].members=[],s=>s.rounds.forEach(r=>r.closed=true)]){const s=fixture();s.users[1].emailRemindersEnabled=true;queueEmailReminders(s,env,now+3600000);change(s);let sent=0;const result=await deliverPendingMail({jobId:s.mailOutbox[0].id,transactionFn:async fn=>fn(s),env,now:()=>now+3601000,send:async()=>sent++});assert.equal(result,'none');assert.equal(sent,0);}});
test('unsubscribe is anonymous, tamper-resistant, repeatable and disables every queued email for that user',()=>{const s=fixture(),u=s.users[1];u.emailRemindersEnabled=true;queueEmailReminders(s,env,now+3600000);const raw=unsubscribeToken(u,env);assert.throws(()=>disableEmailReminders(s,raw.slice(0,-3)+'bad',env));assert.equal(u.emailRemindersEnabled,true);assert.equal(disableEmailReminders(s,raw,env).ok,true);assert.equal(u.emailRemindersEnabled,false);assert.equal(s.mailOutbox.length,0);assert.equal(disableEmailReminders(s,raw,env).ok,true);});
test('email message is refreshed immediately before dispatch and only lists the remaining missing slip',async()=>{const s=fixture();s.users[1].emailRemindersEnabled=true;const [jobId]=queueEmailReminders(s,env,now+3600000);s.rounds[0].slips.push({uid:'b'});let payload;await deliverPendingMail({jobId,transactionFn:async fn=>fn(s),env,now:()=>now+3601000,send:async j=>{payload=decodeMail(j,env);}});assert.match(payload.text,/Giornata 2/);assert.doesNotMatch(payload.text,/Campionato · Giornata 1/);assert.match(payload.html,/Nessuna pubblicità/);});
test('email preference starts off, requires the authenticated account and unsubscribe needs no session',async()=>{const s=emptyState(),u={id:'u',name:'Tester',username:'tester',email:'tester@example.test',emailVerified:true};s.users=[u];const token=session(s,u.id),api=createApi({transact:async fn=>fn(s,{query:async()=>({rows:[{attempts:1}]})}),env}),call=(route,body,cookie)=>api(new Request('https://example.test/api/'+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie:'sid='+cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));const state=await(await call('state',null,token)).json();assert.equal(state.user.emailRemindersEnabled,false);assert.equal((await call('profile-email-reminders',{enabled:true})).status,401);assert.equal((await call('profile-email-reminders',{enabled:true},token)).status,200);const raw=unsubscribeToken(u,env);assert.equal((await call('unsubscribe-email-reminders',{token:raw})).status,200);assert.equal(u.emailRemindersEnabled,false);});
test('several Quasi leagues sharing a deadline produce one email per person with a direct link for each missing league',()=>{const s=fixture();s.users[1].emailRemindersEnabled=true;s.leagues.push({id:'second',name:'Secondo Bar',members:[{uid:'b'}]});s.rounds.push({...structuredClone(s.rounds[0]),id:'other',league:'second',slips:[]});const jobs=queueEmailReminders(s,env,now+3600000);assert.equal(jobs.length,1);const mail=decodeMail(s.mailOutbox[0],env);assert.match(mail.text,/Secondo Bar/);assert.match(mail.text,/slip=second/);assert.match(mail.text,/slip=l/);});
test('manual Bar reminders require the president and target the missing member through both channels',async()=>{
 const s=fixture();s.leagues[0].admin='a';s.sessions=[];
 Object.assign(s.rounds[0],{source:null,provider:'API-FOOTBALL',kickoff:new Date(Date.now()+3600000).toISOString()});
 const president=session(s,'a'),member=session(s,'b'),sent=[];
 const api=createApi({transact:async fn=>fn(s),env,sendSubmissionReminder:(channel,message,target,opts)=>
  sendAdminSubmissionReminder(channel,message,target,{...opts,deliverMail:async job=>sent.push(decodeMail(job,env)),sendPush:async(sub,data)=>sent.push(JSON.parse(data))})});
 const call=(token,uid,channel)=>api(new Request('https://example.test/api/league-reminder',{method:'POST',headers:{cookie:'sid='+token},
  body:JSON.stringify({league:'l',round:'r',uid,channel})}));
 assert.equal((await call(member,'b','email')).status,403);
 assert.equal((await call(president,'a','push')).status,409);
 for(const channel of ['email','push'])assert.equal((await call(president,'b',channel)).status,200);
 assert.deepEqual(sent[0].to,['b@example.test']);
 assert.match(sent[0].html,/example\.test\/#\/bar\/schedina\?lega=l&amp;giornata=r/);
 assert.equal(sent[1].url,'/#/bar/schedina?lega=l&giornata=r');
 s.rounds[0].provider='Leghe Fantacalcio';
 assert.equal((await call(president,'b','push')).status,409);
 assert.equal(sent.length,2);
});
