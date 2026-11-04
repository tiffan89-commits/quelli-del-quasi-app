import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {Client} from 'pg';import {migrate} from './migrate.mjs';import {closeDatabase} from '../lib/db.mjs';
const dump=process.argv[2],u=new URL(process.env.DATABASE_URL||'http://invalid'),bin=process.env.PG_BIN;
if(!dump||!bin||!['127.0.0.1','localhost'].includes(u.hostname)||!/^quasi[a-z_0-9]*$/.test(u.pathname.slice(1)))throw Error('Ripristino consentito solo in un DB locale quasi* esplicitamente selezionato; mai sulla produzione');
const c=new Client({connectionString:u.href}),run=promisify(execFile),temp=await fs.mkdtemp(path.join(os.tmpdir(),'quasi-restore-'));
try{await c.connect();const tables=(await c.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','fanta') AND c.relkind IN('r','p','v','m','S')")).rows[0].n;
 if(tables)throw Error('TARGET_NOT_EMPTY');await c.query('CREATE SCHEMA IF NOT EXISTS fanta');await c.query('CREATE SCHEMA IF NOT EXISTS public');await c.end();
 const exe=path.join(bin,process.platform==='win32'?'pg_restore.exe':'pg_restore'),{stdout}=await run(exe,['--list',dump],{windowsHide:true,maxBuffer:4*1024*1024}),toc=path.join(temp,'restore.list');
 await fs.writeFile(toc,stdout.split('\n').filter(line=>!/^\d+;\s+\d+\s+\d+\s+SCHEMA\s+-\s+(public|fanta)\s/.test(line)).join('\n'));
 const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1))};
 await run(exe,['--exit-on-error','--no-owner','--no-acl','--use-list',toc,'--dbname',env.PGDATABASE,dump],{env,windowsHide:true,maxBuffer:1024*1024});
 const adopted=await migrate({adopt:true});console.log(JSON.stringify({restored:true,migrations:adopted.mode,warning:'Verificare il report prima di avviare worker o modificare DNS'}));
}catch(e){await c.end().catch(()=>{});console.error('RESTORE_FAILED',e.message==='TARGET_NOT_EMPTY'?e.message:e.code||e.name);process.exitCode=1;}finally{await closeDatabase();await fs.unlink(path.join(temp,'restore.list')).catch(()=>{});await fs.rmdir(temp);}
