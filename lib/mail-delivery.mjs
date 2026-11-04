import {enqueueOperation} from './operations/store.mjs';
import {flushExternalActivity} from './platform-admin.mjs';
import {reminderTransaction} from './db.mjs';
import {sendMail} from './mail.mjs';
import {prepareReminderMail} from './reminder-email.mjs';
// Event-triggered delivery after the account transaction commits. Periodic retries are separate.
export async function deliverPendingMail({jobId,accountOnly=false,transactionFn=reminderTransaction,send=sendMail,now=Date.now,env=process.env,schedule=enqueueOperation}={}){
 let retry;const job=await transactionFn(s=>{const at=now();const j=(s.mailOutbox||[]).find(j=>(!jobId||j.id===jobId)&&(!accountOnly||j.account||(s.accountTokens||[]).some(t=>t.mailId===j.id)||(s.adminChallenges||[]).some(t=>t.mailId===j.id))&&(!j.expires||j.expires>at)&&j.attempts<8&&j.nextAt<=at&&(!j.lease||j.lease<at));if(!j)return null;if(!prepareReminderMail(s,j,env,at)){s.mailOutbox=s.mailOutbox.filter(x=>x.id!==j.id);return null;}j.lease=at+60000;return structuredClone(j)});
 if(!job)return 'none';let ok=false,result,error;try{result=await send(job,undefined,env);ok=true}catch(e){error={code:e.mailCode||'delivery-failed',status:e.providerStatus||null}}
 await transactionFn(s=>{flushExternalActivity(s);const j=s.mailOutbox?.find(j=>j.id===job.id);if(!j)return;const report=s.supportMessages?.find(x=>x.mailId===job.id);if(report){report.delivery=ok?'accepted':'queued';report.lastDeliveryAt=new Date(now()).toISOString()}s.mailDeliveryLog=[...(s.mailDeliveryLog||[]),{jobId:job.id,at:now(),result:ok?(result?.blocked?'blocked':'accepted'):'failed',providerId:result?.providerId||null,error:ok?null:error}].slice(-100);if(ok)s.mailOutbox=s.mailOutbox.filter(j=>j.id!==job.id);else{j.lastError=error;j.attempts++;j.lease=0;j.nextAt=now()+Math.min(3600000,60000*2**j.attempts);if(j.attempts<8&&(!j.expires||j.expires>j.nextAt))retry={id:'mail:'+j.id+':'+j.attempts,jobId:j.id,kind:'mail',at:new Date(j.nextAt).toISOString(),...(j.expires?{expires:new Date(j.expires).toISOString()}: {})}}});
 if(retry)await schedule(retry).catch(()=>console.warn('MAIL_RETRY_INDEX_FAILED'));
 return ok?(result?.blocked?'blocked':'sent'):'queued';
}
