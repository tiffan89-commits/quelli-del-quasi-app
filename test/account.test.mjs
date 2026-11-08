import test from 'node:test';import assert from 'node:assert/strict';
import {registerAccount,requestAccountMail,activateAccount,resetAccountPassword,changeAccountPassword,setAccountEmail,GENERIC_MAIL} from '../lib/account.mjs';
import {decodeMail,mailReady,sendMail} from '../lib/mail.mjs';
import {checkPassword,session,userFor,stateFor} from '../lib/game.mjs';
const env={RESEND_API_KEY:'unit-test-not-real',MAIL_FROM:'Fanta <test@example.test>',APP_BASE_URL:'https://example.test'};
const now=Date.parse('2026-10-29T12:00:00Z');
const empty=()=>({users:[],sessions:[],leagues:[],rounds:[],ledger:[],football:{fixtures:{},rounds:{}}});
const p={username:'mister',name:'Mister',email:'MISTER@example.test',password:'Private-password-123'};
function token(s){const msg=decodeMail(s.mailOutbox.at(-1),env);return new URLSearchParams(msg.text.match(/https:\/\/\S+/)[0].split('#')[1]).get('token')}
function verified(){const s=empty(),u=registerAccount(s,p,env,now);activateAccount(s,token(s),now+1);return {s,u}}
test('new accounts require no username and derive a mutable, non-unique nickname from email',()=>{
 const s=empty(),legacy={id:'legacy',username:'mister',name:'Vecchio mister',email:'legacy@example.test',emailVerified:true};s.users.push(legacy);
 const before=structuredClone(legacy),a=registerAccount(s,{email:'mister@example.test',password:p.password,username:'tiffano',name:'Ignored name'},env,now),b=registerAccount(s,{email:'mister@other.test',password:p.password},env,now);
 assert.equal(a.name,'mister');assert.equal(b.name,'mister');assert.notEqual(a.id,b.id);assert.equal(a.nicknameSuggested,true);assert.equal(Object.hasOwn(a,'username'),false);assert.equal(Object.hasOwn(b,'username'),false);assert.deepEqual(legacy,before);
 const mail=decodeMail(s.mailOutbox.at(-1),env);assert.doesNotMatch(mail.html,/USERNAME|undefined/);assert.match(mail.text,/Email: mister@other.test/);
 const c=registerAccount(s,{email:'a+tag@example.test',password:p.password},env,now);assert.equal(c.name,'a+tag');
});
test('registration hashes password, encrypts mail/token and restricts sessions to profile until verified',()=>{
 const s=empty(),u=registerAccount(s,p,env,now);assert.equal(u.email,'mister@example.test');assert.equal(u.emailVerified,false);assert.equal(checkPassword(u,p.password),true);assert.equal(JSON.stringify(s).includes(p.password),false);
 const raw=token(s);assert.equal(JSON.stringify(s).includes(raw),false);const sid=session(s,u.id);assert.equal(userFor(s,sid).id,u.id);assert.deepEqual(stateFor(s,u).leagues,[]);activateAccount(s,raw,now+1);assert.equal(userFor(s,sid).id,u.id);assert.throws(()=>activateAccount(s,raw,now+2));
 const mail=decodeMail(s.mailOutbox[0],env);assert.match(mail.text,/Email: mister@example.test/);assert.equal(mail.text.includes(p.password),false);
});
test('verification expires after twenty-four hours and reset purpose cannot activate',()=>{const s=empty();registerAccount(s,p,env,now);assert.throws(()=>activateAccount(s,token(s),now+86400000));const {s:v}=verified();requestAccountMail(v,p.email,'reset',env,now+1000);assert.throws(()=>activateAccount(v,token(v),now+1001))});
test('recovery returns the same response for unknown and known accounts without resetting immediately',()=>{
 const {s,u}=verified(),password=u.password;assert.equal(requestAccountMail(s,'unknown@example.test','reset',env,now+1000),GENERIC_MAIL);assert.equal(requestAccountMail(s,p.email,'reset',env,now+1000),GENERIC_MAIL);assert.equal(u.password,password);
 const n=s.mailOutbox.length;requestAccountMail(s,p.email,'reset',env,now+2000);assert.equal(s.mailOutbox.length,n);
});
test('reset token is single use, expires in thirty minutes and revokes every session',()=>{
 const {s,u}=verified();const sid=session(s,u.id);requestAccountMail(s,p.email,'reset',env,now+1000);const raw=token(s);assert.throws(()=>resetAccountPassword(s,raw,'New-password-123',env,now+1000+30*60000));
 resetAccountPassword(s,raw,'New-password-123',env,now+2000);assert.equal(checkPassword(u,p.password),false);assert.equal(checkPassword(u,'New-password-123'),true);assert.equal(userFor(s,sid),undefined);assert.throws(()=>resetAccountPassword(s,raw,'Other-password-123',env,now+2001));
 const notice=decodeMail(s.mailOutbox.at(-1),env);assert.match(notice.subject,/modificata/);assert.equal(notice.text.includes('New-password-123'),false);assert.equal(JSON.stringify(s).includes('New-password-123'),false);
});
test('reissuing a link invalidates the previous token',()=>{const s=empty();registerAccount(s,p,env,now);const old=token(s);requestAccountMail(s,p.email,'verify',env,now+61000);const fresh=token(s);assert.notEqual(old,fresh);assert.throws(()=>activateAccount(s,old,now+62000));activateAccount(s,fresh,now+62000)});
test('unverified recovery proves mailbox ownership and resets the password in one step',()=>{const s=empty(),u=registerAccount(s,p,env,now);requestAccountMail(s,p.email,'reset',env,now+61000);assert.equal(s.accountTokens.at(-1).purpose,'reset');resetAccountPassword(s,token(s),'New-password-123',env,now+62000);assert.equal(u.emailVerified,true);assert.equal(checkPassword(u,'New-password-123'),true);assert.equal(checkPassword(u,p.password),false)});
test('legacy account can add email only after checking current password and mailbox ownership',()=>{
 const {s,u}=verified();delete u.email;delete u.emailVerified;assert.throws(()=>setAccountEmail(s,u,{email:'new@example.test',password:'wrong'},env,now));
 setAccountEmail(s,u,{email:'new@example.test',password:p.password},env,now+61000);assert.equal(u.email,undefined);assert.equal(u.pendingEmail,'new@example.test');activateAccount(s,token(s),now+62000);assert.equal(u.email,'new@example.test');assert.equal(u.emailVerified,true);
});
test('duplicate emails and weak passwords cannot create accounts; nicknames may coincide',()=>{const s=empty();registerAccount(s,p,env,now);assert.throws(()=>registerAccount(s,{...p,username:'other'},env,now));const other=registerAccount(s,{...p,email:'mister@else.test'},env,now);assert.equal(other.name,'mister');assert.equal(other.username,undefined);assert.throws(()=>registerAccount(s,{...p,username:'third',email:'third@example.test',password:'short'},env,now))});
test('email configuration fails closed and uses a fixed trusted HTTPS base URL',()=>{
 assert.equal(mailReady({...env,APP_BASE_URL:'http://example.test'}),false);const s=empty();assert.throws(()=>registerAccount(s,p,{},now));assert.equal(s.users.length,0);registerAccount(s,p,env,now);assert.match(decodeMail(s.mailOutbox[0],env).text,/https:\/\/example.test\/account.html#action=verify/);
});
test('email transport uses idempotency and does not include plaintext passwords',async()=>{const s=empty();registerAccount(s,p,env,now);let calls=0;await sendMail(s.mailOutbox[0],async(url,opts)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.match(opts.headers['Idempotency-Key'],/^fanta-mail\//);assert.equal(opts.body.includes(p.password),false);assert.equal(JSON.parse(opts.body).to[0],'mister@example.test');return {ok:true}},env);assert.equal(calls,1)});
test('other members do not receive account tokens, mail jobs or private email',()=>{const {s,u}=verified();const v={id:'v',username:'v',name:'Other'};s.users.push(v);const view=stateFor(s,v);assert.equal(JSON.stringify(view).includes(u.email),false);assert.equal('accountTokens' in view,false);assert.equal('mailOutbox' in view,false)});

test('existing legacy sessions expose only profile until email verification; league data survives',()=>{const {s,u}=verified();const sid=session(s,u.id);s.leagues.push({id:'private-league',admin:u.id,members:[{uid:u.id,credits:480,points:8}]});delete u.email;delete u.emailVerified;const restricted=stateFor(s,userFor(s,sid));assert.deepEqual(restricted.leagues,[]);assert.equal(restricted.provider,undefined);setAccountEmail(s,u,{email:'new@example.test',password:p.password},env,now+61000);assert.deepEqual(stateFor(s,u).leagues,[]);activateAccount(s,token(s),now+62000);assert.equal(stateFor(s,u).leagues[0].members[0].credits,480);assert.equal(stateFor(s,u).leagues[0].members[0].points,8)});

test('owner-authorized legacy recovery verifies the supplied mailbox only when its single-use reset link is used',async()=>{const {inviteLegacyRecovery}=await import('../lib/account.mjs');const {s,u}=verified();delete u.email;delete u.emailVerified;const before={password:u.password,leagues:JSON.stringify(s.leagues)};const oldSession=session(s,u.id);const config={operation:'test-owner-recovery-001',username:'mister',email:'legacy@example.test'};const op=inviteLegacyRecovery(s,config,env,now);assert.equal(u.email,undefined);assert.equal(u.pendingEmail,'legacy@example.test');assert.equal(u.password,before.password);assert.equal(userFor(s,oldSession),undefined);const link=token(s);assert.equal(inviteLegacyRecovery(s,config,env,now).mailId,op.mailId);resetAccountPassword(s,link,'New-legacy-password-123',env,now+1000);assert.equal(u.email,'legacy@example.test');assert.equal(u.emailVerified,true);assert.equal(checkPassword(u,'New-legacy-password-123'),true);assert.equal(JSON.stringify(s.leagues),before.leagues);assert.throws(()=>resetAccountPassword(s,link,'New-legacy-password-123',env,now+2000))});
test('legacy recovery cannot replace an existing email or create a duplicate mailbox association',async()=>{const {inviteLegacyRecovery}=await import('../lib/account.mjs');const {s,u}=verified();const cfg={operation:'test-owner-recovery-002',username:'mister',email:'new@example.test'};assert.throws(()=>inviteLegacyRecovery(s,cfg,env,now));delete u.email;delete u.emailVerified;s.users.push({id:'other',email:'new@example.test'});assert.throws(()=>inviteLegacyRecovery(s,cfg,env,now))});

test('changing a local password requires the old one, preserves only this session and rejects social-only accounts',()=>{
 const {s,u}=verified(),current=session(s,u.id),other=session(s,u.id);
 requestAccountMail(s,p.email,'reset',env,now+1000);const previousLink=token(s);
 const next={currentPassword:p.password,newPassword:'New-local-password',confirmPassword:'New-local-password'};
 assert.equal(changeAccountPassword(s,u,current,{...next,currentPassword:'wrong'}),false);
 assert.throws(()=>changeAccountPassword(s,u,current,{...next,confirmPassword:'mismatch'}),/non coincidono/);
 assert.equal(changeAccountPassword(s,u,current,next),true);
 assert.ok(checkPassword(u,next.newPassword));assert.equal(checkPassword(u,p.password),false);
 assert.equal(userFor(s,current),u);assert.equal(userFor(s,other),undefined);
 assert.throws(()=>resetAccountPassword(s,previousLink,'Another-password',env,now+2000));
 const social={...u,password:undefined};assert.equal(stateFor(s,social).user.hasLocalPassword,false);
 assert.throws(()=>changeAccountPassword(s,social,current,next),/non disponibile/);
});
