// User-level Windows startup. No execution-policy changes or administrator rights.
import fs from 'node:fs';import path from 'node:path';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';import {parseEnv} from 'node:util';
const root=path.resolve(process.argv[2]||''),app=path.join(root,'app'),file=path.join(root,'config/app.env'),run=promisify(execFile),pause=ms=>new Promise(r=>setTimeout(r,ms));
if(!fs.existsSync(path.join(app,'runtime/server.mjs'))||!fs.existsSync(file))throw Error('Installazione locale non riconosciuta');
let env=parseEnv(fs.readFileSync(file,'utf8'));const port=Number(env.PORT)||3000;
async function processInfo(pid){if(!Number.isSafeInteger(pid)||pid<1)return null;try{const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`],{windowsHide:true});return stdout.trim()?JSON.parse(stdout):null;}catch{return null;}}
const pidFile=kind=>path.join(root,'data',kind+'.pid');
async function owned(kind){let pid;try{pid=Number(fs.readFileSync(pidFile(kind),'utf8').trim());}catch{return null;}const info=await processInfo(pid);if(!info)return null;const exe=kind==='tunnel'?path.join(root,'tools/cloudflared.exe'):process.execPath;if(info.ExecutablePath?.toLowerCase()!==exe.toLowerCase())return null;if(kind!=='tunnel'&&(!info.CommandLine?.includes(file)||!info.CommandLine.includes('runtime/'+kind+'.mjs')))return null;return pid;}
function start(kind,exe,args,{truncate=false}={}){
 const out=fs.openSync(path.join(root,'logs',kind+'.out.log'),truncate?'w':'a'),err=fs.openSync(path.join(root,'logs',kind+'.err.log'),truncate?'w':'a');
 const p=spawn(exe,args,{cwd:app,windowsHide:true,detached:true,stdio:['ignore',out,err]});p.unref();fs.closeSync(out);fs.closeSync(err);fs.writeFileSync(pidFile(kind),String(p.pid));return p.pid;
}
async function startApps(){for(const kind of ['server','worker'])if(!await owned(kind))start(kind,process.execPath,['--env-file='+file,'runtime/'+kind+'.mjs']);for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/healthz');if(r.ok&&(await r.json()).version==='0.29.22-selfhost')return;}catch{}await pause(100);}throw Error('Web locale non pronto');}
try{
 const pg=path.join(root,'tools/pg18/pgsql/bin/pg_ctl.exe'),data=path.join(root,'data/postgres18');
 try{await run(pg,['status','-D',data],{windowsHide:true});}catch{await run(pg,['start','-D',data,'-l',path.join(root,'logs/postgres18.log'),'-o','-p '+new URL(env.DATABASE_URL).port+' -h 127.0.0.1','-w'],{windowsHide:true,maxBuffer:1024*1024});}
 await startApps();
 if(process.argv.includes('--tunnel')){
  if(env.SELFHOST_TEST_INSTANCE!=='true'||String(env.SELFHOST_PREVIEW_KEY||'').length<32)throw Error('Tunnel protetto non configurato');
  if(!await owned('tunnel'))start('tunnel',path.join(root,'tools/cloudflared.exe'),['tunnel','--no-autoupdate','--url','http://127.0.0.1:'+port,'--protocol','http2','--loglevel','info'],{truncate:true});
  let origin;for(let i=0;i<40;i++){const text=fs.readFileSync(path.join(root,'logs/tunnel.err.log'),'utf8'),hit=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(hit&&text.includes('Registered tunnel connection')){origin=hit[0];break;}await pause(1000);}if(!origin)throw Error('Tunnel non pronto');
  if(origin!==env.PUBLIC_ORIGIN){fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/^PUBLIC_ORIGIN=.*$/m,'PUBLIC_ORIGIN='+origin));for(const kind of ['server','worker']){const pid=await owned(kind);if(pid)process.kill(pid);}await pause(400);env=parseEnv(fs.readFileSync(file,'utf8'));await startApps();}
  fs.writeFileSync(path.join(root,'config/test-link.txt'),origin+'/_preview/access?key='+env.SELFHOST_PREVIEW_KEY+'\n');
 }
 console.log('Server e worker verificati; il link privato resta nel file config/test-link.txt');
}catch(e){console.error('BOOTSTRAP_FAILED',e.code||e.name);process.exitCode=1;}
