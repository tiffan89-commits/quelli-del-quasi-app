import {schedulesEnabled} from '../../lib/release-env.mjs';
import {operationalStore,readOperationTicket,mutatePlan} from '../../lib/operations/store.mjs';
import {completeWork} from '../../lib/operations/calendar.mjs';
import {temporaryDatabaseError} from '../../lib/operations/background-db.mjs';
export default async request=>{
 if(!schedulesEnabled()||request.method!=='POST')return;
 const ticket=readOperationTicket(request.headers.get('X-Quasi-Operation'));if(!ticket)return;
 const store=operationalStore(),plan=await store.get('calendar',{type:'json'});
 const job=plan?.live?.id===ticket.id?plan.live:plan?.jobs?.find(j=>j.id===ticket.id);
 if(!job||job.status!=='running'||job.nonce!==ticket.nonce||Date.parse(job.leaseUntil)<Date.now())return;
 let claimed=null;const lockedPlan=await mutatePlan(current=>{claimed=null;const target=current.live?.id===ticket.id?current.live:current.jobs?.find(j=>j.id===ticket.id);if(target?.status==='running'&&target.nonce===ticket.nonce&&!target.executionStartedAt){target.executionStartedAt=new Date().toISOString();claimed=structuredClone(target);}return current;},{store});if(!claimed)return;
 const started=Date.now();let result;
 try{const {runOperation}=await import('../../lib/operations/workflows.mjs');result=await runOperation(claimed,lockedPlan);}
 catch(error){result={ok:false,error:String(error.message||'operation-failed').slice(0,220),
  ...(job.kind==='morning'&&temporaryDatabaseError(error)?{retryable:true,retryFixtureIds:job.fixtureIds}:{})};}
 if((job.kind==='live'||['round-close','round-opening','odds'].includes(job.kind)&&(result.ok||result.metrics?.odds?.changed))&&process.env.SELFHOST_RUNTIME==='true')try{const {notifySportsSaved}=await import('../../runtime/sports-notifications.mjs');await notifySportsSaved();}catch{console.error('SPORTS_PUSH_WAKE_FAILED');}
 await mutatePlan(current=>completeWork(current,job,result),{store});
 console.info('QUASI_OPERATION',JSON.stringify({kind:job.kind,id:job.id,status:result.ok?'done':'error',durationMs:Date.now()-started,...result.metrics,error:result.error||null}));
};
