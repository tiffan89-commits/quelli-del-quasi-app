import {enqueueOperation} from './operations/store.mjs';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {mailConfig} from './mail.mjs';
export function mailTicket(jobId,env=process.env,now=Date.now()){
 const key=env.MAIL_ENCRYPTION_KEY||env.RESEND_API_KEY;if(!key)throw Error('Servizio email non configurato');
 const body=Buffer.from(JSON.stringify({jobId:jobId||null,at:now})).toString('base64url');
 return body+'.'+createHmac('sha256',key).update('quasi:account-mail:'+body).digest('base64url');
}
export function readMailTicket(ticket,env=process.env,now=Date.now()){
 try{const [body,sig]=String(ticket).split('.');
  const key=env.MAIL_ENCRYPTION_KEY||env.RESEND_API_KEY,want=createHmac('sha256',key).update('quasi:account-mail:'+body).digest(),got=Buffer.from(sig,'base64url');
  if(got.length!==want.length||!timingSafeEqual(got,want))return null;
  const data=JSON.parse(Buffer.from(body,'base64url'));return data.at<=now+10000&&now-data.at<120000&&(data.jobId===null||/^[a-f0-9]{32}$/.test(data.jobId))?data:null;
 }catch{return null;}
}
export async function dispatchAccountMail(jobId,{env=process.env,fetcher=fetch}={}){
 if(!jobId)return 'none';
 const base=new URL(env.DEPLOY_PRIME_URL||mailConfig(env).APP_BASE_URL);if(base.protocol!=='https:')throw Error('URL email non valido');
 try{const r=await fetcher(new URL('/.netlify/functions/account-mail-background',base),{method:'POST',headers:{'X-Quasi-Mail':mailTicket(jobId,env)},signal:AbortSignal.timeout(5000),redirect:'error'});if(!r.ok)throw Error('Invio accodato');return 'queued';}
 catch{await enqueueOperation({id:'mail:'+jobId+':dispatch',jobId,kind:'mail',at:new Date(Date.now()+60000).toISOString()});throw Error('Invio accodato');}
}
