import {operationalStore,mutatePlan} from './store.mjs';
import {dueWork,refreshPlan} from './calendar.mjs';
import {connection} from '../db.mjs';
import {barCalendarRows,barStorageMode} from '../storage-mode.mjs';
export async function operationStatus({store=operationalStore()}={}){
 const plan=await store.get('calendar',{type:'json'});if(!plan)return {initialized:false};
 return {initialized:true,timezone:plan.timezone,live:plan.live,fixtures:plan.fixtures.map(({id,round,kickoff,status,error,morningAttemptedAt})=>({id,round,kickoff,status,error,morningAttemptedAt})),jobs:plan.jobs,errors:plan.errors,due:dueWork(plan)};
}
export async function retryOperation(id,{store=operationalStore(),now=Date.now()}={}){
 let found=false;await mutatePlan(plan=>{const job=plan.jobs.find(j=>j.id===id);if(!job||!['error','done'].includes(job.status))return plan;found=true;Object.assign(job,{status:'queued',at:new Date(now).toISOString(),error:null,nonce:null,leaseUntil:null,executionStartedAt:null,completedAt:null});return plan;},{store});
 if(!found)throw Object.assign(Error('Operazione non ripetibile'),{status:400});return {ok:true};
}
export async function refreshOperationalCalendar({store=operationalStore(),connect=connection,now=Date.now(),sportsStorage=barStorageMode()}={}){
 const c=await connect();let rows;
 try{
  rows=(await c.query(`SELECT jsonb_strip_nulls(jsonb_build_object('id',m->>'id','apiId',(m->>'apiFootballId')::int,
   'round',(r->>'number')::int,'kickoff',coalesce(m->>'officialKickoff',m->>'kickoff'),'status',m->>'status',
   'home',m->>'home','away',m->>'away')) AS fixture
   FROM ${barCalendarRows(sportsStorage,{round:true})} WHERE coalesce(m->>'officialKickoff',m->>'kickoff') IS NOT NULL`)).rows;
 }finally{c.release();}
 await mutatePlan(plan=>refreshPlan(plan,rows.map(row=>row.fixture),{now}),{store});return {ok:true,fixtures:rows.length};
}
