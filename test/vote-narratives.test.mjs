import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFixture,calculateVote} from '../fanta/votes.mjs';
import {roundByBands} from '../fanta/statistical-votes/math.mjs';
import {DEFAULT_CONFIG,MODEL,voteConfig} from '../fanta/statistical-votes/config.mjs';
import {evaluateGoalSupport} from '../fanta/statistical-votes/goal-impact.mjs';
import {describePerformance,NARRATIVE_VERSION} from '../fanta/statistical-votes/narrative.mjs';
import {mergeInstallations,bootstrapPlan} from '../lib/operations/store.mjs';
import {apiFixture} from './fanta/helpers.mjs';

function scorer(sequence,{status='FT',minutes=90}={}){
 const raw=apiFixture({status,minutes});raw.teams.home={id:10,name:'Lazio'};raw.teams.away={id:20,name:'Bologna'};
 raw.fixture.status={short:status,elapsed:minutes};raw.goals={home:0,away:0};
 raw.events=sequence.map(([side,player,minute,detail='Normal Goal'])=>{if(!/missed|disallow|shootout/i.test(detail))raw.goals[side]++;return {type:'Goal',detail,time:{elapsed:minute},team:{id:side==='home'?10:20},player:{id:player}};});
 const player=raw.players[0].players[1];player.player={id:3,name:'Isaksen'};raw.players[0].team={id:10,name:'Lazio'};
 player.statistics=[{games:{minutes,position:'M',substitute:false},passes:{total:37,accuracy:32,key:0},tackles:{total:1,interceptions:1},duels:{total:12,won:9},shots:{total:3,on:2},goals:{total:sequence.filter(([side,id,,detail])=>side==='home'&&id===3&&!/missed|disallow|own|shootout/i.test(detail||'')).length}}];
 raw.lineups[0].team={id:10};raw.lineups[0].startXI.push({player:{id:3,pos:'M'}});
 return {raw,input:normalizeFixture(raw).find(p=>p.apiId===3)};
}
const support=(input,performance=6,probability=.5)=>evaluateGoalSupport(input,{value:performance},{odds:{sourceKind:'bookmaker',probabilities:{1:probability,X:.2,2:.8-probability}}},{config:DEFAULT_CONFIG});

test('progressive grade boundaries are deterministic and less punitive below six',()=>{
 for(const [raw,expected]of [[3.59,3.5],[3.6,4],[4.6,5],[5.29,5],[5.3,5.5],[5.5,5.5],[5.6,5.5],[5.600001,6],[5.7,6],[6.2,6],[6.200001,6.5],[6.65,6.5],[6.650001,7],[7.25,7],[7.250001,7.5],[7.75,7.5],[7.750001,8],[8.25,8],[8.250001,8.5],[8.75,8.5],[8.750001,9]])assert.equal(roundByBands(raw,DEFAULT_CONFIG.rounding.bands),expected,String(raw));
 assert.throws(()=>voteConfig({rounding:{bands:[[6,6],[5,7]]}}));assert.throws(()=>voteConfig({goalSupport:{decay:2}}));
});
test('first verified equalizer or winner supports the technical vote by half a point, separately from fantasy bonuses',()=>{
 for(const seq of [[['away',8,12],['home',3,80]],[['home',3,25]],[['home',9,12],['home',3,45],['away',8,70]]]){
  const {input}=scorer(seq),v=calculateVote(input),without=calculateVote({...input,events:{...input.events,goals:0},goalImpact:null});
  assert.equal(v.goalSupport.first,.5);assert.ok(v.rawVote>=without.rawVote+.5);assert.equal(v.goalSupport.delta,.5);
  assert.equal(v.fantavote-v.vote,3);assert.match(v.why,/Isaksen/);assert.match(v.why,/Lazio/);assert.match(v.why,/Bologna/);assert.doesNotMatch(v.why,/mezzo punto|voto base/);assert.match(v.why,/Segna il pareggio|Firma il gol partita|Va a segno/);
  assert.ok(Math.abs(6+v.breakdown.lines.reduce((n,l)=>n+l.delta,0)-v.vote)<1e-6);
 }
});
test('goal support applies in defeats and live, including a late consolation goal',()=>{
 const live=scorer([['home',3,20]],{status:'1H',minutes:30}).input;assert.equal(support(live).delta,.5);assert.equal(support(live).provisional,true);assert.match(calculateVote(live).why,/provvisori[ao]/);
 const lost=scorer([['away',8,20],['away',8,40],['home',3,80]]).input;assert.equal(support(lost).delta,.5);assert.ok(calculateVote(lost).vote>=6);assert.doesNotMatch(calculateVote(lost).why,/mezzo punto|voto base/);assert.match(calculateVote(lost).why,/senza evitare la sconfitta/);
 const changed=structuredClone(live);changed.fixture.score={home:1,away:2};assert.equal(support(changed).delta,.5);
});
test('additional goals diminish with margin and are weighted by performance and pre-match difficulty',()=>{
 const close=scorer([['home',3,10],['away',8,20],['home',3,40],['away',8,50],['home',3,80]]).input;
 const a=support(close);assert.equal(a.first,.5);assert.equal(a.additional[0].delta,.2);assert.equal(a.additional[1].delta,.1);assert.equal(a.delta,.8);
 assert.ok(support(close,5).delta<a.delta);assert.ok(support(close,7,.2).delta>support(close,7,.75).delta);
 const blowout=scorer([['home',3,10],['home',3,40],['home',3,80]]).input;assert.ok(support(blowout).delta<a.delta);assert.equal(support(blowout).first,.5);
});
test('documented scorer statistics work without a timeline; cancelled, missed and own goals do not count as scored goals',()=>{
 const incomplete=scorer([['home',3,20]]);incomplete.raw.goals.home=2;assert.equal(support(normalizeFixture(incomplete.raw).find(p=>p.apiId===3)).delta,.5);
 for(const detail of ['Missed Penalty','Goal Disallowed','Penalty Shootout'])assert.equal(support(scorer([['home',3,20,detail]]).input).delta,0);
 const own=scorer([['away',3,20,'Own Goal']]);own.raw.goals={home:0,away:1};assert.equal(support(normalizeFixture(own.raw).find(p=>p.apiId===3)).delta,0);
 const ambiguous=calculateVote(scorer([['home',3,20],['away',8,20]]).input);assert.equal(ambiguous.goalSupport.delta,.5);assert.doesNotMatch(ambiguous.why,/pareggio dà|vantaggio dà/);
 const statistics=scorer([]).input;statistics.events.goals=2;assert.ok(support(statistics).delta>.5);
});
test('match reports explain the observed game without numerical stat lists or public experimental labels',()=>{
 const {input}=scorer([['home',3,25]]),a=calculateVote(input),b=calculateVote(input);assert.equal(a.why,b.why);assert.match(a.why,/Lazio–Bologna 1–0/);assert.doesNotMatch(a.why,/media del ruolo|86\.486|contrasti:|sperimentale|voto base|mezzo punto/);assert.equal(a.narrativeVersion,NARRATIVE_VERSION);assert.equal(a.model,MODEL);
 const live=scorer([['home',3,20],['away',8,25],['away',8,28]],{status:'1H',minutes:30}).input;assert.doesNotMatch(calculateVote(live).why,/non evita la sconfitta/);
});
test('new model installation merges once into an existing calendar without reviving old jobs or changing live leases',()=>{
 const bootstrap=bootstrapPlan(Date.parse('2026-11-01T12:00Z'),{}),job=bootstrap.jobs.find(j=>j.operation==='rebuild-votes');assert.match(job.id,new RegExp(MODEL));
 const plan={jobs:[{id:'install:statistical-votes-v2',status:'complete'},{id:'live',status:'running',nonce:'keep',leaseUntil:'keep'}],fixtures:[{id:'preserved'}]};
 mergeInstallations(plan,bootstrap);mergeInstallations(plan,bootstrap);assert.equal(plan.jobs.length,2+bootstrap.jobs.filter(j=>j.kind==='maintenance'&&j.id.startsWith('install:')).length);assert.equal(plan.jobs.filter(j=>j.operation==='install-api-football-odds').length,1);assert.equal(plan.jobs.filter(j=>j.operation==='rebuild-votes').length,1);assert.equal(plan.jobs[0].status,'complete');assert.equal(plan.jobs[1].nonce,'keep');assert.deepEqual(plan.fixtures,[{id:'preserved'}]);
});

test('a scorer is never below six, even with poor stats, a defeat, sparse data or a missed penalty',()=>{
 const input=scorer([['away',8,10],['away',8,30],['home',3,80]]).input;
 input.metrics={passesTotal:20,passAccuracy:10,keyPasses:0,shotsTotal:9,shotsOn:1,tackles:0,interceptions:0,duelsTotal:20,duelsWon:0,dribblesAttempts:10,dribbles:0,foulsDrawn:0};
 for(const extra of [{},{minutes:3},{minutes:null,metrics:{}},{metrics:{}},{events:{...input.events,penMissed:1}}]){
  const v=calculateVote({...input,...extra});assert.ok(v.vote>=6);assert.ok(v.rawVote>=6);assert.ok(Math.abs(6+v.breakdown.lines.reduce((n,l)=>n+l.delta,0)-v.vote)<1e-6);assert.doesNotMatch(v.why,/mezzo punto|voto base/);
 }
});
test('a saved penalty gives the keeper at least 6.5 while the fantasy bonus is applied separately',()=>{
 const input=scorer([]).input;input.role='P';input.events={penSaved:1,conceded:3};input.metrics={saves:0,passesTotal:10,passAccuracy:10};
 const v=calculateVote(input);assert.ok(v.vote>=6.5);assert.ok(v.rawVote>=6.5);assert.equal(v.fantavote-v.vote,0);assert.match(v.why,/rigore parato/);assert.doesNotMatch(v.why,/soglia|voto base|mezzo punto/);
 const sparse=calculateVote({...input,minutes:null,metrics:{}});assert.equal(sparse.vote,6.5);
 const outfield=calculateVote({...input,role:'D',events:{penSaved:1}});assert.equal(outfield.eventImpact.penSaved,0);
});
test('each missed penalty subtracts half a technical point in addition to its fantasy malus',()=>{
 const input=scorer([]).input,base=calculateVote(input),missed=calculateVote({...input,events:{...input.events,penMissed:1}}),twice=calculateVote({...input,events:{...input.events,penMissed:2}});
 assert.ok(Math.abs(missed.rawVote-(base.rawVote-.5))<1e-6);assert.equal(missed.eventImpact.penaltyMissedDelta,-.5);assert.equal(missed.fantavote-missed.vote,-3);assert.equal(twice.eventImpact.penaltyMissedDelta,-1);assert.equal(twice.fantavote-twice.vote,-6);assert.match(missed.why,/errore dal dischetto/);
});
test('documented scorer statistics establish an appearance even when minutes and the event timeline are missing',()=>{
 const {raw}=scorer([['home',3,20]]);raw.events=[];raw.players[0].players[1].statistics[0].games={minutes:null,position:'M',substitute:true};raw.lineups[0].startXI=raw.lineups[0].startXI.filter(x=>x.player.id!==3);
 const p=normalizeFixture(raw).find(p=>p.apiId===3),v=calculateVote(p);assert.equal(p.onField,true);assert.equal(v.vote,6.5);assert.equal(v.fantavote,9.5);
});

test('a brace and hat trick reward the goals and still allow distinct votes for distinct performances',()=>{
 for(const [goals,target] of [[2,8],[3,9]]){
  const sequence=Array.from({length:goals},(_,i)=>['home',3,15+i*16]);
  const {input}=scorer(sequence);
  const reference=calculateVote({...input,minutes:null,metrics:{}});
  const strong=calculateVote({...input,metrics:{passesTotal:84,passAccuracy:100,keyPasses:9,shotsTotal:9,shotsOn:9,tackles:8,interceptions:8,duelsTotal:26,duelsWon:26,dribblesAttempts:12,dribbles:12,foulsDrawn:9},ratingRanks:{matchBest:1}});
  const weak=calculateVote({...input,events:{...input.events,penMissed:2},metrics:{passesTotal:8,passAccuracy:8,shotsTotal:15,shotsOn:2,duelsTotal:18,duelsWon:0,dribblesAttempts:12,dribbles:0}});
  assert.equal(reference.vote,target);
  assert.ok(strong.vote>target&&strong.vote<=10);
  assert.equal(weak.vote,target-.5);
  for(const v of [reference,strong,weak]){
   assert.equal(v.eventImpact.multiGoal.target,target);
   assert.ok(Math.abs(6+v.breakdown.lines.reduce((sum,line)=>sum+line.delta,0)-v.vote)<1e-6);
  }
 }
});

test('four and more goals mean ten even with sparse or poor evidence and the goals remain fantasy bonuses',()=>{
 for(const goals of [4,5])for(const status of ['2H','FT']){
  const {input}=scorer(Array.from({length:goals},(_,i)=>['home',3,10+i*10]),{status,minutes:80});
  const v=calculateVote({...input,name:'D. Malen',role:'A',minutes:null,metrics:{}});
  assert.equal(v.vote,10);assert.equal(v.fantavote,10+3*goals);
  assert.match(v.why,new RegExp(goals+' gol'));
  assert.equal(v.breakdown.lines.find(line=>line.key==='event-minimum').label,'Quattro o più gol');
  assert.ok(Math.abs(6+v.breakdown.lines.reduce((sum,line)=>sum+line.delta,0)-10)<1e-6);
 }
});

test('match commentary has several punchlines for the same grade and names the observed decisive event',()=>{
 const {input}=scorer([['away',8,10],['home',3,80]]);
 const variants=new Set(Array.from({length:12},(_,i)=>describePerformance({...input,id:'p'+i},{vote:7,goalSupport:{count:1,anchor:{types:['equalizer']}}})));
 assert.ok(variants.size>=2);
 for(const text of variants){assert.match(text,/Segna il pareggio/);assert.match(text,/Lazio–Bologna 1–1/);}
});
