import webpush from 'web-push';
import {mailConfig,queueMail,sendMail} from './mail.mjs';
import {recipientAllowed} from './release-env.mjs';
import {fail} from './game.mjs';
import {submissionPath} from '../public/src/routes.mjs';

const escape=value=>String(value).replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));

export function submissionReminderMessage(mode,league,{round,competition,lead}={}){
 const task=mode==='bar'?'schedina':'formazione';
 return {
  title:(mode==='bar'?'Schedina':'Formazione')+' da consegnare · '+league.name,
  body:lead?`Mancano ${lead} ore alla chiusura. Consegna la tua ${task}.`:`Il presidente ti ricorda di consegnare la tua ${task}.`,
  url:submissionPath(mode,league.id,{round,competition}),
  league:league.id,kind:mode==='bar'?'slip-reminder':'fanta',
 };
}

export function validateSubmissionChannel(channel){
 if(channel!=='email'&&channel!=='push')fail('Scegli email o notifica');
}

export async function sendAdminSubmissionReminder(channel,message,target,{env=process.env,
 sendPush=(...args)=>webpush.sendNotification(...args),deliverMail=sendMail,now=Date.now()}={}){
 validateSubmissionChannel(channel);
 const user=target?.user;
 if(!user?.emailVerified||user.adminOnly||user.demo)fail('Partecipante non disponibile',404);
 if(!recipientAllowed(user.email,env))fail('Invio non disponibile in questo ambiente',403);
 if(channel==='email'){
  if(!user.email)fail('Il partecipante ha bisogno di un’email verificata',409);
  const mail={},url=new URL(message.url,mailConfig(env).APP_BASE_URL);
  queueMail(mail,{to:[user.email],subject:message.title,html:`<p>${escape(message.body)}</p><p><a href="${escape(url.href)}">${message.kind==='fanta'?'Apri lo Studio formazione':'Apri la Schedina'}</a></p>`},env);
  const sent=await deliverMail(mail.mailOutbox[0],undefined,env);
  if(sent?.blocked)fail('Invio non disponibile in questo ambiente',403);
  return {ok:true};
 }
 const publicKey=env.WEB_PUSH_PUBLIC_KEY||target.keys?.publicKey,privateKey=env.WEB_PUSH_PRIVATE_KEY||target.keys?.privateKey;
 if(!target.devices?.length)fail('Questo partecipante deve abilitare le notifiche su un dispositivo',409);
 if(!publicKey||!privateKey)fail('Servizio notifiche temporaneamente non disponibile',503);
 const results=await Promise.allSettled(target.devices.map(device=>sendPush(device.subscription,JSON.stringify(message),{
  timeout:2500,TTL:Math.max(1,Math.min(3600,Math.floor((target.deadline-now)/1000))),
  vapidDetails:{subject:env.WEB_PUSH_SUBJECT||'mailto:account@quellidelquasi.com',publicKey,privateKey},
 })));
 if(!results.some(result=>result.status==='fulfilled'))fail('Non è stato possibile raggiungere i dispositivi del partecipante',503);
 return {ok:true};
}
