import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRemoteJWKSet,jwtVerify,SignJWT,importPKCS8,customFetch} from 'jose';

export class SocialError extends Error {constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a??'')).digest(),createHash('sha256').update(String(b??'')).digest());
export function socialOrigin(env=process.env){
 let u;try{u=new URL(env.PUBLIC_ORIGIN||env.APP_BASE_URL);}catch{throw new SocialError('configuration',503);}
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new SocialError('configuration',503);return u.origin;
}
export function socialProviders(env=process.env){
 try{socialOrigin(env);}catch{return [];}
 return ['google','facebook','apple'].filter(p=>p==='google'?env.GOOGLE_LOGIN_ENABLED==='true'&&env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET:p==='facebook'?env.FACEBOOK_LOGIN_ENABLED==='true'&&env.FACEBOOK_APP_ID&&env.FACEBOOK_APP_SECRET&&/^v\d{1,2}\.0$/.test(env.FACEBOOK_GRAPH_VERSION||''):env.APPLE_LOGIN_ENABLED==='true'&&env.APPLE_SERVICE_ID&&env.APPLE_TEAM_ID&&env.APPLE_KEY_ID&&env.APPLE_PRIVATE_KEY_FILE);
}
export const redirectUri=(provider,env)=>socialOrigin(env)+'/api/social-'+provider+'-callback';
export function authorizationUrl(provider,attempt,env){
 if(!socialProviders(env).includes(provider))throw new SocialError('unavailable',503);
 const base=provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':provider==='apple'?'https://appleid.apple.com/auth/authorize':'https://www.facebook.com/'+env.FACEBOOK_GRAPH_VERSION+'/dialog/oauth';
 const u=new URL(base);u.search=new URLSearchParams({client_id:provider==='google'?env.GOOGLE_OAUTH_CLIENT_ID:provider==='apple'?env.APPLE_SERVICE_ID:env.FACEBOOK_APP_ID,redirect_uri:redirectUri(provider,env),response_type:'code',scope:provider==='facebook'?'email':provider==='apple'?'email':'openid email',state:attempt.state});
 if(provider!=='facebook')u.searchParams.set('nonce',attempt.nonce);
 if(provider==='google'){u.searchParams.set('code_challenge',createHash('sha256').update(attempt.verifier).digest('base64url'));u.searchParams.set('code_challenge_method','S256');u.searchParams.set('prompt','select_account');}
 if(provider==='apple')u.searchParams.set('response_mode','form_post');return u.href;
}
async function json(url,options,fetcher){
 let r;try{r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new SocialError('provider-unavailable',503);}
 if(!r.ok)throw new SocialError('provider-denied',401);
 let data;
 try{const chunks=[],reader=r.body.getReader();let bytes=0;try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>256000)throw Error('size');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new SocialError('provider-invalid',502);}
 if(!data||typeof data!=='object'||Array.isArray(data)||data.error)throw new SocialError('provider-invalid',502);return data;
}
const resolvers=new Map();
export async function verifyIdentityToken(token,provider,attempt,env,{keyResolver,now=Date.now()}={}){
 if(!['google','apple'].includes(provider)||typeof token!=='string'||token.length>20000)throw new SocialError('provider-invalid',401);
 if(!keyResolver){if(!resolvers.has(provider))resolvers.set(provider,createRemoteJWKSet(new URL(provider==='google'?'https://www.googleapis.com/oauth2/v3/certs':'https://appleid.apple.com/auth/keys'),{cacheMaxAge:3600000,timeoutDuration:10000,[customFetch]:(url,options)=>fetch(url,{...options,redirect:'error'})}));keyResolver=resolvers.get(provider);}
 try{
  const audience=provider==='google'?env.GOOGLE_OAUTH_CLIENT_ID:env.APPLE_SERVICE_ID;
  const {payload:c}=await jwtVerify(token,keyResolver,{algorithms:['RS256'],issuer:provider==='google'?['https://accounts.google.com','accounts.google.com']:'https://appleid.apple.com',audience,requiredClaims:['sub','iss','aud','exp','iat','nonce'],maxTokenAge:'10m',clockTolerance:5,currentDate:new Date(now)});
  if(!equal(c.nonce,attempt.nonce)||typeof c.sub!=='string'||c.sub.length>255||!c.sub||c.azp&&c.azp!==audience)throw Error('claims');
  const verified=c.email_verified===true||c.email_verified==='true';
  const email=typeof c.email==='string'&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.email)&&c.email.length<=254?c.email.trim().toLowerCase():null;
  if(!email||!verified)throw Error('email');
  // Google is authoritative for Gmail and verified Workspace domains, not every third-party address.
  const authoritative=provider==='apple'||email.endsWith('@gmail.com')||email.endsWith('@googlemail.com')||typeof c.hd==='string'&&c.hd.toLowerCase()===email.split('@')[1];
  return {provider,subject:c.sub,email,verified:true,authoritative};
 }catch{throw new SocialError('provider-invalid',401);}
}
export async function appleSecret(env,{now=Date.now(),read=readFile}={}){
 try{const key=await importPKCS8(await read(env.APPLE_PRIVATE_KEY_FILE,'utf8'),'ES256');return await new SignJWT({}).setProtectedHeader({alg:'ES256',kid:env.APPLE_KEY_ID}).setIssuer(env.APPLE_TEAM_ID).setSubject(env.APPLE_SERVICE_ID).setAudience('https://appleid.apple.com').setIssuedAt(Math.floor(now/1000)).setExpirationTime(Math.floor(now/1000)+600).sign(key);}catch{throw new SocialError('configuration',503);}
}
export async function exchangeSocialCode(provider,code,attempt,env,{fetcher=fetch,keyResolver,now=Date.now()}={}){
 if(!socialProviders(env).includes(provider))throw new SocialError('unavailable',503);
 if(typeof code!=='string'||!code||code.length>4096)throw new SocialError('provider-invalid');
 const version=env.FACEBOOK_GRAPH_VERSION;
 const endpoint=provider==='google'?'https://oauth2.googleapis.com/token':provider==='apple'?'https://appleid.apple.com/auth/token':'https://graph.facebook.com/'+version+'/oauth/access_token';
 const fields={client_id:provider==='google'?env.GOOGLE_OAUTH_CLIENT_ID:provider==='apple'?env.APPLE_SERVICE_ID:env.FACEBOOK_APP_ID,client_secret:provider==='google'?env.GOOGLE_OAUTH_CLIENT_SECRET:provider==='apple'?await appleSecret(env,{now}):env.FACEBOOK_APP_SECRET,code,redirect_uri:redirectUri(provider,env),grant_type:'authorization_code'};
 if(provider==='google')fields.code_verifier=attempt.verifier;
 const result=await json(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString()},fetcher);
 if(provider!=='facebook')return verifyIdentityToken(result.id_token,provider,attempt,env,{keyResolver,now});
 if(typeof result.access_token!=='string'||result.access_token.length>10000)throw new SocialError('provider-invalid',401);
 const debug=new URL('https://graph.facebook.com/'+version+'/debug_token');debug.searchParams.set('input_token',result.access_token);
 const {data}=await json(debug.href,{headers:{Authorization:'Bearer '+env.FACEBOOK_APP_ID+'|'+env.FACEBOOK_APP_SECRET}},fetcher);
 if(!data?.is_valid||String(data.app_id)!==String(env.FACEBOOK_APP_ID)||typeof data.user_id!=='string'||data.expires_at*1000<=now||!Number.isFinite(data.expires_at)||data.data_access_expires_at&&data.data_access_expires_at*1000<=now)throw new SocialError('provider-invalid',401);
 const me=new URL('https://graph.facebook.com/'+version+'/me');me.searchParams.set('fields','id,email');me.searchParams.set('appsecret_proof',createHmac('sha256',env.FACEBOOK_APP_SECRET).update(result.access_token).digest('hex'));
 const user=await json(me.href,{headers:{Authorization:'Bearer '+result.access_token}},fetcher);
 if(user.id!==data.user_id)throw new SocialError('provider-invalid',401);
 return {provider,subject:user.id,email:typeof user.email==='string'&&user.email.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user.email)?user.email.toLowerCase():null,verified:false,authoritative:false};
}
