// Loopback-only auction with a synthetic PostgreSQL fixture. No .env.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {fixtureDb} from '../test/fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';import {attachAuctionSocket} from '../runtime/auction-socket.mjs';
const fixture=await fixtureDb(),bus=new EventEmitter(),base=sqlFantaStore(fixture),store={...base,league:async(uid,id,fn,options)=>{const result=await base.league(uid,id,fn,options);if(options?.write)bus.emit('change',id);return result;}},api=createFantaApi({store}),root=path.resolve('public');
const computer=process.argv.includes('--computer'),mixed=process.argv.includes('--mixed'),online=computer||mixed||process.argv.includes('--online');
const port=Number(process.env.AUCTION_PREVIEW_PORT||(computer?8927:mixed?8930:online?8929:8896));
const startPreview=online
 ?`await api.auctionSchedule(league,{type:'iniziale',mode:'live',computerTeams:${computer||mixed},startsAt:new Date(Date.now()+60000).toISOString()});await api.auctionStart(league);`
 :"await api.auctionStartNow(league,'manual');";
const startLabel=computer?'Apri asta online contro il computer':mixed?'Apri asta mista di prova':online?'Apri asta online tra partecipanti':'Apri asta di prova · banditore';
if(mixed){
 await fixture.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES('t3','fanta-lucas-a','Real Divano','Computer')");
 await fixture.db.query(`UPDATE fanta.players SET name='Centravanti di prova',data='{"value":100}' WHERE id='free'`);
}
if(computer){
 await fixture.db.query("UPDATE fanta.teams SET user_id=NULL,name='Real Divano',manager='Computer' WHERE id='t2'");
 await fixture.db.query(`UPDATE fanta.players SET name='Centravanti di prova',data='{"value":100}' WHERE id='free'`);
 const session={uid:'u1',token:createHash('sha256').update('preview-second-device').digest('hex'),expires:Date.now()+3600000};
 await fixture.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{sessions}',payload->'sessions'||$1::jsonb)",[JSON.stringify([session])]);
}
const server=http.createServer(async(req,res)=>{try{
 const origin='http://'+req.headers.host,u=new URL(req.url,origin);res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
 if(/^\/_test\/login\/[12]$/.test(u.pathname)){const device=u.pathname.at(-1),token=computer&&device==='2'?'preview-second-device':'token'+device;res.writeHead(302,{'Set-Cookie':'sid='+token+'; HttpOnly; SameSite=Strict; Path=/','Location':'/'});res.end();return;}
 if(u.pathname.startsWith('/fanta-api/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),r=await api(new Request(u,{method:req.method,headers:req.headers,...(body.length?{body}: {})}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Socket.IO · Prova isolata</title>${['styles','v2','fanta','fanta-integrations','studio-formazione','ux-review'].map(s=>'<link rel="stylesheet" href="/'+s+'.css">').join('')}<body><p style="font:10px Arial;text-align:center;color:#eac77e">PROVA LOCALE · dati sintetici</p><button id="start-proof" style="min-height:44px">${startLabel}</button><p id="proof-status" role="status"></p><div id="app"></div><div id="v2-sheet-root" hidden></div><script type="module">import {mountFanta} from '/src/fanta/app.mjs';import {createFantaApi} from '/src/fanta/api.mjs';const api=createFantaApi(),league='fanta-lucas-a';mountFanta(document.querySelector('#app'),{api,initialTab:'oggi'});document.querySelector('#start-proof').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{${startPreview}document.querySelector('#proof-status').textContent='Asta avviata.';}catch(error){document.querySelector('#proof-status').textContent=error.message;button.disabled=false;}};</script></body></html>`);return;}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(500);res.end('Preview error');}});
const origin='http://127.0.0.1:'+port,secondOrigin='http://localhost:'+port;
const hub=await attachAuctionSocket(server,{store,origin,allowedOrigins:[origin,secondOrigin],subscribe:cb=>{bus.on('change',cb);return()=>bus.off('change',cb);}});
server.listen(port,'127.0.0.1',()=>console.log(`Prima sessione ${origin}/_test/login/1 | Seconda sessione ${secondOrigin}/_test/login/2`));
process.on('SIGINT',async()=>{await hub.close();await fixture.close();process.exit(0);});
