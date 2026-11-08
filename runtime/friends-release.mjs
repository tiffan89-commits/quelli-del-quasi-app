import http from 'node:http';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';

const cookieName='__Host-quasi-friends';
const prefix='/_friends/assets/';
const ttl=12*60*60*1000;
const sha=value=>createHash('sha256').update(value).digest('hex');
const emailKey=value=>String(value||'').trim().toLowerCase();
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
const session=req=>{const token=cookie(req,'sid');return /^[A-Za-z0-9_-]{43}$/.test(token)?sha(token):null;};
const assetName=/^(?:chunks\/)?[a-zA-Z0-9_-]+\.(?:mjs|css)$/;
const same=(a,b)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

export function configReader(filename){
 return async()=>{
  const config=JSON.parse(await readFile(filename,'utf8'));
  if(typeof config.enabled!=='boolean'||!/^[a-f0-9]{7,40}$/.test(config.revision||'')||!Array.isArray(config.emails))throw Error('Configurazione Friends & Family non valida');
  return {...config, emails:new Set(config.emails.map(emailKey).filter(Boolean))};
 };
}

export function shellHtml(html,channel,revision){
 const marker=`<meta name="qdq-release-channel" content="${channel}"><script src="/_friends/channel.js" defer></script>`;
 if(channel==='friends')html=html.replaceAll('"/build/',`"${prefix}${revision}/`);
 return html.replace('</head>',marker+'</head>');
}

const clearCookie=()=>`${cookieName}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;
export function createFriendsRelease({stableDir,candidateDir,loadConfig,identify,secret,now=Date.now,onError=()=>{}}){
 if(!secret||Buffer.byteLength(secret)<32)throw Error('Chiave di firma Friends & Family mancante');
 const stable=resolve(stableDir),releases=resolve(candidateDir);
 const sign=value=>createHmac('sha256',secret).update(value).digest('base64url');
 const subject=email=>sign('account:'+emailKey(email));
 const pack=(revision,tokenHash,person,expires)=>{const body=[revision,tokenHash,subject(person),expires].join('.');return body+'.'+sign(body);};
 function validAsset(req,config,revision){
  const tokenHash=session(req),value=cookie(req,cookieName);
  if(!config.enabled||!tokenHash||revision!==config.revision||value.length>240)return false;
  const [rev,sid,key,expires,signature,extra]=value.split('.');
  if(extra!==undefined||rev!==revision||sid!==tokenHash||!/^\d{13}$/.test(expires||'')||Number(expires)<=now()||!/^[A-Za-z0-9_-]{43}$/.test(signature||''))return false;
  if(![...config.emails].some(email=>subject(email)===key))return false;
  return same(sign([rev,sid,key,expires].join('.')),signature);
 }
 async function choose(req,config){
  const hash=session(req);
  if(!config?.enabled||!config.emails.size||!hash)return null;
  const account=await identify(hash,config.emails);
  if(!account||!config.emails.has(emailKey(account.email))||Number(account.expires)<=now())return null;
  return {hash,email:account.email,expires:Math.min(Number(account.expires),now()+ttl)};
 }
 return http.createServer(async(req,res)=>{
  const send=(status,body='',headers={})=>{res.writeHead(status,{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers});res.end(req.method==='HEAD'?undefined:body);};
  try{
   if(!['GET','HEAD'].includes(req.method))return send(405);
   const url=new URL(req.url,'http://localhost');
   if(url.origin!=='http://localhost')return send(400);
   const pathname=url.pathname;
   if(pathname==='/healthz')return send(200,'{"ok":true}',{'Content-Type':'application/json'});
   if(pathname==='/_friends/channel.js')return send(200,await readFile(new URL('./friends-release-client.js',import.meta.url)),{'Content-Type':'text/javascript; charset=utf-8'});
   const asset=pathname.startsWith(prefix)?pathname.slice(prefix.length).match(/^([a-f0-9]{7,40})\/(.+)$/):null;
   const isShell=pathname==='/'||pathname==='/index.html'||pathname.startsWith('/invito/');
   if(!asset&&!isShell&&pathname!=='/_friends/channel')return send(404);
   let config;
   try{config=await loadConfig();}catch(error){onError(error);}
   if(asset){
    if(!config||!assetName.test(asset[2])||!validAsset(req,config,asset[1]))return send(404);
    const file=resolve(releases,asset[1],'build',asset[2]);
    const size=(await stat(file)).size;
    res.writeHead(200,{'Content-Type':extname(file)==='.css'?'text/css; charset=utf-8':'text/javascript; charset=utf-8',
     'Content-Length':size,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'});
    if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    return;
   }
   let person,html;
   try{
    person=await choose(req,config);
    if(person)html=await readFile(resolve(releases,config.revision,'index.html'),'utf8');
   }catch(error){person=null;onError(error);}
   const channel=person?'friends':'stable';
   const headers={'X-Quasi-Release':person?`friends-${config.revision}`:'stable'};
   if(person){
    headers['Set-Cookie']=`${cookieName}=${pack(config.revision,person.hash,person.email,person.expires)}; Max-Age=${Math.max(0,Math.floor((person.expires-now())/1000))}; Path=/; Secure; HttpOnly; SameSite=Strict`;
    headers['X-Robots-Tag']='noindex, nofollow';
   }else if(cookie(req,cookieName))headers['Set-Cookie']=clearCookie();
   if(!isShell)return send(200,JSON.stringify({channel,revision:person?config.revision:null}),{...headers,'Content-Type':'application/json'});
   html??=await readFile(resolve(stable,'index.html'),'utf8');
   return send(200,shellHtml(html,channel,config?.revision),{...headers,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
  }catch(error){
   if(error.code==='ENOENT')return send(404);
   onError(error);if(!res.headersSent)send(503);else res.destroy();
  }
 });
}

const identitySql=`SELECT u->>'email' AS email, (a->>'expires')::numeric AS expires
 FROM fanta_state s
 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'sessions') a
 JOIN LATERAL jsonb_array_elements(s.payload->'users') u ON u->>'id'=a->>'uid'
 WHERE s.id=1 AND a->>'token'=$1 AND (a->>'expires')::numeric>$2
 AND u->>'emailVerified'='true' AND u->>'adminOnly' IS DISTINCT FROM 'true'
 AND u->>'demo' IS DISTINCT FROM 'true' AND lower(u->>'email')=ANY($3::text[])
 LIMIT 1`;
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {DATABASE_URL,FRIENDS_STABLE_DIR,FRIENDS_CANDIDATE_DIR,FRIENDS_CONFIG,FRIENDS_PORT,FRIENDS_SIGNING_KEY}=process.env;
 if(!DATABASE_URL||!FRIENDS_STABLE_DIR||!FRIENDS_CANDIDATE_DIR||!FRIENDS_CONFIG)throw Error('Configurazione server Friends & Family mancante');
 const db=new Pool({connectionString:DATABASE_URL,max:2,connectionTimeoutMillis:1200,statement_timeout:1200,idleTimeoutMillis:15000});
 const server=createFriendsRelease({stableDir:FRIENDS_STABLE_DIR,candidateDir:FRIENDS_CANDIDATE_DIR,loadConfig:configReader(FRIENDS_CONFIG),secret:FRIENDS_SIGNING_KEY,
  identify:async(hash,emails)=>(await db.query(identitySql,[hash,Date.now(),[...emails]])).rows[0],
  onError:error=>console.error('FRIENDS_RELEASE',error.code||error.name)});
 server.listen(Number(FRIENDS_PORT)||8996,'127.0.0.1');
}
