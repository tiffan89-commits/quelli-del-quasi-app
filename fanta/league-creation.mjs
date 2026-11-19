import {randomUUID} from 'node:crypto';
import {newLeague,fail} from '../lib/game.mjs';
import {welcomeLeagueChat} from '../lib/league-chat.mjs';
import {DEFAULT_RULES} from './rules.mjs';
import {availableTeamNames} from './team-names.mjs';
import {leagueAccent} from '../public/src/league-theme.mjs';
import {nativeLeagueBranding} from '../lib/league-profile.mjs';
import {shortenTeamName,TEAM_NAME_MAX} from '../public/src/fanta/team-name.mjs';
export async function createLeaguePair(c,s,user,input,{season=2026,now=Date.now()}={}){
 const mode=input.rosterMode||'empty',requestedSize=Number(input.size??8),requestId=input.requestId||randomUUID();
 if(!['empty','random'].includes(mode)||!Number.isInteger(requestedSize)||requestedSize<2||requestedSize>12)fail('Scegli rose vuote o random e da 2 a 12 squadre');
 if(!/^[a-f0-9-]{36}$/.test(requestId))fail('Identificatore della richiesta non valido');
 const previous=(await c.query('SELECT * FROM fanta.creation_jobs WHERE id=$1',[requestId])).rows[0];
 if(previous){if(previous.owner_uid!==user.id)fail('Richiesta non accessibile',403);if(previous.roster_mode!==mode||previous.name!==String(input.name||'Quelli del quasi').trim().replace(/\s+/g,' ').slice(0,80))fail('Questa richiesta è già stata usata con impostazioni diverse',409);return {ok:true,league:previous.bar_id,fantaLeague:previous.league_id,reused:true,creationStatus:previous.status};}
 const count=s.leagues.length,bar=newLeague(s,user,input.name),linked=(await c.query('SELECT fanta_league_id FROM fanta.bar_links WHERE bar_league_id=$1 AND active',[bar.id])).rows[0];
 if(linked)return {ok:true,league:bar.id,fantaLeague:linked.fanta_league_id,reused:true};
 const size=s.leagues.length===count&&bar.members.length>1?bar.members.length:requestedSize;if(size>12)fail('Questa lega ha più di 12 membri: contatta l’amministratore');
 const id=(mode==='random'?'random:':'league:')+requestId,status=mode==='random'?'queued':'ready',at=new Date(now).toISOString();
 if(mode==='random'){
  const counts=(await c.query(`SELECT p.role,count(*)::int AS n FROM fanta.players p WHERE coalesce((p.data->>'active')::boolean,true) AND EXISTS(SELECT 1 FROM fanta.fixtures f WHERE f.season=$1 AND p.club_id IN(f.home_id,f.away_id)) GROUP BY p.role`,[season])).rows;
  for(const [role,slots]of Object.entries(DEFAULT_RULES.roster))if((counts.find(x=>x.role===role)?.n||0)<size*slots)fail('Listone insufficiente nel ruolo '+role+' per '+size+' squadre');
 }
 await c.query(`INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,max_members,kind,auto_lineups_from,accent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,bar.name,season,user.id,'L-'+requestId,JSON.stringify({...DEFAULT_RULES,rosterMode:mode,creationPending:mode==='random',...(bar.branding?{leagueIdentity:nativeLeagueBranding(bar)}:{})}),size,mode==='random'?'random':'standard',mode==='random'?at:null,leagueAccent(bar,'fanta')]);
 const initialMembers=[user.id,...bar.members.map(m=>m.uid).filter(uid=>uid!==user.id)].slice(0,size);
 const generatedNames=mode==='random'?await availableTeamNames(c,size,requestId):null;
 const teams=Array.from({length:size},(_,i)=>{const uid=initialMembers[i]||null,coach=uid?s.users.find(u=>u.id===uid):null;return {id:id+':'+i,league_id:id,name:generatedNames?generatedNames[i]:uid?shortenTeamName('Squadra '+(coach?.name||coach?.username||user.name||user.username),TEAM_NAME_MAX):'Squadra '+(i+1),manager:uid?(coach?.name||coach?.username||user.name||user.username):'Allenatore da assegnare',user_id:uid,color:['#b64b5a','#d4aa45','#608ca8','#78a67b','#9a72b2','#df8952'][i%6]};});
 await c.query(`INSERT INTO fanta.teams(id,league_id,name,manager,user_id,color) SELECT id,league_id,name,manager,user_id,color FROM jsonb_to_recordset($1::jsonb) x(id text,league_id text,name text,manager text,user_id text,color text)`,[JSON.stringify(teams)]);
 await c.query(`INSERT INTO fanta.competitions(id,league_id,name,kind,status) VALUES($1,$2,'Campionato','league','draft')`,[id+':main',id]);
 await c.query(`INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key,active) VALUES($1,$2,$2||':main',$3,true) ON CONFLICT(bar_league_id) DO UPDATE SET fanta_league_id=EXCLUDED.fanta_league_id,competition_id=EXCLUDED.competition_id,competition_key=EXCLUDED.competition_key,active=true WHERE NOT fanta.bar_links.active`,[bar.id,id,'native:'+id]);
 await c.query(`INSERT INTO fanta.creation_jobs(id,bar_id,owner_uid,size,name,status,league_id,roster_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[requestId,bar.id,user.id,size,bar.name,status,id,mode]);
 if(s.leagues.length>count)welcomeLeagueChat(s,bar,now);
 bar.nativeFantaLink={leagueId:id,competitionId:id+':main',coachIds:initialMembers};bar.fantaSlipsEnabled=true;bar.fantaCreation={jobId:requestId,status,rosterMode:mode,size};
 return {ok:true,league:bar.id,fantaLeague:id,reused:s.leagues.length===count,creationStatus:status,...(status==='queued'?{jobId:requestId}:{}),message:mode==='random'?'Bar e Fanta creati. Le rose equilibrate saranno disponibili tra qualche minuto.':'Bar e Fanta creati. Squadre vuote pronte per l’asta a chiamata.'};
}
export async function joinLinkedTeam(c,bar,user){
 const link=(await c.query(`SELECT l.id,l.max_members,b.competition_id FROM fanta.bar_links b JOIN fanta.leagues l ON l.id=b.fanta_league_id WHERE b.bar_league_id=$1 AND b.active AND l.source_key IS NULL AND l.rules->>'disabledAt' IS NULL FOR UPDATE OF l`,[bar.id])).rows[0];
 if(!link)return;
 const id=link.id;
 const teams=(await c.query('SELECT id,user_id FROM fanta.teams WHERE league_id=$1 ORDER BY id FOR UPDATE',[id])).rows;
 const barMembers=new Set(bar.members.map(m=>m.uid)),coaches=teams.map(t=>t.user_id).filter(Boolean);
 const occupied=new Set([...barMembers,...coaches]);
 let team=teams.find(t=>t.user_id===user.id);
 if(!barMembers.has(user.id)&&(barMembers.size>=link.max_members||!team&&occupied.size>=link.max_members))fail('La lega è al completo',409);
 if(!team){
  team=teams.find(t=>!t.user_id);
  if(!team)fail('La lega è al completo',409);
  await c.query('UPDATE fanta.teams SET user_id=$2,manager=$3,joined_at=now() WHERE id=$1',[team.id,user.id,user.name||user.username]);
 }
 const previous=bar.nativeFantaLink;
 bar.nativeFantaLink={...previous,leagueId:id,competitionId:link.competition_id,maxMembers:link.max_members,coachIds:[...new Set([...coaches,user.id])]};
 return team.id;
}
