import test from 'node:test';
import assert from 'node:assert/strict';
import {closeBarMatches} from '../lib/operations/round-closure.mjs';
import {settle} from '../lib/game.mjs';

test('deadline settles with recorded finals and refunds picks without a score or price',()=>{
 const fixtures=[
  {id:'known',status:'FT',score:[2,0],odds:{1:2}},
  {id:'stale',status:'LIVE',liveScore:[1,0],odds:{1:3}},
  {id:'unpriced',status:'FT',score:[1,0],odds:{}},
 ];
 const round={number:11,season:2026,requiresOfficialScores:true,kickoff:'2026-11-07T15:00Z',league:'bar',rules:{},matches:structuredClone(fixtures),slips:[
  {uid:'winner',picks:{known:'1',stale:'1',unpriced:'1'},stake:10},
  {uid:'refund',picks:{stale:'1',unpriced:'1'},stake:10},
 ]};
 const league={id:'bar',members:[{uid:'winner',points:0,credits:90},{uid:'refund',points:0,credits:90}]};
 const state={football:{calendar:{season:2026,rounds:[{number:11,matches:fixtures}]}},rounds:[round],ledger:[]};
 const job={season:2026,round:11,fixtureIds:fixtures.map(f=>f.id),cutoffAt:'2026-11-09T22:00Z'};
 assert.deepEqual(closeBarMatches(state,job),{closed:3,voided:1});
 for(const match of round.matches)Object.assign(match,fixtures.find(f=>f.id===match.id));
 assert.equal(settle(state,league,round),true);
 assert.deepEqual(round.slips.map(s=>[s.points,s.prize,s.voidPicks]),[[2,20,['unpriced']],[0,10,['unpriced']]]);
 assert.deepEqual(league.members.map(m=>m.credits),[110,100]);
 assert.equal(fixtures[1].liveScore,null);
 closeBarMatches(state,job);
 assert.equal(settle(state,league,round),false);
 assert.deepEqual(league.members.map(m=>m.credits),[110,100]);
});
