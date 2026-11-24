import test from 'node:test';import assert from 'node:assert/strict';
import {newPlan,refreshPlan,dueWork,claimWork,completeWork,nextRomeMorning,mergeUpcomingFixtures} from '../lib/operations/calendar.mjs';
import {runOperation} from '../lib/operations/workflows.mjs';
import {dispatchDue,mutatePlan,operationTicket,readOperationTicket} from '../lib/operations/store.mjs';
const date=x=>Date.parse(x),start='2026-11-01T17:00:00Z';
function calendar(matches){return [{number:10,matches:matches.map((m,i)=>({id:'m'+i,apiFootballId:100+i,home:'Home',away:'Away',officialKickoff:start,kickoff:start,status:'NS',...m}))}];}
const memory=()=>{let data=null,version=0;return {getWithMetadata:async()=>data?{data:structuredClone(data),etag:String(version)}:null,setJSON:async(k,next,options)=>{if(options.onlyIfNew&&data||options.onlyIfMatch&&options.onlyIfMatch!==String(version))return {modified:false};data=structuredClone(next);return {modified:true,etag:String(++version)};}};}
test('Rome 07:00 verification respects both daylight-saving transitions',()=>{assert.equal(nextRomeMorning('2026-10-24T21:30:00Z'),'2026-10-25T06:00:00.000Z');assert.equal(nextRomeMorning('2026-03-28T21:30:00Z'),'2026-03-29T05:00:00.000Z');assert.throws(()=>nextRomeMorning('invalid'));});
test('lineup quality runs daily at 05:20 Rome including the clock change and is claimed once',()=>{
 const now=date('2026-10-24T06:00Z'),plan=newPlan([],{now});
 const slot=plan.jobs.find(j=>j.operation==='audit-lineup-quality');
 assert.equal(slot.at,'2026-10-25T04:20:00.000Z');
 const claim=claimWork(plan,{now:date(slot.at),nonce:'first'});
 assert.equal(claim.jobs.filter(j=>j.operation==='audit-lineup-quality').length,1);
 assert.equal(claimWork(claim.plan,{now:date(slot.at),nonce:'second'}).jobs.length,0);
 assert.equal(refreshPlan(claim.plan,[],{now:date(slot.at)+3600000}).jobs.find(j=>j.operation==='audit-lineup-quality'&&j.status==='queued').at,'2026-10-26T04:20:00.000Z');
});
test('outside the useful windows the dispatcher never calls database/provider/worker; the calendar is initialized once',async()=>{const now=date('2026-10-25T02:00Z'),bootstrap=newPlan(calendar([{}]),{now}),store=memory();let network=0;const report=await dispatchDue({store,bootstrap,now,fetcher:()=>network++,env:{}});assert.equal(report.claimed,0);assert.equal(report.dbOperations,0);assert.equal(report.providerCalls,0);assert.equal(network,0);assert.ok(await store.getWithMetadata('calendar'));const a=await store.getWithMetadata('calendar');await dispatchDue({store,bootstrap,now,fetcher:()=>network++});assert.equal((await store.getWithMetadata('calendar')).etag,a.etag);});
test('stored official dates retime existing jobs, with one periodic reconciliation and recovery after downtime',async()=>{
 const hour=3600000,now=date(start)-28*hour,store=memory(),bootstrap=newPlan(calendar([{}]),{now});
 const fetcher=async()=>({ok:true});
 await dispatchDue({store,bootstrap,now,fetcher,env:{URL:'https://example.test',MAIL_ENCRYPTION_KEY:'test'},syncOfficialSchedule:true});
 const {data:claimed}=await store.getWithMetadata('calendar');
 const job=claimed.jobs.find(j=>j.kind==='schedule-sync');
 assert.equal(job.status,'running');
 const kickoff=new Date(date(start)+hour).toISOString();
 const done=completeWork(claimed,job,{ok:true,fixtures:[{id:'m0',kickoff}]},{now});
 assert.equal(done.jobs.filter(j=>j.kind==='schedule-sync').length,1);
 assert.equal(date(done.jobs.find(j=>j.kind==='schedule-sync').at),now+6*hour);
 assert.equal(done.jobs.filter(j=>j.kind==='reminder-push'&&j.status==='queued').at(0).at,new Date(date(kickoff)-24*hour).toISOString());
 assert.ok(claimWork(done,{now:now+7*hour}).jobs.some(j=>j.kind==='schedule-sync'));
});
test('simultaneous matches produce one shared minute job, even if the dispatch is duplicated',()=>{const now=date(start),p=newPlan(calendar([{},{}]),{now}),a=claimWork(p,{now,nonce:'a'});assert.equal(a.jobs.filter(j=>j.kind==='live').length,1);assert.deepEqual(a.jobs[0].fixtureIds,['m0','m1']);assert.equal(claimWork(a.plan,{now,nonce:'b'}).jobs.length,0);});
test('final status suspends live immediately, does not assume an end at ninety minutes, and creates a single next-morning verification',()=>{let now=date(start),p=newPlan(calendar([{},{}]),{now});p=refreshPlan(p,[{id:'m0',status:'LIVE'},{id:'m1',status:'LIVE'}],{now});assert.equal(dueWork(p,{now:now+110*60000}).live.length,2);now+=120*60000;p=refreshPlan(p,[{id:'m0',status:'FT'},{id:'m1',status:'FT'}],{now});assert.equal(dueWork(p,{now}).live.length,0);const jobs=p.jobs.filter(j=>j.kind==='morning');assert.equal(jobs.length,1);assert.equal(jobs[0].at,'2026-11-02T06:00:00.000Z');assert.equal(refreshPlan(p,[],{now}).jobs.filter(j=>j.kind==='morning').length,1);const claimed=claimWork(p,{now:date(jobs[0].at),nonce:'verify'}),job=claimed.jobs.find(j=>j.kind==='morning'),done=completeWork(claimed.plan,job,{ok:true},{now:date(job.at)});assert.equal(claimWork(done,{now:date(job.at)+60000}).jobs.length,0);});
test('postponed games remain pending without keeping polling alive; a rescheduled recovery gets only its own verification',()=>{let now=date(start),p=newPlan(calendar([{},{}]),{now});p=refreshPlan(p,[{id:'m0',status:'FT'},{id:'m1',status:'PST'}],{now});const j=p.jobs.find(j=>j.kind==='morning'),c=claimWork(p,{now:date(j.at),nonce:'one'}),done=completeWork(c.plan,c.jobs.find(x=>x.id===j.id),{ok:true},{now:date(j.at)});assert.deepEqual(dueWork(done,{now:now+3*86400000}).live,[]);const resumed=refreshPlan(done,[{id:'m1',status:'LIVE',kickoff:'2026-11-04T17:00:00Z'}],{now:date('2026-11-04T17:00Z')}),final=refreshPlan(resumed,[{id:'m1',status:'FT'}],{now:date('2026-11-04T19:00Z')}),next=final.jobs.filter(x=>x.kind==='morning'&&x.status==='queued');assert.equal(next.length,1);assert.deepEqual(next[0].fixtureIds,['m1']);});
test('a failed morning check has no automatic retry; stalled kickoffs and suspensions have explicit limits',()=>{let now=date(start),p=newPlan(calendar([{}]),{now});p=refreshPlan(p,[],{now:now+46*60000});assert.equal(p.fixtures[0].status,'TIMED_OUT');assert.equal(dueWork(p,{now:now+46*60000}).live.length,0);p=newPlan(calendar([{status:'FT',finishedAt:start}]),{now});const j=p.jobs.find(j=>j.kind==='morning'),claimed=claimWork(p,{now:date(j.at),nonce:'one'}),failed=completeWork(claimed.plan,claimed.jobs.find(x=>x.id===j.id),{ok:false,error:'missing-player-statistics'},{now:date(j.at)});assert.equal(dueWork(failed,{now:date(j.at)+86400000}).jobs.length,0);assert.equal(failed.jobs.find(x=>x.id===j.id).error,'missing-player-statistics');});
test('editorial forecasts wait for the previous closure and use ten Rome time slots per day even during a break',()=>{
 const now=date('2026-03-28T05:00Z'),kickoff='2026-04-08T18:45:00.000Z';
 const plan={jobs:[{id:'close',round:10,kind:'round-close',status:'running',at:'2026-03-27T20:00:00Z',leaseUntil:'2026-03-28T06:00:00Z'}],
  fixtures:[{id:'past',round:10,kickoff:'2026-03-26T19:00:00Z',finishedAt:'2026-03-26T21:00:00Z',status:'FT'},
   {id:'next',apiId:102,round:11,kickoff,status:'NS'},{id:'later',apiId:103,round:11,kickoff:'2026-04-08T20:45:00.000Z',status:'NS'}]};
 const forecasts=p=>p.jobs.filter(j=>j.kind==='probable-lineups');
 assert.equal(forecasts(refreshPlan(plan,[],{now})).length,0);
 plan.jobs[0].status='done';
 const p=refreshPlan(plan,[],{now});
 const days=['2026-03-28','2026-03-29'].map(day=>forecasts(p).filter(j=>j.at.startsWith(day)));
 assert.deepEqual(days.map(day=>day.length),[10,10]);
 assert.deepEqual(days.map(day=>[day[0].at,day.at(-1).at]),[
  ['2026-03-28T07:00:00.000Z','2026-03-28T20:30:00.000Z'],
  ['2026-03-29T06:00:00.000Z','2026-03-29T19:30:00.000Z']]);
 assert.equal(days.flat().filter(j=>j.refreshCalendar).length,2);
 assert.ok(days.flat().every(j=>j.fixtureIds.join(',')==='later,next'));
 const at=date(days[0][0].at),claimed=claimWork(p,{now:at,nonce:'one'});
 assert.equal(claimed.jobs.filter(j=>j.kind==='probable-lineups').length,1);
 assert.equal(claimWork(claimed.plan,{now:at,nonce:'two'}).jobs.filter(j=>j.kind==='probable-lineups').length,0);
 const matchday=refreshPlan(p,[{id:'next',status:'FT',finishedAt:'2026-04-08T20:30:00Z'}],{now:date('2026-04-08T20:35Z')});
 assert.equal(forecasts(matchday).some(j=>j.status==='queued'),false);
});
test('four submission pushes follow the first confirmed kickoff and a reschedule replaces pending times',()=>{
 const hour=3600000,now=date(start)-26*hour;
 const offsets=[24,12,6,3], queued=plan=>plan.jobs.filter(j=>j.kind==='reminder-push'&&j.status==='queued');
 const plan=newPlan(calendar([{}]),{now});
 assert.deepEqual(queued(plan).map(j=>j.leadHours),offsets);
 assert.deepEqual(queued(plan).map(j=>date(j.at)),offsets.map(hours=>date(start)-hours*hour));
 const kickoff=new Date(date(start)+hour).toISOString();
 const updated=refreshPlan(plan,[{id:'m0',kickoff}],{now});
 assert.deepEqual(queued(updated).map(j=>date(j.at)),offsets.map(hours=>date(kickoff)-hours*hour));
});
test('the 72-hour availability window fires every hour even without a previous closure and follows the first kickoff',()=>{
 const hour=3600000,now=date(start)-72*hour,previous='2026-10-28T20:00:00Z';
 const input=[{number:9,matches:[{id:'past',officialKickoff:previous,status:'FT'}]},...calendar([{},{}])];
 const p=newPlan(input,{now}),queued=plan=>plan.jobs.filter(j=>j.refreshAvailability&&j.status==='queued');
 assert.equal(queued(p).length,72);
 assert.deepEqual(queued(p).map(j=>date(j.at)),Array.from({length:72},(_,i)=>now+i*hour));
 assert.ok(queued(p).every(j=>j.fixtureIds.join(',')==='m0,m1'));
 assert.equal(claimWork(p,{now:now-1}).jobs.some(j=>j.refreshAvailability),false);
 const first=claimWork(p,{now,nonce:'one'});
 assert.equal(first.jobs.filter(j=>j.refreshAvailability).length,1);
 assert.equal(claimWork(first.plan,{now,nonce:'two'}).jobs.some(j=>j.refreshAvailability),false);
 assert.equal(queued(refreshPlan(p,[],{now:date(start)})).length,0);
 const moved=refreshPlan(p,[{id:'m0',kickoff:new Date(date(start)+30*60000).toISOString()},{id:'m1',status:'PST'}],{now});
 assert.equal(date(queued(moved)[0].at),now+30*60000);
 assert.ok(queued(moved).every(j=>j.fixtureIds.join(',')==='m0'));
});
test('private operational tickets expire, reject tampering and do not contain credentials',()=>{const env={RESEND_API_KEY:'synthetic-only'},t=operationTicket({id:'j',nonce:'n'},env,1000);assert.equal(readOperationTicket(t,env,2000).id,'j');assert.equal(readOperationTicket(t,env,122000),null);assert.equal(readOperationTicket(t+'bad',env,2000),null);assert.ok(!t.includes(env.RESEND_API_KEY));});

test('07:00 closure follows the local finishing date and moves only queued old morning jobs',()=>{
 assert.equal(nextRomeMorning('2026-11-02T21:50:00Z'),'2026-11-03T06:00:00.000Z');
 assert.equal(nextRomeMorning('2026-11-02T23:15:00Z'),'2026-11-04T06:00:00.000Z');
 const now=date('2026-11-02T22:00:00Z'),p=newPlan(calendar([{officialKickoff:'2026-11-02T19:00:00Z',status:'FT',finishedAt:'2026-11-02T21:50:00Z'}]),{now});const j=p.jobs.find(j=>j.kind==='morning');j.at='2026-11-03T08:00:00.000Z';
 assert.equal(refreshPlan(p,[],{now}).jobs.find(x=>x.id===j.id).at,'2026-11-03T06:00:00.000Z');j.status='done';assert.equal(refreshPlan(p,[],{now}).jobs.find(j=>j.kind==='morning').at,'2026-11-03T08:00:00.000Z');
});

test('closure waits for the last match, survives downtime and replaces expired provider retries',async()=>{
 const ended=date(start)+120*60000,cutoff=ended+86400000;
 const source=calendar(Array.from({length:10},(_,i)=>i===9?{officialKickoff:new Date(ended-20*60000).toISOString()}:{}));
 const bootstrap=newPlan(source,{now:date(start)-60000});
 let plan={...bootstrap,fixtures:bootstrap.fixtures.slice(0,9)};
 mergeUpcomingFixtures(plan,bootstrap,date(start)-60000);
 plan=refreshPlan(plan,plan.fixtures.slice(0,9).map(f=>({id:f.id,status:'FT'})),{now:ended-40*60000});
 assert.ok(!plan.jobs.some(j=>j.kind==='round-close'));
 plan=refreshPlan(plan,[{id:'m9',status:'FT'}],{now:ended});
 const closure=plan.jobs.find(j=>j.kind==='round-close');
 assert.equal(date(closure.at),cutoff);
 assert.ok(!claimWork(plan,{now:cutoff-1}).jobs.some(j=>j.kind==='round-close'));
 const first=claimWork(plan,{now:cutoff+180*60000,nonce:'first'});
 assert.deepEqual(first.jobs.map(j=>j.kind),['round-close']);
 const blocked=first.plan.jobs.find(j=>j.kind==='morning');
 assert.equal(blocked.status,'cancelled');
 const skipped=await runOperation(blocked,first.plan,{now:()=>cutoff,provider:{get(){throw Error('Unexpected provider call');}}});
 assert.equal(skipped.metrics.providerCalls,0);
 const failed=completeWork(first.plan,first.jobs[0],{ok:false,error:'out-of-memory'},{now:cutoff+180*60000});
 const retry=claimWork(failed,{now:cutoff+185*60000,nonce:'retry'});
 assert.equal(retry.jobs[0].id,closure.id);
 assert.equal(retry.jobs[0].attempts,2);
 const restored=claimWork(retry.plan,{now:cutoff+194*60000,nonce:'expired'});
 assert.equal(restored.jobs.length,0);
 const again=claimWork(restored.plan,{now:cutoff+204*60000,nonce:'again'});
 const done=completeWork(again.plan,again.jobs[0],{ok:true},{now:cutoff+204*60000});
 assert.equal(done.jobs.find(j=>j.id===closure.id).status,'done');
 assert.equal(claimWork(done,{now:cutoff+215*60000}).jobs.length,0);
});
