// Isolated preview: reads exported public sports files, writes no production database.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {randomBytes} from 'node:crypto';import {Server} from 'socket.io';
import {labAuction,replaySnapshot,replayMatch} from '../fanta/live-lab.mjs';import {auctionAction,auctionView,auctionTickDue} from '../fanta/auction.mjs';import {computerDecision} from '../fanta/auction-computer.mjs';
const prefix='/laboratorio',root=path.resolve('public'),dir=path.resolve('outputs/live-lab'),{fixtures}=JSON.parse(await fs.readFile(path.join(dir,'fixtures.json'),'utf8')),catalog=JSON.parse(await fs.readFile(path.join(dir,'catalog.json'),'utf8'));
const rooms=new Map();let phase=35,paused=false,version=1,frame=replaySnapshot(fixtures,phase);
const getCookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('quasi_lab='))?.slice(10);
const html=()=>`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Il laboratorio del Quasi</title>${['styles','v2','fanta','fanta-integrations','studio-formazione','lineup-pitch','live-lab'].map(s=>`<link rel="stylesheet" href="${prefix}/${s}.css">`).join('')}<body><div id="lab"></div><dialog id="lab-player"></dialog><script src="${prefix}/socket.io/socket.io.js"></script><script type="module" src="${prefix}/src/live-lab.mjs"></script></body></html>`;
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),pathname=u.pathname.startsWith(prefix)?u.pathname.slice(prefix.length)||'/':u.pathname;res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex,nofollow');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(pathname==='/accesso'||pathname==='/accesso/'){
  res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Registrazione · anteprima</title><link rel="stylesheet" href="${prefix}/styles.css"><link rel="stylesheet" href="${prefix}/pubblico.css"><body class="public-area"><p style="text-align:center;color:#d6f77b;font:12px Arial">PROVA ISOLATA · account simulati, nessuna email inviata</p><div id="app"></div><script type="module">import {mountPublic} from '${prefix}/src/pubblico/app.mjs';import {createFakePublicApi} from '${prefix}/src/pubblico/api.mjs';const api=createFakePublicApi();api.features=async()=>({barDemo:true,socialProviders:['google']});api.socialStart=async()=>{throw Error('Questa anteprima simula solo il modulo email.');};mountPublic(document.querySelector('#app'),{api});</script></body></html>`);return;
 }
 if(pathname==='/'||pathname==='/index.html'){

  let token=getCookie(req),r=rooms.get(token);if(!r){token=randomBytes(24).toString('hex');r={state:labAuction(catalog,token),offset:0,expires:Date.now()+2*3600000,requests:new Map()};if(rooms.size>=30){res.writeHead(503);res.end('Prova occupata');return;}rooms.set(token,r);res.setHeader('Set-Cookie','quasi_lab='+token+'; Path='+prefix+'; HttpOnly; SameSite=Strict; Max-Age=7200'+(req.headers['x-forwarded-proto']==='https'?'; Secure':''));}
  res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html());return;
 }
 if(pathname==='/healthz'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,preview:true,phase,rooms:rooms.size}));return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))throw Error('path');const ext=path.extname(file);if(!['.css','.mjs','.svg','.woff2'].includes(ext)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',{'.css':'text/css','.mjs':'text/javascript','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]);res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end('Non disponibile');}});
const io=new Server(server,{path:prefix+'/socket.io',transports:['websocket'],maxHttpBufferSize:4096,perMessageDeflate:false,allowRequest:(req,done)=>done(null,['https://quellidelquasi.com','https://casa.quellidelquasi.com','http://127.0.0.1:8898','http://localhost:8898'].includes(req.headers.origin))});
io.use((s,next)=>{const token=getCookie(s.request),room=rooms.get(token);if(!room||room.expires<Date.now())return next(Error('Riapri la pagina della prova.'));s.data.token=token;s.data.room=room;next();});
const current=r=>auctionView(r.state,'lab-player',Date.now()+r.offset);
function pushAuction(token,r){io.to(token).emit('auction:update',current(r));}
const publicFrame=()=>({...frame,matches:frame.matches.map(({players,...m})=>m)});
const casePlayer=replayMatch(fixtures[0],99).players.find(p=>p.id==='af:327774');
function sendPlayer(s){const choice=s.data.player,p=choice==='case'?casePlayer:frame.matches.find(m=>m.id===choice?.match)?.players.find(p=>p.id===choice?.id);if(p){const key=JSON.stringify([p.vote,p.rawVote,p.events,p.status]);if(s.data.playerKey!==key){s.data.playerKey=key;s.emit('player:update',p);}}}
function pushReplay(){frame={...replaySnapshot(fixtures,phase),version:++version,paused};io.emit('sports:update',publicFrame());for(const s of io.sockets.sockets.values())if(s.data.player)sendPlayer(s);}
io.on('connection',s=>{
 const r=s.data.room;s.join(s.data.token);s.emit('sports:update',publicFrame());s.emit('auction:update',current(r));s.on('lab:catalog',()=>s.emit('lab:catalog',r.state.players.map(({id,name,club,role,value,fm,status})=>({id,name,club,role,value,fm,status}))));
 s.on('lab:player',choice=>{s.data.player=choice;s.data.playerKey=null;sendPlayer(s);});
 let last=0,count=0;
 s.on('lab:command',(message,ack=()=>{})=>{try{
  if(Date.now()-last>1000){last=Date.now();count=0;}if(++count>12)throw Error('Un comando alla volta.');
  if(!message||typeof message.id!=='string'||message.id.length>80)throw Error('Comando non valido');if(r.requests.has(message.id))return ack(r.requests.get(message.id));
  const kind=message.kind,input=message.input||{},now=Date.now()+r.offset;
  if(kind==='replay:pause'){paused=!paused;pushReplay();}
  else if(kind==='replay:restart'){phase=8;paused=false;pushReplay();}
  else if(kind==='replay:final'){phase=99;paused=true;pushReplay();}
  else if(kind==='auction:reset'){r.state=labAuction(catalog,s.data.token);r.offset=0;pushAuction(s.data.token,r);}
  else if(kind==='auction:skip'){const a=r.state.auction,at=Date.parse(a.lot?.endsAt||a.pausedUntil||a.callDeadline);if(Number.isFinite(at)){r.offset+=Math.max(0,at-now)+20;r.state=auctionAction(r.state,'read',{},'lab-player',{now:Date.now()+r.offset});pushAuction(s.data.token,r);}}
  else {const action=({'auction:start':'start-now','auction:nominate':'nominate','auction:bid':'bid','auction:pass':'pass','auction:cancel':'cancel-lot','auction:close':'close'})[kind];if(!action)throw Error('Comando non valido');if(message.version!==r.state.auction.version)throw Error('L’asta è avanzata. Controlla l’offerta attuale.');r.state=auctionAction(r.state,action,action==='start-now'?{type:'iniziale',mode:'live'}:input,'lab-player',{admin:true,now});pushAuction(s.data.token,r);}
  const result={ok:true};r.requests.set(message.id,result);if(r.requests.size>100)r.requests.delete(r.requests.keys().next().value);ack(result);
 }catch(e){ack({ok:false,error:e.message});}});
});
const ticker=setInterval(()=>{for(const [token,r]of rooms){if(r.expires<Date.now()){io.in(token).disconnectSockets(true);rooms.delete(token);continue;}const now=Date.now()+r.offset;try{if(auctionTickDue(r.state.auction,now)){r.state=auctionAction(r.state,'read',{},'lab-player',{now});pushAuction(token,r);}const cmd=computerDecision(r.state,{now});if(cmd){r.state=auctionAction(r.state,cmd.kind,cmd.input,null,{computerTeam:cmd.teamId,now});pushAuction(token,r);}}catch(e){console.error('LAB_AUCTION',e.message);}}},500);
const replay=setInterval(()=>{if(!paused&&phase<99){phase=Math.min(99,phase+3);pushReplay();}},5000);
server.listen(8898,'127.0.0.1',()=>console.log('LAB_READY http://127.0.0.1:8898/laboratorio/'));
process.on('SIGTERM',()=>{clearInterval(ticker);clearInterval(replay);io.close();server.close();});
process.on('SIGINT',()=>{clearInterval(ticker);clearInterval(replay);io.close();server.close();});
