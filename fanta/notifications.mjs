import {barStorageRoot} from '../lib/storage-mode.mjs';
import {appRoute} from '../public/src/routes.mjs';
import {createHash,randomUUID} from 'node:crypto';
import webpush from 'web-push';
import {connection} from '../lib/db.mjs';
import {recipientAllowed,blockedDelivery} from '../lib/release-env.mjs';
import {sendMail,mailReady} from '../lib/mail.mjs';
import {REMINDER_WINDOW_MS,isReminderDue} from '../lib/reminder-timing.mjs';
import {sendAdminSubmissionReminder,submissionReminderMessage} from '../lib/submission-reminders.mjs';
export function fantaNotificationUrl(league,kind,target={}){
 const page=kind==='lineupReminder'?'squadra':kind==='auction'?'asta':kind==='trade'?'scambi':target.round?'giornata':'oggi';
 const section=kind==='lineupReminder'?'studio':null;
 return '/?'+new URLSearchParams({mode:'fanta',fantaLeague:league})+appRoute({mode:'fanta',page,section,league,round:target.round,competition:target.competition});
}
const idFor=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function scheduleMessage(name,startsAt){
 const when=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',dateStyle:'full',timeStyle:'short'}).format(new Date(startsAt));
 return {title:'Asta programmata · '+name,body:'Ci vediamo al tavolo '+when+'.'};
}
export async function queueAuctionNotice(c,s,auction,{now=Date.now()}={}){
 const scheduled=auction.status==='scheduled';
 const key=scheduled?auction.scheduleNotificationKey:auction.openNotificationKey||s.league.id+':'+auction.version+':'+now;
 const message=scheduled?scheduleMessage(s.league.name,auction.startsAt):{title:'Asta aperta · '+s.league.name,body:'Il banditore è al tavolo. Entra nella sala della tua lega!'};
 const members=scheduled?(await c.query(`SELECT member->>'uid' AS uid FROM fanta.bar_links b JOIN fanta_state s ON s.id=1 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'leagues') bar CROSS JOIN LATERAL jsonb_array_elements(bar->'members') member WHERE b.active AND b.fanta_league_id=$1 AND bar->>'id'=b.bar_league_id`,[s.league.id])).rows:[];
 for(const uid of new Set([...s.teams.map(t=>t.userId),...members.map(m=>m.uid)].filter(Boolean)))await c.query('INSERT INTO fanta.notifications(id,user_id,kind,data,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[
  idFor([uid,'auction',key]),uid,'auction',JSON.stringify({...message,league:s.league.id,kind:'fanta',url:fantaNotificationUrl(s.league.id,'auction')}),new Date(now+12*3600000).toISOString()
 ]);
 return idFor([s.league.id,key]);
}
export const queueAuctionOpened=queueAuctionNotice;
export async function queueTradeNotice(c,{id,revision,league,uid,now,endsAt}){
 const key=idFor([uid,'trade',id,revision]);
 const title=(revision===1?'Nuova proposta di scambio':'Nuova controproposta')+' · '+league.name;
 const expires=new Date(Math.min(now+24*3600000,Date.parse(endsAt)||Infinity)).toISOString();
 await c.query(`INSERT INTO fanta.notifications(id,user_id,kind,data,expires_at)
  VALUES($1,$2,'trade',$3,$4) ON CONFLICT DO NOTHING`,[key,uid,
  JSON.stringify({title,body:'Apri Scambi per vedere la proposta.',kind:'fanta',league:league.id,url:fantaNotificationUrl(league.id,'trade'),tradeId:id,revision}),expires]);
 return key;
}
export async function queueFantaNotifications({connect=connection,now=Date.now,reminderHours=null,emailOnly=false}={}){
 const c=await connect();try{
  const at=now(),target=reminderHours?at+reminderHours*3600000:null;
  const rounds=(await c.query(`SELECT r.competition_id,r.number,r.deadline,r.league_id,r.official,t.id AS team_id,t.user_id,l.name,
   EXISTS(SELECT 1 FROM fanta.lineups x WHERE x.competition_id=r.competition_id AND x.round=r.number AND x.team_id=t.id) AS has_lineup,
   (NOT r.official AND EXISTS(SELECT 1 FROM fanta.competitions comp WHERE comp.id=r.competition_id AND comp.status='active')
    AND EXISTS(SELECT 1 FROM fanta.matchups m WHERE m.competition_id=r.competition_id AND m.round=r.number AND t.id IN(m.home_id,m.away_id))) AS can_remind
   FROM fanta.rounds r JOIN fanta.leagues l ON l.id=r.league_id JOIN fanta.teams t ON t.league_id=l.id AND t.user_id IS NOT NULL
   WHERE l.rules->>'disabledAt' IS NULL AND (r.deadline BETWEEN $1 AND $2 OR r.deadline BETWEEN $4::timestamptz AND $5::timestamptz
    OR (r.official AND EXISTS(SELECT 1 FROM fanta.results z JOIN fanta.matchups m ON m.id=z.matchup_id WHERE m.competition_id=r.competition_id AND m.round=r.number AND z.official AND NOT z.historical AND z.updated_at>=$3)))`,
   [new Date(at-2*3600000).toISOString(),new Date(at+2*3600000).toISOString(),new Date(at-24*3600000).toISOString(),
    target===null?null:new Date(target-REMINDER_WINDOW_MS).toISOString(),target===null?null:new Date(target).toISOString()])).rows;
  const pending=[];
  const enqueue=(uid,kind,key,title,body,league,lineup=null,target=lineup)=>pending.push({
   id:idFor([uid,kind,key]),user_id:uid,kind,
   data:{title,body,league,kind:'fanta',url:fantaNotificationUrl(league,kind,target||{}),...(lineup?{lineup}:{})},
   expires_at:new Date(lineup?.deadline||now()+12*3600000).toISOString(),
  });
  for(const r of rounds){
   const age=now()-Date.parse(r.deadline);
   if(reminderHours&&r.can_remind&&!r.has_lineup&&isReminderDue(Date.parse(r.deadline),at,reminderHours)){
    const lineup={deadline:r.deadline,competition:r.competition_id,round:r.number,team:r.team_id};
    const message=submissionReminderMessage('fanta',{id:r.league_id,name:r.name},{...lineup,lead:reminderHours});
    pending.push({id:idFor([r.user_id,'lineupReminder',r.competition_id,r.number,Date.parse(r.deadline),reminderHours,emailOnly]),
     user_id:r.user_id,kind:'lineupReminder',data:{...message,lineup,delivery:emailOnly?'email':'push'},expires_at:new Date(r.deadline).toISOString()});
   }
   if(age>=0&&age<15*60000)enqueue(r.user_id,'roundStart',r.competition_id+':'+r.number,'Si gioca!','La giornata è iniziata. Le scuse sono già pronte.',r.league_id,null,{competition:r.competition_id,round:r.number});
   if(r.official&&age>=0)enqueue(r.user_id,'results',r.competition_id+':'+r.number,'Il conto della giornata','Risultati e voti ufficiali sono pronti nel Fanta.',r.league_id,null,{competition:r.competition_id,round:r.number});
  }
  const events=(await c.query(`SELECT e.fixture_id,e.id,e.data,t.user_id,l.league_id,r.number,r.competition_id,CASE WHEN l.starters ? ('af:'||(e.data#>>'{player,id}')) THEN e.data#>>'{player,name}' ELSE e.data#>>'{assist,name}' END AS player_name,CASE WHEN l.starters ? ('af:'||(e.data#>>'{player,id}')) THEN e.data->>'detail' ELSE 'Assist' END AS detail FROM fanta.events e JOIN fanta.fixtures f ON f.id=e.fixture_id JOIN fanta.rounds r ON r.seriea_round=f.round JOIN fanta.lineups l ON l.competition_id=r.competition_id AND l.round=r.number JOIN fanta.teams t ON t.id=l.team_id JOIN fanta.leagues k ON k.id=l.league_id AND k.season=f.season WHERE k.rules->>'disabledAt' IS NULL AND e.notify AND e.seen_at>=$1 AND t.user_id IS NOT NULL AND (l.starters ? ('af:'||(e.data#>>'{player,id}')) OR (e.data->>'type'='Goal' AND e.data->>'detail'<>'Own Goal' AND e.data->>'detail'<>'Missed Penalty' AND l.starters ? ('af:'||(e.data#>>'{assist,id}')))) AND e.data->>'type' IN ('Goal','Card')`,[new Date(now()-2*60000).toISOString()])).rows;
  for(const e of events)enqueue(e.user_id,'liveEvents',e.competition_id+':'+e.fixture_id+':'+e.id,'I tuoi sono in campo',(e.player_name||'Un tuo titolare')+' · '+(e.detail||e.data.type),e.league_id,null,{competition:e.competition_id,round:e.number});
  const auctions=(await c.query(`SELECT a.id,a.league_id,jsonb_build_object('status',a.data->'status','scheduleNotificationKey',a.data->'scheduleNotificationKey',
   'openNotificationKey',a.data->'openNotificationKey','startsAt',a.data->'startsAt','caller',a.data->'caller',
   'hasLot',coalesce(a.data->'lot'<>'null'::jsonb,false),'callDeadline',a.data->'callDeadline') AS data,t.id AS team_id,t.user_id FROM fanta.auctions a JOIN fanta.teams t ON t.league_id=a.league_id AND t.user_id IS NOT NULL WHERE NOT EXISTS(SELECT 1 FROM fanta.leagues k WHERE k.id=a.league_id AND k.rules->>'disabledAt' IS NOT NULL) AND a.data->>'status' IN ('scheduled','running')`)).rows;
  for(const a of auctions){const d=a.data,key=d.status==='scheduled'?d.scheduleNotificationKey:d.openNotificationKey;if(!key)enqueue(a.user_id,'auction',a.id+':'+d.status+':'+(d.startsAt||''),'Asta · il tavolo è pronto',d.status==='scheduled'?'La tua lega ha programmato un’asta.':'La sala d’asta è aperta.',a.league_id);if(d.status==='running'&&d.caller===a.team_id&&!d.hasLot)enqueue(a.user_id,'auction',a.id+':turn:'+d.callDeadline,'Tocca a te','Chiami un giocatore o chiami un altro giro?',a.league_id);}
  for(let i=0;i<pending.length;i+=100)await c.query(`INSERT INTO fanta.notifications(id,user_id,kind,data,expires_at)
   SELECT id,user_id,kind,data,expires_at FROM jsonb_to_recordset($1::jsonb)
   AS item(id text,user_id text,kind text,data jsonb,expires_at timestamptz) ON CONFLICT DO NOTHING`,
   [JSON.stringify(pending.slice(i,i+100))]);
 }finally{c.release();}
}
export const DELIVERY_SQL=`SELECT u AS user,(SELECT coalesce(jsonb_agg(d),'[]'::jsonb) FROM jsonb_array_elements(coalesce(payload->'chatSubscriptions','[]'::jsonb)) d WHERE d->>'uid'=$1) AS devices,payload->'chatPushKeys' AS keys FROM ${barStorageRoot()} CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE u->>'id'=$1`;
export async function deliverFantaNotifications({connect=connection,env=process.env,now=Date.now,notificationId=null,sendPush=(...args)=>webpush.sendNotification(...args),deliverMail=sendMail}={}){
 const c=await connect(),lease=new Date(now()+90000).toISOString();let jobs;
 try{await c.query('BEGIN');jobs=(await c.query(`SELECT n.*,s.data AS settings FROM fanta.notifications n LEFT JOIN fanta.notification_settings s ON s.user_id=n.user_id WHERE NOT EXISTS(SELECT 1 FROM fanta.leagues k WHERE k.id=n.data->>'league' AND k.rules->>'disabledAt' IS NOT NULL) AND ($2::text IS NULL OR n.id=$2) AND n.delivered_at IS NULL AND n.attempts<4 AND n.expires_at>$1 AND (n.lease_until IS NULL OR n.lease_until<$1) ORDER BY n.id LIMIT 5 FOR UPDATE OF n SKIP LOCKED`,[new Date(now()).toISOString(),notificationId])).rows;if(jobs.length)await c.query('UPDATE fanta.notifications SET lease_until=$2,attempts=attempts+1 WHERE id=ANY($1::text[])',[jobs.map(j=>j.id),lease]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 let delivered=0;
 for(const j of jobs){const c=await connect();let target,mailLineup=false;
  try{
   target=(await c.query(DELIVERY_SQL,[j.user_id])).rows[0];
   if(j.kind==='trade'&&!(await c.query("SELECT 1 FROM fanta.trades WHERE id=$1 AND recipient_uid=$2 AND revision=$3 AND status='pending'",[j.data.tradeId,j.user_id,j.data.revision])).rows.length)target=null;
   const lineup=j.kind==='lineupReminder'&&j.data.lineup;
   if(lineup&&target){
    const stillMissing=(await c.query(`SELECT 1 FROM fanta.rounds r JOIN fanta.teams t ON t.league_id=r.league_id
     WHERE r.competition_id=$1 AND r.number=$2 AND t.id=$3 AND t.user_id=$4 AND r.deadline=$5 AND r.deadline>$6
      AND NOT r.official AND NOT EXISTS(SELECT 1 FROM fanta.lineups x WHERE x.competition_id=$1 AND x.round=$2 AND x.team_id=$3)`,
     [lineup.competition,lineup.round,lineup.team,j.user_id,lineup.deadline,new Date(now()).toISOString()])).rows.length;
    if(!stillMissing)target=null;
    mailLineup=!!(target&&j.data.delivery!=='push'&&env.FANTA_EMAIL_ENABLED==='true'&&target.user.emailVerified&&target.user.emailRemindersEnabled&&recipientAllowed(target.user.email,env)&&mailReady(env));
   }
  }finally{c.release();}let success=true;
  if(target&&recipientAllowed(target.user.email,env)){
   const keys={publicKey:env.WEB_PUSH_PUBLIC_KEY||target.keys?.publicKey,privateKey:env.WEB_PUSH_PRIVATE_KEY||target.keys?.privateKey};
   const url=j.data.lineup?fantaNotificationUrl(j.data.league,j.kind,j.data.lineup):j.kind==="auction"?fantaNotificationUrl(j.data.league,j.kind):j.data.url;
   if(j.data.delivery!=='email'&&j.settings?.notify?.[j.kind]!==false)for(const device of target.devices||[])try{if(keys.publicKey&&keys.privateKey)await sendPush(device.subscription,JSON.stringify({...j.data,url,tag:'fanta-'+j.id}),{TTL:3600,vapidDetails:{subject:env.WEB_PUSH_SUBJECT||'mailto:account@quellidelquasi.com',...keys}});}catch(e){if(![404,410].includes(e.statusCode))success=false;}
   if(mailLineup)try{await sendAdminSubmissionReminder('email',{...j.data,url},target,{env,deliverMail});}catch{success=false;}
  }else if(target&&!recipientAllowed(target.user.email,env))blockedDelivery('fanta-notification',env);
  const end=await connect();try{await end.query('UPDATE fanta.notifications SET delivered_at=$2,lease_until=NULL WHERE id=$1 AND lease_until=$3',[j.id,success?new Date(now()).toISOString():null,lease]);if(success)delivered++;}finally{end.release();}
 }
 return delivered;
}
