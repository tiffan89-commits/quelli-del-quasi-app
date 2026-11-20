import {runAutoLineups} from '../../fanta/auto-lineups.mjs';
import {ensurePilotBars} from '../../fanta/random-leagues.mjs';
import {ensurePilot} from '../../fanta/pilot.mjs';
import {syncNativeBar} from '../../fanta/bar.mjs';
import {refundRetiredSlips} from '../../fanta/retired-slips.mjs';
import {refreshFutureCalendar} from './future-calendar.mjs';
import {dispatchRelated} from './related-jobs.mjs';
import {nativeNotifications} from './native-notifications.mjs';
import {connection,reminderTransaction,chatTransaction} from '../db.mjs';
import {apiFootballClient,applyApiFootball} from '../api-football.mjs';
import {ingestFixture,computeRounds} from '../../fanta/ingest.mjs';
import {rebuildVoteModel} from '../../fanta/statistical-votes/rebuild.mjs';
import {updateDerived} from './derived-db.mjs';
import {patchSports} from './sports-db.mjs';
import {publicStore,enqueueOperation} from './store.mjs';
import {createHash} from 'node:crypto';
import {barStorageMode} from '../storage-mode.mjs';
import {roundCutoff} from './calendar.mjs';
import {fantaProvider} from '../../fanta/provider.mjs';
import {closeRoundFromStorage} from './round-closure.mjs';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const publicMatch=m=>({id:m.id,status:m.status,score:m.score,liveScore:m.liveScore,clock:m.clock,phase:m.phase,officialConfirmed:m.officialConfirmed,clockUpdatedAt:m.clockUpdatedAt,scoreUpdatedAt:m.scoreUpdatedAt,events:m.details?.events||[],eventsAt:m.details?.updatedAt||null,statistics:m.details?.statistics||[]});
export async function publishMatches(matches,{store=publicStore()}={}){
 for(let attempt=0;attempt<4;attempt++){
  const prior=await store.getWithMetadata('scores',{type:'json'}),previous=prior?.data||{matches:[],revision:null},merged=new Map(previous.matches.map(m=>[m.id,m]));
  for(const m of matches){const old=merged.get(m.id),before=Date.parse(old?.scoreUpdatedAt),incoming=Date.parse(m.scoreUpdatedAt);if(Number.isFinite(before)&&(!Number.isFinite(incoming)||incoming<before))continue;merged.set(m.id,publicMatch(m));}
  const rows=[...merged.values()].sort((a,b)=>a.id.localeCompare(b.id)),revision=hash(rows);
  if(previous.revision===revision)return {revision,changed:false};
  const saved=await store.setJSON('scores',{matches:rows,revision},prior?{onlyIfMatch:prior.etag}:{onlyIfNew:true});
  if(saved.modified)return {revision,changed:true};
 }
 throw Error('Public score cache contention');
}
export async function runOperation(job,plan,{env=process.env,connect=connection,provider=apiFootballClient({env}),now=Date.now,sportsStorage=barStorageMode(),scoreStore}={}){
 const odds=job.kind==='odds'||job.operation==='install-api-football-odds';
 const rehearsal=sportsStorage==='rows'&&barStorageMode()!=='rows';
 if(rehearsal&&!odds&&!['official-lineups','probable-lineups'].includes(job.kind)&&!(['live','morning','round-close'].includes(job.kind)&&scoreStore))
  throw Error('Unsupported row storage rehearsal job');
 if(odds){const {runOddsOperation}=await import('./odds.mjs');return runOddsOperation(plan,{env,connect,provider,now,sportsStorage});}
 const metrics={scope:'shared-sports-and-native-core',providerCalls:0,fixtures:0,voteRevisions:0,dbQueries:0,dbWrites:0,dbMs:0,dbMaxQueryMs:0,cacheWrites:0};
 const counted=async()=>{const c=await connect();return {async query(...args){
  metrics.dbQueries++;
  const start=performance.now();
  try{
   const result=await c.query(...args);
   if(/^\s*(INSERT|UPDATE|DELETE)/i.test(args[0]))metrics.dbWrites+=result.rowCount||0;
   return result;
  }finally{
   const elapsed=Math.round(performance.now()-start);
   metrics.dbMs+=elapsed;
   metrics.dbMaxQueryMs=Math.max(metrics.dbMaxQueryMs,elapsed);
  }
 },release:()=>c.release()};};
 if(job.kind==='round-close'){
  const {matches,...closed}=await closeRoundFromStorage(job,{connect:counted,env,now,sportsStorage});
  const cache=scoreStore?await publishMatches(matches,{store:scoreStore}):await publishMatches(matches);
  return {ok:true,metrics:{...metrics,...closed,cacheWrites:Number(cache.changed)}};
 }
 if(job.kind==='probable-lineups'){
  const {runProbableLineups}=await import('./probable-lineups.mjs');
  const targets=plan.fixtures.filter(f=>job.fixtureIds.includes(f.id));
  let fixtures=[],calendarError=null;
  if(job.refreshCalendar)try{
   fixtures=await refreshFutureCalendar(provider,{connect,now:now(),season:Number(env.FANTA_SEASON||2026),sportsStorage,fixtures:targets});
  }catch(error){calendarError=error.code||error.name;}
  try{
   const availabilityProvider=job.refreshAvailability&&env.FANTA_ENABLED==='true'?fantaProvider({env,maxCalls:1}):undefined;
   const forecast=await runProbableLineups(job,{connect,sportsStorage,now,availabilityProvider});
   return {...forecast,fixtures,metrics:{...forecast.metrics,providerCalls:(provider.quota?.calls||0)+(forecast.metrics.availability?.providerCalls??availabilityProvider?.calls??0),calendarFixtures:fixtures.length,...(calendarError?{calendarError}:{})}};
  }catch(error){
   return {ok:false,fixtures,error:error.code||error.name,metrics:{scope:'editorial-lineups-only',calendarFixtures:fixtures.length,...(calendarError?{calendarError}:{})}};
  }
 }
 if(job.kind==='official-lineups'){const {runOfficialLineups}=await import('./official-lineups.mjs');return runOfficialLineups(job,plan,{connect:counted,provider,now,sportsStorage});}
 if(job.kind==='auto-lineup'||job.kind==='auto-lineup-final'){if(env.FANTA_ENABLED!=='true')return {ok:true,metrics:{...metrics,disabled:true}};metrics.autoLineups=await runAutoLineups({connect:counted,now:now(),sportsStorage});metrics.bar=await syncNativeBar({connect:counted,now:now()});return {ok:true,metrics};}
 if(job.kind==='maintenance'){
  if(job.operation==='repair-removed-coaches'){const {repairRemovedCoaches}=await import('../../fanta/linked-membership.mjs');metrics.membershipRepair=await repairRemovedCoaches({connect:counted});return {ok:true,metrics};}
  if(job.operation==='refresh-presence-estimates'){const {refreshPresenceEstimates}=await import('../../fanta/presence-estimates.mjs');metrics.presence=await refreshPresenceEstimates({connect:counted,season:Number(env.FANTA_SEASON||2026),now:now()});return {ok:true,metrics};}
  if(job.operation==='seed-lineup-accuracy'){const {seedUpcomingLineupAccuracy}=await import('../lineup-accuracy.mjs');metrics.accuracy=await seedUpcomingLineupAccuracy({connect:counted,season:Number(env.FANTA_SEASON||2026),now:now()});return {ok:true,metrics};}
  if(job.operation==='install-straight-half-scoring'){const {installStraightScoring}=await import('../straight-scoring-install.mjs');return {ok:true,metrics:{...metrics,scoring:await installStraightScoring({connect:counted,now:now()})}};}
  if(job.operation==='audit-final-round'){
   const {finalReadiness}=await import('../../fanta/final-readiness.mjs'),{normalizeFixture,calculateVote}=await import('../../fanta/votes.mjs'),{configuredVotes}=await import('../../fanta/statistical-votes/repository.mjs');
   const c=await counted();let stored,roles;try{stored=(await c.query('SELECT id,api_id,data,frozen_at,checked_at FROM fanta.fixtures WHERE season=$1 AND round=$2 ORDER BY id',[Number(env.FANTA_SEASON||2026),Number(job.round)])).rows;roles=Object.fromEntries((await c.query('SELECT id,role FROM fanta.players')).rows.map(p=>[p.id,p.role]));}finally{c.release();}
   const fresh=stored.length?(await provider.get('fixtures?ids='+stored.map(f=>f.api_id).join('-'))).response:[],config=configuredVotes(env);
   const inspect=raw=>{const normalized=normalizeFixture(raw,roles,{config}),votes=normalized.filter(p=>p.role).map(p=>({p,vote:calculateVote(p,{config})}));return finalReadiness(raw,normalized,votes);};
   const fixtures=stored.map(f=>{const raw=fresh.find(x=>x.fixture.id===f.api_id);return {id:f.id,match:f.data.teams.home.name+' – '+f.data.teams.away.name,official:!!f.frozen_at,checkedAt:f.checked_at,stored:inspect(f.data),fresh:raw?inspect(raw):{complete:false,issues:[{code:'fixture-response-missing'}]}};});
   return {ok:true,metrics:{...metrics,providerCalls:provider.quota?.calls||0,finalAudit:{round:job.round,complete:fixtures.length===10&&fixtures.every(f=>f.fresh.complete),fixtures}}};
  }
  if(job.operation==='install-league-wallets'){const {installLeagueWallets}=await import('../../fanta/wallet-install.mjs');return {ok:true,metrics:{...metrics,wallets:await installLeagueWallets({connect:counted})}};}
  if(job.operation==='native-pilot-setup'){if(env.FANTA_ENABLED!=='true')return {ok:true,metrics:{...metrics,disabled:true}};metrics.refunds=await refundRetiredSlips({connect:counted,now:now()});metrics.pilot={disabled:true};metrics.pilotBars=await ensurePilotBars({connect:counted,now:now()});metrics.autoLineups=await runAutoLineups({connect:counted,now:now()});metrics.rounds=await computeRounds({connect:counted,now});metrics.bar=await syncNativeBar({connect:counted,now:now()});const verified=await counted();try{metrics.nativeLeagues=(await verified.query("SELECT l.id,l.kind,count(DISTINCT t.id)::int AS teams,count(DISTINCT r.player_id)::int AS players,(SELECT count(*)::int FROM fanta.rounds x WHERE x.league_id=l.id) AS rounds,(SELECT count(*)::int FROM fanta.lineups x WHERE x.league_id=l.id) AS lineups FROM fanta.leagues l LEFT JOIN fanta.teams t ON t.league_id=l.id LEFT JOIN fanta.rosters r ON r.team_id=t.id WHERE l.kind='pilot' OR l.source_key='lucas-bar:548867' GROUP BY l.id ORDER BY l.id")).rows;}finally{verified.release();}return {ok:true,metrics};}
  if(job.operation==='recompute-round-results'){
   const {currentModelKey,configuredVotes}=await import('../../fanta/statistical-votes/repository.mjs');
   const rounds=await computeRounds({connect:counted,now,recalculate:true,modelKey:currentModelKey(configuredVotes(env)),correctionReason:'owner-missing-lineup-zero-v1'}),c=await counted();let tables;
   try{tables=(await c.query("SELECT id,name,data->'summary' AS summary FROM fanta.competitions ORDER BY id")).rows;}finally{c.release();}
   return {ok:true,metrics:{...metrics,resultsRecalculation:{rounds,tables,source:'stored-votes-only',policy:'missing-lineup-zero-v1'}}};
  }
  if(job.operation==='refresh-vote-narratives'){
   const {refreshVoteNarratives}=await import('../../fanta/statistical-votes/refresh-narratives.mjs'),{auditStoredVotes,currentModelKey,configuredVotes}=await import('../../fanta/statistical-votes/repository.mjs'),c=await counted();
   try{const config=configuredVotes(env),key=currentModelKey(config);metrics.narratives=await refreshVoteNarratives(c,{key,minMinutes:config.minMinutes});if(!metrics.narratives.pending)metrics.voteAudit=await auditStoredVotes(c,key,job.auditPlayers||[]);return {ok:true,pending:metrics.narratives.pending,metrics};}finally{c.release();}
  }
  if(job.operation==='audit-player-votes'){const {auditStoredVotes,currentModelKey,configuredVotes}=await import('../../fanta/statistical-votes/repository.mjs'),c=await counted();try{metrics.voteAudit=await auditStoredVotes(c,currentModelKey(configuredVotes(env)),Array.isArray(job.auditPlayers)?job.auditPlayers:[]);}finally{c.release();}return {ok:true,metrics};}
  if(job.operation==='audit-player-identities'){const {inspectPlayerIdentities}=await import('../../fanta/identity-maintenance.mjs'),report=await inspectPlayerIdentities({connect:counted,env,verifyClubs:true});return {ok:true,metrics:{...metrics,providerCalls:report.clubEvidence?.calls||0,identityAudit:report}};}
  const check=await counted();let identities;try{identities=(await check.query("SELECT data FROM fanta.jobs WHERE id='maintenance:player-identities:v1'")).rows[0]?.data;}finally{check.release();}
  if(!identities){const {repairPlayerIdentities}=await import('../../fanta/identity-maintenance.mjs');identities=await repairPlayerIdentities({connect:counted,env});metrics.providerCalls+=identities.clubEvidence?.calls||0;}metrics.identityRepair=identities;
  const report=await rebuildVoteModel({connect:counted,provider,env,now,sportsStorage,limit:Math.min(24,Math.max(1,Number(job.batchSize)||12)),closedOnly:job.closedOnly===true,cachedOnly:job.cachedOnly===true,auditPlayers:Array.isArray(job.auditPlayers)?job.auditPlayers.slice(0,10):[]});
  if(report.unavailable?.length)throw Error('Incomplete cached/provider fixtures: manual retry required');
  if(!report.pending)metrics.bar=await syncNativeBar({connect:counted,now:now()});
  return {ok:true,pending:report.pending||0,metrics:{...metrics,providerCalls:metrics.providerCalls+(provider.quota?.calls||0),rebuild:report}};
 }
 if(job.kind==='mail'){
  const {deliverPendingMail}=await import('../mail-delivery.mjs');
  await deliverPendingMail({jobId:job.jobId,transactionFn:reminderTransaction,env,now});
  return {ok:true,metrics};
 }
 if(job.kind==='native-notify'){metrics.notifications=await nativeNotifications({connect:counted,env,now,queue:false});return {ok:true,metrics};}
  if(job.kind==='chat-push'){
  const {deliverChatPush}=await import('../league-chat.mjs');
  await deliverChatPush({transact:chatTransaction,jobId:job.jobId,env});return {ok:true,metrics};
 }
 if(job.kind==='reminder-push'||job.kind==='reminder-delivery'){
  const {deliverLeagueReminders}=await import('../league-reminders.mjs');
  const queue=job.kind==='reminder-push';
  const report=await deliverLeagueReminders({transact:reminderTransaction,env,now,queue,leadHours:job.leadHours});
  if(report.next)await enqueueOperation({id:'reminder-delivery:'+Math.ceil(report.next/60000),kind:'reminder-delivery',at:new Date(report.next).toISOString()});
  if(queue&&env.FANTA_ENABLED==='true')await nativeNotifications({connect:counted,env,now,reminderHours:job.leadHours});
  return {ok:true,metrics};
 }
 if(job.kind==='lineup-reminder-mail'){
  if(env.FANTA_ENABLED==='true'&&env.FANTA_EMAIL_ENABLED==='true')await nativeNotifications({connect:counted,env,now,reminderHours:2,emailOnly:true});
  return {ok:true,metrics};
 }
 if(job.kind==='reminder-mail'){
  const {queueEmailReminders}=await import('../reminder-email.mjs');
  const {deliverPendingMail}=await import('../mail-delivery.mjs');
  const ids=await reminderTransaction(s=>{queueEmailReminders(s,env,now());return (s.mailOutbox||[]).filter(j=>j.reminder&&j.expires>now()&&j.nextAt<=now()&&j.attempts<8).map(j=>j.id);});
  for(const jobId of ids)await enqueueOperation({id:'mail:'+jobId+':reminder',kind:'mail',jobId,at:new Date(now()+60000).toISOString()});
  for(const jobId of ids.slice(0,10))await deliverPendingMail({jobId,transactionFn:reminderTransaction,env,now});return {ok:true,metrics};
 }
 if(!['live','morning'].includes(job.kind))throw Error('Unsupported operation');
 const cutoff=job.kind==='morning'?roundCutoff(plan.fixtures.filter(f=>f.round===job.round)):null;
 if(job.kind==='morning'&&(cutoff!=null&&now()>=cutoff||plan.jobs?.some(j=>j.kind==='round-close'&&j.round===job.round&&j.status==='done')))return {ok:true,metrics:{...metrics,skipped:'stored-data-closure-cutoff'}};
 const selected=plan.fixtures.filter(f=>job.fixtureIds.includes(f.id)),ids=selected.map(f=>f.apiId).filter(Boolean),raw=[],observedAt=new Date(now()).toISOString();
 // Shared aggregate request. Never dispatch another native-Fanta provider job.
 for(let i=0;i<ids.length;i+=20){const batch=await provider.get('fixtures?ids='+ids.slice(i,i+20).join('-'));raw.push(...batch.response);}
 for(const date of new Set(selected.filter(f=>!f.apiId).map(f=>f.kickoff.slice(0,10)))){
  const response=await provider.get(`fixtures?league=135&season=${Number(env.FANTA_SEASON||2026)}&date=${date}`);raw.push(...response.response);
 }
 if(!raw.length)return {ok:false,error:'Official data incomplete: missing fixtures',retryable:job.kind==='morning',retryFixtureIds:job.fixtureIds,metrics};
 const morning=job.kind==='morning',at=observedAt;
 const saved=await patchSports(selected.map(f=>f.id),s=>applyApiFootball(s,raw,at,{updateRounds:false,allowOfficialCorrection:morning,finalVerification:morning}),{connect:counted,sportsStorage});
 // Publish scores before downstream votes/notifications: an unrelated failure must not freeze the live feed.
 const cache=scoreStore?await publishMatches(saved.matches,{store:scoreStore}):await publishMatches(saved.matches);metrics.cacheWrites=Number(cache.changed);
 if(saved.accuracyMatches?.length)try{const {recordLineupAccuracy}=await import('../lineup-accuracy.mjs');metrics.accuracy=await recordLineupAccuracy(saved.accuracyMatches,{connect:counted,season:Number(env.FANTA_SEASON||2026),now:now()});}catch{metrics.accuracyPending=true;}
 if(saved.derive)metrics.derived=await updateDerived(selected.map(f=>f.id),{connect:counted,sportsStorage});
 metrics.fixtures=raw.length;metrics.providerCalls=provider.quota?.calls||0;
 const finalStatuses=new Set(['FT','AET','PEN']);
 const changedRounds=[],retryFixtureIds=selected.filter(f=>!raw.some(e=>Number(e.fixture?.id)===Number(f.apiId))).map(f=>f.id),incomplete=[];
 let changedFinal=false;
 if(env.FANTA_ENABLED==='true')for(const fixture of raw){
  const report=await ingestFixture(fixture,{connect:counted,env,now,finalVerification:morning,force:morning,sportsStorage});
  metrics.voteRevisions+=report.revisions||0;
  if(morning&&!report.cached&&(!report.official||report.needsReview?.length)){
   const target=selected.find(f=>Number(f.apiId)===Number(fixture.fixture.id));
   if(target)retryFixtureIds.push(target.id);
   incomplete.push({fixture:report.fixture,issues:report.readiness?.issues||[],needsReview:report.needsReview||[]});
  }
  if(report.cached||report.superseded)continue;
  changedRounds.push(Number(String(fixture.league?.round).match(/\d+$/)?.[0]));
  if(finalStatuses.has(fixture.fixture?.status?.short)&&(report.changed||report.revisions))changedFinal=true;
 }
 const affectedRounds=[...new Set(changedRounds.filter(Number.isFinite))];
 if(affectedRounds.length){
  const season=Number(env.FANTA_SEASON||2026);
  await computeRounds({connect:counted,now,recalculate:morning,serieARounds:affectedRounds,season,correctionReason:'morning-official-correction'});
  // Keep future quotes in sync with the updated history without rebuilding past Bar rounds.
  metrics.bar=await syncNativeBar({connect:counted,now:now(),fromSerieARound:Math.min(...affectedRounds),season,sportsStorage});
 }
 if(metrics.voteRevisions>0&&!rehearsal)metrics.notifications=await nativeNotifications({connect:counted,env,now});
 // Presence estimates are auxiliary. A contention timeout here must not discard completed work.
 if(changedFinal)try{
  const {refreshPresenceEstimates}=await import('../../fanta/presence-estimates.mjs');
  metrics.presence=await refreshPresenceEstimates({connect:counted,season:Number(env.FANTA_SEASON||2026),now:now()});
 }catch(error){metrics.presenceError=error.code||error.name;}
 const future=morning&&!job.retryOf&&(cutoff==null||now()<cutoff)?await refreshFutureCalendar(provider,{connect:counted,now:now(),season:Number(env.FANTA_SEASON||2026),sportsStorage}):[];
 if(morning&&!job.retryOf&&!rehearsal)metrics.related=await dispatchRelated('morning',{env});
 metrics.providerCalls=provider.quota?.calls||0;
 const fixtures=selected.flatMap(f=>{const m=saved.matches.find(m=>m.id===f.id),e=raw.find(e=>e.fixture?.id===m?.apiFootballId);return m?[{id:f.id,apiId:m.apiFootballId,round:f.round,kickoff:e?.fixture?.date||f.kickoff,status:e?.fixture?.status?.short||m.status,...(m.status==='FT'?{finishedAt:f.finishedAt||at}:{})}]:[];});
 if(morning&&(retryFixtureIds.length||incomplete.length||fixtures.some(f=>!finalStatuses.has(f.status))))return {ok:false,error:'Official data incomplete',retryable:true,retryFixtureIds:[...new Set([...retryFixtureIds,...fixtures.filter(f=>!finalStatuses.has(f.status)).map(f=>f.id)])],fixtures,metrics:{...metrics,incomplete}};
 return {ok:true,fixtures:[...fixtures,...future],metrics};
}
