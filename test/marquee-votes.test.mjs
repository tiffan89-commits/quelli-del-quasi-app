import {evaluateMarquee} from '../fanta/statistical-votes/marquee.mjs';
import {voteConfig} from '../fanta/statistical-votes/config.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeFixture,calculateVote} from '../fanta/votes.mjs';
import fs from 'node:fs/promises';
function fixture({home=496,away=492,assist=false}={}){const player=(id,rating)=>({player:{id,name:'Player '+id},statistics:[{games:{minutes:90,position:'F',rating},shots:{total:2,on:1},goals:{total:id===2?1:0,assists:id===3?1:0},passes:{total:30,accuracy:'25',key:1},tackles:{total:0,interceptions:0},duels:{total:6,won:3},dribbles:{attempts:1,success:1},fouls:{drawn:0,committed:0},cards:{yellow:0,red:0}}]});return {fixture:{id:12,date:'2026-11-01T20:45:00+01:00',status:{short:'FT',elapsed:90}},league:{id:135,season:2026},teams:{home:{id:home,name:'Juventus'},away:{id:away,name:'Napoli'}},goals:{home:0,away:1},players:[{team:{id:home},players:[player(1,'6')]},{team:{id:away},players:[player(2,assist?'8':'9'),player(3,assist?'9':'7')]}],events:[{type:'Goal',detail:'Normal Goal',time:{elapsed:70},team:{id:away},player:{id:2},assist:assist?{id:3}:null}]};}
test('marquee context adds a continuous bonus for statistical MVP with decisive goal; all previous components stay unchanged',()=>{
 const p=normalizeFixture(fixture()).find(p=>p.apiId===2),a=calculateVote(p),b=calculateVote(p,{config:{marquee:{enabled:false}}});
 assert.ok(a.context.marquee.delta>.5&&a.context.marquee.delta<.75);assert.ok(Math.abs(a.rawVote-b.rawVote-a.context.marquee.delta)<.00001);assert.deepEqual(a.individual,b.individual);assert.equal(a.context.delta,b.context.delta);assert.deepEqual(a.ratingImpact,b.ratingImpact);assert.deepEqual(a.breakdown.bonus,b.breakdown.bonus);
});
test('decisive assist qualifies; verified young first year increases the continuous ceiling; missing career does not',()=>{
 const raw=fixture({assist:true}),get=profile=>normalizeFixture(raw,{}, {playerProfiles:{'af:3':profile}}).find(p=>p.apiId===3);
 const young=calculateVote(get({birthDate:'2006-01-01',firstItalySeason:2026,verified:true,source:'cached career history'})).context.marquee.delta,unknown=calculateVote(get({birthDate:'2006-01-01',firstItalySeason:2026,verified:false})).context.marquee.delta,older=calculateVote(get({birthDate:'1995-01-01',firstItalySeason:2026,verified:true})).context.marquee.delta;
 assert.ok(young>unknown&&young<1);assert.ok(unknown>.5&&unknown<.75);assert.equal(unknown,older);
 const input=get({birthDate:'2006-01-01',firstItalySeason:2026,verified:true}),options={config:voteConfig(),individual:{value:7},context:{}};const full=evaluateMarquee(input,options).delta;input.minutes=20;assert.ok(evaluateMarquee(input,options).delta<full);

});
test('no extra for ordinary fixture, non-MVP scorer, incomplete timeline, or provisional game',()=>{
 assert.equal(calculateVote(normalizeFixture(fixture({home:895})).find(p=>p.apiId===2)).context.marquee.delta,0);
 assert.equal(calculateVote(normalizeFixture(fixture({assist:true})).find(p=>p.apiId===2)).context.marquee.delta,0);
 const raw=fixture();raw.events=[];assert.equal(calculateVote(normalizeFixture(raw).find(p=>p.apiId===2)).context.marquee.delta,0);
 const live=fixture();live.fixture.status.short='2H';assert.equal(calculateVote(normalizeFixture(live).find(p=>p.apiId===2)).context.marquee.delta,0);
});
test('Bar slip markup removes result checks and losing strike-through only',async()=>{
 const source=await fs.readFile(new URL('../public/src/bar-slips.mjs',import.meta.url),'utf8'),css=await fs.readFile(new URL('../public/bar-slips.css',import.meta.url),'utf8');assert.doesNotMatch(source,/data-result-check/);assert.doesNotMatch(css,/text-decoration:line-through/);assert.match(source,/data-inline-result/);assert.match(css,/\.bar-bet\.lose/);assert.match(css,/\.bar-bet\.win/);
});

test('exceptional verified young debut can reach +1 without changing final rounding policy',()=>{const p=normalizeFixture(fixture(),{},{playerProfiles:{'af:2':{birthDate:'2008-01-01',firstItalySeason:2026,verified:true}}}).find(p=>p.apiId===2);p.context.marqueeEvidence.decisive[0].minute=90;const v=evaluateMarquee(p,{config:voteConfig(),individual:{value:8},context:{odds:{probabilities:{2:.2}}}});assert.equal(v.delta,1);});
