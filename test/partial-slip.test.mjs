import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {placeSlip,settle,priceSlip} from '../lib/game.mjs';
import {describeSavedSlip} from '../lib/player-analysis.mjs';
import {slipSummary} from '../public/src/slip-state.mjs';
import {renderSlipV2} from '../public/src/v2/slip-v2.mjs';
import {patchSlipResults} from '../public/src/slip-results.mjs';
import {barSlipsView} from '../public/src/bar-slips.mjs';
const now=Date.now(),future=i=>new Date(now+(i+1)*3600000).toISOString();
function fixture(){
 const u={id:'me'},l={id:'league',members:[{uid:u.id,credits:500,points:0}]},r={id:'round',league:l.id,source:'seriea',number:1,eventBetting:true,kickoff:future(0),slips:[],rules:{mode:'classic',correct:1,wrong:-1,maxStake:20},matches:Array.from({length:10},(_,i)=>({id:'m'+i,kickoff:future(i),home:'Casa '+i,away:'Ospiti '+i,status:'NS',odds:{1:2,X:3,2:4}}))};
 return {u,l,r,s:{leagues:[l],rounds:[r],ledger:[]}};
}
test('3 from 10 pay only the selected accumulator, without penalties for the seven skipped fixtures',()=>{
 const {u,l,r,s}=fixture(),picks={m0:'1',m4:'1',m9:'1'};
 placeSlip(s,l,r,u,{picks,stake:60},{now});
 const slip=r.slips[0];assert.equal(slip.odds,8);assert.equal(l.members[0].credits,440);
 const portrait=describeSavedSlip(r,slip,{now});assert.equal(portrait.omitted,7);assert.equal(portrait.pending,3);assert.match(portrait.short,/7 partite saltate.*Fifone/);
 r.kickoff=new Date(now-10000).toISOString();
 r.matches.forEach(m=>{m.status='FT';m.score=[1,0];});
 assert.equal(settle(s,l,r),true);assert.equal(slip.points,3);assert.equal(slip.prize,480);assert.equal(l.members[0].credits,920);
 assert.equal(settle(s,l,r),false);assert.equal(l.members[0].credits,920);
});
test('individual kickoff protects earlier picks, accepted odds and stake while the next fixture remains editable',()=>{
 const {u,l,r,s}=fixture();
 placeSlip(s,l,r,u,{picks:{m0:'1'},stake:25},{now});
 const late=now+3600001,baseSavedAt=r.slips[0].savedAt;
 r.matches[0].odds['1']=4;
 assert.throws(()=>placeSlip(s,l,r,u,{picks:{m0:'X',m1:'1'},stake:25},{now:late}),/chiuso/);
 assert.throws(()=>placeSlip(s,l,r,u,{picks:{m1:'1'},stake:25},{now:late}),/chiuso/);
 assert.throws(()=>placeSlip(s,l,r,u,{picks:{m0:'1',m1:'1'},stake:26},{now:late}),/puntata è bloccata/);
 assert.throws(()=>placeSlip(s,l,r,u,{picks:{m1:'1'},stake:501},{now}),/insufficienti/);
 placeSlip(s,l,r,u,{picks:{m0:'1',m1:'1'},stake:25,baseSavedAt},{now:late});
 assert.equal(r.slips[0].acceptedOdds.m0,2);assert.equal(priceSlip(r,r.slips[0]).odds,4);assert.equal(l.members[0].credits,475);
 assert.equal(slipSummary({...r,closed:true,slip:r.slips[0]},{m0:'X',m1:'X'},25,475,late).picks.m0,'1');
});
test('partial Bar slip shows the Italian kickoff per match and has no fixed stake cap; six Fanta outcomes render without flip',()=>{
 const {r}=fixture();r.matches[0].kickoff=new Date(now-1000).toISOString();
 const doc=parseHTML(renderSlipV2({round:{...r,closed:true},picks:{m1:'1'},stake:50,credits:500,esc:String,fmt:String,date:String})).document;
 assert.equal(doc.querySelectorAll('.slip-match-kickoff').length,10);
 assert.equal(doc.querySelector('[data-match-card=m1] time').getAttribute('datetime'),r.matches[1].kickoff);
 const time=doc.querySelector('[data-match-card=m0] time');
 r.matches[0].kickoff='2026-11-07T14:00:00Z';
 patchSlipResults(doc,r,{m1:'1'},false);
 assert.equal(time.textContent,'Sab 7 nov 26 15:00');
 assert.equal(doc.querySelectorAll('[data-slip-event-at]').length,0);
 assert.ok(doc.querySelector('[data-pick=m0]').disabled);
 assert.equal(doc.querySelector('[data-pick=m1]').disabled,false);
 assert.equal(doc.querySelector('#stake').getAttribute('max'),'500');
 assert.equal(doc.querySelector('#save-slip').disabled,false);
 assert.match(doc.querySelector('[data-os-footer]').textContent,/Quota in arrivo/);
 r.matches=r.matches.slice(0,6);r.publicSlips=[{uid:'me',picks:{m1:'1'},stake:50}];r.closed=true;
 const other=parseHTML(barSlipsView({l:{members:[]},r,uid:'me',fmt:String,rounds:[r],sourceOf:()=> 'fantacalcio',compact:true})).document;
 assert.equal(other.querySelectorAll('.bar-bet').length,6);
 assert.match(other.querySelector('.bar-bets').getAttribute('style'),/matches:6/);
 assert.equal(other.querySelector('[data-pitch-flip]'),null);
 assert.equal(other.querySelector('[data-os-strip]'),null);
});
