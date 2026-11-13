import {configure} from './config.mjs';
import {processOne} from './queue.mjs';
import {atomicJson,stateRoot} from './local-blobs.mjs';
import path from 'node:path';
import {installRuntimeLogging} from './observability.mjs';
import {syncDns} from './ddns.mjs';
import {refreshInsights} from '../lib/admin-insights/service.mjs';
import {startMemoryGuard} from './memory-guard.mjs';
configure();process.env.SELFHOST_PROCESS_ROLE='worker';installRuntimeLogging('worker');
await startMemoryGuard();
if(process.env.SELFHOST_MAINTENANCE==='true'){
 console.info('QUASI_WORKER_PAUSED_FOR_FAILOVER');const hold=setInterval(()=>{},60000);
 await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});clearInterval(hold);process.exit(0);
}
const network=globalThis.fetch;
const {installInternalDispatch,executeJob}=await import('./dispatch.mjs');installInternalDispatch();
const [{default:dispatch},{closeDatabase}]=await Promise.all([import('../netlify/functions/operational-dispatch.mjs'),import('../lib/db.mjs')]);
if(process.env.SELFHOST_SCHEDULER_ENABLED==='true'){
 const {operationalStore}=await import('../lib/operations/store.mjs');
 if(!await operationalStore().get('calendar',{type:'json'}))throw Error('Importare il piano operativo prima di abilitare il worker; init-fresh solo su installazioni nuove');
}
let stopping=false,lastMinute=-1,lastHealth=0,lastDns=0,dnsPending=null,dispatchPending=null,lastDispatch=null;process.once('SIGTERM',()=>stopping=true);process.once('SIGINT',()=>stopping=true);
let insightsPending=null,lastInsights=0;
console.info('QUASI_WORKER_READY',JSON.stringify({scheduler:process.env.SELFHOST_SCHEDULER_ENABLED==='true',external:process.env.SELFHOST_ALLOW_EXTERNAL==='true'}));
async function pulse(){
 const now=Date.now(),minute=Math.floor(now/60000);
 if(process.env.ADMIN_INSIGHTS_ENABLED==='true'&&process.env.SELFHOST_ALLOW_EXTERNAL==='true'&&!insightsPending&&now-lastInsights>=60000){lastInsights=now;insightsPending=refreshInsights().then(result=>{if(!result.skipped)console.info('ADMIN_INSIGHTS_REFRESH',JSON.stringify(result));}).catch(e=>console.error('ADMIN_INSIGHTS_FAILED',e.code||e.name)).finally(()=>{insightsPending=null;});}
 if(process.env.NETLIFY_DDNS_ENABLED==='true'&&!dnsPending&&now-lastDns>=300000){lastDns=now;dnsPending=syncDns({fetcher:network,dryRun:false}).then(result=>console.info('QUASI_DDNS',JSON.stringify(result))).catch(e=>console.error('QUASI_DDNS_FAILED',e.message?.startsWith('DDNS_')?e.message:e.code||e.name)).finally(()=>{dnsPending=null;});}
 if(process.env.SELFHOST_SCHEDULER_ENABLED==='true'&&process.env.SELFHOST_ALLOW_EXTERNAL==='true'&&minute!==lastMinute&&!dispatchPending){lastMinute=minute;dispatchPending=(async()=>{try{const result=await dispatch();let body;try{body=await result.clone().json();}catch{}lastDispatch={at:new Date().toISOString(),status:result.status,body};if(result.status>=400)console.error('DISPATCH_UNAVAILABLE');}catch(e){lastDispatch={at:new Date().toISOString(),error:e.code||e.name};console.error('DISPATCH_FAILED',e.code||e.name);}})().finally(()=>{dispatchPending=null;});}
 if(now-lastHealth>10000){lastHealth=now;await atomicJson(path.join(stateRoot(),'worker-health.json'),{at:new Date().toISOString(),lastDispatch,scheduler:process.env.SELFHOST_SCHEDULER_ENABLED==='true'});}
}
const isLive=job=>job.name==='operational-worker-background'&&String(job.payload?.id||'').startsWith('live:');
const isInstant=job=>job.name==='fanta-worker-background'&&String(job.payload?.kind||'').startsWith('auction-notify:');
async function consume(accept){while(!stopping){let result;try{result=await processOne(executeJob,{accept});if(result)console.info('LOCAL_JOB',JSON.stringify(result));}catch(e){console.error('LOCAL_QUEUE_FAILED',e.code||e.name);}
 if(!result)await new Promise(r=>setTimeout(r,1000));
}}
// A long catalog/rebuild job cannot block the minute dispatcher or the live lane.
const clock=setInterval(()=>pulse().catch(e=>console.error('LOCAL_PULSE_FAILED',e.code||e.name)),1000);
try{await pulse();await Promise.all([consume(isLive),consume(isInstant),consume(job=>!isLive(job)&&!isInstant(job))]);}finally{clearInterval(clock);await dispatchPending;await dnsPending;await insightsPending;await closeDatabase();}
