import {randomUUID,randomInt} from 'node:crypto';
import {connection} from '../lib/db.mjs';
import {DEFAULT_RULES,fail} from './rules.mjs';
import {DEFAULT_RULES as BAR_RULES} from '../lib/game.mjs';
import {pilotCatalog,withPilotTransaction} from './pilot.mjs';
import {balancedRandomRosters} from './auto-coach.mjs';
import {roundRobin,materializeCalendar} from './competitions.mjs';
import {writeAutoLineups} from './auto-lineups.mjs';
import {syncNativeBar} from './bar.mjs';
import {availableTeamNames} from './team-names.mjs';

// All writes below are one-off transactions, never part of a client's read path.
export async function ensureBar(c,league,{barId,now=Date.now()}={}){
 const own=(await c.query('SELECT bar_league_id FROM fanta.bar_links WHERE fanta_league_id=$1 LIMIT 1',[league.id])).rows[0];
 const id=own?.bar_league_id||barId||'bar:'+league.id;
 const coaches=(await c.query(`SELECT DISTINCT user_id AS uid FROM fanta.teams t WHERE league_id=$1 AND user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'leagues') b CROSS JOIN LATERAL jsonb_array_elements(coalesce(b->'removedMembers','[]')) m WHERE b->>'id'=$2 AND m->>'uid'=t.user_id)`,[league.id,id])).rows;
 await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1) THEN (SELECT jsonb_agg(CASE WHEN l->>'id'=$1 THEN l||jsonb_build_object('nativeFantaLink',jsonb_build_object('leagueId',$2::text,'competitionId',$2::text||':main','coachIds',$5::jsonb),'fantaSlipsEnabled',$3::boolean) ELSE l END) FROM jsonb_array_elements(payload->'leagues') l) ELSE coalesce(payload->'leagues','[]')||jsonb_build_array($4::jsonb) END) WHERE id=1`,[id,league.id,league.slips_enabled!==false,JSON.stringify({id,name:league.name,admin:league.admin_uid,code:randomUUID().replaceAll('-','').slice(0,8).toUpperCase(),createdAt:new Date(now).toISOString(),rules:BAR_RULES,members:coaches.map(x=>({uid:x.uid,initial:500,credits:500,points:0,joinedAt:new Date(now).toISOString()})),nativeFantaLink:{leagueId:league.id,competitionId:league.id+':main',coachIds:coaches.map(x=>x.uid)},fantaSlipsEnabled:league.slips_enabled!==false,demo:false}),JSON.stringify(coaches.map(x=>x.uid))]);
 await c.query(`INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key,active) VALUES($1,$2,$2||':main',$3,true) ON CONFLICT(bar_league_id) DO UPDATE SET fanta_league_id=EXCLUDED.fanta_league_id,competition_id=EXCLUDED.competition_id,competition_key=EXCLUDED.competition_key,active=true WHERE NOT fanta.bar_links.active`,[id,league.id,'native:'+league.id]);
 await syncCoaches(c,league.id,id);return id;
}
async function syncCoaches(c,leagueId,barId){
 await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',(SELECT coalesce(jsonb_agg(CASE WHEN l->>'id'=$1 THEN jsonb_set(l,'{members}',coalesce(l->'members','[]')||(SELECT coalesce(jsonb_agg(jsonb_build_object('uid',t.user_id,'initial',500,'credits',500,'points',0,'joinedAt',now())),'[]') FROM fanta.teams t WHERE t.league_id=$2 AND t.user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l->'removedMembers','[]')) gone WHERE gone->>'uid'=t.user_id) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l->'members','[]')) m WHERE m->>'uid'=t.user_id))) ELSE l END),'[]') FROM jsonb_array_elements(payload->'leagues') l)) WHERE id=1`,[barId,leagueId]);
}
export async function ensurePilotBars({connect=connection,now=Date.now()}={}){return withPilotTransaction(async c=>{const leagues=(await c.query("SELECT * FROM fanta.leagues WHERE rules->>'disabledAt' IS NULL AND kind IN('pilot','random')")).rows;for(const l of leagues)await ensureBar(c,l,{now});return {leagues:leagues.length};},{connect});}
export async function queueRandom(user,input,{connect=connection}={}){
 return withPilotTransaction(async c=>{
  let barId=input.barId,size=Number(input.size),name=String(input.name||'Lega random').trim().slice(0,80);
  if(barId){const b=(await c.query(`SELECT l FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1`,[barId])).rows[0]?.l;if(!b||b.admin!==user.id)fail('Solo il presidente del Bar può creare il Fanta',403);size=input.computerTeams===true?Number(input.size):b.members.length;if(size<b.members.length)fail('Servono almeno tante squadre quanti sono i partecipanti del Bar');name=input.name?name:b.name;}
  else {if(!/^[a-f0-9-]{36}$/.test(input.requestId||''))fail('Identificatore della richiesta non valido');barId='bar:random:'+user.id+':'+input.requestId;}
  const old=(await c.query('SELECT * FROM fanta.creation_jobs WHERE bar_id=$1',[barId])).rows[0];if(old){if(old.owner_uid!==user.id)fail('Lega non accessibile',403);return old;}
  if((await c.query('SELECT 1 FROM fanta.bar_links WHERE bar_league_id=$1 AND active',[barId])).rows.length)fail('Questo Bar ha già una lega Fanta',409);
  if(!Number.isInteger(size)||size<2||size>20)fail('Servono da 2 a 20 partecipanti per creare le rose');
  const counts=(await c.query(`SELECT p.role,count(*)::int AS n FROM fanta.players p WHERE coalesce((p.data->>'active')::boolean,true) AND EXISTS(SELECT 1 FROM fanta.fixtures f WHERE f.season=$1 AND p.club_id IN(f.home_id,f.away_id)) GROUP BY p.role`,[Number(process.env.FANTA_SEASON||2026)])).rows;
  for(const [role,slots]of Object.entries(DEFAULT_RULES.roster))if((counts.find(x=>x.role===role)?.n||0)<size*slots)fail('Listone insufficiente nel ruolo '+role+' per '+size+' squadre');
  const id=randomUUID();await c.query('INSERT INTO fanta.creation_jobs(id,bar_id,owner_uid,size,name) VALUES($1,$2,$3,$4,$5)',[id,barId,user.id,size,name]);
  return {id,bar_id:barId,status:'queued',size,message:'La lega sarà disponibile tra qualche minuto. Stiamo distribuendo rose e responsabilità discutibili.'};
 },{connect});
}
export async function randomStatus(user,{connect=connection}={}){const c=await connect();try{return (await c.query(`SELECT j.id,j.name,j.status,j.bar_id,j.league_id,j.size,j.error FROM fanta.creation_jobs j WHERE j.owner_uid=$1 OR EXISTS(SELECT 1 FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'leagues') l CROSS JOIN LATERAL jsonb_array_elements(l->'members') m WHERE l->>'id'=j.bar_id AND m->>'uid'=$1) ORDER BY j.created_at DESC LIMIT 30`,[user.id])).rows;}finally{c.release();}}
export async function runRandomCreation(jobId,{connect=connection,env=process.env,now=Date.now()}={}){
 const result=await withPilotTransaction(async c=>{
  const job=(await c.query('SELECT * FROM fanta.creation_jobs WHERE id=$1 FOR UPDATE',[jobId])).rows[0];if(!job||job.status==='ready')return {reused:true};
  await c.query("UPDATE fanta.creation_jobs SET status='running',error=NULL,updated_at=now() WHERE id=$1",[jobId]);
  if(job.league_id){
   const league=(await c.query(`SELECT * FROM fanta.leagues WHERE id=$1 AND rules->>'disabledAt' IS NULL`,[job.league_id])).rows[0];if(!league)fail('Lega non disponibile');
   const season=Number(env.FANTA_SEASON||2026),fixtures=(await c.query('SELECT round,min(kickoff) AS first,count(*)::int AS matches FROM fanta.fixtures WHERE season=$1 AND kickoff IS NOT NULL GROUP BY round ORDER BY round',[season])).rows,first=fixtures.find(r=>r.matches===10&&Date.parse(r.first)>now);if(!first)fail('Calendario della prossima giornata non disponibile');
   const teams=(await c.query('SELECT id FROM fanta.teams WHERE league_id=$1 ORDER BY id',[league.id])).rows,ids=teams.map(t=>t.id),catalog=await pilotCatalog(c,season),rosters=balancedRandomRosters(catalog,{teams:job.size,seed:job.id});
   if((await c.query('SELECT 1 FROM fanta.rosters WHERE league_id=$1 LIMIT 1',[league.id])).rows.length)fail('La lega contiene già giocatori: generazione interrotta');
   await c.query('INSERT INTO fanta.rosters SELECT * FROM jsonb_to_recordset($1::jsonb) x(league_id text,team_id text,player_id text,price int)',[JSON.stringify(rosters.flatMap((r,i)=>r.map(p=>({league_id:league.id,team_id:ids[i],player_id:p.id,price:p.price}))))]);
   const cycle=roundRobin(ids,{twice:true}),plan=Array.from({length:39-first.round},(_,i)=>({number:i+1,matches:cycle[i%cycle.length].map(m=>({...m,stage:'league'}))})),comp={id:league.id+':main',league_id:league.id,start_round:first.round,kind:'league',data:{plan,startedAt:new Date(now).toISOString()}};
   await c.query("UPDATE fanta.competitions SET status='active',start_round=$2,data=$3 WHERE id=$1",[comp.id,first.round,JSON.stringify(comp.data)]);await materializeCalendar(c,comp,season);
   await c.query("UPDATE fanta.leagues SET rules=rules||'{\"creationPending\":false}'::jsonb WHERE id=$1",[league.id]);
   await writeAutoLineups(c,{now,leagueIds:[league.id],initial:true});await c.query("UPDATE fanta.creation_jobs SET status='ready',error=NULL,updated_at=now() WHERE id=$1",[job.id]);
   await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',(SELECT jsonb_agg(CASE WHEN l->>'id'=$1 THEN jsonb_set(l,'{fantaCreation,status}','"ready"'::jsonb) ELSE l END) FROM jsonb_array_elements(payload->'leagues') l)) WHERE id=1`,[job.bar_id]);return {league:league.id};
  }
  const season=Number(env.FANTA_SEASON||2026),fixtures=(await c.query('SELECT round,min(kickoff) AS first,max(kickoff) AS last,count(*)::int AS matches FROM fanta.fixtures WHERE season=$1 AND kickoff IS NOT NULL GROUP BY round ORDER BY round',[season])).rows;
  // Start at the next open round: nobody loses their first lineup deadline during generation.
  const first=fixtures.find(r=>r.matches===10&&Date.parse(r.first)>now);if(!first)fail('Calendario della prossima giornata non disponibile');
  const id='random:'+job.id,catalog=await pilotCatalog(c,season),rosters=balancedRandomRosters(catalog,{teams:job.size,seed:job.id}),at=new Date(now).toISOString();
  await c.query("INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,max_members,kind,auto_lineups_from) VALUES($1,$2,$3,$4,$5,$6,$7,'random',$8)",[id,job.name,season,job.owner_uid,'R-'+randomUUID(),JSON.stringify(DEFAULT_RULES),job.size,at]);
  const ids=[],colors=['#b64b5a','#d4aa45','#608ca8','#78a67b','#9a72b2','#df8952'],names=await availableTeamNames(c,job.size,job.id);
  for(let i=0;i<job.size;i++){const tid=id+':'+i;ids.push(tid);const primary=colors[i%6],secondary=colors[(i+2)%6],branding={type:'design',design:{shape:['shield','circle','hexagon','pennant'][i%4],primary,secondary,ink:'#ffffff',text:names[i].split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(),symbol:['star','ball','coffee','clover'][i%4],pattern:['diagonal','stripes','chevron','halves'][i%4]}};await c.query('INSERT INTO fanta.teams(id,league_id,name,manager,color,coach_name,branding) VALUES($1,$2,$3,$4,$5,$4,$6)',[tid,id,names[i],'Mister di Bordo '+(i+1),primary,JSON.stringify(branding)]);}
  await c.query('INSERT INTO fanta.rosters SELECT * FROM jsonb_to_recordset($1::jsonb) x(league_id text,team_id text,player_id text,price int)',[JSON.stringify(rosters.flatMap((r,i)=>r.map(p=>({league_id:id,team_id:ids[i],player_id:p.id,price:p.price}))))]);
  const cycle=roundRobin(ids,{twice:true}),plan=Array.from({length:39-first.round},(_,i)=>({number:i+1,matches:cycle[i%cycle.length].map(m=>({...m,stage:'league'}))})),comp={id:id+':main',league_id:id,name:'Campionato random',kind:'league',start_round:first.round,data:{plan,startedAt:at}};
  await c.query("INSERT INTO fanta.competitions(id,league_id,name,kind,status,start_round,data) VALUES($1,$2,$3,'league','active',$4,$5)",[comp.id,id,comp.name,first.round,JSON.stringify(comp.data)]);await materializeCalendar(c,comp,season);
  await ensureBar(c,{id,name:job.name,admin_uid:job.owner_uid},{barId:job.bar_id,now});
  // Keep the creator in their Bar, even before they claim a team.
  await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',(SELECT jsonb_agg(CASE WHEN l->>'id'=$1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l->'members') m WHERE m->>'uid'=$2) THEN jsonb_set(l,'{members}',l->'members'||jsonb_build_array(jsonb_build_object('uid',$2::text,'initial',500,'credits',500,'points',0,'joinedAt',now()))) ELSE l END) FROM jsonb_array_elements(payload->'leagues') l)) WHERE id=1`,[job.bar_id,job.owner_uid]);
  await writeAutoLineups(c,{now,leagueIds:[id],initial:true});await c.query("UPDATE fanta.creation_jobs SET status='ready',league_id=$2,updated_at=now() WHERE id=$1",[jobId,id]);return {league:id};
 },{connect});if(result.league)await syncNativeBar({connect,now,onlyLeagueIds:[result.league]});return result;
}
export async function claimRandom(user,leagueId,{connect=connection,random=randomInt,teamId=null}={}){
 if(teamId!==null&&(typeof teamId!=='string'||!teamId||teamId.length>200))fail('Scegli una squadra valida');
 return withPilotTransaction(async c=>{await c.query('SELECT id FROM fanta_state WHERE id=1 FOR UPDATE');const row=(await c.query(`SELECT l.*,b.bar_league_id FROM fanta.leagues l JOIN fanta.bar_links b ON b.fanta_league_id=l.id AND b.active WHERE l.id=$1 AND l.source_key IS NULL AND l.rules->>'disabledAt' IS NULL`,[leagueId])).rows[0];if(!row)fail('Lega non disponibile',404);
  const member=(await c.query(`SELECT 1 FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'leagues') l CROSS JOIN LATERAL jsonb_array_elements(l->'members') m WHERE l->>'id'=$1 AND m->>'uid'=$2 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l->'removedMembers','[]')) gone WHERE gone->>'uid'=$2)`,[row.bar_league_id,user.id])).rows.length;if(!member)fail('Devi prima entrare nel Bar della lega',403);
  const existing=(await c.query('SELECT id FROM fanta.teams WHERE league_id=$1 AND user_id=$2',[leagueId,user.id])).rows[0];if(existing)return {league:{id:leagueId},team:existing,reused:true};
  if(row.rules?.creationPending)fail('Le rose sono ancora in preparazione. Riprova tra poco.',409);
  const free=(await c.query('SELECT id,name FROM fanta.teams WHERE league_id=$1 AND user_id IS NULL ORDER BY id FOR UPDATE',[leagueId])).rows;if(!free.length)fail('Tutte le squadre hanno già un allenatore',409);const team=teamId?free.find(t=>t.id===teamId):free[random(free.length)];if(!team)fail('Questa squadra non è più disponibile. Scegline un’altra.',409);await c.query('UPDATE fanta.teams SET user_id=$2,manager=$3,joined_at=now() WHERE id=$1',[team.id,user.id,user.name||user.username]);await ensureBar(c,row,{barId:row.bar_league_id});return {league:{id:leagueId},team};
 },{connect});
}
export async function setSlips(user,leagueId,enabled,{connect=connection}={}){if(typeof enabled!=='boolean')fail('Impostazione non valida');return withPilotTransaction(async c=>{
 const l=(await c.query('UPDATE fanta.leagues SET slips_enabled=$3 WHERE id=$1 AND admin_uid=$2 RETURNING id',[leagueId,user.id,enabled])).rows[0];if(!l)fail('Serve il presidente Fanta',403);
 await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',(SELECT jsonb_agg(CASE WHEN l#>>'{nativeFantaLink,leagueId}'=$1 THEN l||jsonb_build_object('fantaSlipsEnabled',$2::boolean) ELSE l END) FROM jsonb_array_elements(payload->'leagues') l)) WHERE id=1`,[leagueId,enabled]);return {enabled};
 },{connect});}
