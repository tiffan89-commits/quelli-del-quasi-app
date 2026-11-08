import test from 'node:test';
import assert from 'node:assert/strict';
import {currentObjectiveRound} from '../public/src/day-objectives.mjs';
import {renderSlipV2} from '../public/src/v2/slip-v2.mjs';
const esc=String,fmt=n=>String(n);
test('objectives ignore undated placeholder13 and select upcoming playable11',()=>{
 const rounds=[{id:'13',title:'Giornata 13',kickoff:'1970-01-01T00:00:00Z',matches:[{}]},{id:'11',title:'Giornata 11',kickoff:'2026-11-06T19:45:00Z',matches:[{}]}];
 assert.equal(currentObjectiveRound({rounds},'seriea',null,Date.parse('2026-11-02T12:00:00Z')).id,'11');
});
test('slip displays the odds without the server point offers',()=>{
 const round={kickoff:'2099-01-01T12:00:00Z',rules:{maxStake:20},matches:[{id:'m',home:'Casa',away:'Ospite',odds:{'1':2},pointOffers:{'1':{correct:1.25,wrong:-.75}}}]};
 const html=renderSlipV2({round,esc,fmt,date:String});assert.match(html,/Quota 2/);assert.doesNotMatch(html,/\+1,25|−0,75|punti se corretto/);
});
