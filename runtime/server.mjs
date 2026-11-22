import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {isIP} from 'node:net';
import {pathToFileURL} from 'node:url';
import {configure} from './config.mjs';
import {installRuntimeLogging} from './observability.mjs';
import {previewGate} from './preview-gate.mjs';
import {startMemoryGuard} from './memory-guard.mjs';
import packageInfo from '../package.json' with {type:'json'};
const mime={'.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.wasm':'application/wasm'};
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
export function requestIp(req,trust=false){const direct=req.socket.remoteAddress||'unknown';if(!trust)return direct;const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();return isIP(forwarded)?forwarded:direct;}
const friendlyPages=new Set(['/privacy','/fantacalcio-tra-amici','/asta-fantacalcio','/schedine-virtuali','/admin','/account']);
export function staticEncoding(header=''){const entries=String(header).split(',').map(item=>{const [name,...args]=item.trim().split(';'),quality=args.find(x=>x.trim().startsWith('q='));return {name:name.trim(),q:quality?Number(quality.trim().slice(2)):1};});return ['br','gzip'].map(name=>({name,q:entries.find(e=>e.name===name)?.q??entries.find(e=>e.name==='*')?.q??0})).filter(e=>e.q>0&&e.q<=1).sort((a,b)=>b.q-a.q)[0]?.name||null;}
export function createServer({api,fanta,scores,chatUpdate,leagueUpdate,origin=process.env.PUBLIC_ORIGIN,root=path.resolve('dist'),trustProxy=process.env.TRUST_PROXY==='true',bodyLimit=1024*1024}={}){
 const base=new URL(origin),staticRoot=path.resolve(root);
 const server=http.createServer(async(req,res)=>{
  const controller=new AbortController();req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
   const url=new URL(req.url,base);if(url.origin!==base.origin)return json(res,400,{error:'Invalid request target'});
   const preview=process.env.SELFHOST_TEST_INSTANCE==='true'||Boolean(process.env.SELFHOST_PREVIEW_KEY)||process.env.CONTEXT!=='production';
   if(preview||url.pathname.startsWith('/invito/'))res.setHeader('X-Robots-Tag','noindex, nofollow');
   const gate=previewGate(req,url);if(gate){res.writeHead(gate.status,Object.fromEntries(gate.headers));res.end(Buffer.from(await gate.arrayBuffer()));return;}
   if(url.pathname==='/healthz')return json(res,req.method==='GET'?200:405,{ok:req.method==='GET',version:packageInfo.version+'-selfhost'});
   if(process.env.SELFHOST_MAINTENANCE==='true'){res.setHeader('Retry-After','300');return json(res,503,{error:'Sito temporaneamente trasferito su Netlify. Riprova tra pochi minuti.'});}
   const handler=url.pathname.startsWith('/api/')?api:url.pathname.startsWith('/fanta-api/')?fanta:url.pathname==='/.netlify/functions/public-football'?scores:null;
   if(handler){
    let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>bodyLimit){req.resume();return json(res,413,{error:'Request too large'});}chunks.push(chunk);}
    const headers=new Headers();for(let i=0;i<req.rawHeaders.length;i+=2)headers.append(req.rawHeaders[i],req.rawHeaders[i+1]);headers.delete('x-nf-client-connection-ip');
    const body=Buffer.concat(chunks),request=new Request(url,{method:req.method,headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)&&body.length?{body}:{})});
    const response=await handler(request,{ip:requestIp(req,trustProxy),chatUpdate,leagueUpdate});if(!(response instanceof Response))throw Error('Invalid handler response');
    const outgoing=Object.fromEntries([...response.headers].filter(([k])=>k!=='set-cookie'));const cookies=response.headers.getSetCookie();if(cookies.length)outgoing['set-cookie']=cookies;
    res.writeHead(response.status,outgoing);if(response.body&&req.method!=='HEAD')Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);else res.end();return;
   }
   if(url.pathname.startsWith('/api')||url.pathname.startsWith('/fanta-api')||url.pathname.startsWith('/.netlify/')||url.pathname.split('/').some(p=>p.startsWith('.')))return json(res,404,{error:'Not found'});
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
   if(url.pathname==='/env.json')return json(res,200,{env:process.env.SELFHOST_TEST_INSTANCE==='true'?'preview':process.env.CONTEXT==='production'?'production':'preview',version:packageInfo.version,commit:'server-casa'});
   if(preview&&url.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:'User-agent: *\nDisallow: /\n');return;}
   const pathname=url.pathname==='/'||url.pathname.startsWith('/invito/')?'/index.html':friendlyPages.has(url.pathname)?url.pathname+'.html':decodeURIComponent(url.pathname),file=path.resolve(staticRoot,'.'+pathname);
   if(!file.startsWith(staticRoot+path.sep))return json(res,404,{error:'Not found'});
   let data,status=200,extension=path.extname(file);try{data=await fs.readFile(file);}catch(e){if(!['ENOENT','EISDIR'].includes(e.code))throw e;status=404;data=await fs.readFile(path.join(staticRoot,'404.html'));extension='.html';}
   let encoding=null;const requested=staticEncoding(req.headers['accept-encoding']);if(status===200&&requested&&/\.(mjs|js|css)$/.test(file)){try{data=await fs.readFile(file+(requested==='br'?'.br':'.gz'));encoding=requested;}catch(e){if(e.code!=='ENOENT')throw e;}}
   res.writeHead(status,{'Content-Type':mime[extension]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Vary':'Accept-Encoding',...(encoding?{'Content-Encoding':encoding}:{}),'Cache-Control':/\/build\/chunks\//.test(pathname)?'public,max-age=31536000,immutable':'public,max-age=0,must-revalidate'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(controller.signal.aborted)return;console.error('HTTP_FAILED',e.code||e.name);if(!res.headersSent)json(res,500,{error:'Servizio temporaneamente non disponibile'});else res.destroy();}
 });server.requestTimeout=30000;server.headersTimeout=15000;return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 configure();installRuntimeLogging('web');if(!process.env.DATABASE_URL)throw Error('DATABASE_URL obbligatorio');
 await startMemoryGuard();
 const {installInternalDispatch}=await import('./dispatch.mjs');installInternalDispatch();
 const [{default:api},{default:fanta},{default:scores},{closeDatabase}]=await Promise.all([import('../netlify/functions/api.mjs'),import('../netlify/functions/fanta-api.mjs'),import('../netlify/functions/public-football.mjs'),import('../lib/db.mjs')]);
 let auctionHub;
 const server=createServer({api,fanta,scores,chatUpdate:update=>auctionHub?.chatUpdate?.(update),leagueUpdate:update=>auctionHub?.leagueUpdate?.(update)});
 const {attachAuctionSocket}=await import('./auction-socket.mjs');
 const origin=process.env.PUBLIC_ORIGIN,aliases=new URL(origin).hostname==='quellidelquasi.com'?['https://casa.quellidelquasi.com','https://server.quellidelquasi.com']:[];
 const maintenance=process.env.SELFHOST_MAINTENANCE==='true';
 auctionHub=maintenance?{close:async()=>{}}:await attachAuctionSocket(server,{origin,allowedOrigins:[origin,...aliases]});
 const {attachSportsSocket}=await import('./sports-socket.mjs');const sportsHub=maintenance?{close:async()=>{}}:attachSportsSocket(auctionHub.io);
 const {listenSportsSaved}=await import('./sports-notifications.mjs');const sportsListener=maintenance?{close:async()=>{}}:listenSportsSaved(sportsHub.refresh,{lineupsSaved:sportsHub.lineupsSaved});
 server.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.info('QUASI_HTTP_READY'));
 let ending=false;const stop=async()=>{if(ending)return;ending=true;await sportsListener.close();await sportsHub.close();await auctionHub.close();await closeDatabase();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
