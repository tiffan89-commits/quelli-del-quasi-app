import {recipientAllowed,blockedDelivery} from './release-env.mjs';
import {recordExternal} from './platform-admin.mjs';
import webpush from 'web-push';
import {randomUUID} from 'node:crypto';
import {stableHash} from '../public/src/reward-catalog.mjs';
import {SUBMISSION_REMINDER_HOURS,isReminderDue} from './reminder-timing.mjs';
import {submissionReminderMessage} from './submission-reminders.mjs';
import {acceptsBarSlipReminder} from './bar-slip-reminder.mjs';
const HOUR=3600000;
export function queueLeagueReminders(s,now=Date.now(),leadHours=null){
 s.reminderRegistry??={};s.reminderOutbox??=[];s.leagueAlerts=(s.leagueAlerts||[]).filter(a=>a.expires>now);
 s.reminderOutbox=s.reminderOutbox.filter(j=>j.expires>now&&j.attempts<6);
 for(const [key,v] of Object.entries(s.reminderRegistry))if(v.created<now-90*24*HOUR)delete s.reminderRegistry[key];
 const groups=new Map();
 for(const r of s.rounds||[]){
  const deadline=Date.parse(r.deadline||r.kickoff),lead=leadHours??SUBMISSION_REMINDER_HOURS.find(hours=>isReminderDue(deadline,now,hours));
  if(!acceptsBarSlipReminder(r,now)||!lead||!isReminderDue(deadline,now,lead))continue;
  const key=r.league+':'+deadline,g=groups.get(key)||{league:r.league,deadline,lead,rounds:[]};
  g.rounds.push(r);groups.set(key,g);
 }
 let queued=0;
 for(const g of groups.values()){
  const l=s.leagues.find(l=>l.id===g.league);if(!l||l.demo)continue;
  for(const m of l.members){const u=s.users.find(u=>u.id===m.uid);if(!u||m.removed||u.adminOnly||u.demo||!u.emailVerified||u.remindersEnabled===false)continue;
   const pending=g.rounds.filter(r=>!r.slips?.some(x=>x.uid===u.id));
   if(!pending.length)continue;
   const key=l.id+':'+u.id+':'+g.deadline+':'+g.lead,record=s.reminderRegistry[key]??={created:now,devices:[]};
   const {title,body,url}=submissionReminderMessage('bar',l,{round:pending[0].id,lead:g.lead});
   if(!s.leagueAlerts.some(a=>a.id===key))s.leagueAlerts.push({id:key,uid:u.id,league:l.id,title,body,url,created:now,expires:g.deadline});
   const devices=(s.chatSubscriptions||[]).filter(d=>d.uid===u.id&&!record.devices.includes(d.id)).map(d=>d.id);
   if(devices.length){record.devices.push(...devices);s.reminderOutbox.push({id:randomUUID(),key,uid:u.id,league:l.id,rounds:[pending[0].id],deadline:g.deadline,expires:g.deadline,recipients:devices,title,body,url,attempts:0,next:0,tag:'schedina-'+stableHash(key)});queued++;}
  }
 }
 return queued;
}
export async function deliverLeagueReminders({transact,env=process.env,now=Date.now,leadHours=null,queue=true,sendPush=(...args)=>webpush.sendNotification(...args)}={}){
 const jobs=await transact(s=>{if(queue)queueLeagueReminders(s,now(),leadHours);return (s.reminderOutbox||[]).filter(j=>j.expires>now()&&j.attempts<6&&j.next<=now()&&!(j.lease>now())).slice(0,20).map(j=>{j.lease=now()+90000;j.attempts++;return structuredClone(j);});});
 let sent=0;
 await Promise.all(jobs.map(async j=>{
  const targets=await transact(s=>{const live=s.reminderOutbox?.find(x=>x.id===j.id&&x.lease===j.lease),l=s.leagues.find(l=>l.id===j.league),u=s.users.find(u=>u.id===j.uid),active=(s.rounds||[]).some(r=>j.rounds.includes(r.id)&&Date.parse(r.deadline||r.kickoff)===j.deadline&&acceptsBarSlipReminder(r,now())&&!r.slips?.some(slip=>slip.uid===j.uid));if(!live||!l?.members.some(m=>m.uid===j.uid&&!m.removed)||!u?.emailVerified||u.adminOnly||u.remindersEnabled===false||!active)return [];
   if(!recipientAllowed(u.email,env)){blockedDelivery('reminder-push',env);return [];}
   const keys=env.WEB_PUSH_PUBLIC_KEY&&env.WEB_PUSH_PRIVATE_KEY?{publicKey:env.WEB_PUSH_PUBLIC_KEY,privateKey:env.WEB_PUSH_PRIVATE_KEY}:s.chatPushKeys;if(!keys)return [];
   return j.recipients.slice(0,5).map(id=>s.chatSubscriptions?.find(d=>d.id===id&&d.uid===j.uid)).filter(Boolean).map(d=>({id:d.id,subscription:d.subscription,keys}));});
  const done=[],expired=[];
  await Promise.all(targets.map(async d=>{try{const response=await sendPush(d.subscription,JSON.stringify({title:j.title,body:j.body,tag:j.tag,url:j.url,league:j.league,kind:'slip-reminder'}),{TTL:Math.max(1,Math.floor((j.deadline-now())/1000)),timeout:2500,vapidDetails:{subject:env.WEB_PUSH_SUBJECT||'https://quellidelquasi.com',...d.keys}});recordExternal('WebPush','/scheduled-reminder',response?.statusCode||200);done.push(d.id);sent++;}catch(e){recordExternal('WebPush','/scheduled-reminder',e.statusCode||0);if([404,410].includes(e.statusCode)){done.push(d.id);expired.push(d.id);}}}));
  await transact(s=>{const live=s.reminderOutbox?.find(x=>x.id===j.id&&x.lease===j.lease);if(!live)return;if(!targets.length){s.reminderOutbox=s.reminderOutbox.filter(x=>x.id!==j.id);return;}const targetIds=new Set(targets.map(t=>t.id)),failed=targets.filter(t=>!done.includes(t.id)).map(t=>t.id);live.recipients=[...live.recipients.filter(id=>!targetIds.has(id)&&s.chatSubscriptions?.some(d=>d.id===id&&d.uid===j.uid)),...failed];live.lease=0;live.next=now()+(failed.length?Math.min(300000,30000*2**live.attempts):0);if(!failed.length)live.attempts=0;if(!live.recipients.length)s.reminderOutbox=s.reminderOutbox.filter(x=>x.id!==j.id);s.chatSubscriptions=(s.chatSubscriptions||[]).filter(d=>!expired.includes(d.id));});
 }));
 const next=await transact(s=>Math.min(...(s.reminderOutbox||[]).filter(j=>j.expires>now()&&j.attempts<6).map(j=>Math.max(j.next||0,j.lease||0,now()+60000))));
 return {jobs:jobs.length,sent,...(Number.isFinite(next)?{next}: {})};
}
