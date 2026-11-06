import http from 'node:http';
import {createNativePreview} from './preview-fanta.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {emptyState} from '../lib/db.mjs';
import {newLeague,hash,session,placeSlip,settle} from '../lib/game.mjs';
import {ensureCalendar} from '../lib/calendar.mjs';
import {memoryPlayerStore} from '../lib/player-store.mjs';
import {REWARD_CATALOG} from '../public/src/reward-catalog.mjs';
import {createHash} from 'node:crypto';
import {createApi} from '../netlify/functions/api.mjs';
import {decodeMail} from '../lib/mail.mjs';
import {uxViewport} from './ux-viewport.mjs';
process.env.ENABLE_DEMO='true';process.env.CONTEXT='dev';
const root=process.env.PREVIEW_ASSET_ROOT?path.resolve(process.env.PREVIEW_ASSET_ROOT):fileURLToPath(new URL('../public/',import.meta.url));
const publicPreview=process.env.PREVIEW_PUBLIC==='1',previewPassword=process.env.PREVIEW_PASSWORD||'QuasiLocale26!';
if(publicPreview&&(previewPassword.length<20||process.env.PREVIEW_AUTO_AUTH==='1'||process.env.PREVIEW_MAILBOX==='1'))throw Error('Public preview requires private credentials and no automatic authentication/mailbox');
const state=emptyState();ensureCalendar(state);
const u={id:'v2-local-player',username:'anteprima',name:'Il Quasi di prova',email:'anteprima@example.test',emailVerified:true,salt:'local-v2-salt',password:hash(previewPassword,'local-v2-salt')};
const rival={id:'v2-local-rival',username:'geometra',name:'Il Geometra',emailVerified:true};state.users.push(u,rival);
const a=newLeague(state,u,'Il Bar v2 · Anteprima',true),b=newLeague(state,rival,'Il Bar degli Ospiti',true);a.code='V2LOCAL';const invitationLeague=newLeague(state,rival,'Gli invitati del Bar',true);invitationLeague.demo=false;invitationLeague.code='V2INVITO';b.members.push({uid:u.id,initial:350,credits:350,points:2});
a.members.push({uid:rival.id,initial:500,credits:500,points:5});
a.branding={emblem:'BQ',accent:'#d6f77b',motto:'Qui si prova tutto in locale.'};
const odds={'1':2.1,'X':3.2,'2':3.4,'1X':1.3,'12':1.25,'X2':1.7,'Goal':1.8,'No Goal':1.9,'Under 2.5':1.8,'Over 2.5':1.95};
function addRound(league,source,number,key,names){
 const kickoff=new Date(Date.now()+2*86400000).toISOString();
 const r={id:'v2-'+league.id+'-'+source+'-'+(key||'a'),league:league.id,source,number,title:'Giornata '+number,kickoff,deadline:kickoff,rules:structuredClone(league.rules),slips:[],settled:false,...(key?{competitionKey:key,competitionName:'Lega '+(key.endsWith('b')?'B':'A'),virtualBookmaker:true}:{}),matches:names.map(([home,away],i)=>({id:(key||source)+'-'+i,home,away,kickoff,odds:{...odds},status:'NS',score:null}))};state.rounds.push(r);return r;
}
const pairs=[['Inter','Juventus'],['Milan','Roma'],['Napoli','Atalanta']];
addRound(a,'seriea',11,null,pairs);addRound(b,'seriea',11,null,pairs);
const f=addRound(a,'fantacalcio',8,'fc:local-a',[['SamBuca Juniors','Fly Emigrates'],['FC 41 bis','Don Falcone']]);
addRound(a,'fantacalcio',7,'fc:local-b',[['La Quasi Perfetta','Quasi United'],['Real Gin','AC Ciaccola']]);

const live=addRound(a,'seriea',10,'live',pairs);delete live.virtualBookmaker;live.competitionKey=null;live.kickoff=live.deadline=new Date(Date.now()-3600000).toISOString();live.matches.forEach((m,i)=>Object.assign(m,{status:i?'FT':'LIVE',score:i?[2,1]:null,liveScore:i?null:[0,0],clock:i?null:"12'"}));live.slips=[{uid:u.id,picks:Object.fromEntries(live.matches.map(m=>[m.id,'1'])),stake:10,odds:9.261,savedAt:new Date().toISOString()}];
live.matches[0].details={complete:false,updatedAt:new Date().toISOString(),events:[{kind:'yellow',minute:"8'",team:'Juventus',side:'away',players:['Il Difensore di prova']}]};
state.football.calendar.rounds.push({number:40,date:live.kickoff,matches:live.matches});
let tail=Promise.resolve();const transact=fn=>{const result=tail.then(()=>fn(state,{query:async()=>({rows:[{attempts:1}]})}));tail=result.catch(()=>{});return result;};
const mediaRows=[];
let mediaManifest;try{mediaManifest=JSON.parse(await fs.readFile(new URL('../.preview-media/manifest.json',import.meta.url),'utf8'));}catch{mediaManifest=[];}
for(let i=0;i<mediaManifest.length;i++){
 const item=mediaManifest[i],data=await fs.readFile(new URL('../.preview-media/'+item.id+'.png',import.meta.url));
 const mime=data[0]===137?'image/png':data[0]===255?'image/jpeg':'image/webp';let asset={data,mime,digest:item.digest};
 if(process.env.PREVIEW_OPTIMIZE!=='0'){const {optimizePortrait}=await import('../lib/image-optimize.mjs');try{asset=await optimizePortrait(data,mime);}catch(error){console.warn('Fixture portrait retained:',item.id,error.message);}}
 mediaRows.push({id:'apifootball:'+item.id,providerId:String(item.id),season:'2026',team:i<11?'inter':'juventus',name:'Giocatore '+(i+1),...asset});
}
live.matches[0].lineups={kind:'probable',sourceCount:5,updatedAt:new Date().toISOString(),teams:['Inter','Juventus'].map((team,k)=>({team,formation:'4-4-2',players:Array.from({length:11},(_,i)=>({id:'preview-'+k+'-'+i,name:mediaRows[k*11+i]?.name||['Portiere','Terzino','Difensore','Centrale','Laterale','Mediano','Regista','Mezzala','Esterno','Punta','Attaccante'][i],role:i===0?'P':i<5?'D':i<9?'C':'A',jersey:i+1,club:team,probability:80})),bench:Array.from({length:5},(_,i)=>({id:'bench-'+k+'-'+i,name:'Riserva '+(i+1),role:'C',jersey:12+i,probability:25}))}))};
state.playerRewards={[u.id]:[{round:'fixture-awards',league:a.id,leagueName:a.name,title:'Giornata dimostrativa',competitionName:'Serie A',ids:REWARD_CATALOG.filter(r=>r.type==='room').slice(0,12).map(r=>r.id),earnedAt:new Date().toISOString(),reason:'Premi sintetici per la prova'}]};
for(let i=0;i<10;i++){const member={id:'perf-member-'+i,username:'quasi'+i,name:'Il Quasi '+i,emailVerified:true,avatar:{room:'base-room-'+String(i+1).padStart(2,'0')}};state.users.push(member);a.members.push({uid:member.id,initial:500,credits:500,points:i});}

// Demo "Le schedine del Bar": due giornate chiuse, sei pronosticatori con Quasi e stili diversi (si vede anche l'evoluzione).
{
 const cast=[['v2-bar-cugino','Il Cugino Informato',{character:'male',hair:'short',hairColor:'#75452d',skin:'#dca274',beard:'stubble',outfit:'jacket',color:'#4d78a6',accessory:'whistle',room:'base-room-02'}],['v2-bar-peppe','Zio Peppe',{character:'male',hair:'bald',skin:'#b77952',beard:'moustache',outfit:'scarf',color:'#bd514b',accessory:'ticket',body:'stocky',room:'base-room-03'}],['v2-bar-vale','La Vale',{character:'female',hair:'long',hairColor:'#ad5036',skin:'#f3c8a2',outfit:'stripes',color:'#ec8758',accessory:'ball',body:'slim',room:'base-room-04'}],['v2-bar-capitano','Capitan Sicuro',{character:'male',hair:'curly',hairColor:'#30251f',skin:'#875539',outfit:'jersey',color:'#a6d4b4',accessory:'none',body:'athletic',room:'base-room-05'}],['v2-bar-debuttante','Il Debuttante',{character:'neutral',hair:'wave',hairColor:'#ca943e',skin:'#f3c8a2',outfit:'jersey',color:'#8b6da4',accessory:'ticket',room:'base-room-06'}]];
 u.avatar={character:'female',hair:'wave',hairColor:'#30251f',skin:'#dca274',outfit:'jersey',color:'#a6d4b4',accessory:'ball',room:'base-room-01'};
 rival.avatar={character:'male',hair:'bun',hairColor:'#537a8a',skin:'#54382e',outfit:'stripes',color:'#d5ad57',accessory:'ticket',room:'base-room-07'};
 for(const [id,name,avatar] of cast){state.users.push({id,username:id.slice(7),name,emailVerified:true,avatar});a.members.push({uid:id,initial:500,credits:500,points:0});}
 const ten=[['Inter','Juventus'],['Napoli','Roma'],['Milan','Atalanta'],['Fiorentina','Bologna'],['Lazio','Udinese'],['Genoa','Parma'],['Torino','Como'],['Lecce','Cagliari'],['Verona','Sassuolo'],['Cremonese','Pisa']];
 const style={profeta:i=>['1','X','2','1X','Over 2.5','1','Goal','X2','1','2'][i],geometra:i=>i%2?'X2':'1X',cugino:i=>['1','2','X','1X','Under 2.5','No Goal','1','12','X','Goal'][i],peppe:i=>['2','X','2','Over 2.5','X','2','Goal','X','2','Over 2.5'][i],vale:i=>['1','1','X2','1X','Goal','1','Over 2.5','1X','2','1'][i],capitano:i=>i%3?'1X':'12',debuttante:i=>['2','2','2','X','2','X','2','2','X','2'][i]};
 const lineup={8:[[u.id,10,style.peppe],[rival.id,8,style.geometra],['v2-bar-cugino',12,style.cugino],['v2-bar-peppe',20,style.peppe],['v2-bar-vale',10,style.vale],['v2-bar-capitano',6,style.capitano],['v2-bar-debuttante',15,style.debuttante]],9:[[u.id,10,style.profeta],[rival.id,8,style.geometra],['v2-bar-cugino',12,style.cugino],['v2-bar-peppe',5,style.capitano],['v2-bar-vale',10,style.vale],['v2-bar-capitano',6,style.capitano],['v2-bar-debuttante',20,style.debuttante]]};
 const finals={8:[[1,1],[2,1],[0,0],[3,1],[1,2],[2,2],[0,1],[1,0],[2,0],[1,3]],9:[[2,0],[2,0],[2,0],[2,0],[2,0],[2,0],[2,0],[2,0],[2,0],[0,1]]};
 for(const [n,daysAgo] of [[8,6],[9,1]]){
  const rd=addRound(a,'seriea',n,'bar'+n,ten);
  for(const [uid,stake,pick] of lineup[n])placeSlip(state,a,rd,state.users.find(x=>x.id===uid),{picks:Object.fromEntries(rd.matches.map((m,i)=>[m.id,pick(i)])),stake});
  rd.kickoff=rd.deadline=new Date(Date.now()-daysAgo*86400000).toISOString();
  rd.matches.forEach((m,i)=>{m.kickoff=new Date(Date.parse(rd.kickoff)+Math.floor(i/4)*86400000+(i%4)*7200000-3600000).toISOString();m.status='FT';m.score=finals[n][i];});
  settle(state,a,rd);
 }
}
const owner={id:'local-frankwood',username:'frankwood',name:'Presidente locale',email:'frankwood@example.test',emailVerified:true,salt:'local-owner',password:hash(previewPassword,'local-owner')};state.users.push(owner);a.members.push({uid:owner.id,initial:500,credits:500,points:0});
const fixtureToken=session(state,process.env.PREVIEW_AUTO_USER==='frankwood'?owner.id:u.id);
const native=await createNativePreview(state);
const previewMailbox=[],previewMailEnv={RESEND_API_KEY:'synthetic-preview-only',APP_BASE_URL:publicPreview?'https://pre.quellidelquasi.com':'https://example.test'};
const api=createApi({playerStore:memoryPlayerStore(mediaRows),transact,read:fn=>fn(state),env:previewMailEnv,deliverMail:async({jobId})=>{
 const job=state.mailOutbox?.find(x=>x.id===jobId);if(!job)return 'none';
 previewMailbox.push(decodeMail(job,previewMailEnv));state.mailOutbox=state.mailOutbox.filter(x=>x.id!==jobId);
 const report=state.supportMessages?.find(x=>x.mailId===jobId);if(report)report.delivery='accepted';return 'sent';
}});
// This harness never calls an external service, DB, email or scheduled job.
globalThis.fetch=async()=>{throw Error('External calls disabled in local v2 preview');};
http.createServer(async(req,res)=>{
 try{
  const port=Number(process.env.PREVIEW_PORT||8780),url=new URL(req.url,publicPreview?'https://pre.quellidelquasi.com':'http://127.0.0.1:'+port);
  if(publicPreview){res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');if(url.pathname.startsWith('/__preview/')){res.writeHead(404).end();return;}if(url.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'}).end('User-agent: *\nDisallow: /\n');return;}}
  if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,preview:true,version:JSON.parse(await fs.readFile(path.join(root,'version.json'),'utf8')).version}));return;}
  if(url.pathname==='/__preview/viewport'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).end(uxViewport(url.searchParams));return;
  }
  if(url.pathname==='/__preview/mail'&&process.env.PREVIEW_MAILBOX==='1'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(previewMailbox));return;
  }
  if(url.pathname==='/__preview/inbox'&&process.env.PREVIEW_MAILBOX==='1'){
   const links=previewMailbox.map((m,i)=>{const raw=(m.html||'').match(/https:\/\/example\.test\/account\.html[^"\s<]+/g)?.find(x=>x.includes('action='));if(!raw)return '';const target=new URL(raw.replaceAll('&amp;','&'));return '<p><a href="'+target.pathname+target.search+target.hash+'">Apri email di prova '+(i+1)+' →</a></p>';}).join('');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end('<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/acquisition.css"><main class="acq-entry"><p class="acq-eyebrow">SOLO ANTEPRIMA · NESSUNA EMAIL REALE INVIATA</p><h1>La posta<br>del mister.</h1>'+ (links||'<p>Non ci sono ancora email di prova.</p>')+'<a href="/prendi-squadra.html">Torna alla pagina →</a></main></html>');return;
  }
  if(url.pathname==='/__preview/live'&&req.method==='POST'){
   const m=live.matches[0];if(url.searchParams.has('finish')){live.matches.forEach(x=>{x.status='FT';x.score=x.liveScore||x.score||[0,0];x.officialConfirmed=true;});}else{m.liveScore=[m.liveScore[0]+1,0];m.clock="25'";}res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,score:m.liveScore}));return;
  }
  if(url.pathname.startsWith('/fanta-api/')){await native.syncAuth();let body='';for await(const chunk of req)body+=chunk;const request=new Request(url,{method:req.method,headers:{...req.headers,...(process.env.PREVIEW_AUTO_AUTH==='1'?{cookie:'sid='+fixtureToken}:{})},...(body?{body}:{})}),response=await native.api(request);await native.syncGame();res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));return;}
 if(url.pathname.startsWith('/api/')){
   let data='';for await(const chunk of req)data+=chunk;
   const request=new Request(url,{method:req.method,headers:{...req.headers,...(port===8790||process.env.PREVIEW_AUTO_AUTH==='1'?{cookie:'sid='+fixtureToken}:{})},...(data?{body:data}:{})});
   const response=await api(request,{ip:'127.0.0.1'});const headers=Object.fromEntries(response.headers);
   if(headers['set-cookie']&&!publicPreview)headers['set-cookie']=headers['set-cookie'].replace('; Secure','');
   res.writeHead(response.status,headers).end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(url.pathname==='/env.json'){
   const metadata=JSON.parse(await fs.readFile(path.join(root,'version.json'),'utf8'));
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({env:'preview',version:metadata.version+(publicPreview?'':' · frontend v2'),commit:publicPreview?'prova isolata':'locale'}));return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'||url.pathname.startsWith('/invito/')?'/index.html':url.pathname));
  if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}
  let data;try{data=await fs.readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}).end(await fs.readFile(path.join(root,'404.html')));return;}
  const perf=url.searchParams.get('perf');
  if(path.basename(file)==='index.html'&&perf)data=Buffer.from(data.toString().replace('src="/src/app.mjs"','src="/src/app.mjs?perf='+perf+'"'));
  if(url.pathname==='/src/app.mjs'&&perf){
    const initial={home:'lega',roster:'quasi',wardrobe:'profilo',lineups:'schedina'}[perf];
    if(!initial)throw Error('Invalid test view');
    let source=data.toString().replace('page = "lega"','page = "'+initial+'"');
    if(perf!=='lineups')source=source.replace('\nrefresh(true);','\nrefresh(true).then(()=>{page='+JSON.stringify(initial)+';render();});');
    if(perf==='lineups')source=source.replace('\nrefresh(true);','\nrefresh(true).then(()=>{sourceScope="seriea";selectedRoundId='+JSON.stringify(live.id)+';hydrateDraft();render();openMatch("live-0");});');
    data=Buffer.from(source);
  }
  const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch(e){res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');console.error(req.url,e.message);}
}).listen(Number(process.env.PREVIEW_PORT||8780),'127.0.0.1',()=>console.log('Anteprima isolata: http://127.0.0.1:'+Number(process.env.PREVIEW_PORT||8780)+' — dati sintetici in RAM · nessun invio esterno'));


