import test from 'node:test';import assert from 'node:assert/strict';
import {currentSlipRound,defaultSlipRound,selectableSlipRounds,slipRoundLastDay,isClosed} from '../public/src/slip-state.mjs';
const rounds=[{id:'old',number:9,kickoff:'2026-10-23T18:45Z',settled:true,matches:[{kickoff:'2026-10-26T19:45Z',status:'FT'}]},{id:'current',number:10,kickoff:'2026-10-31T14:00Z',settled:true,closed:true,matches:[{kickoff:'2026-10-31T14:00Z',status:'FT'},{kickoff:'2026-11-02T19:45Z',status:'FT',finishedAt:'2026-11-02T21:50Z'}]},{id:'next',number:11,kickoff:'2026-11-06T19:45Z',matches:[{kickoff:'2026-11-06T19:45Z',status:'NS'}]}];
test('current sporting day advances at midnight, but every completed slip stays in the dropdown',()=>{
 const before=Date.parse('2026-11-02T22:59:59Z'),after=Date.parse('2026-11-02T23:00:00Z');assert.equal(currentSlipRound(rounds,before).id,'current');assert.deepEqual(selectableSlipRounds(rounds,before).map(r=>r.id),['old','current']);assert.equal(currentSlipRound(rounds,after).id,'next');assert.deepEqual(selectableSlipRounds(rounds,after).map(r=>r.id),['old','current']);assert.equal(isClosed(rounds[1],before),true);
 const unofficial=rounds.map(r=>({...r,settled:false}));assert.equal(currentSlipRound(unofficial,after).id,'next','07:00 official calculations must not delay navigation');
});
test('Fanta uses the last actual Serie A match rather than its earlier slip deadline or morning calculation',()=>{
 const fantasy=rounds.map(r=>({...r,id:'fanta-'+r.id,source:'fantacalcio',serieARound:r.number,number:r.number-2,matches:[{status:r.settled?'FT':'NS'}]})),calendar={rounds};
 assert.equal(currentSlipRound(fantasy,Date.parse('2026-11-02T22:59Z'),calendar).id,'fanta-current');assert.equal(currentSlipRound(fantasy,Date.parse('2026-11-02T23:00Z'),calendar).id,'fanta-next');assert.equal(slipRoundLastDay(fantasy[1],calendar),'2026-11-02');
});
test('late finishes, summer time and backfilled timestamps respect Rome midnight without locking on postponed older rounds',()=>{
 const late={id:'late',number:1,kickoff:'2026-06-01T21:00Z',settled:true,matches:[{kickoff:'2026-06-01T21:00Z',status:'FT',finishedAt:'2026-06-01T23:05Z'}]},next={id:'next',number:2,kickoff:'2026-06-08T18:45Z',matches:[{kickoff:'2026-06-08T18:45Z'}]};
 assert.equal(slipRoundLastDay(late),'2026-06-02');assert.equal(currentSlipRound([late,next],Date.parse('2026-06-02T21:59:59Z')).id,'late');assert.equal(currentSlipRound([late,next],Date.parse('2026-06-02T22:00Z')).id,'next');
 const old={...rounds[0],matches:[{kickoff:'2026-10-23T18:45Z',status:'FT',finishedAt:'2026-11-02T10:00Z'}]};assert.equal(slipRoundLastDay(old),'2026-10-23');assert.equal(currentSlipRound([old,...rounds.slice(1)],Date.parse('2026-11-02T22:00Z')).id,'current');
 const postponed={...rounds[0],settled:false,matches:[...rounds[0].matches,{kickoff:'2026-12-01T18:00Z',status:'PST'}]};assert.equal(currentSlipRound([postponed,...rounds.slice(1)],Date.parse('2026-11-02T22:00Z')).id,'current');
});

test('every slip subsection defaults to the same open round and hides future rounds without odds',async()=>{
 const {currentPublicSlipRound,selectablePublicSlipRounds}=await import('../public/src/slip-state.mjs');
 for(const variant of [rounds,rounds.map(r=>({...r,source:'fantacalcio',serieARound:r.number,number:r.number-2}))]){
  const calendar={rounds},afterMidnight=Date.parse('2026-11-03T10:00Z'),kickoff=Date.parse(rounds[2].kickoff);
  assert.equal(currentSlipRound(variant,afterMidnight,calendar).id,'next');assert.equal(currentPublicSlipRound(variant,afterMidnight,calendar).id,'current');assert.deepEqual(selectablePublicSlipRounds(variant,afterMidnight,calendar).map(r=>r.id),['old','current']);
  const priced=variant.map(r=>r.id==='next'?{...r,matches:r.matches.map(m=>({...m,odds:{1:2,X:3,2:4}}))}:r);
  assert.equal(defaultSlipRound(priced,afterMidnight,calendar).id,'next');assert.equal(currentPublicSlipRound(priced,kickoff-1,calendar).id,'next');assert.deepEqual(selectablePublicSlipRounds(priced,afterMidnight,calendar).map(r=>r.id),['old','current','next']);
  const waiting=priced.map(r=>({...r,publicChoicesAvailable:false}));assert.equal(currentPublicSlipRound(waiting,kickoff,calendar).id,'next');assert.equal(isClosed(variant[2],kickoff),true);
 }
});
test('verdict does not label the previous winners as the new matchday result',async()=>{
 const {communityView}=await import('../public/src/community.mjs');const league={members:[{uid:'u',name:'Mister'}],community:{seriea:{recap:{round:'current',title:'Giornata 10',winners:['u'],points:8,participants:1,almost:[]},history:[],honours:[]}}};
 const old=communityView(league,'seriea',{id:'u'},null,String,String,null,{...rounds[1],title:'Giornata 10'});assert.match(old,/Mister/);assert.match(old,/8 punti/);
 const next=communityView(league,'seriea',{id:'u'},null,String,String,null,{...rounds[2],title:'Giornata 11',closed:true});assert.match(next,/Giornata 11 · in corso/);assert.doesNotMatch(next,/8 punti/);
});
