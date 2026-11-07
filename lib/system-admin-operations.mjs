import {id,sha,fail} from './game.mjs';
import {emptyState} from './db.mjs';
import {requireSystemAdmin,requireRecentAdmin,isSystemAdmin} from './system-admin-auth.mjs';
import {safeDatabaseValue,flushExternalActivity,clearPendingActivity} from './platform-admin.mjs';
import {recordExternal} from './platform-admin.mjs';
import {decodeMail} from './mail.mjs';
import {deleteFantaLeagues,linkedFantaForWipe} from '../fanta/league-deletion.mjs';
const audit=(s,action,counts)=>{(s.adminAudit??=[]).push({at:new Date().toISOString(),action,counts});s.adminAudit=s.adminAudit.slice(-500);};
export function adminLeagues(s,u,leagueId){
 requireSystemAdmin(s,u);
 if(!leagueId)return {leagues:s.leagues.map(l=>({id:l.id,name:l.name,admin:l.admin,members:l.members.length,rounds:s.rounds.filter(r=>r.league===l.id).length,connections:[]}))};
 const l=s.leagues.find(l=>l.id===leagueId);if(!l)fail('Lega non trovata',404);
 const members=[...l.members,...(l.removedMembers||[])];
 return safeDatabaseValue({league:l,users:members.map(m=>({...s.users.find(u=>u.id===m.uid),membership:m})),rounds:s.rounds.filter(r=>r.league===l.id)});
}
export function forceAllFantasy(s,u){requireSystemAdmin(s,u);audit(s,'force-native-fanta',{queued:true});return {ok:true,queued:true,message:'Ricalcolo delle nostre leghe accodato.'};}
function affected(s,scope,target){
 if(!['league','user','game','all'].includes(scope))fail('Ambito non valido');
 if(scope==='league'&&!s.leagues.some(l=>l.id===target))fail('Lega non trovata',404);
 if(scope==='user'&&!s.users.some(u=>u.id===target&&!isSystemAdmin(u)))fail('Utente non eliminabile',404);
 const leagues=scope==='league'?s.leagues.filter(l=>l.id===target):scope==='user'?s.leagues.filter(l=>l.admin===target):s.leagues;
 const ids=leagues.map(l=>l.id),rounds=s.rounds.filter(r=>ids.includes(r.league));
 const extra=scope==='user'?s.rounds.filter(r=>!ids.includes(r.league)).flatMap(r=>r.slips.filter(x=>x.uid===target)):[];
 return {leagues:ids,counts:{leghe:leagues.length,utenti:scope==='all'?s.users.filter(u=>!isSystemAdmin(u)).length:scope==='user'?1:0,giornate:rounds.length,schedine:rounds.reduce((n,r)=>n+r.slips.length,extra.length),messaggi:Object.entries(s.leagueChats||{}).reduce((n,[key,r])=>n+(r?.messages||[]).filter(m=>ids.includes(key)||scope==='user'&&m.uid===target).length,0),collegamenti:(s.fantasyConnections||[]).filter(c=>c.leagues?.some(l=>ids.includes(l))||scope==='user'&&c.owner===target).length}};
}
const fingerprint=(s,scope,target)=>sha(JSON.stringify({scope,target,...affected(s,scope,target),users:s.users.map(u=>u.id),rounds:s.rounds.filter(r=>affected(s,scope,target).leagues.includes(r.league)).map(r=>[r.id,r.slips.length])}));
export function planWipe(s,u,input,token,now=Date.now()){
 requireRecentAdmin(s,u,token,now);const scope=String(input.scope),target=String(input.target||''),a=affected(s,scope,target);
 const plan={id:id(),operator:u.id,scope,target,counts:a.counts,digest:fingerprint(s,scope,target),expires:now+300000,phrase:scope==='all'?'CANCELLA TUTTI I DATI':scope==='game'?'AZZERA TUTTO IL GIOCO':scope==='user'?'ELIMINA UTENTE E STORICO':'ELIMINA LEGA E STORICO'};
 s.adminWipePlans=(s.adminWipePlans||[]).filter(p=>p.expires>now&&p.operator!==u.id);s.adminWipePlans.push(plan);
 return {id:plan.id,scope,counts:plan.counts,phrase:plan.phrase,expiresAt:plan.expires,notice:scope==='all'?'Saranno conservate soltanto l’utenza e la sessione amministrativa. Gli archivi pubblici Serie A potranno essere ricreati dai batch.':scope==='user'?'Saranno eliminate anche le leghe presiedute dall’utente e tutti i suoi dati personali e di gioco.':'Eliminazione definitiva dal database attivo. Eventuali copie di backup del provider seguono la loro conservazione.'};
}
export function purgeLeagues(s,ids){
 const removedMails=(s.mailOutbox||[]).filter(j=>j.reminder&&(j.reminder.leagues||[j.reminder.league]).some(id=>ids.includes(id)));for(const j of removedMails)if(s.emailReminderRegistry)delete s.emailReminderRegistry[j.reminder.uid+':'+j.reminder.deadline];s.mailOutbox=(s.mailOutbox||[]).filter(j=>!removedMails.includes(j));if(s.emailReminderRegistry)for(const key of Object.keys(s.emailReminderRegistry))if(ids.some(id=>key.startsWith(id+':')))delete s.emailReminderRegistry[key];
 if(s.reminderRegistry)for(const key of Object.keys(s.reminderRegistry))if(ids.some(id=>key.startsWith(id+':')))delete s.reminderRegistry[key];
 if(s.playerRewards)for(const uid of Object.keys(s.playerRewards))s.playerRewards[uid]=s.playerRewards[uid].filter(a=>!ids.includes(a.league));
 s.leagueAlerts=(s.leagueAlerts||[]).filter(a=>!ids.includes(a.league));s.reminderOutbox=(s.reminderOutbox||[]).filter(j=>!ids.includes(j.league));
 s.leagues=s.leagues.filter(l=>!ids.includes(l.id));s.rounds=s.rounds.filter(r=>!ids.includes(r.league));s.ledger=s.ledger.filter(x=>!ids.includes(x.league));
 for(const k of ['leagueChats','chatReaders','fantasyRankingCache','playerProfiles','analysisTextHashes'])if(s[k])for(const key of Object.keys(s[k]))if(ids.some(id=>key===id||key.startsWith(id+':')||key.includes(':'+id)))delete s[k][key];
 s.chatPushOutbox=(s.chatPushOutbox||[]).filter(j=>!ids.includes(j.league));
 s.fantasyConnections=(s.fantasyConnections||[]).filter(c=>{c.leagues=(c.leagues||[]).filter(l=>!ids.includes(l));return c.leagues.length;});
}
export async function deleteOwnedLeague(s,c,u,league,phrase){
 if(!league||league.admin!==u?.id||!u.emailVerified||u.adminOnly||u.demo||league.demo)fail('Serve il presidente di lega',403);
 if(phrase!=='ELIMINA LEGA E STORICO')fail('Frase di conferma errata',409);
 if(!c)fail('Cancellazione temporaneamente non disponibile',503);
 const barIds=[league.id],leagueIds=await linkedFantaForWipe(c,s.leagues,barIds);
 await deleteFantaLeagues(c,{leagueIds,barIds});
 purgeLeagues(s,barIds);
 audit(s,'president-league-delete',{leghe:1,legheFanta:leagueIds.length});
 return {ok:true};
}
export function executeWipe(s,u,input,token,env=process.env,now=Date.now()){
 requireRecentAdmin(s,u,token,now);
 const p=s.adminWipePlans?.find(p=>p.id===input.plan&&p.operator===u.id&&p.expires>now);
 if(!p||input.phrase!==p.phrase)fail('Conferma non valida o scaduta',409);
 if(p.digest!==fingerprint(s,p.scope,p.target))fail('I dati sono cambiati: genera una nuova anteprima prima di cancellare.',409);
 const a=affected(s,p.scope,p.target),scope=p.scope,uid=p.target;
 if(scope==='all'){
  clearPendingActivity();
  const admin=structuredClone(u),sessions=s.sessions.filter(x=>x.uid===u.id&&x.admin),provisioned=s.adminProvisioned;
  for(const key of Object.keys(s))delete s[key];Object.assign(s,emptyState(),{users:[admin],sessions,systemAdminId:admin.id,adminProvisioned:provisioned});
 }else if(scope==='game'){
  purgeLeagues(s,s.leagues.map(l=>l.id));
  for(const key of ['chatSubscriptions','playerProfiles','analysisTextHashes','fantasyRankingCache','fantasyAttempts','supportMessages','leagueChats','chatReaders','chatPushOutbox'])delete s[key];
 }else{
  purgeLeagues(s,a.leagues);
  if(scope==='user'){
    if(s.reminderRegistry)for(const key of Object.keys(s.reminderRegistry))if(key.includes(':'+uid+':'))delete s.reminderRegistry[key];if(s.emailReminderRegistry)for(const key of Object.keys(s.emailReminderRegistry))if(key.startsWith(uid+':')||key.includes(':'+uid+':'))delete s.emailReminderRegistry[key];if(s.playerRewards)delete s.playerRewards[uid];s.leagueAlerts=(s.leagueAlerts||[]).filter(a=>a.uid!==uid);s.reminderOutbox=(s.reminderOutbox||[]).filter(a=>a.uid!==uid);
   clearPendingActivity(uid);
   const removed=s.users.find(x=>x.id===uid),emails=[removed.email,removed.pendingEmail].filter(Boolean),mailIds=(s.accountTokens||[]).filter(t=>t.uid===uid).map(t=>t.mailId);
   mailIds.push(...(s.supportMessages||[]).filter(x=>x.uid===uid).map(x=>x.mailId));
   s.mailOutbox=(s.mailOutbox||[]).filter(j=>{if(mailIds.includes(j.id))return false;try{return !decodeMail(j,env).to?.some(e=>emails.includes(e));}catch{return false;}});
   s.mailDeliveryLog=(s.mailDeliveryLog||[]).filter(j=>!mailIds.includes(j.jobId));
   s.fantasyAttempts=(s.fantasyAttempts||[]).filter(x=>x.uid!==uid);
   s.users=s.users.filter(x=>x.id!==uid);s.sessions=s.sessions.filter(x=>x.uid!==uid);s.accountTokens=(s.accountTokens||[]).filter(x=>x.uid!==uid);
   const social=(s.socialIdentities||[]).filter(x=>x.uid===uid);s.socialIdentities=(s.socialIdentities||[]).filter(x=>x.uid!==uid);s.socialPending=(s.socialPending||[]).filter(x=>x.completed?.uid!==uid&&!emails.includes(x.identity?.email)&&!social.some(i=>i.provider===x.identity?.provider&&i.subject===x.identity?.subject));
   s.accessEvents=(s.accessEvents||[]).filter(x=>x.uid!==uid);s.ledger=s.ledger.filter(x=>x.uid!==uid);
   for(const l of s.leagues){l.members=l.members.filter(x=>x.uid!==uid);l.removedMembers=(l.removedMembers||[]).filter(x=>x.uid!==uid);l.prizeWinners=(l.prizeWinners||[]).filter(x=>x!==uid);}
   for(const r of s.rounds)r.slips=r.slips.filter(x=>x.uid!==uid);
   const devices=(s.chatSubscriptions||[]).filter(d=>d.uid===uid).map(d=>d.id);s.chatSubscriptions=(s.chatSubscriptions||[]).filter(d=>d.uid!==uid);
   for(const r of Object.values(s.leagueChats||{})){r.messages=r.messages.filter(m=>m.uid!==uid);r.revision=(r.revision||0)+1;}
   s.chatPushOutbox=(s.chatPushOutbox||[]).filter(j=>j.author!==uid&&j.testUser!==uid);for(const j of s.chatPushOutbox)j.recipients=j.recipients.filter(d=>!devices.includes(d));
   s.fantasyConnections=(s.fantasyConnections||[]).filter(c=>c.owner!==uid);
   for(const day of Object.values(s.platformStats?.days||{}))if(day.users)delete day.users[uid];
   for(const key of Object.keys(s.chatReaders||{}))if(key.endsWith(':'+uid))delete s.chatReaders[key];
   s.supportMessages=(s.supportMessages||[]).filter(x=>x.uid!==uid);
   delete s.playerProfiles;delete s.analysisTextHashes;delete s.fantasyRankingCache;
   if(s.legacyRecoveryOperations)for(const [k,v]of Object.entries(s.legacyRecoveryOperations))if(v.uid===uid)delete s.legacyRecoveryOperations[k];
  }
 }
 s.adminWipePlans=[];audit(s,'wipe-'+scope,a.counts);return {ok:true,scope,counts:a.counts};
}
export async function planPlatformWipe(s,c,u,input,token,now=Date.now()){
 const preview=planWipe(s,u,input,token,now);
 const plan=s.adminWipePlans.find(p=>p.id===preview.id);
 const {leagues}=affected(s,plan.scope,plan.target);
 plan.fantaIds=await linkedFantaForWipe(c,s.leagues,leagues);
 plan.counts={...plan.counts,legheFanta:plan.fantaIds.length};
 return {...preview,counts:plan.counts};
}
export async function executePlatformWipe(s,c,u,input,token,env=process.env,now=Date.now()){
 const plan=s.adminWipePlans?.find(p=>p.id===input.plan);
 const before=s.leagues;
 const result=executeWipe(s,u,input,token,env,now);
 const remaining=new Set(s.leagues.map(l=>l.id));
 const barIds=before.filter(l=>!remaining.has(l.id)).map(l=>l.id);
 const leagueIds=await linkedFantaForWipe(c,before,barIds);
 if(JSON.stringify(plan.fantaIds)!==JSON.stringify(leagueIds)){
  fail('I collegamenti con il Fanta sono cambiati. Genera una nuova anteprima.',409);
 }
 await deleteFantaLeagues(c,{leagueIds,barIds});
 if(result.scope==='all')await c.query('DELETE FROM fanta_login_limits');
 const counts={...result.counts,legheFanta:leagueIds.length};
 s.adminAudit.at(-1).counts=counts;
 return {...result,counts};
}
export async function runAdminProbe({transact,u,token,input,env=process.env,fetcher=fetch}){
 await transact(s=>requireSystemAdmin(s,u));
 const started=Date.now();let result;
 if(input.provider==='database')result={ok:true,message:'Lettura e autorizzazione del database riuscite.'};
 else if(input.provider==='espn'){
  const r=await fetcher('https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard',{signal:AbortSignal.timeout(10000)});recordExternal('ESPN','scoreboard',r.status);const data=await r.json();result={ok:r.ok,status:r.status,events:data.events?.length||0};
 }else fail('Test non consentito');
 result.durationMs=Date.now()-started;
 await transact(s=>{requireSystemAdmin(s,u);(s.adminProbeLog??=[]).push({at:new Date().toISOString(),provider:input.provider,...result});s.adminProbeLog=s.adminProbeLog.slice(-100);flushExternalActivity(s);});return result;
}
