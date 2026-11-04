import {recipientAllowed,blockedDelivery} from './release-env.mjs';
import {recordExternal} from './platform-admin.mjs';
import webpush from 'web-push';
import {randomUUID} from 'node:crypto';
import {stableHash} from '../public/src/reward-catalog.mjs';
const HOUR=3600000;
export function queueLeagueReminders(s,now=Date.now()){
 s.reminderRegistry??={};s.reminderOutbox??=[];s.leagueAlerts=(s.leagueAlerts||[]).filter(a=>a.expires>now);
 s.reminderOutbox=s.reminderOutbox.filter(j=>j.expires>now&&j.attempts<6);
 for(const [key,v] of Object.entries(s.reminderRegistry))if(v.created<now-90*24*HOUR)delete s.reminderRegistry[key];
 const groups=new Map();
 for(const r of s.rounds||[]){const deadline=Date.parse(r.deadline||r.kickoff);if(r.settled||r.closed||r.calculated||r.sourceConflict||!(r.matchCount??r.matches?.length)||!Number.isFinite(deadline)||deadline<=now||now<deadline-2*HOUR)continue;const key=r.league+':'+deadline;const g=groups.get(key)||{league:r.league,deadline,rounds:[]};g.rounds.push(r);groups.set(key,g);}
 let queued=0;
 for(const g of groups.values()){
  const l=s.leagues.find(l=>l.id===g.league);if(!l||l.demo)continue;
  for(const m of l.members){const u=s.users.find(u=>u.id===m.uid);if(!u||u.adminOnly||u.demo||!u.emailVerified||u.remindersEnabled===false)continue;
   const key=l.id+':'+u.id+':'+g.deadline,record=s.reminderRegistry[key]??={created:now,devices:[]};
   const complete=g.rounds.every(r=>r.slips?.some(x=>x.uid===u.id));
   const body=complete?'Hai già salvato: un ultimo controllo e poi si tifa.':'Mancano due ore: salva la schedina prima del fischio!';
   const title='Ultima chiamata al bar · '+l.name;
   const url='/?slip='+encodeURIComponent(l.id)+'&round='+encodeURIComponent(g.rounds[0].id);
   if(!s.leagueAlerts.some(a=>a.id===key))s.leagueAlerts.push({id:key,uid:u.id,league:l.id,title,body,url,created:now,expires:g.deadline});
   const devices=(s.chatSubscriptions||[]).filter(d=>d.uid===u.id&&!record.devices.includes(d.id)).map(d=>d.id);
   if(devices.length){record.devices.push(...devices);s.reminderOutbox.push({id:randomUUID(),key,uid:u.id,league:l.id,rounds:g.rounds.map(r=>r.id),deadline:g.deadline,expires:g.deadline,recipients:devices,title,body,url,attempts:0,next:0,tag:'schedina-'+stableHash(key)});queued++;}
  }
 }
 return queued;
}
export async function deliverLeagueReminders({transact,env=process.env,now=Date.now,sendPush=(...args)=>webpush.sendNotification(...args)}={}){
 const jobs=await transact(s=>{queueLeagueReminders(s,now());return s.reminderOutbox.filter(j=>j.next<=now()&&!(j.lease>now())).slice(0,20).map(j=>{j.lease=now()+90000;j.attempts++;return structuredClone(j);});});
 let sent=0;
 await Promise.all(jobs.map(async j=>{
  const targets=await transact(s=>{const live=s.reminderOutbox?.find(x=>x.id===j.id&&x.lease===j.lease),l=s.leagues.find(l=>l.id===j.league),u=s.users.find(u=>u.id===j.uid),active=(s.rounds||[]).some(r=>j.rounds.includes(r.id)&&Date.parse(r.deadline||r.kickoff)===j.deadline&&!r.settled&&!r.closed&&j.deadline>now());if(!live||!l?.members.some(m=>m.uid===j.uid)||!u?.emailVerified||u.adminOnly||u.remindersEnabled===false||!active)return [];
   if(!recipientAllowed(u.email,env)){blockedDelivery('reminder-push',env);return [];}
   const keys=env.WEB_PUSH_PUBLIC_KEY&&env.WEB_PUSH_PRIVATE_KEY?{publicKey:env.WEB_PUSH_PUBLIC_KEY,privateKey:env.WEB_PUSH_PRIVATE_KEY}:s.chatPushKeys;if(!keys)return [];
   return j.recipients.slice(0,5).map(id=>s.chatSubscriptions?.find(d=>d.id===id&&d.uid===j.uid)).filter(Boolean).map(d=>({id:d.id,subscription:d.subscription,keys}));});
  const done=[],expired=[];
  await Promise.all(targets.map(async d=>{try{const response=await sendPush(d.subscription,JSON.stringify({title:j.title,body:j.body,tag:j.tag,url:j.url,league:j.league,kind:'slip-reminder'}),{TTL:Math.max(1,Math.floor((j.deadline-now())/1000)),timeout:2500,vapidDetails:{subject:env.WEB_PUSH_SUBJECT||'https://quellidelquasi.com',...d.keys}});recordExternal('WebPush','/scheduled-reminder',response?.statusCode||200);done.push(d.id);sent++;}catch(e){recordExternal('WebPush','/scheduled-reminder',e.statusCode||0);if([404,410].includes(e.statusCode)){done.push(d.id);expired.push(d.id);}}}));
  await transact(s=>{const live=s.reminderOutbox?.find(x=>x.id===j.id&&x.lease===j.lease);if(!live)return;if(!targets.length){s.reminderOutbox=s.reminderOutbox.filter(x=>x.id!==j.id);return;}const targetIds=new Set(targets.map(t=>t.id)),failed=targets.filter(t=>!done.includes(t.id)).map(t=>t.id);live.recipients=[...live.recipients.filter(id=>!targetIds.has(id)&&s.chatSubscriptions?.some(d=>d.id===id&&d.uid===j.uid)),...failed];live.lease=0;live.next=now()+(failed.length?Math.min(300000,30000*2**live.attempts):0);if(!failed.length)live.attempts=0;if(!live.recipients.length)s.reminderOutbox=s.reminderOutbox.filter(x=>x.id!==j.id);s.chatSubscriptions=(s.chatSubscriptions||[]).filter(d=>!expired.includes(d.id));});
 }));
 return {jobs:jobs.length,sent};
}
