import test from 'node:test';import assert from 'node:assert/strict';
import {predictionStatus} from '../public/prediction.mjs';
import {ensureCalendar} from '../lib/calendar.mjs';
import {DEFAULT_RULES,settle} from '../lib/game.mjs';
const now=new Date('2026-10-29T22:00:00Z');
const live=score=>({status:'LIVE',liveScore:score});
test('locked slip colours the chosen outcome against the live score and reverses when scores change',()=>{
 assert.equal(predictionStatus(live([1,0]),'1',true).className,'pick-winning');assert.equal(predictionStatus(live([1,1]),'1',true).className,'pick-losing');assert.equal(predictionStatus(live([1,1]),'1',true).live,true);assert.equal(predictionStatus(live([1,1]),'X',true).winning,true);
});
test('every selectable market has provisional win and loss display',()=>{
 for(const [p,win,loss]of [['1',[2,0],[0,1]],['X',[0,0],[1,0]],['2',[0,1],[1,0]],['1X',[1,1],[0,1]],['12',[1,0],[1,1]],['X2',[0,0],[1,0]],['Goal',[1,1],[1,0]],['No Goal',[0,2],[1,1]],['Under 2.5',[1,1],[2,1]],['Over 2.5',[2,1],[1,1]]]){assert.equal(predictionStatus(live(win),p,true).winning,true,p);assert.equal(predictionStatus(live(loss),p,true).winning,false,p)}
});
test('no premature red/green on open slips, missing scores or void matches',()=>{
 assert.equal(predictionStatus(live([1,0]),'1',false),null);assert.equal(predictionStatus({status:'NS'},'1',true),null);assert.equal(predictionStatus({...live([1,0]),void:true},'1',true),null);assert.equal(predictionStatus(live(null),'1',true),null);
});
test('final display distinguishes pending provider confirmation from confirmed final',()=>{
 assert.match(predictionStatus({status:'FT',score:[2,0]},'1',true).note,/attesa/);assert.match(predictionStatus({status:'FT',score:[2,0],officialConfirmed:true},'1',true).note,/confermato/);
});
function setup(){const s={users:[],leagues:[],rounds:[],ledger:[],football:{fixtures:{},rounds:{},quota:{used:20,remaining:480}}};ensureCalendar(s);const m=s.football.calendar.rounds[8].matches[0];Object.assign(m,{providerId:'provider-id',kickoff:'2026-10-29T19:00:00Z',status:'FT',score:[1,0],officialConfirmed:false});return {s,m}}
test('official rounds cannot settle points or winnings from unconfirmed secondary finals',()=>{
 const l={id:'l',members:[{uid:'u',credits:490,points:0}]},s={ledger:[]};const r={kickoff:'2000-01-01',requiresOfficialScores:true,rules:structuredClone(DEFAULT_RULES),matches:[{id:'m',status:'FT',score:[1,0],odds:{'1':2}}],slips:[{uid:'u',picks:{m:'1'},stake:10}]};assert.equal(settle(s,l,r),false);assert.equal(l.members[0].points,0);r.matches[0].officialConfirmed=true;assert.equal(settle(s,l,r),true);assert.equal(l.members[0].credits,510);
});
