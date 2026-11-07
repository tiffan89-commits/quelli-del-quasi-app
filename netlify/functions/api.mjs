import {objectiveReceipt} from '../../lib/day-objectives.mjs';
import {enrichStoredMatch} from '../../lib/lineup-presence.mjs';
import {saveBarSlip} from '../../lib/bar-slip-save.mjs';
import {createLeaguePair,joinLinkedTeam} from '../../fanta/league-creation.mjs';
import {detachBarCoach} from '../../fanta/linked-membership.mjs';
import {dispatchFanta} from '../../fanta/jobs.mjs';
import {inviteInfo} from '../../lib/public-area.mjs';
import {liveSnapshot} from '../../lib/live-snapshot.mjs';
import { normalizeAvatar } from '../../public/src/avatar.mjs';
import {ownedRewardIds,syncRoundRewards} from '../../lib/progression.mjs';
import {sqlPlayerStore,memoryPlayerStore} from '../../lib/player-store.mjs';
import {enrichLineupPortraits,enrichFantasyPortraits} from '../../lib/player-media.mjs';
import {publicLineups} from '../../lib/lineup-consensus.mjs';
import {compactClientState} from '../../lib/client-snapshot.mjs';
import {REWARD_SLOTS,rewardById} from '../../public/src/reward-catalog.mjs';
import {disableEmailReminders} from '../../lib/reminder-email.mjs';
import {
  isPlatformOwner,
  platformData,
  recordApiActivity,
  recordLogin,
  flushExternalActivity,
  recordFastActivity,
} from "../../lib/platform-admin.mjs";
import {provisionSystemAdmin,beginAdminLogin,finishAdminLogin,isSystemAdmin,requireSystemAdmin} from '../../lib/system-admin-auth.mjs';
import {createSocialAuth} from '../../lib/social-auth.mjs';
import {socialProviders} from '../../lib/social-providers.mjs';
import {adminLeagues,forceAllFantasy,planPlatformWipe,executePlatformWipe,runAdminProbe} from '../../lib/system-admin-operations.mjs';
import {
  removeLeagueMember,
  restoreLeagueMember,
  setPrizeWinners,
} from "../../lib/league-management.mjs";
import { submitSupport } from "../../lib/support.mjs";
import { submitFantasyWaitlist } from "../../lib/fanta-interest.mjs";
import { chatAction } from "../../lib/league-chat.mjs";
import {fantasyRanking} from '../../lib/bar-fanta-rankings.mjs';
import { accountTotals,enhanceState, updateLeagueProfile } from "../../lib/community.mjs";
import { analysisFor, analysisRoundSummary, previewRoundProfiles, describeSavedSlip } from "../../lib/player-analysis.mjs";
import { deliverPendingMail } from "../../lib/mail-delivery.mjs";
import {dispatchAccountMail} from '../../lib/account-mail.mjs';
import {
  registerAccount,
  requestAccountMail,
  activateAccount,
  resetAccountPassword,
  setAccountEmail,
} from "../../lib/account.mjs";
import { mailReady } from "../../lib/mail.mjs";
import { loadMatchDetails } from "../../lib/match-data.mjs";
import { randomBytes } from "node:crypto";
import { calendarView, updateCalendarRounds } from "../../lib/calendar.mjs";
import { transaction,readSnapshot,chatTransaction,authTransaction,membershipTransaction,profileTransaction } from "../../lib/db.mjs";
import {
  id,
  hash,
  checkPassword,
  session,
  userFor,
  sha,
  newLeague,
  placeSlip,
  stateFor,
  validateRules,
  fail,
  settle,
  MARKETS,
  DEFAULT_RULES,
  roundClosed,
} from "../../lib/game.mjs";
function reply(data, status = 200, cookie) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}
const cookie = (t) =>
  `sid=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`;
function demo(s) {
  const u = {
    id: id(),
    username: "demo_" + id(),
    name: "Il Profeta del Quasi",
    demo: true,
  };
  s.users.push(u);
  const l = newLeague(s, u, "Quelli del quasi", true);
  const pairs = [["Inter", "Juventus"], ["Napoli", "Roma"], ["Milan", "Atalanta"], ["Fiorentina", "Bologna"], ["Lazio", "Udinese"], ["Genoa", "Parma"], ["Torino", "Como"], ["Lecce", "Cagliari"], ["Verona", "Sassuolo"], ["Cremonese", "Pisa"]];
  const book = [[2.1, 3.4, 3.5], [2.6, 3.3, 2.7], [1.9, 3.6, 4], [2.4, 3.2, 3], [1.6, 4, 5.5], [2.2, 3.1, 3.4], [2, 3.3, 3.8], [2.5, 3, 3.1], [2.9, 3.2, 2.5], [2.3, 3.1, 3.2]];
  const pair = (a, b) => Math.round(100 / (1 / a + 1 / b)) / 100;
  const matches = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    home: pairs[i][0],
    away: pairs[i][1],
    kickoff: new Date(Date.now() + 2 * 86400000 + i * 3600000).toISOString(),
    odds: {
      1: book[i][0],
      X: book[i][1],
      2: book[i][2],
      "1X": pair(book[i][0], book[i][1]),
      12: pair(book[i][0], book[i][2]),
      X2: pair(book[i][1], book[i][2]),
      Goal: 1.85,
      "No Goal": 1.95,
      "Under 2.5": 1.9,
      "Over 2.5": 1.9,
    },
    score: null,
  }));
  s.rounds.push({
    id: id(),
    league: l.id,
    title: "Giornata demo",
    kickoff: matches[0].kickoff,
    created: new Date().toISOString(),
    matches,
    rules: structuredClone(l.rules),
    slips: [],
    settled: false,
  });
  return u;
}
export function createApi({
  transact: baseTransact = transaction,
  read: baseRead,
  chatTransact,
  authTransact,
  membershipTransact,
  profileTransact,
  slipSaver,
  env = process.env,
  deliverMail = deliverPendingMail,
  dispatchMail = dispatchAccountMail,
  playerStore,
  insightService,
} = {}) {
  baseRead??=baseTransact===transaction?readSnapshot:baseTransact;
  chatTransact??=baseTransact===transaction?chatTransaction:baseTransact;
  authTransact??=baseTransact===transaction?authTransaction:baseTransact;
  membershipTransact??=baseTransact===transaction?membershipTransaction:baseTransact;
  profileTransact??=baseTransact===transaction?profileTransaction:baseTransact;
  slipSaver??=baseTransact===transaction?saveBarSlip:null;
  playerStore??=baseTransact===transaction?sqlPlayerStore:memoryPlayerStore();
  const portraitCache=new Map();let portraitBytes=0;
  return async (req, context = {}) => {
    const started = Date.now(),
      activityRoute = new URL(req.url).pathname
        .split("/")
        .filter(Boolean)
        .at(-1);
    const authRoute=activityRoute.startsWith('social-')||['register','login','logout','admin-login','admin-verify','forgot-password','resend-verification','activate','reset-password','set-email'].includes(activityRoute);
    const membershipRoute=['create','join','member-remove','member-restore','league-prizes'].includes(activityRoute);
    const profileRoute=['profile','profile-avatar','profile-reminders','profile-email-reminders','support','fantacalcio-waitlist'].includes(activityRoute);
    const deliverAccount=async jobId=>deliverMail!==deliverPendingMail?deliverMail({jobId,transactionFn:authTransact,env}):dispatchMail(jobId,{env});
    let accountRequest=null;
    let counted = false,chatLeague=null;
    const sid = (req.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("sid="))
      ?.slice(4);
    const transact = (fn) =>
      (authRoute?authTransact:membershipRoute?membershipTransact:profileRoute?profileTransact:activityRoute.startsWith('chat-')?chatTransact:baseTransact)(async (s, c) => {
        provisionSystemAdmin(s);
        const actor=userFor(s,sid);
        if(actor?.adminOnly&&!['state','logout','platform','platform-leagues','platform-force-sync','platform-probe','platform-wipe-plan','platform-wipe','admin-login','admin-verify','login'].includes(activityRoute))
          fail('Questo account può accedere soltanto all’amministrazione',403);
        const previous=accountRequest&&s.accountRequests?.find(x=>x.id===accountRequest.id&&x.expires>Date.now());
        if(previous){if(previous.digest!==accountRequest.digest)fail('Richiesta già utilizzata con dati diversi',409);return structuredClone(previous.result);}
        const result = await fn(s, c);
        if(accountRequest&&(result?.status||200)<400){s.accountRequests=(s.accountRequests||[]).filter(x=>x.expires>Date.now()).slice(-199);s.accountRequests.push({...accountRequest,result:structuredClone(result),expires:Date.now()+15*60000});}
        if (!counted) {
          recordApiActivity(s, {
            route: activityRoute,
            uid: userFor(s, sid)?.id,
            status: result?.status || 200,
            duration: Date.now() - started,
          });
          counted = true;
        }
        flushExternalActivity(s);
        return result;
      },{league:chatLeague});
    const read=(fn,options)=>baseRead(s=>{const value=fn(s);recordFastActivity({route:activityRoute,uid:userFor(s,sid)?.id,duration:Date.now()-started});return value;},options);
    try {
      const url = new URL(req.url),
        route = url.pathname.split("/").filter(Boolean).at(-1),
        origin = req.headers.get("origin");
      if(route.startsWith('social-')){const response=await createSocialAuth({transact:authTransact,env,onLogin:recordLogin,deliverMail:deliverAccount})(req,context);recordFastActivity({route:activityRoute,status:response.status,duration:Date.now()-started});return response;}
      if(origin&&origin!==url.origin)return reply({error:'Origine non consentita'},403);
      if (!["GET", "POST"].includes(req.method))
        return reply({ error: "Metodo non supportato" }, 405);
      if(route==='features'&&req.method==='GET'){const providers=socialProviders(env);return reply({barDemo:true,...(providers.length?{socialProviders:providers}:{})});}
      if(route==='invite-info'&&req.method==='GET'){const preview=await inviteInfo(url.searchParams.get('code'),{ip:context.ip||req.headers.get('x-nf-client-connection-ip')||'unknown'});return reply(preview.data,preview.status);}
      if(!sid&&(route==='platform'||route.startsWith('platform-')))
        return reply({error:'Accesso riservato all’amministratore di sistema'},403);
      const raw = req.method === "POST" ? await req.text() : "";
      if (raw.length > 200000)
        return reply({ error: "Richiesta troppo grande" }, 413);
      const p = raw ? JSON.parse(raw) : {};
      if(route==='slip'&&req.method==='POST'&&slipSaver){const data=await slipSaver(sid,p);recordFastActivity({route,uid:data.receipt?.uid,duration:Date.now()-started});return reply(data);}
      if(['register','forgot-password','resend-verification','activate','reset-password','set-email'].includes(route)&&p.requestId){
        if(typeof p.requestId!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(p.requestId))fail('Identificativo richiesta non valido');
        accountRequest={id:p.requestId,digest:sha(JSON.stringify({route,p,actor:sha(sid||'')}))};
      }
      chatLeague=String(req.method==='GET'?url.searchParams.get('league')||'':p.league||'');
      const token = (req.headers.get("cookie") || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("sid="))
        ?.slice(4);
      if(route==='unsubscribe-email-reminders'){
        if(req.method!=='POST')return reply({error:'Metodo non supportato'},405);
        return reply(await transact(s=>disableEmailReminders(s,p.token,env)));
      }
      if(['admin-login','admin-verify'].includes(route)){
        if(req.method!=='POST')return reply({error:'Metodo non supportato'},405);
        const out=await transact(s=>route==='admin-login'?beginAdminLogin(s,p,env):finishAdminLogin(s,p,env));
        if(out.mailId){try{await deliverAccount(out.mailId);}catch{out.data.message='Codice in preparazione. Controlla la tua email tra un minuto.';}}
        return reply(out.data,out.status||200,out.token?cookie(out.token).replace('Max-Age=604800','Max-Age=28800'):undefined);
      }
      if(['platform-insights','platform-insights-task','platform-insights-refresh'].includes(route)){
       await read(s=>requireSystemAdmin(s,userFor(s,token)),{kind:'player-auth',tokenHash:sha(token||'')});
       if(req.method!==(route==='platform-insights'?'GET':'POST'))return reply({error:'Metodo non supportato'},405);
       const insights=insightService||await import('../../lib/admin-insights/service.mjs');
       return reply(await (route==='platform-insights'?insights.readInsights():route==='platform-insights-task'?insights.updateSuggestion(p):insights.requestRefresh()));
      }
      if(['platform-operations','platform-operations-retry','platform-operations-calendar'].includes(route)){
       await read(s=>requireSystemAdmin(s,userFor(s,token)),{kind:'player-auth',tokenHash:sha(token||'')});
       const ops=await import('../../lib/operations/admin.mjs');
       if(route==='platform-operations'&&req.method==='GET')return reply(await ops.operationStatus());
       if(req.method!=='POST')return reply({error:'Metodo non supportato'},405);
       return reply(route==='platform-operations-retry'?await ops.retryOperation(p.id):await ops.refreshOperationalCalendar());
      }
      if(route==='platform'&&req.method==='GET')return reply(await read(s=>platformData(s,userFor(s,token),url.searchParams),{kind:'platform'}));
      if(route.startsWith('platform-')){
        if(route==='platform-leagues'&&req.method==='GET')return reply(await read(s=>adminLeagues(s,userFor(s,token),url.searchParams.get('league')),{kind:'platform'}));
        if(req.method!=='POST')return reply({error:'Metodo non supportato'},405);
        if(route==='platform-probe'){
          const u=await transact(s=>{const u=userFor(s,token);requireSystemAdmin(s,u);return structuredClone(u);});
          return reply(await runAdminProbe({transact,u,token,input:p,env}));
        }
        const result=await transact(async(s,c)=>{
          const u=userFor(s,token);requireSystemAdmin(s,u);
          if(route==='platform-force-sync')return forceAllFantasy(s,u);
          if(route==='platform-wipe-plan')return planPlatformWipe(s,c,u,p,token);
          if(route==='platform-wipe')return executePlatformWipe(s,c,u,p,token,env);
          fail('Operazione amministrativa sconosciuta',404);
        });
        if(route==='platform-force-sync'&&baseTransact===transaction){const {enqueueOperation}=await import('../../lib/operations/store.mjs');await enqueueOperation({id:'native-refresh:'+Math.floor(Date.now()/60000),kind:'maintenance',operation:'native-pilot-setup',at:new Date().toISOString()});result.dispatched=true;}
        return reply(result);
      }
      if(route==='state'&&req.method==='GET'&&!token)return reply({user:null,leagues:[],features:{demo:env.ENABLE_DEMO==='true',emailAuth:mailReady(env),community:true,leagueProfile:true}});
      if(route==='state'&&req.method==='GET'){
        const data=await read(s=>{const u=userFor(s,token);if(isSystemAdmin(u))return {user:{id:u.id,username:u.username,name:u.name,adminOnly:true},adminOnly:true,creator:false,leagues:[]};
          const result={
            data: {
              ...enhanceState(s, u, stateFor(s, u)),
              creator: false,
              features: {
                demo: process.env.ENABLE_DEMO === "true",
                emailAuth: mailReady(),
                community: true,
                leagueProfile: true,
              },
              ...(u && (u.demo || u.emailVerified === true)
                ? { calendar: calendarView(s), standings: s.football.standings }
                : {}),
            },
          };

          return compactClientState(result.data,{compact:url.searchParams.get('lite')==='1'});
        },{kind:'game',tokenHash:sha(token||'')});return reply(data);
      }
      if(route==='live'&&req.method==='GET'){
        let data;try{data=await read(s=>liveSnapshot(s,userFor(s,token),url.searchParams.get('league')),{kind:'live',league:url.searchParams.get('league')});}catch(error){return reply({error:error.status?error.message:'Live temporaneamente non disponibile'},error.status||503);}
        const body=JSON.stringify(data),etag='"'+sha(body)+'"';
        const headers={'Content-Type':'application/json','Cache-Control':'private, max-age=0, must-revalidate','ETag':etag,'Vary':'Cookie','X-Content-Type-Options':'nosniff'};
        return new Response(req.headers.get('if-none-match')===etag?null:body,{status:req.headers.get('if-none-match')===etag?304:200,headers});
      }
      if(route==='results'&&req.method==='GET'){
        const data=await read(s=>{
          const u=userFor(s,token);if(!u||(!u.demo&&!u.emailVerified)||u.adminOnly)fail('Accedi con il tuo account di gioco',401);
          const l=s.leagues.find(l=>l.id===url.searchParams.get('league')&&l.members.some(m=>m.uid===u.id));if(!l)fail('Lega non accessibile',403);
          const r=s.rounds.find(r=>r.league===l.id&&r.id===url.searchParams.get('round'));if(!r)fail('Giornata non trovata',404);
          const keys=["id","status","score","liveScore","clock","phase","officialConfirmed","void","clockUpdatedAt","scoreUpdatedAt"];
          return {league:l.id,round:r.id,matches:r.matches.map(m=>Object.fromEntries(keys.map(k=>[k,m[k]??null])))};
        },{kind:'results',league:url.searchParams.get('league'),competition:url.searchParams.get('round')});return reply(data);
      }
      if(route==='match'&&req.method==='GET'){
        const data=await read(s=>{const u=userFor(s,token);if(!u||(!u.demo&&!u.emailVerified)||u.adminOnly)fail('Accedi con il tuo account di gioco',401);
          const id=url.searchParams.get('id'),league=url.searchParams.get('league');let m;
          if(league){const l=s.leagues.find(l=>l.id===league&&l.members.some(m=>m.uid===u.id));if(!l)fail('Lega non accessibile',403);const r=s.rounds.find(r=>r.league===l.id&&r.id===url.searchParams.get('round'));m=r?.matches.find(m=>m.id===id);}
          else m=s.football.calendar?.rounds.flatMap(r=>r.matches).find(m=>m.id===id);
          if(!m)fail('Partita non trovata',404);
          const keys=['id','home','away','status','score','liveScore','clock','phase','clockUpdatedAt','scoreUpdatedAt','lineups','officialConfirmed','details','fantasyPoints','odds','oddsModel'];return {...Object.fromEntries(keys.map(k=>[k,m[k]??null])),fantasy:!!league};
        },{kind:'match',league:url.searchParams.get('league'),competition:url.searchParams.get('round'),team:url.searchParams.get('id')});
        if(data.lineups||data.fantasy&&data.details?.teams){const roster=await playerStore.catalog(data.fantasy?undefined:[data.home,data.away]);if(data.lineups)data.lineups=enrichLineupPortraits(data.lineups,roster);if(data.fantasy)data.details=enrichFantasyPortraits(data.details,roster);}
        const enriched=data.fantasy?data:await enrichStoredMatch(data).catch(()=>data);
        if(enriched.lineups)enriched.lineups=publicLineups(enriched.lineups);
        return reply(enriched);
      }
      if(route==='player-photo'&&req.method==='GET'){
        await read(s=>{const u=userFor(s,token);if(!u||(!u.demo&&!u.emailVerified))fail('Accedi e conferma la tua email',401);},{kind:'player-auth',tokenHash:sha(token||'')});
        const id=url.searchParams.get('id'),digest=url.searchParams.get('v');if(!/^apifootball:\d+$/.test(id||'')||!/[a-f0-9]{64}$/.test(digest||'')||digest.length!==64)fail('Immagine non valida',400);
        const cacheKey=id+':'+digest,cached=portraitCache.get(cacheKey);let asset=cached&&cached.until>Date.now()?cached.asset:null;
        if(!asset){asset=await playerStore.asset(id,digest);if(!asset)fail('Immagine non disponibile',404);
          if(cached){portraitBytes-=cached.asset.data.length;portraitCache.delete(cacheKey);}
          portraitCache.set(cacheKey,{asset,until:Date.now()+600000});portraitBytes+=asset.data.length;
          while(portraitBytes>8*1024*1024&&portraitCache.size){const k=portraitCache.keys().next().value;portraitBytes-=portraitCache.get(k).asset.data.length;portraitCache.delete(k);}
        }
        const headers={'Content-Type':asset.mime,'Cache-Control':'private, max-age=604800, immutable',ETag:'"'+asset.digest+'"','X-Content-Type-Options':'nosniff'};
        return new Response(req.headers.get('if-none-match')===headers.ETag?null:Buffer.from(asset.data),{status:req.headers.get('if-none-match')===headers.ETag?304:200,headers});
      }
      if(route==='bar-team-asset'&&req.method==='GET'){
        const asset=await read(s=>{const u=userFor(s,token);if(!u||!u.emailVerified)fail('Accedi',401);if(!s.leagues.some(l=>l.id===url.searchParams.get('league')&&l.members.some(m=>m.uid===u.id)))fail('Lega non accessibile',403);if(!s.barAsset)fail('Immagine non disponibile',404);return s.barAsset;},{kind:'asset',league:url.searchParams.get('league'),competition:url.searchParams.get('competition'),team:url.searchParams.get('team'),assetKind:url.searchParams.get('kind')});const etag='"'+asset.digest+'"';return new Response(req.headers.get('if-none-match')===etag?null:Buffer.from(asset.data,'base64'),{status:req.headers.get('if-none-match')===etag?304:200,headers:{'Content-Type':asset.mime,'Cache-Control':'private, max-age=604800, immutable',ETag:etag,'X-Content-Type-Options':'nosniff'}});
      }
      if (route.startsWith("chat-")) {
        const readOnly = ["chat-messages", "chat-config"].includes(route);
        if (req.method !== (readOnly ? "GET" : "POST"))
          return reply({ error: "Metodo non supportato" }, 405);
        return reply(
          await chatAction({
            route,
            input: readOnly ? Object.fromEntries(url.searchParams) : p,
            token,
            transact,
            read:fn=>read(fn,{kind:'chat',league:url.searchParams.get('league')}),
            env,
          }),
        );
      }
      if (route === "analysis" && req.method === "GET") {
        // Read-only: derive a cached preview from the compact slip when final profiles are not stored yet.
        const leagueId = url.searchParams.get("league"),
          roundId = url.searchParams.get("round"),
          wanted = url.searchParams.get("uid");
        const build = (s, fresh) => {
          const u = userFor(s, token);
          if (!u || (!u.demo && u.emailVerified !== true))
            fail("Accedi e conferma la tua email", 401);
          const l = s.leagues.find(
            (x) => x.id === leagueId && x.members.some((m) => m.uid === u.id),
          );
          if (!l) fail("Lega non accessibile", 403);
          const r = s.rounds.find((x) => x.id === roundId && x.league === l.id);
          if (!r || !roundClosed(r))
            fail("Analisi disponibile dopo la chiusura della giornata", 403);
          if (r.pointsOnly || r.source === "fantacalcio")
            fail(
              "Il profilo del pronosticatore è disponibile per le schedine di Serie A",
              400,
            );
          if (wanted && !l.members.some((m) => m.uid === wanted))
            fail("Giocatore non trovato", 404);
          const slipUids = (r.slipUids || r.slips?.map((x) => x.uid) || []).filter((uid) => !wanted || uid === wanted);
          if (wanted && !slipUids.length) fail("Nessuna schedina salvata per questa giornata", 404);
          let players = analysisRoundSummary(s, l.id, r.id, slipUids);
          if(players.length<slipUids.length)players=previewRoundProfiles(s,l.id,r.id,slipUids);

          return wanted ? players[0] : { round: r.id, title: r.title, players };
        };
        let data = await read((s) => build(s, false), {
          kind: "analysis",
          league: leagueId,
          competition: roundId,
        });
        if(!data)return reply({error:'Il verdetto si sta preparando. Riprova dopo l’aggiornamento della giornata.'},503);
        const body = JSON.stringify(data),
          etag = '"' + sha(body) + '"',
          same = req.headers.get("if-none-match") === etag;
        return new Response(same ? null : body, {
          status: same ? 304 : 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=30, must-revalidate",
            ETag: etag,
            Vary: "Cookie",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if(req.method==='GET')return reply({error:'Rotta non disponibile'},404);
      const out = await transact(async (s, c) => {
        if(!authRoute&&!membershipRoute&&!profileRoute){updateCalendarRounds(s);syncRoundRewards(s);}
        let u = userFor(s, token);
        let setCookie;
        if(route==='state'&&req.method==='GET'&&isSystemAdmin(u))return {data:{user:{id:u.id,username:u.username,name:u.name,adminOnly:true},adminOnly:true,creator:false,leagues:[]}};
        if (route === "platform" && req.method === "GET")
          return { data: platformData(s, u, url.searchParams) };
        if (route === "match" && req.method === "GET") {
          if (!u) fail("Accedi prima", 401);
          if (!u.demo && u.emailVerified !== true)
            fail("Conferma prima la tua email", 403);
          try {
            const result = await loadMatchDetails(
              s,
              url.searchParams.get("id"),
              undefined,
              undefined,
              undefined,
              true,
            );
            if (!result) fail("Partita non trovata", 404);
            const m = result.match;
            return {
              data: {
                id: m.id,
                home: m.home,
                away: m.away,
                status: m.status,
                score: m.score,
                liveScore: m.liveScore,
                clock: m.clock,
                phase: m.phase,
                clockUpdatedAt: m.clockUpdatedAt,
                scoreUpdatedAt: m.scoreUpdatedAt,
                lineups: publicLineups(m.lineups) || null,
                officialConfirmed: !!m.officialConfirmed,
                details: m.details || null,
              },
            };
          } catch (e) {
            return {
              data: {
                error: e.status
                  ? e.message
                  : "Dettagli momentaneamente non disponibili",
              },
              status: e.status || 503,
            };
          }
        }
        if (req.method !== "POST") fail("Metodo non supportato", 405);
        if (
          [
            "register",
            "login",
            "demo",
            "forgot-password",
            "resend-verification",
            "activate",
            "reset-password",
            "set-email",
            "support",
            "fantacalcio-waitlist",
          ].includes(route)
        ) {
          const ip = sha(context.ip || req.headers.get('x-nf-client-connection-ip') || 'identity:'+String(p.identity||p.username||p.token||u?.id||'unknown').trim().toLowerCase()),
            key = `${route}:${ip}:${sha(String(p.username||p.identity||p.email||p.token||u?.id||'').trim().toLowerCase())}`;
          const rate = await c.query(
            "INSERT INTO fanta_login_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN fanta_login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE fanta_login_limits.attempts+1 END,window_start=CASE WHEN fanta_login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE fanta_login_limits.window_start END RETURNING attempts",
            [key],
          );
          const limit = [
            "register",
            "forgot-password",
            "resend-verification",
            "set-email",
          ].includes(route)
            ? 10
            : 30;
          if (rate.rows[0].attempts > limit)
            return {
              data: { error: "Troppi tentativi. Riprova tra 15 minuti." },
              status: 429,
            };
          if (route === "support" || route === "fantacalcio-waitlist") {
            const report = route === "fantacalcio-waitlist" ? submitFantasyWaitlist(s,u,p,env) : submitSupport(s, u, p,env);
            return {
              mailId: route==='fantacalcio-waitlist'&&report.delivery==='accepted'?null:report.mailId,
              data: {
                ok: true,
                id: report.id,
                delivery: report.delivery,
                message:
                  route === "fantacalcio-waitlist" ? "Sei in lista! Il tuo messaggio è arrivato al bancone." : "Messaggio ricevuto. Grazie: il reparto scuse è stato avvisato.",
              },
            };
          }
          if (route === "register") {
            if(p.correctEmail===true){const u=s.users.find(u=>(p.previousEmail?[u.email,u.pendingEmail].some(value=>String(value||'').toLowerCase()===String(p.previousEmail).trim().toLowerCase()):!!p.username&&u.username===String(p.username).trim().toLowerCase())&&!u.emailVerified&&!u.adminOnly&&!u.demo&&Date.parse(u.createdAt)>Date.now()-24*3600000);if(!u||String(p.password||'').length>200||!checkPassword(u,String(p.password||'')))fail('Per correggere l’email usa la password della registrazione appena creata.');setAccountEmail(s,u,p,env);}else registerAccount(s, p, env);
            return {
              mailId: s.mailOutbox.at(-1)?.id,
              data: {
                ok: true,
                pendingVerification: true,
                message:
                  "Controlla la tua email e conferma l’account dal link ricevuto. Il link vale 24 ore.",
              },
            };
          }
          if (route === "forgot-password" || route === "resend-verification") {
            const before = new Set((s.mailOutbox || []).map((j) => j.id));
            const message = requestAccountMail(
              s,
              p.identity,
              route === "forgot-password" ? "reset" : "verify",
              env,
            );
            return {
              mailId: s.mailOutbox?.find((j) => !before.has(j.id))?.id,
              data: { ok: true, message },
            };
          }
          if (route === "activate") {
            const activated=activateAccount(s, p.token);
            return {
              data: {
                ok: true,
                loggedIn:userFor(s,token)?.id===activated.id,
                message: "Indirizzo confermato. Ora puoi accedere.",
              },
            };
          }
          if (route === "reset-password") {
            resetAccountPassword(s, p.token, p.password, env);
            return {
              mailId: s.mailOutbox.at(-1)?.id,
              data: {
                ok: true,
                message:
                  "Password aggiornata. Accedi con la nuova password. Riceverai un’email di conferma.",
              },
            };
          }
          if (route === "set-email") {
            if (!u || u.demo) fail("Accedi con un account registrato", 401);
            setAccountEmail(s, u, p, env);
            return {
              mailId: s.mailOutbox.at(-1)?.id,
              data: {
                ok: true,
                message:
                  "Controlla il nuovo indirizzo email e confermalo dal link ricevuto.",
              },
            };
          }
          if (route === "demo") {
            if (process.env.ENABLE_DEMO !== "true")
              fail("Modalità demo disabilitata");
            u = demo(s);
          } else {
            const username = String(p.email || p.identity || p.username || "")
                .trim()
                .toLowerCase(),
              password = String(p.password || "");
            if (password.length > 200 || username.length > 254)
              fail("Credenziali troppo lunghe");
            if (!username || !password) fail("Inserisci email e password");
            u = s.users.find((x) => String(x.username||'').toLowerCase() === username || !x.adminOnly&&(String(x.email||'').toLowerCase()===username||!x.emailVerified&&String(x.pendingEmail||'').toLowerCase()===username));
            if(username==='tiffano')return beginAdminLogin(s,p,env);
            if (!checkPassword(u, password))
              return { data: { error: "Credenziali errate" }, status: 401 };
          }
          recordLogin(s, u);
          setCookie = cookie(session(s, u.id));
          return { data: { ok: true,...(!u.demo&&!u.emailVerified?{pendingVerification:true,identity:u.pendingEmail||u.email||null}:{}) }, cookie: setCookie };
        }
        if (!u) fail("Accedi prima", 401);
        if (route === "logout") {
          s.sessions = s.sessions.filter((x) => x.token !== sha(token || ""));
          return {
            data: { ok: true },
            cookie:
              "sid=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
          };
        }
        if(route==='profile-email-reminders'){
          if(typeof p.enabled!=='boolean'||!u.emailVerified||u.demo)fail('Preferenza non valida');
          if(p.enabled&&!u.emailRemindersEnabled)delete u.emailReminderVersion;
          u.emailRemindersEnabled=p.enabled;if(!p.enabled)s.mailOutbox=(s.mailOutbox||[]).filter(j=>j.reminder?.uid!==u.id);return {data:{ok:true,enabled:p.enabled}};
        }
        if(route==='profile-reminders'){
          if(typeof p.enabled!=='boolean')fail('Preferenza non valida');u.remindersEnabled=p.enabled;return {data:{ok:true,enabled:u.remindersEnabled}};
        }
        if (route === "profile-avatar") {
          if (!p.avatar || typeof p.avatar !== 'object' || Array.isArray(p.avatar)) fail('Personaggio non valido');
          const owned=ownedRewardIds(s,u.id);
          if(Object.values(REWARD_SLOTS).some(key=>p.avatar[key]&&p.avatar[key]!=='none'&&!owned.includes(rewardById(p.avatar[key])?.id||p.avatar[key])))fail('Questo premio è ancora da conquistare',403);
          u.avatar = normalizeAvatar(p.avatar,owned);
          return { data: { ok: true, avatar: u.avatar } };
        }
        if (route === "profile") {
          const name = String(p.name || "").trim();
          if (!name || name.length > 60) fail("Soprannome non valido");
          if(u.name!==name)delete u.nicknameSuggested;
          u.name = name;
          return { data: { ok: true } };
        }
        if (!u.demo && u.emailVerified !== true)
          fail(
            "Inserisci e conferma la tua email dal profilo per continuare",
            403,
          );
        if (route === "create") {
          if(u.demo){const l=newLeague(s,u,p.name,true);return {data:{ok:true,league:l.id}};}
          return {data:await createLeaguePair(c,s,u,p,{season:Number(env.FANTA_SEASON||2026)})};
        }
        if (route === "join") {
          const l = s.leagues.find(
            (x) => x.code === String(p.code).trim().toUpperCase(),
          );
          if (!l || l.demo) fail("Codice lega non valido");
          if (l.removedMembers?.some((m) => m.uid === u.id))
            fail(
              "Il presidente deve riattivare la tua partecipazione alla lega",
              403,
            );
          if (!l.members.some((x) => x.uid === u.id))
            l.members.push({
              uid: u.id,
              initial: l.rules.initial,
              credits: l.rules.initial,
              points: 0,
              joinedAt: new Date().toISOString(),
            });
          if(c)await joinLinkedTeam(c,l,u);
          return { data: { ok: true,league:l.id } };
        }
        const l = s.leagues.find(
          (x) => x.id === p.league && x.members.some((m) => m.uid === u.id),
        );
        if (!l) fail("Lega non accessibile", 403);
        const r = s.rounds.find((x) => x.id === p.round && x.league === l.id);
        if (route === "slip") {if(r?.source==='fantacalcio'){
          if(!r.nativeFanta||l.fantaSlipsEnabled===false)fail('Questa schedina Fanta non è abilitata.',403);
          if(!c||(await c.query(`SELECT 1 FROM fanta.leagues fl JOIN fanta.bar_links b ON b.fanta_league_id=fl.id WHERE fl.id=$1 AND b.bar_league_id=$2 AND b.active AND fl.source_key IS NULL AND fl.slips_enabled AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=fl.id AND t.user_id=$3)`,[r.nativeFanta.leagueId,l.id,u.id])).rows.length!==1)fail('Devi allenare una squadra di questa lega Fanta',403);
        }const previousPortrait=r?.slips?.find(x=>x.uid===u.id)?.portrait;placeSlip(s,l,r,u,p);if(r.source!=='fantacalcio'){const slip=r.slips.find(x=>x.uid===u.id);slip.portrait=describeSavedSlip(r,slip,{name:u.name,previous:previousPortrait});}syncRoundRewards(s);
          const member=l.members.find(m=>m.uid===u.id);
          return {data:{ok:true,receipt:{...objectiveReceipt(s,l,r,u.id),uid:u.id,league:l.id,round:r.id,slip:r.slips.find(x=>x.uid===u.id),user:{avatar:normalizeAvatar(u.avatar,ownedRewardIds(s,u.id)),rewards:s.playerRewards?.[u.id]||[]},fantasyRanking:fantasyRanking(s,l),member:{...accountTotals(s,l,member),credits:member.credits,initial:member.initial,points:member.points,...(member.fantasyWallets?{fantasyWallets:member.fantasyWallets}:{}),...(member.fantasyWallet?{fantasyWallet:member.fantasyWallet}:{})},ledger:s.ledger.filter(x=>x.league===l.id&&x.uid===u.id).slice(-100).reverse()}}};
        }
        else {
          if (l.admin !== u.id) fail("Serve il presidente di lega", 403);
          if (route === "member-remove") {removeLeagueMember(l, p.uid, u.id);if(c)await detachBarCoach(c,l,p.uid);}
          else if (route === "member-restore")
            restoreLeagueMember(l, p.uid, u.id);
          else if (route === "league-prizes")
            setPrizeWinners(l, p.winners, u.id);
          else if (route === "rules") l.rules = validateRules(p.rules);
          else if (route === "league-profile")
            updateLeagueProfile(l, p.branding || {});
          else if (route === "calendar-create")
            fail("Il calendario ufficiale è gestito automaticamente");
          else if (route === "results" || route === "demo-close")
            fail(
              "I risultati vengono acquisiti esclusivamente dalla sincronizzazione o dal file ufficiale.",
              403,
            );
          else fail("Operazione sconosciuta", 404);
        }
        return { data: { ok: true } };
      });
      if(route==='create'&&out.data?.jobId){try{await dispatchFanta('random:'+out.data.jobId,env);}catch{out.data.dispatchPending=true;}}
      if (out.mailId) {
        try {
          const delivery = authRoute?await deliverAccount(out.mailId):await deliverMail({ jobId: out.mailId,env });
          if (delivery === "queued" && route === "support")
            out.data.message = "Messaggio salvato. L’invio email è in coda.";
          if(route === "fantacalcio-waitlist"){
            out.data.delivery=delivery;
            if(delivery==='queued')out.data.message="Sei in lista! Il messaggio è salvato e l’email partirà appena torna il postino del bar.";
          }
          if (delivery === "queued" && route === "register")out.data.message="Account creato. Il link di conferma è in arrivo via email. Controlla anche la cartella spam.";
        } catch {
          if (route === "register")
            out.data.message =
              "Account creato. Se non ricevi il messaggio, usa Reinvia conferma email.";
        }
      }
      return reply(out.data, out.status || 200, out.cookie);
    } catch (e) {
      if(authRoute||membershipRoute||req.method==='GET')recordFastActivity({route:activityRoute,status:e.status||503,duration:Date.now()-started});
      else await baseTransact((s) => {
        recordApiActivity(s, {
          route: activityRoute,
          uid: userFor(s, sid)?.id,
          status: e.status || 503,
          duration: Date.now() - started,
        });
        flushExternalActivity(s);
      }).catch(() => {});
      console.error(
        "FANTA_API_ERROR",
        JSON.stringify({
          name: e.name,
          code: e.code || null,
          dbConfigured: !!process.env.DATABASE_URL,
          managedDb: !!process.env.NETLIFY_DB_URL,
          driver: process.env.NETLIFY_DB_DRIVER || "auto",
        }),
      );
      return reply(
        {
          error: e.status
            ? e.message
            : e instanceof SyntaxError
              ? "JSON non valido"
              : "Servizio temporaneamente non disponibile. Verifica configurazione database.",
        },
        e.status || (e instanceof SyntaxError ? 400 : 503),
      );
    }
  };
}
export default createApi();
export const config = { path: "/api/*" };
