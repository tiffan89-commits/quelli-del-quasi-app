// Keep the schedule with the function: manual prebuilt deploys must retain it.
export const config={schedule:'* * * * *'};
import {schedulesEnabled} from '../../lib/release-env.mjs';
import {dispatchDue,bootstrapPlan} from '../../lib/operations/store.mjs';
export default async()=>{
 if(!schedulesEnabled())return new Response('Non-production schedules disabled');
 try{
  const now=Date.now(),bootstrap=bootstrapPlan(now);
  const result=await dispatchDue({bootstrap,now,syncOfficialSchedule:true});
  if(result.claimed)console.info('QUASI_OPERATIONS_DISPATCH',JSON.stringify(result));
  return new Response(JSON.stringify(result));
 }catch{console.error('QUASI_OPERATIONS_DISPATCH_FAILED');return new Response('Operational dispatcher unavailable',{status:503});}
};
