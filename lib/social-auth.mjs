import {randomBytes} from 'node:crypto';
import {id,sha,session,checkPassword,userFor} from './game.mjs';
import {email as validEmail,registerAccount,accountNickname} from './account.mjs';
import {SocialError,socialOrigin,socialProviders,authorizationUrl,exchangeSocialCode,equal} from './social-providers.mjs';
const ttl=600000,random=()=>randomBytes(32).toString('base64url');
const pendingName='__Host-qdq-social-pending',attemptName=state=>'__Host-qdq-social-'+state.slice(0,12);
const cookie=(name,value,age=600,cross=false)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${cross?'None':'Strict'}; Max-Age=${age}`;
const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(s=>s.trim().split('=' )).filter(p=>p.length===2));
const headers=()=>new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});
function reply(data,status=200,setCookies=[]){const h=headers();h.set('Content-Type','application/json');for(const c of setCookies)h.append('Set-Cookie',c);return new Response(JSON.stringify(data),{status,headers:h});}
function redirect(location,setCookies=[]){const h=headers();h.set('Location',location);for(const c of setCookies)h.append('Set-Cookie',c);return new Response(null,{status:303,headers:h});}
function clean(s,now){for(const k of ['socialAttempts','socialPending','socialLimits'])s[k]=(s[k]||[]).filter(x=>x.expires>now);s.socialIdentities??=[];}
const playersForEmail=(s,email)=>s.users.filter(u=>!u.adminOnly&&!u.demo&&String(u.email||'').toLowerCase()===email);
function resolve(s,identity){
 const links=(s.socialIdentities||[]).filter(x=>x.provider===identity.provider&&x.subject===identity.subject);
 if(links.length>1)throw new SocialError('account-conflict',409);
 if(links.length){const u=s.users.find(u=>u.id===links[0].uid&&!u.adminOnly&&!u.demo);if(!u)throw new SocialError('account-conflict',409);return {user:u,linked:true};}
 const matches=identity.email?playersForEmail(s,identity.email):[];
 if(matches.length>1)throw new SocialError('account-conflict',409);
 if(matches.length)return {user:matches[0],automatic:identity.verified&&identity.authoritative};
 if(identity.email&&s.users.some(u=>u.adminOnly&&(u.email===identity.email||u.pendingEmail===identity.email)))throw new SocialError('admin-only',403);
 return {};
}
export function createSocialAuth({transact,env=process.env,exchange=exchangeSocialCode,onLogin=()=>{},deliverMail=async()=>{},now=()=>Date.now()}={}){
 return async(req,context={})=>{
  const url=new URL(req.url),route=url.pathname.split('/').at(-1),callback=/^social-(google|facebook|apple)-callback$/.exec(route),provider=callback?.[1];let clear=[];
  try{
   if(!/^social-(?:config|start|status|complete|(?:google|facebook|apple)-callback)$/.test(route))throw new SocialError('not-found',404);
   const origin=socialOrigin(env);if(url.origin!==origin)throw new SocialError('wrong-origin',403);
   if(!callback&&req.headers.get('origin')&&req.headers.get('origin')!==origin)throw new SocialError('wrong-origin',403);
   if(['social-config','social-status'].includes(route)&&req.method!=='GET'||['social-start','social-complete'].includes(route)&&req.method!=='POST'||callback&&req.method!==(provider==='apple'?'POST':'GET'))throw new SocialError('method',405);
   if(!callback&&['social-start','social-complete'].includes(route)&&req.headers.get('origin')!==origin)throw new SocialError('wrong-origin',403);
   if(route==='social-config')return reply({providers:socialProviders(env)});
   const browser=cookies(req),time=now();
   let p={};if(req.method==='POST'){const text=await req.text();if(text.length>20000)throw new SocialError('request-large',413);try{if(callback){if(!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw Error('type');p=Object.fromEntries(new URLSearchParams(text));}else{if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('type');p=JSON.parse(text);if(!p||typeof p!=='object'||Array.isArray(p))throw Error('body');}}catch{throw new SocialError('request-invalid');}}
   if(route==='social-start'){
    const provider=p.provider;if(!socialProviders(env).includes(provider))throw new SocialError('unavailable',503);
    const state=random(),binding=random(),nonce=random(),verifier=random(),attempt={state,nonce,verifier};
    await transact(s=>{clean(s,time);const key=sha(context.ip||'unknown'),limit=s.socialLimits.find(x=>x.key===key);if(limit&&limit.count>=20)return {limited:true};if(!limit){if(s.socialLimits.length>=2000)throw new SocialError('busy',503);s.socialLimits.push({key,count:1,expires:time+900000});}else limit.count++;if(s.socialAttempts.length>=1000)throw new SocialError('busy',503);s.socialAttempts.push({digest:sha(state),binding:sha(binding),provider,nonce,verifier,entry:p.entry==='fanta'?'fanta':null,invite:/^[A-Za-z0-9_-]{3,40}$/.test(p.invite||'')?p.invite:null,expires:time+ttl});return {limited:false};}).then(r=>{if(r.limited)throw new SocialError('limited',429);});
    return reply({authorizationUrl:authorizationUrl(provider,attempt,env)},200,[cookie(attemptName(state),binding,600,true)]);
   }
   if(callback){
    const q=provider==='apple'?p:Object.fromEntries(url.searchParams),state=q.state;
    if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state)||!browser[attemptName(state)])throw new SocialError('expired');
    clear=[cookie(attemptName(state),'',0,true)];
    const attempt=await transact(s=>{clean(s,time);const a=s.socialAttempts.find(a=>a.digest===sha(state)&&a.provider===provider&&equal(a.binding,sha(browser[attemptName(state)])));if(!a)throw new SocialError('expired');s.socialAttempts=s.socialAttempts.filter(x=>x!==a);return a;});
    if(q.error)throw new SocialError(q.error==='access_denied'||q.error==='user_cancelled_authorize'?'cancelled':'provider-denied');
    // Never hold the DB lock during requests to Google, Apple or Meta.
    const identity=await exchange(provider,q.code,attempt,env,{now:time});
    const ticket=random();await transact(s=>{clean(s,time);resolve(s,identity);if(s.socialPending.length>=1000)throw new SocialError('busy',503);s.socialPending.push({digest:sha(ticket),identity,entry:attempt.entry,invite:attempt.invite,tries:0,expires:time+ttl});});
    return redirect(origin+'/#social',[...clear,cookie(pendingName,ticket)]);
   }
   const ticket=browser[pendingName];
   if(!/^[A-Za-z0-9_-]{43}$/.test(ticket||'')){
    const authenticated=await transact(s=>{const u=userFor(s,browser.sid);return u&&!u.demo&&!u.adminOnly?{ok:true,...(!u.emailVerified?{pendingVerification:true,identity:u.email}:{})}:null;});
    if(authenticated)return reply(route==='social-status'?{ready:true}:authenticated);
    throw new SocialError('expired');
   }
   const out=await transact(s=>{
    clean(s,time);const pending=s.socialPending.find(x=>x.digest===sha(ticket));if(!pending)throw new SocialError('expired');const identity=pending.identity,result=resolve(s,identity),user=result.user;
    const context={provider:identity.provider,email:identity.email,entry:pending.entry,invite:pending.invite};
    if(route==='social-status')return {data:{...context,ready:user?!!(result.linked||result.automatic):!!identity.email,requiresPassword:!!user&&!result.linked&&!result.automatic,requiresUsername:false,requiresEmail:!identity.email}};
    if(pending.completed){const u=s.users.find(u=>u.id===pending.completed.uid&&!u.demo&&!u.adminOnly);if(!u)throw new SocialError('expired');s.sessions=s.sessions.filter(x=>x.token!==pending.completed.sessionDigest);const sid=session(s,u.id);pending.completed.sessionDigest=sha(sid);return {data:{ok:true,...context,...(!u.emailVerified?{pendingVerification:true,identity:u.email}:{})},sid};}
    if(pending.tries>=5)return {status:429,data:{error:'Troppi tentativi. Riparti dall’accesso.',code:'limited'}};
    if(!identity.email&&p.email){let target;try{target=validEmail(p.email);}catch{throw new SocialError('email');}if(playersForEmail(s,target).length===1){pending.identity={...identity,email:target};return {data:{needsLink:true,email:target}};}}
    if(user&&!result.linked&&!result.automatic){pending.tries++;if(typeof p.password!=='string'||p.password.length>200||!checkPassword(user,p.password))return {status:401,data:{error:'Password non corretta. Puoi recuperarla oppure tornare all’accesso.',code:'password-required'}};}
    let u=user,mailId;
    if(!u){
     let target;try{target=identity.email||validEmail(p.email);}catch{throw new SocialError('email');}
     if(s.users.some(x=>String(x.email||'').toLowerCase()===target||x.pendingEmail===target))throw new SocialError('account-unavailable',409);
     if(identity.verified&&identity.authoritative){u={id:id(),name:accountNickname(s.users),email:target,emailVerified:true,emailVerifiedAt:new Date(time).toISOString(),createdAt:new Date(time).toISOString()};s.users.push(u);}
     else{u=registerAccount(s,{email:target,password:random()+random(),entry:pending.entry},env,time);delete u.password;delete u.salt;mailId=s.mailOutbox.at(-1)?.id;}
     u.nicknameSuggested=true;
    }else if(result.automatic&&!u.emailVerified){
     // An unverified signup could have been created by somebody else. Retire all old credentials.
     delete u.password;delete u.salt;s.sessions=s.sessions.filter(x=>x.uid!==u.id);const removed=new Set((s.accountTokens||[]).filter(x=>x.uid===u.id).map(x=>x.mailId));s.accountTokens=(s.accountTokens||[]).filter(x=>x.uid!==u.id);s.mailOutbox=(s.mailOutbox||[]).filter(x=>!removed.has(x.id));u.emailVerified=true;u.emailVerifiedAt=new Date(time).toISOString();delete u.pendingEmail;
    }
    if(!result.linked){const prior=s.socialIdentities.find(x=>x.provider===identity.provider&&x.uid===u.id);if(prior&&prior.subject!==identity.subject)throw new SocialError('account-conflict',409);s.socialIdentities.push({provider:identity.provider,subject:identity.subject,uid:u.id,createdAt:new Date(time).toISOString()});}
    onLogin(s,u);const sid=session(s,u.id);pending.completed={uid:u.id,sessionDigest:sha(sid)};
    return {data:{ok:true,...context,...(!u.emailVerified?{pendingVerification:true,identity:u.email}:{})},sid,mailId};
   });
   if(route==='social-status')return reply(out.data);
   if(out.mailId)try{await deliverMail(out.mailId);}catch{/* Account remains pending; the normal resend flow remains available. */}
   return reply(out.data,out.status||200,out.sid?[cookie('sid',out.sid,604800),cookie(pendingName,'',0)]:[]);
  }catch(e){const code=e instanceof SocialError?e.code:'unavailable',status=e instanceof SocialError?e.status:503;
   if(callback){let origin;try{origin=socialOrigin(env);}catch{return reply({error:'Accesso social non disponibile.',code:'configuration'},503);}return redirect(origin+'/#social-error='+encodeURIComponent(code),clear);}
   const messages={expired:'Accesso scaduto. Premi di nuovo il pulsante per riprovare.',email:'Inserisci un indirizzo email valido.','account-unavailable':'Email già utilizzata. Accedi al tuo account per mantenerne i dati.','account-conflict':'Questo collegamento richiede una verifica: usa l’accesso con email e password.','admin-only':'L’amministratore di sistema accede dalla pagina amministrativa.',limited:'Troppi tentativi. Riprova tra 15 minuti.'};
   return reply({error:messages[code]||'Accesso social non disponibile al momento. Puoi usare email e password.',code},status);
  }
 };
}
