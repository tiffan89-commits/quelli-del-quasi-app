import {configure} from './config.mjs';
import {processOne} from './queue.mjs';
import {atomicJson,stateRoot} from './local-blobs.mjs';
import path from 'node:path';
configure();
const {installInternalDispatch,executeJob}=await import('./dispatch.mjs');installInternalDispatch();
const [{default:dispatch},{closeDatabase}]=await Promise.all([import('../netlify/functions/operational-dispatch.mjs'),import('../lib/db.mjs')]);
if(process.env.SELFHOST_SCHEDULER_ENABLED==='true'){
 const {operationalStore}=await import('../lib/operations/store.mjs');
 if(!await operationalStore().get('calendar',{type:'json'}))throw Error('Importare il piano operativo prima di abilitare il worker; init-fresh solo su installazioni nuove');
}
let stopping=false,lastMinute=-1,lastHealth=0;process.once('SIGTERM',()=>stopping=true);process.once('SIGINT',()=>stopping=true);
console.info('QUASI_WORKER_READY',JSON.stringify({scheduler:process.env.SELFHOST_SCHEDULER_ENABLED==='true',external:process.env.SELFHOST_ALLOW_EXTERNAL==='true'}));
try{while(!stopping){
 const now=Date.now(),minute=Math.floor(now/60000);
 if(process.env.SELFHOST_SCHEDULER_ENABLED==='true'&&process.env.SELFHOST_ALLOW_EXTERNAL==='true'&&minute!==lastMinute){lastMinute=minute;try{const result=await dispatch();if(result.status>=400)console.error('DISPATCH_UNAVAILABLE');}catch(e){console.error('DISPATCH_FAILED',e.code||e.name);}}
 let result;try{result=await processOne(executeJob);if(result)console.info('LOCAL_JOB',JSON.stringify(result));}catch(e){console.error('LOCAL_QUEUE_FAILED',e.code||e.name);}
 if(now-lastHealth>10000){await atomicJson(path.join(stateRoot(),'worker-health.json'),{at:new Date().toISOString()});lastHealth=now;}
 if(!result)await new Promise(r=>setTimeout(r,1000));
}}finally{await closeDatabase();}
