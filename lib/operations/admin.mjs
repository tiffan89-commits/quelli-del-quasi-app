import {operationalStore,mutatePlan} from './store.mjs';
import {dueWork,refreshPlan} from './calendar.mjs';
import {connection} from '../db.mjs';
export async function operationStatus({store=operationalStore()}={}){
 const plan=await store.get('calendar',{type:'json'});if(!plan)return {initialized:false};
 return {initialized:true,timezone:plan.timezone,live:plan.live,fixtures:plan.fixtures.map(({id,round,kickoff,status,error,morningAttemptedAt})=>({id,round,kickoff,status,error,morningAttemptedAt})),jobs:plan.jobs,errors:plan.errors,due:dueWork(plan)};
}
export async function retryOperation(id,{store=operationalStore(),now=Date.now()}={}){
 let found=false;await mutatePlan(plan=>{const job=plan.jobs.find(j=>j.id===id);if(!job||!['error','done'].includes(job.status))return plan;found=true;Object.assign(job,{status:'queued',at:new Date(now).toISOString(),error:null,nonce:null,leaseUntil:null,executionStartedAt:null,completedAt:null});return plan;},{store});
 if(!found)throw Object.assign(Error('Operazione non ripetibile'),{status:400});return {ok:true};
}
export async function refreshOperationalCalendar({store=operationalStore(),connect=connection,now=Date.now()}={}){
 const c=await connect();let rows;try{rows=(await c.query(`SELECT m->>'id' AS id,(m->>'apiFootballId')::int AS "apiId",(r->>'number')::int AS round,m->>'kickoff' AS kickoff,m->>'status' AS status,m->>'home' AS home,m->>'away' AS away FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m->>'kickoff' IS NOT NULL`)).rows;}finally{c.release();}
 await mutatePlan(plan=>refreshPlan(plan,rows,{now}),{store});return {ok:true,fixtures:rows.length};
}
