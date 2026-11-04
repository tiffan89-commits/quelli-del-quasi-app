import {schedulesEnabled} from '../../lib/release-env.mjs';
import {readMailTicket} from '../../lib/account-mail.mjs';
import {reminderTransaction} from '../../lib/db.mjs';
import {deliverPendingMail} from '../../lib/mail-delivery.mjs';
export default async request=>{
 if(!schedulesEnabled()||request.method!=='POST')return;
 const ticket=readMailTicket(request.headers.get('X-Quasi-Mail'));if(!ticket?.jobId)return;
 const start=Date.now();let sent=0,queued=0;
 for(let i=0;i<(ticket.jobId?1:20)&&Date.now()-start<180000;i++){
  const result=await deliverPendingMail({jobId:ticket.jobId,transactionFn:reminderTransaction});
  if(result==='none')break;if(result==='sent')sent++;else if(result==='queued')queued++;
 }
 console.info('ACCOUNT_MAIL_BATCH',JSON.stringify({sent,queued}));
};
