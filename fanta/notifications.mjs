import {createHash,randomUUID} from 'node:crypto';
import webpush from 'web-push';
import {connection} from '../lib/db.mjs';
import {recipientAllowed,blockedDelivery} from '../lib/release-env.mjs';
import {queueMail,sendMail,mailReady} from '../lib/mail.mjs';
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
  idFor([uid,'auction',key]),uid,'auction',JSON.stringify({...message,league:s.league.id,kind:'fanta',url:'/?mode=fanta&fantaLeague='+encodeURIComponent(s.league.id)+'#/fanta/asta?lega='+encodeURIComponent(s.league.id)}),new Date(now+12*3600000).toISOString()
 ]);
 return idFor([s.league.id,key]);
}
export const queueAuctionOpened=queueAuctionNotice;
export async function queueFantaNotifications({connect=connection,now=Date.now}={}){
 const c=await connect();try{
  const rounds=(await c.query(`SELECT r.*,t.id AS team_id,t.user_id,l.name FROM fanta.rounds r JOIN fanta.leagues l ON l.id=r.league_id JOIN fanta.teams t ON t.league_id=l.id AND t.user_id IS NOT NULL WHERE l.rules->>'disabledAt' IS NULL AND (r.deadline BETWEEN $1 AND $2 OR (r.official AND EXISTS(SELECT 1 FROM fanta.results z JOIN fanta.matchups m ON m.id=z.matchup_id WHERE m.competition_id=r.competition_id AND m.round=r.number AND z.official AND NOT z.historical AND z.updated_at>=$3)))`,[new Date(now()-2*3600000).toISOString(),new Date(now()+2*3600000).toISOString(),new Date(now()-24*3600000).toISOString()])).rows;
  const enqueue=async(uid,kind,key,title,body,league,lineup=null)=>{await c.query('INSERT INTO fanta.notifications(id,user_id,kind,data,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[idFor([uid,kind,key]),uid,kind,JSON.stringify({title,body,league,kind:'fanta',url:'/?mode=fanta&fantaLeague='+encodeURIComponent(league),...(lineup?{lineup}:{})}),new Date(lineup?.deadline||now()+12*3600000).toISOString()]);};
  for(const r of rounds){
   const age=now()-Date.parse(r.deadline),has=(await c.query('SELECT 1 FROM fanta.lineups WHERE competition_id=$1 AND round=$2 AND team_id=$3',[r.competition_id,r.number,r.team_id])).rows.length;
   if(age<0&&age>=-2*3600000&&!has)await enqueue(r.user_id,'lineupReminder',r.competition_id+':'+r.number,'Il Fanta sta per chiudere','Manca la formazione: il mister è ancora al bar?',r.league_id,{deadline:r.deadline,competition:r.competition_id,round:r.number,team:r.team_id});
   if(age>=0&&age<15*60000)await enqueue(r.user_id,'roundStart',r.competition_id+':'+r.number,'Si gioca!','La giornata è iniziata. Le scuse sono già pronte.',r.league_id);
   if(r.official&&age>=0)await enqueue(r.user_id,'results',r.competition_id+':'+r.number,'Il conto della giornata','Risultati e voti ufficiali sono pronti nel Fanta.',r.league_id);
  }
  const events=(await c.query(`SELECT e.fixture_id,e.id,e.data,t.user_id,l.league_id,CASE WHEN l.starters ? ('af:'||(e.data#>>'{player,id}')) THEN e.data#>>'{player,name}' ELSE e.data#>>'{assist,name}' END AS player_name,CASE WHEN l.starters ? ('af:'||(e.data#>>'{player,id}')) THEN e.data->>'detail' ELSE 'Assist' END AS detail FROM fanta.events e JOIN fanta.fixtures f ON f.id=e.fixture_id JOIN fanta.rounds r ON r.seriea_round=f.round JOIN fanta.lineups l ON l.competition_id=r.competition_id AND l.round=r.number JOIN fanta.teams t ON t.id=l.team_id JOIN fanta.leagues k ON k.id=l.league_id AND k.season=f.season WHERE k.rules->>'disabledAt' IS NULL AND e.notify AND e.seen_at>=$1 AND t.user_id IS NOT NULL AND (l.starters ? ('af:'||(e.data#>>'{player,id}')) OR (e.data->>'type'='Goal' AND e.data->>'detail'<>'Own Goal' AND e.data->>'detail'<>'Missed Penalty' AND l.starters ? ('af:'||(e.data#>>'{assist,id}')))) AND e.data->>'type' IN ('Goal','Card')`,[new Date(now()-2*60000).toISOString()])).rows;
  for(const e of events)await enqueue(e.user_id,'liveEvents',e.fixture_id+':'+e.id,'I tuoi sono in campo',(e.player_name||'Un tuo titolare')+' · '+(e.detail||e.data.type),e.league_id);
  const auctions=(await c.query(`SELECT a.*,t.id AS team_id,t.user_id FROM fanta.auctions a JOIN fanta.teams t ON t.league_id=a.league_id AND t.user_id IS NOT NULL WHERE NOT EXISTS(SELECT 1 FROM fanta.leagues k WHERE k.id=a.league_id AND k.rules->>'disabledAt' IS NOT NULL) AND a.data->>'status' IN ('scheduled','running')`)).rows;
  for(const a of auctions){const d=a.data,key=d.status==='scheduled'?d.scheduleNotificationKey:d.openNotificationKey;if(!key)await enqueue(a.user_id,'auction',a.id+':'+d.status+':'+(d.startsAt||''),'Asta · il tavolo è pronto',d.status==='scheduled'?'La tua lega ha programmato un’asta.':'La sala d’asta è aperta.',a.league_id);if(d.status==='running'&&d.caller===a.team_id&&!d.lot)await enqueue(a.user_id,'auction',a.id+':turn:'+d.callDeadline,'Tocca a te','Chiami un giocatore o chiami un altro giro?',a.league_id);}
 }finally{c.release();}
}
export const DELIVERY_SQL=`SELECT u AS user,(SELECT coalesce(jsonb_agg(d),'[]'::jsonb) FROM jsonb_array_elements(coalesce(payload->'chatSubscriptions','[]'::jsonb)) d WHERE d->>'uid'=$1) AS devices,payload->'chatPushKeys' AS keys FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE u->>'id'=$1`;
export async function deliverFantaNotifications({connect=connection,env=process.env,now=Date.now,sendPush=(...args)=>webpush.sendNotification(...args),deliverMail=sendMail}={}){
 const c=await connect(),lease=new Date(now()+90000).toISOString();let jobs;
 try{await c.query('BEGIN');jobs=(await c.query(`SELECT n.*,s.data AS settings FROM fanta.notifications n LEFT JOIN fanta.notification_settings s ON s.user_id=n.user_id WHERE NOT EXISTS(SELECT 1 FROM fanta.leagues k WHERE k.id=n.data->>'league' AND k.rules->>'disabledAt' IS NOT NULL) AND n.delivered_at IS NULL AND n.attempts<4 AND n.expires_at>$1 AND (n.lease_until IS NULL OR n.lease_until<$1) ORDER BY n.id LIMIT 5 FOR UPDATE OF n SKIP LOCKED`,[new Date(now()).toISOString()])).rows;for(const j of jobs)await c.query('UPDATE fanta.notifications SET lease_until=$2,attempts=attempts+1 WHERE id=$1',[j.id,lease]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 let delivered=0;
 for(const j of jobs){const c=await connect();let target,mailLineup=false;
  try{
   target=(await c.query(DELIVERY_SQL,[j.user_id])).rows[0];
   const lineup=j.kind==='lineupReminder'&&j.data.lineup;
   if(env.FANTA_EMAIL_ENABLED==='true'&&target?.user.emailVerified&&target.user.emailRemindersEnabled&&lineup&&Date.parse(lineup.deadline)>now()&&recipientAllowed(target.user.email,env)&&mailReady(env)){
    const saved=await c.query('SELECT 1 FROM fanta.lineups WHERE competition_id=$1 AND round=$2 AND team_id=$3',[lineup.competition,lineup.round,lineup.team]);
    mailLineup=saved.rows.length===0;
   }
  }finally{c.release();}let success=true;
  if(target&&recipientAllowed(target.user.email,env)){
   const keys={publicKey:env.WEB_PUSH_PUBLIC_KEY||target.keys?.publicKey,privateKey:env.WEB_PUSH_PRIVATE_KEY||target.keys?.privateKey};
   if(j.settings?.notify?.[j.kind]!==false)for(const device of target.devices||[])try{if(keys.publicKey&&keys.privateKey)await sendPush(device.subscription,JSON.stringify({...j.data,tag:'fanta-'+j.id}),{TTL:3600,vapidDetails:{subject:env.WEB_PUSH_SUBJECT||'mailto:account@quellidelquasi.com',...keys}});}catch(e){if(![404,410].includes(e.statusCode))success=false;}
   if(mailLineup)try{const queue={},message={to:[target.user.email],subject:j.data.title,html:'<p>'+j.data.body+'</p><p><a href="'+(env.APP_BASE_URL||'https://quellidelquasi.com')+'/?mode=fanta">Apri il Fanta</a></p>'};const id=queueMail(queue,message,env);await deliverMail(queue.mailOutbox.find(m=>m.id===id),undefined,env);}catch{success=false;}
  }else if(target&&!recipientAllowed(target.user.email,env))blockedDelivery('fanta-notification',env);
  const end=await connect();try{await end.query('UPDATE fanta.notifications SET delivered_at=$2,lease_until=NULL WHERE id=$1 AND lease_until=$3',[j.id,success?new Date(now()).toISOString():null,lease]);if(success)delivered++;}finally{end.release();}
 }
 return delivered;
}
