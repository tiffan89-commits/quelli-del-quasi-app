import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,jwtVerify} from 'jose';
import {emptyState,GAME_SNAPSHOT_SQL,AUTH_FIELDS} from '../lib/db.mjs';
import {hash,sha,stateFor} from '../lib/game.mjs';
import {createSocialAuth} from '../lib/social-auth.mjs';
import {authorizationUrl,verifyIdentityToken,exchangeSocialCode,appleSecret,socialProviders} from '../lib/social-providers.mjs';
import {createApi} from '../netlify/functions/api.mjs';
import {nicknameNotice} from '../public/src/nickname-notice.mjs';
import {socialButtons} from '../public/src/pubblico/social.mjs';
const origin='https://quasi.test',at=Date.now(),env={PUBLIC_ORIGIN:origin,APP_BASE_URL:origin,GOOGLE_LOGIN_ENABLED:'true',FACEBOOK_LOGIN_ENABLED:'true',APPLE_LOGIN_ENABLED:'true',GOOGLE_OAUTH_CLIENT_ID:'google-client',GOOGLE_OAUTH_CLIENT_SECRET:'google-secret',FACEBOOK_APP_ID:'fb-client',FACEBOOK_APP_SECRET:'fb-secret',FACEBOOK_GRAPH_VERSION:'v24.0',APPLE_SERVICE_ID:'apple-client',APPLE_TEAM_ID:'apple-team',APPLE_KEY_ID:'apple-key',APPLE_PRIVATE_KEY_FILE:'private.p8',RESEND_API_KEY:'test-mail-key'};
const google={provider:'google',subject:'google-permanent-id',email:'mario.rossi@gmail.com',verified:true,authoritative:true};
const player=(extra={})=>({id:'existing',username:'frankwood',name:'Il geometra',email:google.email,emailVerified:true,salt:'salt',password:hash('Original-password!', 'salt'),...extra});
function fixture(identity=google){let state=emptyState(),time=at,calls=0,deliveries=0,logins=0;let tail=Promise.resolve();const transact=fn=>{const run=tail.then(async()=>{const copy=structuredClone(state),result=await fn(copy);state=copy;return result;});tail=run.catch(()=>{});return run;};
 const handler=createSocialAuth({transact,env,now:()=>time,exchange:async()=>{calls++;return structuredClone(identity);},deliverMail:async()=>deliveries++,onLogin:()=>logins++});
 const request=(route,body,jar='',options={})=>handler(new Request(origin+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),...(jar?{Cookie:jar}:{}),...options.headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}),{ip:'test-ip'});
 const begin=async(provider=identity.provider)=>{const response=await request('social-start',{provider,invite:'LEGA123',entry:'fanta'});assert.equal(response.status,200);const u=new URL((await response.json()).authorizationUrl);return {state:u.searchParams.get('state'),binding:response.headers.getSetCookie()[0].split(';')[0]};};
 const callback=async(a,provider=identity.provider,extras='')=>{if(provider==='apple')return handler(new Request(origin+'/api/social-apple-callback',{method:'POST',headers:{Origin:'https://appleid.apple.com','Content-Type':'application/x-www-form-urlencoded',Cookie:a.binding},body:new URLSearchParams({state:a.state,code:'code'})}));return request('social-'+provider+'-callback?state='+a.state+'&code=code'+extras,undefined,a.binding);};
 const ready=async(provider=identity.provider)=>{const a=await begin(provider),cb=await callback(a,provider);assert.equal(cb.headers.get('location'),origin+'/#social');return {a,cb,jar:cb.headers.getSetCookie().find(x=>x.startsWith('__Host-qdq-social-pending=')).split(';')[0]};};
 return {request,begin,callback,ready,transact,get state(){return state;},set state(v){state=v;},set time(v){time=v;},get calls(){return calls;},get deliveries(){return deliveries;},get logins(){return logins;}};
}
test('social login requests only identity/email; Google adds S256 PKCE, nonce, fixed callback and state',()=>{
 const u=new URL(authorizationUrl('google',{state:'state',nonce:'nonce',verifier:'verifier'},env));assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('scope'),'openid email');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),origin+'/api/social-google-callback');assert.equal(u.searchParams.get('nonce'),'nonce');assert.ok(!u.searchParams.has('access_type'));
 assert.deepEqual(socialProviders({...env,APPLE_PRIVATE_KEY_FILE:''}),['google','facebook']);assert.deepEqual(socialProviders({}),[]);
 assert.deepEqual(socialProviders({...env,GOOGLE_LOGIN_ENABLED:'false',FACEBOOK_LOGIN_ENABLED:'false',APPLE_LOGIN_ENABLED:'false'}),[]);
});
test('Google ID token requires a valid signature, issuer, audience, nonce, expiry and verified email',async()=>{
 const pair=await generateKeyPair('RS256'),attempt={nonce:'one-time-nonce'},base={sub:'permanent',nonce:attempt.nonce,email:google.email,email_verified:true};
 const sign=(claims={})=>new SignJWT({...base,...claims}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_OAUTH_CLIENT_ID).setIssuedAt(Math.floor(at/1000)).setExpirationTime(Math.floor(at/1000)+3600).sign(pair.privateKey);
 const token=await sign(),identity=await verifyIdentityToken(token,'google',attempt,env,{keyResolver:pair.publicKey,now:at});assert.equal(identity.subject,'permanent');assert.equal(identity.authoritative,true);
 for(const [t,a,e]of [[await sign({nonce:'wrong'}),attempt,env],[await sign({email_verified:false}),attempt,env],[token,attempt,{...env,GOOGLE_OAUTH_CLIENT_ID:'other'}],[token,{nonce:'other'},env]])await assert.rejects(()=>verifyIdentityToken(t,'google',a,e,{keyResolver:pair.publicKey,now:at}),x=>x.code==='provider-invalid');
 await assert.rejects(()=>verifyIdentityToken(token,'google',attempt,env,{keyResolver:pair.publicKey,now:at+7200000}));
 const external=await verifyIdentityToken(await sign({email:'mario@outside.test'}),'google',attempt,env,{keyResolver:pair.publicKey,now:at});assert.equal(external.authoritative,false);
});
test('Apple server secret is signed with the private key and has only the proper service, issuer, audience and short expiry',async()=>{
 const pair=await generateKeyPair('ES256',{extractable:true}),{exportPKCS8}=await import('jose'),pem=await exportPKCS8(pair.privateKey),token=await appleSecret(env,{now:at,read:async()=>pem});
 const {payload,protectedHeader}=await jwtVerify(token,pair.publicKey,{issuer:env.APPLE_TEAM_ID,audience:'https://appleid.apple.com',currentDate:new Date(at)});assert.equal(payload.sub,env.APPLE_SERVICE_ID);assert.equal(payload.exp-payload.iat,600);assert.equal(protectedHeader.kid,env.APPLE_KEY_ID);
});
test('Facebook validates the access token against our app, then binds the profile ID and sends appsecret_proof; it never assumes email is verified',async()=>{
 const calls=[];const fetcher=async(url,init)=>{calls.push({url,init});assert.equal(init.redirect,'error');return Response.json(calls.length===1?{access_token:'user-private-token'}:calls.length===2?{data:{is_valid:true,app_id:env.FACEBOOK_APP_ID,user_id:'fb-id',expires_at:Math.floor(at/1000)+3600}}:{id:'fb-id',email:'MARIO@MAIL.TEST'});};
 const result=await exchangeSocialCode('facebook','code',{},env,{fetcher,now:at});assert.equal(calls.length,3);assert.equal(result.subject,'fb-id');assert.equal(result.verified,false);assert.equal(result.authoritative,false);assert.equal(result.email,'mario@mail.test');assert.ok(new URL(calls[2].url).searchParams.get('appsecret_proof'));assert.equal(new URL(calls[2].url).searchParams.get('fields'),'id,email');
 let count=0;await assert.rejects(()=>exchangeSocialCode('facebook','code',{},env,{now:at,fetcher:async()=>Response.json(++count===1?{access_token:'private'}:{data:{is_valid:true,app_id:'wrong',user_id:'fb-id',expires_at:Math.floor(at/1000)+3600}})}),e=>e.code==='provider-invalid');assert.equal(count,2);
});
test('existing verified Gmail account signs in automatically without password, preserving ID, nickname, membership and game history',async()=>{
 const f=fixture();f.state.users.push(player(),player({id:'admin',username:'tiffano',adminOnly:true}));f.state.leagues=[{id:'league',members:[{uid:'existing',credits:470,points:5}],rounds:[]}];f.state.ledger=[{uid:'existing',amount:20}];f.state.rounds=[{id:'old',slips:[{uid:'existing',picks:{m:'1'}}]}];const history=JSON.stringify([f.state.leagues,f.state.rounds,f.state.ledger]),before=structuredClone(f.state.users[0]);
 const {jar}=await f.ready(),status=await (await f.request('social-status',undefined,jar)).json();assert.equal(status.ready,true);assert.equal(status.requiresPassword,false);
 const response=await f.request('social-complete',{},jar);assert.equal(response.status,200);assert.match(response.headers.getSetCookie()[0],/^sid=/);assert.equal(f.state.users.length,2);assert.deepEqual(f.state.users[0],before);assert.equal(f.state.socialIdentities[0].uid,'existing');assert.equal(JSON.stringify([f.state.leagues,f.state.rounds,f.state.ledger]),history);assert.equal(f.calls,1);assert.equal(f.deliveries,0);
});
test('new Google account is immediately active, with email-prefix nickname and no username; retries create no duplicates',async()=>{
 const f=fixture();f.state.users.push(player({id:'unrelated',username:'mario.rossi',email:'other@gmail.com'}));const {jar}=await f.ready();assert.equal((await (await f.request('social-status',undefined,jar)).json()).ready,true);
 const [a,b]=await Promise.all([f.request('social-complete',{},jar),f.request('social-complete',{},jar)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(f.state.users.length,2);const u=f.state.users[1];assert.notEqual(u.name,'mario.rossi');assert.ok(u.name);assert.equal(Object.hasOwn(u,'username'),false);assert.equal(u.emailVerified,true);assert.equal(u.nicknameSuggested,true);assert.equal(u.password,undefined);assert.equal(f.state.socialIdentities.length,1);assert.equal(f.state.sessions.length,1);assert.equal(f.logins,1);assert.equal(f.deliveries,0);
});
test('Google takeover of an unverified signup invalidates its old password, sessions and email links',async()=>{
 const f=fixture();f.state.users.push(player({emailVerified:false}));f.state.sessions.push({uid:'existing',token:'attacker-session',expires:at+99999});f.state.accountTokens=[{uid:'existing',mailId:'obsolete-link'}];f.state.mailOutbox=[{id:'obsolete-link'}];const {jar}=await f.ready();await f.request('social-complete',{},jar);assert.equal(f.state.users[0].emailVerified,true);assert.equal(f.state.users[0].password,undefined);assert.equal(f.state.users[0].salt,undefined);assert.ok(!f.state.sessions.some(s=>s.token==='attacker-session'));assert.equal(f.state.accountTokens.length,0);assert.equal(f.state.mailOutbox.length,0);
});
test('persistent provider subject wins over later email changes, while differing manual identity links are not overwritten',async()=>{
 const f=fixture({...google,email:'different@gmail.com'});f.state.users.push(player());f.state.socialIdentities=[{provider:'google',subject:google.subject,uid:'existing'}];const {jar}=await f.ready();await f.request('social-complete',{},jar);assert.equal(f.state.users.length,1);assert.equal(f.state.users[0].email,google.email);
 const g=fixture();g.state.users.push(player());g.state.socialIdentities=[{provider:'google',subject:'other-google-id',uid:'existing'}];const pending=await g.ready(),r=await g.request('social-complete',{},pending.jar);assert.equal(r.status,409);assert.equal(g.state.socialIdentities[0].subject,'other-google-id');assert.equal(g.state.sessions.length,0);
});
test('Facebook email coincidence alone cannot enter an existing account; password links once and subsequent logins use the persistent ID',async()=>{
 const identity={...google,provider:'facebook',subject:'facebook-id',verified:false,authoritative:false},f=fixture(identity);f.state.users.push(player());const {jar}=await f.ready();assert.equal((await (await f.request('social-status',undefined,jar)).json()).requiresPassword,true);
 assert.equal((await f.request('social-complete',{password:'wrong'},jar)).status,401);assert.equal(f.state.socialPending[0].tries,1);assert.equal(f.state.sessions.length,0);assert.equal((await f.request('social-complete',{password:'Original-password!'},jar)).status,200);assert.equal(f.state.users.length,1);assert.equal(f.state.users[0].emailVerified,true);assert.equal(f.state.socialIdentities[0].provider,'facebook');
});
test('Facebook without email requests an address and activates only through the normal verification email',async()=>{
 const f=fixture({...google,provider:'facebook',subject:'fb',email:null,verified:false,authoritative:false}),{jar}=await f.ready();const status=await (await f.request('social-status',undefined,jar)).json();assert.equal(status.requiresEmail,true);assert.equal(status.ready,false);const r=await f.request('social-complete',{email:'nuovo@example.test'},jar),body=await r.json();assert.equal(body.pendingVerification,true);assert.equal(f.state.users[0].emailVerified,false);assert.notEqual(f.state.users[0].name,'nuovo');assert.ok(f.state.users[0].name);assert.equal(f.state.users[0].password,undefined);assert.equal(f.state.accountTokens.length,1);assert.equal(f.deliveries,1);
});
test('callbacks are bound to browser, provider, state and expiry, and cannot replay the provider exchange',async()=>{
 const f=fixture(),a=await f.begin();const wrong=await f.callback({...a,binding:a.binding+'wrong'});assert.match(wrong.headers.get('location'),/social-error=expired/);assert.equal(f.calls,0);
 const mixed=await f.callback(a,'facebook');assert.match(mixed.headers.get('location'),/social-error=expired/);assert.equal(f.calls,0);
 assert.equal((await f.callback(a)).headers.get('location'),origin+'/#social');assert.match((await f.callback(a)).headers.get('location'),/expired/);assert.equal(f.calls,1);
 const g=fixture(),b=await g.begin();g.time=at+600001;assert.match((await g.callback(b)).headers.get('location'),/expired/);assert.equal(g.calls,0);
});
test('Apple accepts the cross-site form POST only with the original browser binding; cancellation returns a recoverable login page',async()=>{
 const f=fixture({...google,provider:'apple',subject:'apple-id'}),{cb,jar}=await f.ready('apple');assert.equal(cb.status,303);assert.equal((await f.request('social-complete',{},jar)).status,200);
 const g=fixture(),a=await g.begin(),cancel=await g.callback(a,'google','&error=access_denied');assert.match(cancel.headers.get('location'),/social-error=cancelled/);assert.equal(g.calls,0);
});
test('social start and completion reject CSRF, bad methods and unconfigured providers, and attempts are bounded per IP',async()=>{
 const f=fixture();assert.equal((await f.request('social-start',{provider:'google'},'',{headers:{Origin:'https://evil.test'}})).status,403);assert.equal((await f.request('social-start')).status,405);assert.equal((await f.request('social-start',{provider:'unknown'})).status,503);
 for(let i=0;i<20;i++)assert.equal((await f.request('social-start',{provider:'google'})).status,200);assert.equal((await f.request('social-start',{provider:'google'})).status,429);assert.equal(f.calls,0);
});
test('system admin cannot gain a game session via social identity or email; public projections omit all transient social secrets',async()=>{
 const f=fixture();f.state.users.push(player({adminOnly:true,username:'tiffano'}));const a=await f.begin(),r=await f.callback(a);assert.match(r.headers.get('location'),/admin-only/);assert.equal(f.state.sessions.length,0);
 for(const field of ['socialAttempts','socialPending','socialIdentities','socialLimits']){assert.ok(AUTH_FIELDS.includes(field));assert.ok(GAME_SNAPSHOT_SQL.includes("'"+field+"'"));}
});
test('nickname notice is private to the user, escaped, and disappears only after a real nickname change through the normal profile API',async()=>{
 const s=emptyState(),u=player({name:'mario.rossi',nicknameSuggested:true});s.users=[u];s.sessions=[{uid:u.id,token:sha('profile-session'),expires:Date.now()+60000}];const api=createApi({transact:async fn=>fn(s)}),request=name=>api(new Request(origin+'/api/profile',{method:'POST',headers:{Origin:origin,Cookie:'sid=profile-session','Content-Type':'application/json'},body:JSON.stringify({name})}));
 assert.match(nicknameNotice(stateFor(s,u).user),/Puoi cambiare/);assert.equal((await request('mario.rossi')).status,200);assert.equal(u.nicknameSuggested,true);assert.equal((await request('Il mister')).status,200);assert.equal(u.nicknameSuggested,undefined);assert.equal(nicknameNotice(stateFor(s,u).user),'');assert.ok(!nicknameNotice({nicknameSuggested:true,name:'<script>'}).includes('<script>'));
});
test('login UI exposes only configured providers, with accessible progress and disabled duplicate clicks',()=>{
 assert.equal(socialButtons({providers:[]}), '');const html=socialButtons({providers:['google','facebook','apple'],busy:true});assert.equal((html.match(/disabled aria-busy/g)||[]).length,3);assert.match(html,/Continua con Google/);assert.ok(!html.includes('<script'));assert.equal(socialButtons({providers:['google'],editRegistration:true}),'');
});
