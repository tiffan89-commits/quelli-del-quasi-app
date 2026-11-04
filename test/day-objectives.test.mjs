import test from 'node:test';import assert from 'node:assert/strict';
import {createDayObjectives,currentObjectiveRound} from '../public/src/day-objectives.mjs';
import {syncRoundRewards,ownedRewardIds,progressionFor} from '../lib/progression.mjs';
import {rewardCondition} from '../public/src/reward-rules.mjs';
import {REWARD_CATALOG} from '../public/src/reward-catalog.mjs';
import {emptyState} from '../lib/db.mjs';
const now=Date.parse('2026-10-30T10:00:00Z');
function fixture(number=1){const s=emptyState(),l={id:'l',name:'Test',members:[{uid:'a',credits:500,points:0},{uid:'b',credits:500,points:0}],rules:{initial:500}},r={id:'r',league:'l',season:'2026-27',number,title:'Giornata '+number,kickoff:'2026-10-31T14:00:00Z',rules:{maxStake:20},matches:Array.from({length:10},(_,i)=>({id:'m'+i})),slips:[]};s.users=[{id:'a'},{id:'b'}];s.leagues=[l];s.rounds=[r];return{s,l,r};}
test('every round exposes at most five applicable goals and first-day leadership expires with that round',()=>{for(let n=1;n<=38;n++){const goals=createDayObjectives({number:n});assert.equal(goals.length,5);assert.equal(goals.some(g=>g.seasonal),n===1);assert.equal(new Set(goals.map(g=>g.id)).size,goals.length);assert.ok(createDayObjectives({number:n,pointsOnly:true}).every(g=>!['minimum','maximum','profit','mixed-markets'].includes(g.id)));}});
test('plans are stored before kickoff and seasonal leaders include ties, award once per season, and never backfill missed historical days',()=>{
 const{s,l,r}=fixture();syncRoundRewards(s,now);assert.equal(r.dayObjectives.length,5);const frozen=JSON.stringify(r.dayObjectives);
 r.slips=[{uid:'a',stake:1,points:5,picks:{}},{uid:'b',stake:1,points:5,picks:{}}];r.matches.forEach(m=>{m.score=[1,0];m.status='FT';});r.settled=true;syncRoundRewards(s,now+2*86400000);
 for(const uid of ['a','b'])assert.equal(s.playerRewards[uid].filter(a=>a.achievement==='opening-leader').length,1);
 const before=JSON.stringify(s.playerRewards);syncRoundRewards(s,now+3*86400000);assert.equal(JSON.stringify(s.playerRewards),before);assert.equal(JSON.stringify(r.dayObjectives),frozen);assert.equal(l.members[0].credits,500);
 const next={...structuredClone(r),id:'next-year',season:'2027-28',kickoff:'2027-10-31T14:00:00Z',settled:false,rewardVersion:undefined,dayObjectives:undefined};s.rounds.push(next);syncRoundRewards(s,Date.parse('2027-10-30T10:00:00Z'));next.settled=true;syncRoundRewards(s,Date.parse('2027-11-01T10:00:00Z'));assert.equal(s.playerRewards.a.filter(a=>a.achievement==='opening-leader').length,2);
 const old=fixture();old.r.settled=true;old.r.matches.forEach(m=>m.score=[1,0]);syncRoundRewards(old.s,now);assert.equal(old.r.dayObjectives,undefined);assert.ok(!old.s.playerRewards.a.some(a=>a.achievement==='opening-leader'));
});
test('only the scheduled stake goal is awarded and attendance needs three consecutive competition days',()=>{
 const{s,l,r}=fixture(3);r.slips=[{uid:'a',stake:20,picks:{}}];syncRoundRewards(s,now);assert.ok(!ownedRewardIds(s,'a').includes('starter-band'));r.slips[0].stake=1;syncRoundRewards(s,now);assert.ok(ownedRewardIds(s,'a').includes('starter-coin'));assert.ok(!ownedRewardIds(s,'a').includes('starter-shirt'));
 for(const n of [1,2])s.rounds.push({...structuredClone(r),id:'old'+n,number:n,settled:true,dayObjectives:undefined,slips:[{uid:'a',stake:2,picks:{}}]});syncRoundRewards(s,now);assert.ok(ownedRewardIds(s,'a').includes('starter-shirt'));assert.ok(ownedRewardIds(s,'a').includes('starter-title'));
 const p=progressionFor(s,l,'a');assert.ok(p.objectives.every(x=>x.goals.length<=5));assert.ok(p.objectives.length<=1);
});
test('the catalogue explains every reward and chooses goals for the displayed competition',()=>{
 for(const r of REWARD_CATALOG)assert.ok(rewardCondition(r).length>30,r.id);
 const l={rounds:[{id:'a',number:8,competitionKey:'A',source:'fantacalcio',matches:[{}],kickoff:'2026-10-31T14:00:00Z'},{id:'b',number:7,competitionKey:'B',source:'fantacalcio',matches:[{}],kickoff:'2026-10-31T14:00:00Z'}]};assert.equal(currentObjectiveRound(l,'fantacalcio','A',now).id,'a');assert.equal(currentObjectiveRound(l,'fantacalcio','B',now).id,'b');
});
test('a delayed credit settlement can unlock the Resort without duplicating ordinary day rewards',()=>{
 const{s,r}=fixture(4);syncRoundRewards(s,now);r.matches.forEach(m=>{m.score=[1,0];m.status='FT';});r.slips=[{uid:'a',stake:10,prize:0,odds:200,points:10,picks:Object.fromEntries(r.matches.map(m=>[m.id,'1']))}];r.settled=true;syncRoundRewards(s,now+2*86400000);assert.ok(!ownedRewardIds(s,'a').includes('room-100'));r.slips[0].prize=2000;r.slips[0].creditsSettled=true;syncRoundRewards(s,now+3*86400000);assert.ok(ownedRewardIds(s,'a').includes('room-100'));assert.equal(s.playerRewards.a.filter(a=>a.round===r.id).length,1);
});
