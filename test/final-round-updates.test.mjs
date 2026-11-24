import {slipCreditReserve} from '../public/slip-events.mjs';
import {applyVerifiedFixtureEvents} from '../fanta/ingest.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {parseHTML} from 'linkedom';
import {newPlan,claimWork,completeWork,dueWork} from '../lib/operations/calendar.mjs';
import {finalReadiness} from '../fanta/final-readiness.mjs';
import {createVerdictCard} from '../public/src/community.mjs';
import {leagueDashboard} from '../public/src/league-dashboard.mjs';
import {renderLeagueChip} from '../public/src/v2/league-switcher.mjs';import {topBar} from '../public/src/fanta/shell.mjs';
import {alignSlipSchedule,selectableSlipRounds,selectablePublicSlipRounds,sourceOf,currentSlipRound,defaultSlipRound,currentPublicSlipRound,slipWaitingForPrevious} from '../public/src/slip-state.mjs';

test('incomplete final data retries after one hour, only pending fixtures, once, bounded to 48 hours',()=>{
 const start=Date.parse('2026-11-03T06:00Z'),p=newPlan([{number:10,matches:[0,1].map(i=>({id:'m'+i,apiFootballId:10+i,status:'FT',kickoff:'2026-11-02T19:45Z',finishedAt:'2026-11-02T21:40Z'}))}],{now:start}),claim=claimWork(p,{now:start,nonce:'first'}),job=claim.jobs.find(j=>j.kind==='morning');assert.ok(job);
 const result={ok:false,error:'Official data incomplete',retryable:true,retryFixtureIds:['m1']},failed=completeWork(claim.plan,job,result,{now:start});assert.equal(dueWork(failed,{now:start+3599999}).jobs.length,0);
 const retry=failed.jobs.find(j=>j.retryOf===job.id);assert.deepEqual(retry.fixtureIds,['m1']);assert.equal(retry.at,'2026-11-03T07:00:00.000Z');assert.equal(completeWork(failed,job,result,{now:start}).jobs.length,failed.jobs.length);
 const c2=claimWork(failed,{now:start+3600000,nonce:'retry'});assert.equal(c2.jobs.length,1);const done=completeWork(c2.plan,c2.jobs[0],{ok:true},{now:start+3600000});assert.ok(done.jobs.find(j=>j.id===job.id).resolvedAt);assert.equal(dueWork(done,{now:start+7200000}).jobs.length,0);
 const expired=completeWork(c2.plan,c2.jobs[0],result,{now:start+49*3600000});assert.equal(expired.jobs.filter(j=>j.kind==='morning'&&j.status==='queued').length,0);
 const hard=completeWork(claim.plan,job,{ok:false,error:'Authorization failed'},{now:start});assert.equal(hard.jobs.some(j=>j.retryOf),false);
});

test('readiness names missing team coverage and a keeper ambiguity without inventing a saved penalty',()=>{
 const raw={teams:{home:{id:1,name:'A'},away:{id:2,name:'B'}},players:[{team:{id:1},players:Array.from({length:11},()=>({statistics:[{games:{minutes:90}}]}))}]};
 const p={id:'af:1',name:'Portiere',club:'A',role:'P',onField:true,needsReview:true,warnings:['penalty-save-undocumented']};const result=finalReadiness(raw,[p],[{p,vote:{needsReview:true}}]);assert.equal(result.complete,false);assert.equal(result.issues[0].team,'B');assert.equal(result.issues[1].name,'Portiere');assert.match(JSON.stringify(result),/penalty-save-undocumented/);
});

test('postcard is an escaped HTML recap of the winner with picks, results, stake and return; no download or canvas',()=>{
 const league={name:'Bar <unsafe>',members:[{uid:'winner',name:'Campione'}],rounds:[{id:'old',title:'Giornata 10',closed:true,matches:[{id:'m',home:'A',away:'B',status:'FT',score:[2,0]}],publicSlips:[{uid:'winner',picks:{m:'1'},stake:10,prize:20}]}],community:{seriea:{recap:{round:'old',winners:['winner'],points:1},history:[{id:'old',players:[{uid:'winner',correct:1,total:1,points:1}]}]}}};
 const html=createVerdictCard(league,'seriea');assert.match(html,/Bar &lt;unsafe&gt;/);assert.match(html,/Campione/);assert.match(html,/2 – 0/);assert.match(html,/Indovinata/);assert.match(html,/20 cr/);assert.doesNotMatch(html,/canvas|download|\.png|blob:/);
});

test('Oggi retains a clickable completed round while the next round is open; explicitly selected old slip stays selectable',()=>{
 const old={id:'old',title:'Giornata 10',number:10,source:'seriea',kickoff:'2026-10-01T12:00Z',settled:true,matches:[{id:'m',home:'A',away:'B',kickoff:'2026-10-01T12:00Z',status:'FT',score:[1,0]}]},next={id:'next',number:11,title:'Giornata 11',source:'seriea',kickoff:'2099-01-01',matches:[{id:'n',odds:{1:2,X:3,2:4}}]},l={id:'l',name:'Lega',members:[{uid:'u',credits:500}],rounds:[next,old]},state={calendar:{rounds:[]}};
 assert.match(leagueDashboard(l,{id:'u',name:'Utente'},'seriea',false,String,String),/data-dashboard-slip="old"/);
 const source=fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8'),body=source.slice(source.indexOf('function availableRounds()'),source.indexOf('\nfunction me()')),ctx={L:()=>l,slipCreditReserve,alignSlipSchedule,slipWaitingForPrevious,publicSlipView:()=>false,sourceScope:'seriea',competitionScope:null,selectedRoundId:'old',selectableSlipRounds,selectablePublicSlipRounds,sourceOf,currentSlipRound,defaultSlipRound,currentPublicSlipRound,state,Date};vm.createContext(ctx);vm.runInContext(body+'\nselected=R().id;',ctx);assert.equal(ctx.selected,'old');
});

test('Bar and Fanta share a compact league selector away from balances and settings',()=>{
 const bar=renderLeagueChip({id:'l',name:'Lega'},'u',String,String,'<button>Bar Fanta</button>');
 const fanta=topBar({mode:'fanta',league:{id:'l',name:'Lega'}});
 for(const html of [bar,fanta]){
  const {document}=parseHTML(html);
  assert.ok(document.querySelector('.shell-compact .v2-league-chip'));
  assert.equal(document.querySelector('.settings-entry,.v2-credits'),null);
 }
});

test('the official Bologna–Monza save correction requires the exact event and preserves provider comments',()=>{
 const event={type:'Goal',detail:'Missed Penalty',player:{id:1649},team:{id:1579},time:{elapsed:81},comments:null};
 const raw={fixture:{id:1550179},league:{season:2026},teams:{home:{id:500},away:{id:1579}},events:[event]};
 applyVerifiedFixtureEvents({...raw,fixture:{id:9}});assert.equal(event.comments,null);
 applyVerifiedFixtureEvents(raw);assert.match(event.comments,/Saved by Łukasz Skorupski/);assert.match(event.verifiedSource,/legaseriea\.it/);
 event.comments='Provider confirms the save';applyVerifiedFixtureEvents(raw);assert.equal(event.comments,'Provider confirms the save');
});
