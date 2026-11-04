import {withFinalVerification} from './final-verification.mjs';
import {lineupRound} from './round-selection.mjs';
import {databaseReadCache} from '../lib/read-cache.mjs';
import {probabilityFor,readPlayProbabilities,readPresenceMinutes} from './play-probabilities.mjs';
import {queueRandom,randomStatus,claimRandom,setSlips,ensurePilotBars} from './random-leagues.mjs';
import {dispatchFanta} from './jobs.mjs';
import {pilotTeams,claimPilot} from './pilot.mjs';
import {rosterAction} from './roster-market.mjs';
import {saveCompetitionSummary} from './summaries.mjs';
import {sqlFantaStore} from './store.mjs';
import {fail,validateLineup} from './rules.mjs';
import {currentRound,homeView,teamView,roundView,matchupView,leagueView} from './views.mjs';
import {auctionAction,auctionView,auctionTickDue} from './auction.mjs';
import {saveTeamLogo} from './team-logo.mjs';
import {competitionAction} from './competitions.mjs';
export const betaUser=(u,env=process.env)=>!!u&&u.verified&&!u.demo&&!u.admin_only&&String(env.FANTA_BETA_USERS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(u.username?.toLowerCase());
const betaLeagues=env=>String(env.FANTA_BETA_LEAGUES||'fanta-lucas-a').split(',').map(x=>x.trim());
export function createFantaApi({store=sqlFantaStore(),env=process.env,now=Date.now,presenceCache=databaseReadCache()}={}){
 return async request=>{
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  try{
   const url=new URL(request.url),route=url.pathname.replace(/^\/(?:\.netlify\/functions\/)?fanta-api\/?/,'');
   if(!['GET','POST'].includes(request.method))fail('Metodo non supportato',405);
   if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)fail('Origine non consentita',403);
   const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);
   if(route==='lineup'&&request.method==='POST'&&store.saveLineupForSession){const body=await request.text();if(body.length>16384)fail('Richiesta troppo grande',413);let input;try{input=JSON.parse(body);}catch{fail('Richiesta non valida');}if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.league!=='string'||!Number.isInteger(input.round))fail('Formazione non valida');return reply(await store.saveLineupForSession(token,input.league,input,{competition:input.competition,now}));}
   const u=token?await store.identity(token):null,eligible=!!u&&u.verified&&!u.demo&&!u.admin_only,owned=eligible?await store.leagues(u.id):[],access=eligible?'full':'demo',allowed=owned.filter(l=>l.sourceKey?u.username?.toLowerCase()==='frankwood':true),pilotTeam=owned.find(l=>l.kind==='pilot')?.teamId||null;
   const me=async()=>({user:{username:u?.username||'ospite',name:u?.name||'Ospite'},access,pilotTeam,settings:eligible?await store.settings(u.id):{notify:{lineupReminder:true,roundStart:true,liveEvents:true,results:true,auction:true}}});
   if(route==='me'&&request.method==='GET')return reply(await me());
   if(!eligible)fail('Accedi e conferma la tua email per entrare nel Fanta.',403);
   if(route==='pilot/teams')fail('Entra nel Bar della tua lega per scegliere una squadra',410);
   if(route==='bootstrap'&&request.method==='GET'){
    const leagues=allowed,selected=leagues.find(l=>l.id===url.searchParams.get('league'))||leagues[0];
    const initial=selected?await store.league(u.id,selected.id,s=>{const r=currentRound(s,now());if(url.searchParams.get('lite')==='1')return {home:homeView(s,u.id,now())};const mine=s.teams.find(t=>t.userId===u.id)?.id,m=r&&s.matchups.find(m=>m.round===r.number&&(m.home_id===mine||m.away_id===mine));return {home:homeView(s,u.id,now()),team:teamView(s,u.id,now()),league:leagueView(s,u.id,now()),round:r?roundView(s,r,u.id,now()):null,matchup:m?matchupView(s,r,m.id,u.id,now()):null};},{competition:url.searchParams.get('competition')}):{};
    if(initial.home)initial.home=await withFinalVerification(initial.home,{now:now()});return reply({me:await me(),leagues,...initial});
   }
   let p={};if(request.method==='POST'){const body=await request.text();if(body.length>(route==='team/logo'?350000:16384))fail('Richiesta troppo grande',413);try{p=JSON.parse(body);}catch{fail('Richiesta non valida');}}
   if(route==='pilot/claim')fail('Le iscrizioni pubbliche alla lega pilota sono chiuse',410);
   if(route==='settings'&&request.method==='POST'){const keys=['lineupReminder','roundStart','liveEvents','results','auction'];if(!p.notify||keys.some(k=>typeof p.notify[k]!=='boolean')||Object.keys(p.notify).some(k=>!keys.includes(k)))fail('Impostazioni non valide');return reply(await store.settings(u.id,{notify:Object.fromEntries(keys.map(k=>[k,p.notify[k]]))}));}
   if(route==='random/status'&&request.method==='GET')return reply(await randomStatus(u,{connect:store.connect}));
   if(route==='random/create'&&request.method==='POST'){const job=await queueRandom(u,p,{connect:store.connect});try{await dispatchFanta('random:'+job.id,env);}catch{return reply({...job,dispatchPending:true},202);}return reply(job,202);}
   if(route==='random/retry'&&request.method==='POST'){const jobs=await randomStatus(u,{connect:store.connect}),job=jobs.find(j=>j.id===p.job);if(!job||!['queued','failed'].includes(job.status))fail('Lavoro non disponibile',409);await dispatchFanta('random:'+job.id,env);return reply({ok:true},202);}
   if(route==='random/claim'&&request.method==='POST')return reply(await claimRandom(u,p.league,{connect:store.connect}));
   if(route==='league/slips'&&request.method==='POST'){if(!allowed.some(l=>l.id===p.league))fail('Lega non accessibile',403);return reply(await setSlips(u,p.league,p.enabled,{connect:store.connect}));}
   if(route==='leagues'&&request.method==='GET')return reply(allowed);
   const id=request.method==='GET'?url.searchParams.get('league'):p.league;if(!allowed.some(l=>l.id===id))fail('Lega non accessibile',403);
   if(route==='team/logo/image'&&request.method==='GET'){
    const image=await store.logo(u.id,id,url.searchParams.get('team'));if(!image)fail('Logo non trovato',404);const etag='"'+image.digest+'"';return new Response(request.headers.get('if-none-match')===etag?null:image.data,{status:request.headers.get('if-none-match')===etag?304:200,headers:{'Content-Type':image.mime,'Cache-Control':'private, max-age=86400','ETag':etag,'X-Content-Type-Options':'nosniff'}});
   }
   const isAuction=route==='auction'||route.startsWith('auction/'),kind=route==='auction'?'read':route.slice('auction/'.length);
   const isWrite=request.method==='POST';
   if(route==='lineup'&&isWrite&&store.saveLineup)return reply(await store.saveLineup(u.id,id,p,{competition:p.competition,now}));
   // Most ticks only read. A running timer is not a reason to reload the full
   // catalog under a write lock every second for every spectator.
   if(route==='auction/tick'&&isWrite){const view=await store.league(u.id,id,s=>auctionTickDue(s.auction,now())?null:auctionView(s,u.id,now()),{competition:p.competition});if(view)return reply(view);}
   const result=await store.league(u.id,id,async(s,c)=>{
    if(s.league.kind==='pilot'&&(route.startsWith('competition/')||route==='league/configure'||route==='team/link'))fail('Nella lega pilota non sono disponibili modifiche della competizione',403);
    if(s.league.kind==='random'&&isWrite&&(route.startsWith('roster/')||route==='league/configure'||route==='team/link'))fail('La Lega random cambia le rose soltanto tramite aste di riparazione',403);
    if(route==='roster/players'&&!isWrite){if(s.league.adminUid!==u.id)fail('Serve il presidente',403);return s.players.filter(p=>p.active!==false&&!s.teams.some(t=>t.roster.some(x=>x.id===p.id)));}
    if(route==='roster/audit'&&!isWrite){if(s.league.adminUid!==u.id)fail('Serve il presidente',403);return (await c.query(`SELECT a.actor,a.kind,a.data,a.created_at,coalesce((SELECT u->>'username' FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE u->>'id'=a.actor),'Utente rimosso') AS username FROM fanta.roster_changes a WHERE a.league_id=$1 ORDER BY a.id DESC LIMIT 100`,[id])).rows;}
    if(route.startsWith('roster/')&&isWrite){const after=rosterAction(s,route.slice(7),p,u.id);await store.persistRoster(c,s,after,{actor:u.id,kind:route.slice(7),input:p,now:now()});return teamView(after,u.id,now(),p.toTeamId||p.teamId);}
    if(route==='league/configure'&&isWrite)return competitionAction(s,c,p,u.id,'configure',now());
    if(route==='competition/create'&&isWrite){const created=await competitionAction(s,c,p,u.id,'create',now());await saveCompetitionSummary(s,c,{competition:created.id,empty:true});return created;}
    if(route==='competition/start'&&isWrite){const started=await competitionAction(s,c,p,u.id,'start',now());await saveCompetitionSummary(s,c);return started;}
    if(route==='team/logo'&&isWrite){const mine=s.teams.find(t=>t.userId===u.id);if(!mine||p.team&&p.team!==mine.id)fail('Puoi modificare solo il logo della tua squadra',403);return {team:mine.id,branding:await saveTeamLogo(c,mine,p,id)};}
    if(route==='team/link'&&isWrite){
     if(s.league.adminUid!==u.id)fail('Solo il presidente può associare le squadre',403);
     const team=s.teams.find(t=>t.id===p.team),username=typeof p.username==='string'?p.username.trim().toLowerCase():'';
     if(!team||!username||username.length>60)fail('Scegli la squadra e inserisci lo username');
     const found=(await c.query(`SELECT u->>'id' AS id,u->>'username' AS username,(u->>'emailVerified')::boolean AS verified,(u->>'demo')::boolean AS demo,(u->>'adminOnly')::boolean AS admin_only FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE lower(u->>'username')=$1`,[username])).rows;
     if(found.length!==1||!found[0].verified||found[0].demo||found[0].admin_only)fail('Account non trovato o email non ancora confermata',400);
     const target=found[0];if(team.userId&&team.userId!==target.id)fail('Questa squadra ha già un account collegato',409);
     if(s.teams.some(t=>t.id!==team.id&&t.userId===target.id))fail('Questo account è già associato a un’altra squadra della lega',409);
     await c.query('UPDATE fanta.teams SET user_id=$2 WHERE id=$1',[team.id,target.id]);return {team:team.id,username:target.username};
    }
    if(isAuction){if(isWrite&&s.rules.creationPending&&kind!=='tick')fail('Le rose sono in preparazione. Attendi qualche minuto prima di aprire l’asta.',409);if(s.league.kind==='random'&&['schedule','start-now'].includes(kind)&&p.type&&p.type!=='riparazione')fail('Nella Lega random sono disponibili solo aste di riparazione',403);if((kind==='read'||kind==='players'||kind==='assigned')!==!isWrite)fail('Metodo non supportato',405);
     if(kind==='assigned'){if(s.league.adminUid!==u.id)fail('Solo il presidente può gestire gli svincoli',403);const q=(url.searchParams.get('q')||'').toLocaleLowerCase('it');return s.teams.flatMap(t=>t.roster.map(p=>({...p,team:{id:t.id,name:t.name}}))).filter(p=>[p.name,p.club,p.team.name].join(' ').toLocaleLowerCase('it').includes(q));}
     if(kind==='players')return s.players.filter(p=>p.active!==false&&!s.teams.some(t=>t.roster.some(x=>x.id===p.id))).sort((a,b)=>(b.value||1)-(a.value||1));
     if(!isWrite)return auctionView(s,u.id,now());
     const next=auctionAction(s,kind==='tick'?'read':kind,p,u.id,{admin:s.league.adminUid===u.id,now:now()});
     if(next.auction.version!==s.auction.version)await store.persistAuction(c,s,next,u.id,kind,p);
     return auctionView(next,u.id,now());
    }
    if(route==='lineup'&&isWrite){const r=s.rounds.find(r=>r.number===p.round);if(!r)fail('Giornata non trovata',404);if(Date.parse(r.deadline)<=now())fail('Il termine per schierare la formazione è scaduto',409);const t=s.teams.find(t=>t.userId===u.id),lineup=validateLineup(p,t.roster,s.rules),savedAt=new Date(now()).toISOString();
     await c.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,saved_at,competition_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition_id,round,team_id) DO UPDATE SET formation=EXCLUDED.formation,starters=EXCLUDED.starters,bench=EXCLUDED.bench,saved_at=EXCLUDED.saved_at,inherited_from=NULL,source_data=jsonb_build_object()',[id,p.round,t.id,lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench),savedAt,s.competition.id]);return {...lineup,savedAt};
    }
    if(isWrite)fail('Operazione non trovata',404);
    if(route==='home')return homeView(s,u.id,now());if(route==='team'){const r=lineupRound(s,now());s.probables=await readPlayProbabilities(c,r?.seriea_round,s.league.season);const target=s.teams.find(t=>url.searchParams.has('team')?t.id===url.searchParams.get('team'):t.userId===u.id);s.presenceMinutes=await readPresenceMinutes(c,(target?.roster||[]).filter(p=>probabilityFor(p,s.probables,r?.seriea_round)?.source!=='official'&&!['injured','suspended'].includes(p.status?.type)),s.league.season,{cache:presenceCache,now:now()});return teamView(s,u.id,now(),url.searchParams.get('team'));}if(route==='league')return leagueView(s,u.id,now());
    const n=Number(url.searchParams.get('number')),r=s.rounds.find(r=>r.number===n)||(!url.searchParams.has('number')?currentRound(s):null);if(!r)fail('Giornata non trovata',404);
    if(route==='round')return roundView(s,r,u.id,now());if(route==='matchup'){const m=matchupView(s,r,url.searchParams.get('id'),u.id,now());if(!m)fail('Sfida non trovata',404);return m;}fail('Pagina non trovata',404);
   },{write:isWrite,auction:isAuction&&isWrite,number:url.searchParams.get('number'),competition:request.method==='GET'?url.searchParams.get('competition'):p.competition});return reply(route==='home'?await withFinalVerification(result,{now:now()}):result);
  }catch(e){return reply({error:e.status?e.message:'Il Fanta non è temporaneamente disponibile. Riprova tra poco.'},e.status||503);}
 };
}
