// Local operator CLI. Never exposed as an HTTP route. Run as the Windows owner.
import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {randomUUID} from 'node:crypto';
import {configure} from './config.mjs';import {redact} from './observability.mjs';
configure();const root=process.env.SELFHOST_INSTALL_ROOT||path.resolve('..'),run=promisify(execFile),[action,...args]=process.argv.slice(2),services=['QuasiPostgres','QuasiWeb','QuasiWorker','QuasiCaddy'];
const powershell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const ps=async command=>{const {stdout}=await run(powershell,['-NoProfile','-Command',"$ErrorActionPreference='Stop';"+command],{windowsHide:true,maxBuffer:1024*1024});try{return JSON.parse(stdout);}catch{return stdout.trim();}};
const print=value=>console.log(JSON.stringify(redact(value),null,2));
async function plan(){const {operationalStore}=await import('../lib/operations/store.mjs');return await operationalStore().get('calendar',{type:'json'});}
try{
 if(action==='status'){
  let health;try{health=await(await fetch('http://127.0.0.1:'+(process.env.PORT||8845)+'/healthz',{signal:AbortSignal.timeout(3000)})).json();}catch{health={ok:false};}
  const worker=await fs.readFile(path.join(process.env.SELFHOST_DATA_DIR,'worker-health.json'),'utf8').then(JSON.parse).catch(()=>null);
  print({at:new Date().toISOString(),root,origin:process.env.PUBLIC_ORIGIN,database:new URL(process.env.DATABASE_URL).pathname.slice(1),scheduler:process.env.SELFHOST_SCHEDULER_ENABLED==='true',providers:process.env.SELFHOST_ALLOW_EXTERNAL==='true',ddns:process.env.NETLIFY_DDNS_ENABLED==='true',services:await ps("Get-Service -Name 'QuasiPostgres','QuasiWeb','QuasiWorker','QuasiCaddy'|Select-Object Name,@{N='Status';E={$_.Status.ToString()}},@{N='StartType';E={$_.StartType.ToString()}}|ConvertTo-Json"),health,worker});
 }else if(action==='service'){
  const [verb,name]=args;if(!['start','stop','restart'].includes(verb)||!services.includes(name))throw Error('Comando servizio non consentito');
  const all=name==='QuasiPostgres',stop=all?[...services].reverse():name==='QuasiWeb'?['QuasiCaddy','QuasiWeb']:[name],start=all?services:name==='QuasiWeb'?['QuasiWeb','QuasiCaddy']:[name];
  const command=(verb!=='start'?stop.map(n=>"Stop-Service -Name '"+n+"' -ErrorAction Stop;").join(''):'')+(verb!=='stop'?start.map(n=>"Start-Service -Name '"+n+"' -ErrorAction Stop;").join(''):'');
  print({action:verb,service:name,result:await ps(command+"Get-Service -Name 'QuasiPostgres','QuasiWeb','QuasiWorker','QuasiCaddy'|Select-Object Name,@{N='Status';E={$_.Status.ToString()}}|ConvertTo-Json")});
 }else if(action==='jobs'){
  const p=await plan();print({at:new Date().toISOString(),live:p?.live,jobs:(p?.jobs||[]).filter(j=>j.status!=='cancelled').sort((a,b)=>Date.parse(b.completedAt||b.at)-Date.parse(a.completedAt||a.at)).slice(0,80)});
 }else if(action==='lineup-quality'){
  const {connection}=await import('../lib/db.mjs'),c=await connection();
  try{
   const season=Number(process.env.FANTA_SEASON||2026);
   const {rows}=await c.query("SELECT data FROM fanta.jobs WHERE id LIKE 'lineup-quality:issue:%' AND data->>'season'=$1 ORDER BY data->>'lastSeen' DESC LIMIT 500",[String(season)]);
   print({season,issues:rows.map(r=>r.data)});
  }finally{c.release();}
 }else if(action==='job'){
  if(process.env.SELFHOST_ALLOW_EXTERNAL!=='true'||process.env.SELFHOST_SCHEDULER_ENABLED!=='true')throw Error('I lavori manuali sono disabilitati nella copia di prova');
  const p=await plan();if(!p)throw Error('Piano operativo assente');const latest=Math.max(...p.fixtures.filter(f=>Date.parse(f.kickoff)<=Date.now()).map(f=>f.round)),spec={results:{kind:'morning',round:latest,fixtureIds:p.fixtures.filter(f=>f.round===latest).map(f=>f.id)},odds:{kind:'odds'},presence:{kind:'maintenance',operation:'refresh-presence-estimates'},lineups:{kind:'auto-lineup'},derived:{kind:'maintenance',operation:'recompute-round-results'},notifications:{kind:'native-notify'}}[args[0]];
  if(!spec)throw Error('Lavoro non consentito');const job={...spec,id:'manual:'+args[0]+':'+randomUUID(),at:new Date().toISOString()};
  const {enqueueOperation,dispatchDue}=await import('../lib/operations/store.mjs');const {installInternalDispatch}=await import('./dispatch.mjs');installInternalDispatch();await enqueueOperation(job);const dispatch=await dispatchDue();print({accepted:true,jobId:job.id,job:spec,dispatch,note:'Il worker esegue il lavoro. Apri Esiti job o Log worker per risultato, metriche ed eventuali errori.'});
 }else if(action==='api-test'){
  if(process.env.SELFHOST_ALLOW_EXTERNAL!=='true')throw Error('Provider disabilitati nella prova');const {apiFootballClient}=await import('../lib/api-football.mjs');const client=apiFootballClient({env:process.env}),p=await plan(),latest=p.fixtures.filter(f=>Date.parse(f.kickoff)<=Date.now()&&f.apiId).sort((a,b)=>Date.parse(b.kickoff)-Date.parse(a.kickoff))[0];if(!latest)throw Error('Nessuna partita disponibile');const result=await client.get('fixtures?ids='+latest.apiId);print({at:new Date().toISOString(),fixture:latest.id,calls:client.quota?.calls,response:result});
 }else if(action==='logs'){
  const files={web:'web-runtime.jsonl',worker:'worker-runtime.jsonl',caddy:'caddy-runtime.log',postgres:'postgres/postgresql.log'};const file=files[args[0]];if(!file)throw Error('Log non consentito');let text;try{const handle=await fs.open(path.join(root,'logs',file),'r');try{const stat=await handle.stat(),size=Math.min(stat.size,240000),buffer=Buffer.alloc(size);await handle.read(buffer,0,size,Math.max(0,stat.size-size));text=buffer.toString('utf8');}finally{await handle.close();}}catch(e){if(e.code!=='ENOENT')throw e;text='Nessuna riga disponibile in questo log.';}console.log(redact(text));
 }else if(action==='backup'){
  const dir=path.join(root,'backups','manual-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(dir,{recursive:true});
  // One pg_dump transaction is consistent even while the web keeps accepting writes.
  const u=new URL(process.env.DATABASE_URL),exe=path.join(root,'tools/pg18/pgsql/bin/pg_dump.exe'),out=path.join(dir,'database.dump');
  await run(exe,['-Fc','--no-owner','--no-acl','-f',out],{windowsHide:true,env:{...process.env,PGHOST:u.hostname,PGPORT:u.port,PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),PGOPTIONS:'-c default_transaction_read_only=on'},maxBuffer:1024*1024});
  await fs.copyFile(path.join(root,'config/app.env'),path.join(dir,'app.env'));if(process.env.GA4_CREDENTIALS_FILE)await fs.copyFile(process.env.GA4_CREDENTIALS_FILE,path.join(dir,'google-analytics-reader.json'));const {insightsStore}=await import('../lib/admin-insights/service.mjs');const insightStore=insightsStore();await fs.writeFile(path.join(dir,'admin-insights.json'),JSON.stringify({report:await insightStore.get('report',{type:'json'}),workflow:await insightStore.get('workflow',{type:'json'})}));await fs.writeFile(path.join(dir,'operations.json'),JSON.stringify(await plan()));print({ok:true,backup:dir,bytes:(await fs.stat(out)).size,note:'Backup privato: contiene dati e configurazione. Non pubblicarlo.'});
 }else throw Error('Comando non consentito');
}catch(e){print({ok:false,error:e.message,code:e.code});process.exitCode=1;}finally{const {closeDatabase}=await import('../lib/db.mjs');await closeDatabase();}
