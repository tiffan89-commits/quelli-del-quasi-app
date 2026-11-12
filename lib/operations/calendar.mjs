import {ODDS_POLICY,scheduleOdds} from '../api-football-odds.mjs';
// No database, provider or platform imports: this is the cheap, persistent-calendar decision layer.
export const OP_CONFIG={startToleranceMinutes:2,initialWindowMinutes:150,maxLiveMinutes:210,maxStartDelayMinutes:45,suspensionGraceMinutes:10,morningHour:7,morningRetryMinutes:60,morningRetryHours:24,missedJobToleranceMinutes:20,leaseMinutes:8,horizonDays:21};
const MIN=60000,DAY=86400000,finals=new Set(['FT','AET','PEN']),terminal=new Set([...finals,'PST','CANC','ABD','AWD','WO','TIMED_OUT']),live=new Set(['LIVE','1H','HT','2H','ET','BT','P','INT']);
const ms=x=>typeof x==='string'&&/^20\d\d-/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const parts=t=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
export function nextRomeMorning(endedAt,config=OP_CONFIG){const time=ms(endedAt);if(time==null)throw Error('Invalid match completion timestamp');const p=parts(time),date=new Date(Date.UTC(p.year,p.month-1,p.day+1)),wall=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),config.morningHour);let utc=wall;for(let i=0;i<3;i++){const z=parts(utc),local=Date.UTC(z.year,z.month-1,z.day,z.hour,z.minute,z.second);utc+=wall-local;}return new Date(utc).toISOString();}
export function newPlan(calendar,{now=Date.now(),config=OP_CONFIG,maintenance=[]}={}){
 const activeRounds=new Set((calendar||[]).filter(r=>(r.matches||[]).some(m=>{const k=ms(m.officialKickoff||m.kickoff);return k!=null&&k>=now-DAY&&k<=now+config.horizonDays*DAY;})).map(r=>Number(r.number)));
 const fixtures=[];for(const r of calendar||[])for(const m of r.matches||[]){const kickoff=ms(m.officialKickoff||m.kickoff),confirmed=!!(m.officialKickoff||m.apiFootballId);if(kickoff==null||!confirmed)continue;const historic=kickoff<now-DAY&&m.status==='FT';if(kickoff>now+config.horizonDays*DAY||historic&&!activeRounds.has(Number(r.number)))continue;fixtures.push({id:m.id,apiId:m.apiFootballId||null,round:Number(r.number),kickoff:new Date(kickoff).toISOString(),status:m.status||'NS',finishedAt:ms(m.finishedAt)!=null?new Date(ms(m.finishedAt)).toISOString():['FT','AET','PEN'].includes(m.status)?new Date(now).toISOString():null,home:m.home,away:m.away,morningAttemptedAt:null,...(['SUSP','INT'].includes(m.status)?{suspendedAt:new Date(now).toISOString()}:{} )});}
 const plan={version:1,timezone:'Europe/Rome',fixtures,jobs:maintenance.map(j=>({...j,status:'queued',attempts:0})),errors:[],live:null};return refreshPlan(plan,[],{now,config});
}
// Fill gaps left by a failed calendar refresh. Existing observed dates and statuses take precedence.
export function mergeUpcomingFixtures(plan,bootstrap,now){
 const ids=new Set(plan.fixtures.map(f=>f.id));
 for(const f of bootstrap?.fixtures||[]){
  if(ms(f.kickoff)<=now||ids.has(f.id))continue;
  plan.fixtures.push(structuredClone(f));ids.add(f.id);
 }
}
export function roundCutoff(fixtures,config=OP_CONFIG){
 if(fixtures.length!==10||!fixtures.every(f=>terminal.has(f.status)))return null;
 const ends=fixtures.filter(f=>finals.has(f.status)||f.status==='TIMED_OUT').map(f=>ms(f.finishedAt)??(ms(f.kickoff)==null?null:ms(f.kickoff)+config.maxLiveMinutes*MIN)).filter(Number.isFinite);
 return ends.length?Math.max(...ends)+DAY:null;
}
function planRoundClosure(plan,round,fixtures,now,config){
 const cutoff=roundCutoff(fixtures,config),prior=plan.jobs.find(j=>j.kind==='round-close'&&j.round===round&&['done','running'].includes(j.status));
 const id=cutoff==null?null:'round-close:'+round+':'+cutoff;
 for(const j of plan.jobs.filter(j=>j.round===round&&j.status==='queued')){
  if(j.kind==='round-close'&&j.id!==id&&j!==prior){j.status='cancelled';j.error='fixture-window-changed';}
  if(j.kind==='morning'&&(prior?.status==='done'||cutoff!=null&&Math.max(now,ms(j.at)??now)>=cutoff)){j.status='cancelled';j.error='stored-data-closure-cutoff';}
 }
 if(!prior&&id){
  const at=new Date(cutoff).toISOString(),existing=plan.jobs.find(j=>j.id===id);
  if(!existing)plan.jobs.push({id,kind:'round-close',round,fixtureIds:fixtures.map(f=>f.id).sort(),cutoffAt:at,at,status:'queued',attempts:0});
  else if(existing.status==='cancelled')Object.assign(existing,{status:'queued',at,error:null});
 }
 return prior?.status==='done'?0:cutoff;
}
export function refreshPlan(prior,updates,{now=Date.now(),config=OP_CONFIG}={}){
 const plan=structuredClone(prior);plan.jobs??=[];plan.errors??=[];for(const u of updates){let f=plan.fixtures.find(f=>f.apiId&&f.apiId===u.apiId||f.id===u.id);if(!f){if(!u.kickoff||ms(u.kickoff)==null||ms(u.kickoff)<now-DAY||ms(u.kickoff)>now+config.horizonDays*DAY)continue;f={...u,morningAttemptedAt:null};plan.fixtures.push(f);}const previous=f.status,changedTime=u.kickoff&&u.kickoff!==f.kickoff;Object.assign(f,u);if(['FT','AET','PEN'].includes(f.status)&&!f.finishedAt)f.finishedAt=new Date(now).toISOString();if(changedTime&&!['FT','AET','PEN'].includes(f.status)){f.error=null;f.suspendedAt=null;}if(['SUSP','INT'].includes(f.status)&&!f.suspendedAt)f.suspendedAt=new Date(now).toISOString();if(previous==='TIMED_OUT'&&u.status&&u.status!=='TIMED_OUT')f.error=null;}
 for(const f of plan.fixtures){const start=ms(f.kickoff);if(start==null||terminal.has(f.status))continue;let reason=null;if(live.has(f.status)&&now>start+config.maxLiveMinutes*MIN)reason='live-window-limit';else if(['NS','TBD'].includes(f.status)&&now>start+config.maxStartDelayMinutes*MIN)reason='kickoff-delay-limit';else if(['SUSP','INT'].includes(f.status)&&ms(f.suspendedAt)!=null&&now>ms(f.suspendedAt)+config.suspensionGraceMinutes*MIN)reason='suspension-pending';if(reason){f.status='TIMED_OUT';f.error=reason;plan.errors.push({kind:'fixture',fixture:f.id,reason,at:new Date(now).toISOString()});}}
 for(const round of [...new Set(plan.fixtures.map(f=>f.round))]){const fs=plan.fixtures.filter(f=>f.round===round),cutoff=planRoundClosure(plan,round,fs,now,config),finished=fs.filter(f=>['FT','AET','PEN'].includes(f.status)&&!f.morningAttemptedAt&&ms(f.finishedAt)!=null);if(!finished.length||!fs.every(f=>terminal.has(f.status)))continue;
  const ids=finished.map(f=>f.id).sort(),id='morning:'+round+':'+ids.join('|'),last=Math.max(...finished.map(f=>ms(f.finishedAt))),at=nextRomeMorning(new Date(last).toISOString(),config),existing=plan.jobs.find(j=>j.id===id);if(cutoff!=null&&Math.max(now,ms(at))>=cutoff)continue;if(!existing)plan.jobs.push({id,kind:'morning',round,fixtureIds:ids,at,status:'queued',attempts:0});else if(existing.status==='queued'&&existing.at!==at)existing.at=at;
 }
 // Official XIs are separate from live statistics: start at T-30, cache once complete.
 for(const f of plan.fixtures){
  const start=ms(f.kickoff),root='official-lineups:'+f.id+':'+f.kickoff;
  for(const j of plan.jobs.filter(j=>j.kind==='official-lineups'&&j.fixtureIds?.includes(f.id)&&j.status==='queued'))if(f.officialLineups||terminal.has(f.status)||!(j.id===root||j.retryOf===root)){j.status='cancelled';j.error=f.officialLineups?'official-lineups-saved':'fixture-window-changed';}
  if(start==null||terminal.has(f.status)||f.officialLineups||now>start+config.maxLiveMinutes*MIN||plan.jobs.some(j=>j.id===root))continue;
  plan.jobs.push({id:root,kind:'official-lineups',fixtureIds:[f.id],round:f.round,at:new Date(Math.max(start-30*MIN,now)).toISOString(),status:'queued',attempts:0});
 }
 // One point job for all leagues sharing the same Serie A opening time; never scan queues periodically.
 for(const round of [...new Set(plan.fixtures.map(f=>f.round))]){const fs=plan.fixtures.filter(f=>f.round===round),start=Math.min(...fs.map(f=>ms(f.kickoff)).filter(Number.isFinite));if(!Number.isFinite(start))continue;for(const[kind,hours]of [['reminder-push',2],['reminder-mail',1],['auto-lineup',2],['auto-lineup-final',0.5]]){const id=kind+':'+round+':'+start;for(const old of plan.jobs.filter(j=>j.kind===kind&&j.round===round&&j.status==='queued'&&j.id!==id)){old.status='cancelled';old.error='official-kickoff-changed';}if(start-hours*3600000<now-MIN||plan.jobs.some(j=>j.id===id))continue;plan.jobs.push({id,kind,round,at:new Date(start-hours*3600000).toISOString(),status:'queued',attempts:0});}}
 return scheduleOdds(plan,{now});
}
export function dueWork(plan,{now=Date.now(),config=OP_CONFIG}={}){
 if(!plan)return {live:[],jobs:[]};const closed=new Set((plan.jobs||[]).filter(j=>j.kind==='round-close'&&j.status==='done').map(j=>j.round));
 const ids=plan.fixtures.filter(f=>{const t=ms(f.kickoff);return !closed.has(f.round)&&t!=null&&!terminal.has(f.status)&&now>=t-config.startToleranceMinutes*MIN&&now<=t+(live.has(f.status)?config.maxLiveMinutes:config.initialWindowMinutes)*MIN;}).map(f=>f.id);
 return {live:ids,jobs:(plan.jobs||[]).filter(j=>j.status==='queued'&&ms(j.at)!=null&&ms(j.at)<=now&&(!j.expires||ms(j.expires)>now)&&(j.kind==='round-close'||now-ms(j.at)<=config.missedJobToleranceMinutes*MIN)).map(j=>j.id)};
}
export function claimWork(plan,{now=Date.now(),config=OP_CONFIG,nonce='claim'}={}){
 const next=refreshPlan(plan,[],{now,config}),due=dueWork(next,{now,config}),jobs=[];const bucket=Math.floor(now/MIN);
 if(due.live.length&&!(next.live?.bucket===bucket&&['running','done','error'].includes(next.live.status))&&!(next.live?.status==='running'&&ms(next.live.leaseUntil)>now)){
  next.live={id:'live:'+bucket,kind:'live',fixtureIds:due.live,bucket,status:'running',nonce,at:new Date(now).toISOString(),leaseUntil:new Date(now+config.leaseMinutes*MIN).toISOString()};jobs.push(structuredClone(next.live));
 }
 for(const j of next.jobs){
  const closure=j.kind==='round-close';
  if(j.status==='running'&&ms(j.leaseUntil)<=now){
   if(closure)requeueClosure(j,now,'execution-lease-expired');
   else {j.status='error';j.error='execution-lease-expired-no-automatic-retry';}
  }
  if(!closure&&j.status==='queued'&&ms(j.at)<now-config.missedJobToleranceMinutes*MIN){j.status='error';j.error='scheduled-time-missed-manual-retry-required';}
  if(!due.jobs.includes(j.id)||j.status!=='queued')continue;
  if(closure&&next.jobs.some(other=>other.kind==='morning'&&other.round===j.round&&other.status==='running'&&ms(other.leaseUntil)>now))continue;
  Object.assign(j,{status:'running',nonce,executionStartedAt:null,attempts:(j.attempts||0)+1,leaseUntil:new Date(now+config.leaseMinutes*MIN).toISOString()});
  jobs.push(structuredClone(j));
 }
 return {plan:next,jobs};
}
function requeueClosure(job,now,error){
 const delay=Math.min(60,5*2**Math.min(4,Math.max(0,job.attempts-1)));
 Object.assign(job,{status:'queued',at:new Date(now+delay*MIN).toISOString(),nonce:null,executionStartedAt:null,leaseUntil:null,error});
}
export function completeWork(prior,job,result,{now=Date.now(),config=OP_CONFIG}={}){
 const plan=structuredClone(prior),target=job.kind==='live'?plan.live:plan.jobs.find(j=>j.id===job.id);if(!target||target.nonce!==job.nonce||target.status!=='running')return plan;Object.assign(target,{status:result.ok?'done':'error',completedAt:new Date(now).toISOString(),error:result.ok?null:result.error||'operation-failed',metrics:result.metrics||{}});
 if(job.kind==='round-close'&&!result.ok)requeueClosure(target,now,target.error);
 if(job.kind==='odds'||job.operation==='install-api-football-odds'){
  const before=plan.odds||{};plan.odds={...before,...result.odds,policy:ODDS_POLICY,fixtures:{...before.fixtures,...result.odds?.fixtures},lastError:result.ok?null:result.error,lastAttemptAt:new Date(now).toISOString()};
  scheduleOdds(plan,{now,failed:!result.ok});
 }
 if(job.kind==='official-lineups'){
  const pending=result.pendingFixtureIds||(!result.ok?job.fixtureIds:[]),ids=pending.filter(id=>{const f=plan.fixtures.find(f=>f.id===id);return f&&!f.officialLineups&&!terminal.has(f.status)&&now+5*MIN<=ms(f.kickoff)+config.maxLiveMinutes*MIN;});
  if(ids.length){const root=job.retryOf||job.id,attempt=(job.retryAttempt||0)+1,id=root+':retry:'+attempt;if(!plan.jobs.some(j=>j.id===id))plan.jobs.push({id,kind:'official-lineups',fixtureIds:ids,round:job.round,at:new Date(now+5*MIN).toISOString(),status:'queued',attempts:0,retryOf:root,retryAttempt:attempt});target.nextRetryAt=new Date(now+5*MIN).toISOString();}
 }
 if(job.kind==='morning')for(const f of plan.fixtures.filter(f=>job.fixtureIds.includes(f.id)))f.morningAttemptedAt=new Date(now).toISOString();
 if(job.kind==='morning'&&!result.ok&&result.retryable===true){
  const root=job.retryOf||job.id,first=job.initialAt||job.at,until=Date.parse(first)+config.morningRetryHours*3600000,at=now+config.morningRetryMinutes*MIN;
  const cutoff=roundCutoff(plan.fixtures.filter(f=>f.round===job.round),config);
  if(at<=until&&(cutoff==null||at<cutoff)){const attempt=(job.retryAttempt||0)+1,id=root+':retry:'+attempt;if(!plan.jobs.some(j=>j.id===id))plan.jobs.push({id,kind:'morning',round:job.round,fixtureIds:result.retryFixtureIds?.length?result.retryFixtureIds:job.fixtureIds,at:new Date(at).toISOString(),status:'queued',attempts:0,retryOf:root,retryAttempt:attempt,initialAt:first});target.nextRetryAt=new Date(at).toISOString();}
  else target.error='official-data-incomplete-retry-window-ended';
 }
 if(job.kind==='morning'&&result.ok&&job.retryOf){const root=plan.jobs.find(j=>j.id===job.retryOf);if(root){root.resolvedAt=new Date(now).toISOString();root.resolvedBy=job.id;delete root.nextRetryAt;}}
 const updated=refreshPlan(plan,result.fixtures||[],{now,config});if(job.kind==='maintenance'&&result.pending>0&&(job.runs||0)<40){const nextId=job.id+':'+result.pending;if(!updated.jobs.some(j=>j.id===nextId))updated.jobs.push({id:nextId,kind:'maintenance',at:new Date(now+MIN).toISOString(),status:'queued',attempts:0,operation:job.operation,...Object.fromEntries(['batchSize','closedOnly','cachedOnly','auditPlayers'].filter(k=>job[k]!==undefined).map(k=>[k,job[k]])),runs:(job.runs||0)+1});}
 if(job.kind==='maintenance'&&result.pending>0&&(job.runs||0)>=40){const j=updated.jobs.find(j=>j.id===job.id);j.status='error';j.error='maintenance-batch-limit-manual-retry-required';}
 return updated;
}
export const publicWindow=plan=>({liveIds:dueWork(plan).live,nextKickoff:(plan.fixtures||[]).filter(f=>!terminal.has(f.status)&&ms(f.kickoff)>Date.now()).sort((a,b)=>ms(a.kickoff)-ms(b.kickoff))[0]?.kickoff||null});
