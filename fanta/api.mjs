import {withFinalVerification} from './final-verification.mjs';
import {DELIVERY_SQL,queueAuctionNotice} from './notifications.mjs';
import {lineupWindow,teamLineupRound} from './round-selection.mjs';
import {databaseReadCache} from '../lib/read-cache.mjs';
import {lineupAvailability,probabilityFor,readPlayProbabilities,readPresenceMinutes} from './play-probabilities.mjs';
import {queueRandom,randomStatus,claimRandom,setSlips,ensurePilotBars} from './random-leagues.mjs';
import {dispatchFanta} from './jobs.mjs';
import {pilotTeams,claimPilot} from './pilot.mjs';
import {rosterAction} from './roster-market.mjs';
import {rosterBatch,rosterOrderId} from './roster-editor.mjs';
import {tradeAction,tradeView,tradeWindow} from './trades.mjs';
import {saveCompetitionSummary} from './summaries.mjs';
import {sqlFantaStore} from './store.mjs';
import {fail,validateLineup} from './rules.mjs';
import {currentRound,homeView,teamView,roundView,matchupView,leagueView,liveStudioView} from './views.mjs';
import {auctionAction,auctionView,auctionTickDue} from './auction.mjs';
import {LAMPO} from '../public/src/auction-formats.mjs';
import {saveTeamIdentity} from './team-logo.mjs';
import {competitionAction} from './competitions.mjs';
import {teamChoices} from './team-choices.mjs';
import {entryStatus,claimEntry} from './acquisition.mjs';
import {nativeLeagueBranding,updateLeagueProfile} from '../lib/league-profile.mjs';
import {sendAdminSubmissionReminder,submissionReminderMessage,validateSubmissionChannel} from '../lib/submission-reminders.mjs';
export const betaUser=(u,env=process.env)=>!!u&&u.verified&&!u.demo&&!u.admin_only&&String(env.FANTA_BETA_USERS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(u.username?.toLowerCase());
const betaLeagues=env=>String(env.FANTA_BETA_LEAGUES||'fanta-lucas-a').split(',').map(x=>x.trim());
export function createFantaApi({store=sqlFantaStore(),env=process.env,now=Date.now,presenceCache=databaseReadCache(),sendSubmissionReminder=sendAdminSubmissionReminder}={}){
 return async (request,context={})=>{
  const receivedAt=now();
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  try{
   const url=new URL(request.url),route=url.pathname.replace(/^\/(?:\.netlify\/functions\/)?fanta-api\/?/,'');
   if(!['GET','POST'].includes(request.method))fail('Metodo non supportato',405);
   if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)fail('Origine non consentita',403);
   const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);
   if(route==='auction/status'&&request.method==='GET'&&store.auctionStatusForSession)return reply(await store.auctionStatusForSession(token,url.searchParams.get('league')));
   if(route==='lineup'&&request.method==='POST'&&store.saveLineupForSession){const body=await request.text();if(body.length>16384)fail('Richiesta troppo grande',413);let input;try{input=JSON.parse(body);}catch{fail('Richiesta non valida');}if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.league!=='string'||!Number.isInteger(input.round))fail('Formazione non valida');return reply(await store.saveLineupForSession(token,input.league,input,{competition:input.competition,now}));}
   const u=token?await store.identity(token):null,eligible=!!u&&u.verified&&!u.demo&&!u.admin_only,owned=eligible?await store.leagues(u.id):[],access=eligible?'full':'demo',allowed=owned.filter(l=>l.sourceKey?u.username?.toLowerCase()==='frankwood':true),pilotTeam=owned.find(l=>l.kind==='pilot')?.teamId||null;
   const me=async()=>({user:{...(u?.username?{username:u.username}:{}),name:u?.name||'Ospite'},access,pilotTeam,settings:eligible?await store.settings(u.id):{notify:{lineupReminder:true,roundStart:true,liveEvents:true,results:true,auction:true}}});
   if(route==='me'&&request.method==='GET')return reply(await me());
   if(route==='entry/status'&&request.method==='GET'){if(env.FANTA_ACQUISITION_ENABLED!=='true')return reply({enabled:false,signedIn:eligible});return reply({enabled:true,...(eligible?await entryStatus(u,{connect:store.connect}):{signedIn:false})});}
   if(!eligible)fail('Accedi e conferma la tua email per entrare nel Fanta.',403);
   if(route==='pilot/teams')fail('Entra nel Bar della tua lega per scegliere una squadra',410);
   if(route==='bootstrap'&&request.method==='GET'){
    const leagues=allowed,requested=url.searchParams.get('league'),needsChoice=!leagues.length||requested&&!leagues.some(l=>l.id===requested),choices=needsChoice&&store.connect?await teamChoices(u.id,{connect:store.connect}):[],choice=choices.find(l=>l.id===requested)||(!leagues.length?choices[0]:null),selected=choice?null:leagues.find(l=>l.id===requested)||leagues[0];
    const initial=selected?await store.league(u.id,selected.id,s=>{const r=currentRound(s,now());if(url.searchParams.get('lite')==='1')return {home:homeView(s,u.id,now())};const mine=s.teams.find(t=>t.userId===u.id)?.id,m=r&&s.matchups.find(m=>m.round===r.number&&(m.home_id===mine||m.away_id===mine));return {home:homeView(s,u.id,now()),team:teamView(s,u.id,now()),league:leagueView(s,u.id,now()),round:r?roundView(s,r,u.id,now()):null,matchup:m?matchupView(s,r,m.id,u.id,now()):null};},{competition:url.searchParams.get('competition'),catalog:false,detailedVotes:url.searchParams.get('lite')!=='1',submissionWindows:true}):{};
    if(initial.home)initial.home=await withFinalVerification(initial.home,{now:now()});return reply({me:await me(),leagues,teamChoices:choices,choiceLeagueId:choice?.id||null,...initial});
   }
   let p={};if(request.method==='POST'){const body=await request.text();if(body.length>(route==='team/logo'?350000:['roster/batch','roster/check'].includes(route)?262144:16384))fail('Richiesta troppo grande',413);try{p=JSON.parse(body);if(!p||typeof p!=='object'||Array.isArray(p))throw Error();}catch{fail('Richiesta non valida');}}
   if(route==='entry/claim'&&request.method==='POST'){if(env.FANTA_ACQUISITION_ENABLED!=='true')fail('Le iscrizioni alla prova sono in pausa.',403);return reply(await claimEntry(u,{connect:store.connect}));}
   if(route==='pilot/claim')fail('Le iscrizioni pubbliche alla lega pilota sono chiuse',410);
   if(route==='settings'&&request.method==='POST'){const keys=['lineupReminder','roundStart','liveEvents','results','auction'];if(!p.notify||keys.some(k=>typeof p.notify[k]!=='boolean')||Object.keys(p.notify).some(k=>!keys.includes(k)))fail('Impostazioni non valide');return reply(await store.settings(u.id,{notify:Object.fromEntries(keys.map(k=>[k,p.notify[k]]))}));}
   if(route==='random/status'&&request.method==='GET')return reply(await randomStatus(u,{connect:store.connect}));
   if(route==='team/choices'&&request.method==='GET')return reply(await teamChoices(u.id,{connect:store.connect}));
   if(route==='team/claim'&&request.method==='POST')return reply(await claimRandom(u,p.league,{connect:store.connect,teamId:p.team??null}));
   if(route==='random/create'&&request.method==='POST'){const job=await queueRandom(u,p,{connect:store.connect});try{await dispatchFanta('random:'+job.id,env);}catch{return reply({...job,dispatchPending:true},202);}return reply(job,202);}
   if(route==='random/retry'&&request.method==='POST'){const jobs=await randomStatus(u,{connect:store.connect}),job=jobs.find(j=>j.id===p.job);if(!job||!['queued','failed'].includes(job.status))fail('Lavoro non disponibile',409);await dispatchFanta('random:'+job.id,env);return reply({ok:true},202);}
   if(route==='random/claim'&&request.method==='POST')return reply(await claimRandom(u,p.league,{connect:store.connect}));
   if(route==='league/slips'&&request.method==='POST'){if(!allowed.some(l=>l.id===p.league))fail('Lega non accessibile',403);return reply(await setSlips(u,p.league,p.enabled,{connect:store.connect}));}
   if(route==='leagues'&&request.method==='GET')return reply(allowed);
   const id=request.method==='GET'?url.searchParams.get('league'):p.league;if(!allowed.some(l=>l.id===id))fail('Lega non accessibile',403);
   if(route==='roster/editor'&&request.method==='GET')return reply(await store.rosterEditor(u.id,id));
   if(route==='roster/players'&&request.method==='GET')return reply(await store.rosterPlayers(u.id,id));
   if(route==='roster/check'&&request.method==='POST')return reply(await store.checkRosterBatch(u.id,id,rosterBatch(p)));
   if(route==='roster/batch'&&request.method==='POST')return reply(await store.saveRosterBatch(u.id,id,rosterBatch(p),now()));
   if(route==='roster/orders'&&request.method==='GET'){
    const before=url.searchParams.get('before');if(before!==null&&!rosterOrderId(before))fail('Pagina dello storico non valida');
    return reply(await store.rosterOrders(u.id,id,before));
   }
   if(route==='roster/orders/undo'&&request.method==='POST'){
    if(!rosterOrderId(p.order))fail('Ordine di correzione non valido');
    return reply(await store.undoRosterOrder(u.id,id,p.order,now()));
   }
   if(route==='league/reminder'&&request.method==='POST'){
    validateSubmissionChannel(p.channel);
    if(allowed.find(l=>l.id===id).role!=='admin')fail('Serve il presidente di lega',403);
    if(!Number.isInteger(p.round)||typeof p.competition!=='string'||typeof p.uid!=='string'||!p.uid)fail('Scegli lega, giornata e allenatore');
    const client=await store.connect();
    let target,matchday;
    try{
     const {rows:[row]}=await client.query(`SELECT r.deadline,l.name,EXISTS(SELECT 1 FROM fanta.lineups x
      WHERE x.competition_id=r.competition_id AND x.round=r.number AND x.team_id=t.id) AS saved
      FROM fanta.rounds r JOIN fanta.leagues l ON l.id=r.league_id
      JOIN fanta.competitions c ON c.id=r.competition_id AND c.status='active'
      JOIN fanta.teams t ON t.league_id=l.id AND t.user_id=$5
      WHERE l.id=$1 AND l.admin_uid=$2 AND r.competition_id=$3 AND r.number=$4 AND NOT r.official
       AND l.rules->>'disabledAt' IS NULL AND EXISTS(SELECT 1 FROM fanta.matchups m
       WHERE m.competition_id=r.competition_id AND m.round=r.number AND t.id IN(m.home_id,m.away_id))`,[id,u.id,p.competition,p.round,p.uid]);
     matchday=row;
     if(!matchday||!(Date.parse(matchday.deadline)>now()))fail('Formazione non più sollecitabile',409);
     if(matchday.saved)fail('La formazione è già stata consegnata',409);
     const {rows:[recipient]}=await client.query(DELIVERY_SQL,[p.uid]);
     target={...recipient,deadline:Date.parse(matchday.deadline)};
    }finally{client.release();}
    return reply(await sendSubmissionReminder(p.channel,submissionReminderMessage('fanta',{id,name:matchday.name},p),target,{env,now:now()}));
   }
   if(route==='league/identity'&&request.method==='POST'){
    const league=allowed.find(l=>l.id===id);
    if(league.role!=='admin')fail('Serve il presidente di lega',403);
    if(!store.saveLeagueIdentity||league.linked)fail('Modifica l’identità dal pannello della lega collegata',409);
    const profile={name:league.name,branding:{...league.branding,accent:league.accent}};
    updateLeagueProfile(profile,p.branding||{});
    const identity={name:profile.name,accent:profile.branding.accent,branding:nativeLeagueBranding(profile)};
    const recipients=await store.saveLeagueIdentity(u.id,id,identity);
    context.leagueUpdate?.({league:id,change:'fanta-identity',recipients});
    return reply(identity);
   }
   if(route==='team/logo/image'&&request.method==='GET'){
    const image=await store.logo(u.id,id,url.searchParams.get('team'));if(!image)fail('Logo non trovato',404);const etag='"'+image.digest+'"';return new Response(request.headers.get('if-none-match')===etag?null:image.data,{status:request.headers.get('if-none-match')===etag?304:200,headers:{'Content-Type':image.mime,'Cache-Control':'private, max-age=86400','ETag':etag,'X-Content-Type-Options':'nosniff'}});
   }
   const isAuction=route==='auction'||route.startsWith('auction/'),kind=route==='auction'?'read':route.slice('auction/'.length);
   const isWrite=request.method==='POST';
   if(route==='trades/status'&&!isWrite)return reply(await store.tradeStatus(id,u.id,now()));
   const isTrade=route==='trades'||route.startsWith('trades/');
   if(route==='lineup'&&isWrite&&store.saveLineup)return reply(await store.saveLineup(u.id,id,p,{competition:p.competition,now}));
   // Most ticks only read. A running timer is not a reason to reload the full
   // catalog under a write lock every second for every spectator.
   if(route==='auction/tick'&&isWrite){const view=await store.league(u.id,id,s=>auctionTickDue(s.auction,now())?null:auctionView(s,u.id,now()),{competition:p.competition});if(view)return reply(view);}
   let auctionNotice=null,leagueUpdate=null;
   const result=await store.league(u.id,id,async(s,c)=>{
    if(isTrade){
     if(route==='trades'&&!isWrite)return tradeView(c,s,u.id,now());
     if(isWrite)return tradeAction(c,s,u.id,route.slice('trades/'.length),p,{persistRoster:store.persistRoster,now:now()});
     fail('Operazione non disponibile',404);
    }
    if(s.league.kind==='pilot'&&(route.startsWith('competition/')||route==='league/configure'||route==='team/link'))fail('Nella lega pilota non sono disponibili modifiche della competizione',403);
    if(s.league.kind==='random'&&isWrite&&(route.startsWith('roster/')||route==='league/configure'||route==='team/link'))fail('La Lega random cambia le rose soltanto tramite aste di riparazione',403);
    if(route==='league/member-remove'&&isWrite){
     if(s.league.adminUid!==u.id)fail('Serve il presidente di lega',403);
     if(typeof p.uid!=='string'||p.uid===u.id)fail('Partecipante non rimovibile');
     if((await c.query('SELECT 1 FROM fanta.bar_links WHERE fanta_league_id=$1 AND active',[id])).rows.length)fail('Usa i partecipanti della lega collegata al Bar',409);
     const detached=await c.query("UPDATE fanta.teams SET user_id=NULL,manager=coalesce(nullif(coach_name,''),'Allenatore automatico') WHERE league_id=$1 AND user_id=$2 RETURNING id",[id,p.uid]);
     if(!detached.rows.length)fail('Partecipante non trovato',404);
     await c.query('DELETE FROM fanta.pilot_claims WHERE league_id=$1 AND user_id=$2',[id,p.uid]);
     leagueUpdate={league:id,change:'fanta-members',recipients:s.teams.map(t=>t.userId).filter(Boolean)};
     return {ok:true};
    }
    if(route==='roster/audit'&&!isWrite){if(s.league.adminUid!==u.id)fail('Serve il presidente',403);return (await c.query(`SELECT a.actor,a.kind,a.data,a.created_at,coalesce((SELECT u->>'username' FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE u->>'id'=a.actor),'Utente rimosso') AS username FROM fanta.roster_changes a WHERE a.league_id=$1 ORDER BY a.id DESC LIMIT 100`,[id])).rows;}
    if(route.startsWith('roster/')&&isWrite){const after=rosterAction(s,route.slice(7),p,u.id);await store.persistRoster(c,s,after,{actor:u.id,kind:route.slice(7),input:p,now:now()});return teamView(after,u.id,now(),p.toTeamId||p.teamId);}
    if(route==='league/configure'&&isWrite)return competitionAction(s,c,p,u.id,'configure',now());
    if(route==='competition/create'&&isWrite){const created=await competitionAction(s,c,p,u.id,'create',now());await saveCompetitionSummary(s,c,{competition:created.id,empty:true});return created;}
    if(route==='competition/start'&&isWrite){const started=await competitionAction(s,c,p,u.id,'start',now());await saveCompetitionSummary(s,c);return started;}
    if(route==='team/logo'&&isWrite){const mine=s.teams.find(t=>t.userId===u.id);if(!mine||p.team&&p.team!==mine.id)fail('Puoi modificare solo la tua squadra',403);return saveTeamIdentity(c,s,mine,p,u.id,now);}
    if(route==='team/link'&&isWrite){
     if(s.league.adminUid!==u.id)fail('Solo il presidente può associare le squadre',403);
     const team=s.teams.find(t=>t.id===p.team),username=typeof (p.identity||p.username)==='string'?(p.identity||p.username).trim().toLowerCase():'';
     if(!team||!username||username.length>254)fail('Scegli la squadra e inserisci l’email o lo username del vecchio account');
     const found=(await c.query(`SELECT u->>'id' AS id,u->>'username' AS username,(u->>'emailVerified')::boolean AS verified,(u->>'demo')::boolean AS demo,(u->>'adminOnly')::boolean AS admin_only FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE lower(u->>'username')=$1 OR lower(u->>'email')=$1`,[username])).rows;
     if(found.length!==1||!found[0].verified||found[0].demo||found[0].admin_only)fail('Account non trovato o email non ancora confermata',400);
     const target=found[0];if((await c.query(`SELECT 1 FROM fanta.bar_links b JOIN fanta_state s ON s.id=1 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'leagues') bar CROSS JOIN LATERAL jsonb_array_elements(coalesce(bar->'removedMembers','[]')) m WHERE b.active AND b.fanta_league_id=$1 AND bar->>'id'=b.bar_league_id AND m->>'uid'=$2`,[id,target.id])).rows.length)fail('Riattiva prima questo partecipante nel Bar della lega',403);if(team.userId&&team.userId!==target.id)fail('Questa squadra ha già un account collegato',409);
     if(s.teams.some(t=>t.id!==team.id&&t.userId===target.id))fail('Questo account è già associato a un’altra squadra della lega',409);
     await c.query('UPDATE fanta.teams SET user_id=$2 WHERE id=$1',[team.id,target.id]);return {team:team.id,username:target.username};
    }
    if(isAuction){if(isWrite&&s.rules.creationPending&&kind!=='tick')fail('Le rose sono in preparazione. Attendi qualche minuto prima di aprire l’asta.',409);if(s.league.kind==='random'&&!p.config&&['schedule','start-now'].includes(kind)&&p.type&&p.type!=='riparazione')fail('Nella Lega random sono disponibili solo aste di riparazione',403);if((kind==='read'||kind==='players'||kind==='assigned')!==!isWrite)fail('Metodo non supportato',405);
     if(kind==='assigned'){if(s.league.adminUid!==u.id)fail('Solo il presidente può gestire gli svincoli',403);const q=(url.searchParams.get('q')||'').toLocaleLowerCase('it');return s.teams.flatMap(t=>t.roster.map(p=>({...p,team:{id:t.id,name:t.name}}))).filter(p=>[p.name,p.club,p.team.name].join(' ').toLocaleLowerCase('it').includes(q));}
     if(kind==='players')return s.players.filter(p=>p.active!==false&&!s.teams.some(t=>t.roster.some(x=>x.id===p.id))).sort((a,b)=>(b.value||1)-(a.value||1));
     if(!isWrite)return auctionView(s,u.id,now());
     if(['open','scheduled'].includes(tradeWindow(s.rules,now()).phase)&&['schedule','start','start-now'].includes(kind))fail('Chiudi gli scambi o annulla la programmazione prima di aprire un’asta.',409);
     const next=auctionAction(s,kind==='tick'?'read':kind,p,u.id,{admin:s.league.adminUid===u.id,now:now(),receivedAt,latencyGrace:LAMPO.httpGrace});
     if(kind==='schedule'&&next.auction.version!==s.auction.version){
      next.auction.scheduleNotificationKey=s.league.id+':schedule:'+next.auction.version+':'+next.auction.startsAt;
      auctionNotice=await queueAuctionNotice(c,next,next.auction,{now:now()});
     }else if(next.auction.status==='running'&&s.auction.status!=='running'){
      next.auction.openNotificationKey=s.league.id+':open:'+next.auction.version+':'+now();
      auctionNotice=await queueAuctionNotice(c,next,next.auction,{now:now()});
     }
     if(next.auction.version!==s.auction.version)await store.persistAuction(c,s,next,u.id,kind,p);
     return auctionView(next,u.id,now());
    }
    if(route==='lineup'&&isWrite){const r=s.rounds.find(r=>r.number===p.round);if(!r)fail('Giornata non trovata',404);const instant=now(),window=lineupWindow(s,r,instant);if(window.started)fail('Il termine per schierare la formazione è scaduto',409);if(!window.open)fail('Le formazioni per questa giornata non sono ancora aperte.',409);const t=s.teams.find(t=>t.userId===u.id),lineup=validateLineup(p,t.roster,s.rules),savedAt=new Date(instant).toISOString();
     await c.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,saved_at,competition_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition_id,round,team_id) DO UPDATE SET formation=EXCLUDED.formation,starters=EXCLUDED.starters,bench=EXCLUDED.bench,saved_at=EXCLUDED.saved_at,inherited_from=NULL,source_data=jsonb_build_object()',[id,p.round,t.id,lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench),savedAt,s.competition.id]);return {...lineup,savedAt};
    }
    if(isWrite)fail('Operazione non trovata',404);
    if(route==='home')return homeView(s,u.id,now());
    if(route==='team'){
     const instant=now(),selection=teamLineupRound(s,instant),serieARound=selection.round?.seriea_round,teamId=url.searchParams.get('team');
     s.probables=await readPlayProbabilities(c,serieARound,s.league.season);
     const target=s.teams.find(t=>teamId?t.id===teamId:t.userId===u.id);
     s.presenceMinutes=await readPresenceMinutes(c,(target?.roster||[]).filter(p=>{
      const {status}=lineupAvailability(p,s.fixtures,serieARound),source=probabilityFor({...p,status},s.probables,serieARound)?.source;
      return source!=='official'&&source!=='unavailable';
     }),s.league.season,{cache:presenceCache,now:instant});
     return teamView(s,u.id,instant,teamId,selection);
    }
    if(route==='league')return leagueView(s,u.id,now());
    const n=Number(url.searchParams.get('number')),r=s.rounds.find(r=>r.number===n)||(!url.searchParams.has('number')?currentRound(s):null);if(!r)fail('Giornata non trovata',404);
    if(route==='round')return roundView(s,r,u.id,now());
    if(route==='studio')return liveStudioView(s,r,u.id,now(),url.searchParams.get('id'));
    if(route==='matchup'){const m=matchupView(s,r,url.searchParams.get('id'),u.id,now());if(!m)fail('Sfida non trovata',404);return m;}
    fail('Pagina non trovata',404);
   },{write:isWrite,market:isTrade,auction:isAuction&&isWrite,catalog:isAuction&&(isWrite||kind==='players'),detailedVotes:route==='matchup'||route==='studio',roundOnly:['round','matchup','studio'].includes(route),submissionWindows:['home','team'].includes(route),teamIdentity:route==='team/logo'&&isWrite&&Object.hasOwn(p,'name'),number:url.searchParams.get('number'),competition:request.method==='GET'?url.searchParams.get('competition'):p.competition});
   if(leagueUpdate)context.leagueUpdate?.(leagueUpdate);
   if(isTrade&&isWrite){
    const {notice,update,...response}=result;
    if(update)context.leagueUpdate?.(update);
    if(notice)try{await dispatchFanta('trade-notify:'+notice,env);}catch{/* The worker also processes queued notices. */}
    return reply(response);
   }
   if(auctionNotice)try{await dispatchFanta('auction-notify:'+auctionNotice,env);}catch{/* Durable notifications remain queued if dispatch needs a retry. */}
   return reply(route==='home'?await withFinalVerification(result,{now:now()}):result);
  }catch(e){return reply({error:e.status?e.message:'Il Fanta non è temporaneamente disponibile. Riprova tra poco.',...(e.issues?{issues:e.issues}:{})},e.status||503);}
 };
}
