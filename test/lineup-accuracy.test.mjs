import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {advanceLineupAccuracy,summarizeLineupAccuracy,recordLineupAccuracy,lineupAccuracySummary,publicLineupAccuracy} from '../lib/lineup-accuracy.mjs';
import {fixtureDb} from './fanta/helpers.mjs';import {renderLineup} from '../public/src/lineup-pitch.mjs';import {createReadCache} from '../lib/read-cache.mjs';
const before=Date.parse('2026-11-04T12:00Z'),after=Date.parse('2026-11-06T21:00Z');
const match=(id='m')=>({id,home:'Juventus',away:'Inter',kickoff:'2026-11-06T20:00Z',lineups:{kind:'probable',method:'recent-form-v3',updatedAt:new Date(before).toISOString(),teams:['Juventus','Inter'].map((team,j)=>({team,players:Array.from({length:11},(_,i)=>({apiId:j*100+i+1,name:'Calciatore '+j+' '+i}))}))}});
const actual=m=>{const x=structuredClone(m);x.status='LIVE';x.lineups.kind='official';x.lineups.updatedAt=new Date(after).toISOString();x.lineups.teams[0].players[9].apiId=901;x.lineups.teams[0].players[10].apiId=902;x.lineups.teams[1].players[10].apiId=1901;return x;};
test('accuracy freezes before kickoff, scores 9/11 and 10/11 by permanent IDs, rejects leakage and incomplete or ambiguous XIs',()=>{
 const m=match(),pred=advanceLineupAccuracy(null,m,{now:before}),result=advanceLineupAccuracy(pred,actual(m),{now:after});
 assert.equal(result.comparison.correct,19);assert.equal(result.comparison.total,22);assert.deepEqual(result.comparison.teams.map(t=>t.correct),[9,10]);
 assert.deepEqual(advanceLineupAccuracy(result,m,{now:before+1}),result,'a known official XI prevents further forecast changes');
 assert.equal(advanceLineupAccuracy(null,actual(m),{now:after}),null,'never backfill a prediction from an actual lineup');
 assert.equal(advanceLineupAccuracy(null,m,{now:after}),null,'never capture forecasts after kickoff');
 const incomplete=match();incomplete.lineups.teams[0].players.pop();assert.equal(advanceLineupAccuracy(null,incomplete,{now:before}),null);
 const ambiguous=match();ambiguous.lineups.teams[0].players[0].apiId=2;assert.equal(advanceLineupAccuracy(null,ambiguous,{now:before}),null);
 const noId=match();delete noId.lineups.teams[0].players[0].apiId;assert.equal(advanceLineupAccuracy(null,noId,{now:before}),null);
 const renamed=actual(m);renamed.lineups.teams.forEach(t=>t.players.forEach(p=>p.name='Alias diverso'));assert.deepEqual(advanceLineupAccuracy(result,renamed,{now:after+1000}),result);
});
test('ten distinct fixtures enable the label; repeated fixtures, future kickoffs and partial data do not pad the sample',()=>{
 const records=Array.from({length:10},(_,i)=>{const m=match('m'+i);return advanceLineupAccuracy(advanceLineupAccuracy(null,m,{now:before}),actual(m),{now:after});});
 assert.equal(summarizeLineupAccuracy(records.slice(0,9),{now:after}).visible,false);
 const s=summarizeLineupAccuracy([...records,records[0]],{now:after});assert.equal(s.validMatches,10);assert.equal(s.totalPlayers,220);assert.equal(s.correctPlayers,190);assert.equal(s.accuracyPct,86.4);assert.equal(s.visible,true);
 assert.equal(summarizeLineupAccuracy(records,{now:before}).validMatches,0);
 assert.equal(summarizeLineupAccuracy(records.map(r=>({...r,status:'PST'})),{now:after}).validMatches,0);
 assert.equal(summarizeLineupAccuracy(records.map(r=>({...r,status:'NS'})),{now:after}).validMatches,0);
 const l=match().lineups;const hidden=renderLineup({lineups:{...l,accuracy:{validMatches:9,accuracyPct:86.4}}});assert.doesNotMatch(hidden,/Accuratezza degli 11/);
 const {document}=parseHTML(renderLineup({lineups:{...l,accuracy:{validMatches:10,accuracyPct:86.4}}}));assert.match(document.querySelector('.lineup-accuracy').textContent,/86,4%.*10 partite/);
});
test('backend audit is durable and idempotent, keeps game data intact and public summary is cached',async()=>{
 const f=await fixtureDb();try{
  const original=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload,inputs=Array.from({length:10},(_,i)=>match('m'+i));let writes=0,reads=0;
  const connect=async()=>{const c=await f.connect();return {...c,query:(sql,args)=>{if(sql.startsWith('INSERT'))writes++;if(sql.includes("AS data FROM fanta.jobs WHERE id LIKE"))reads++;return c.query(sql,args);}};};
  assert.equal((await recordLineupAccuracy(inputs,{connect,now:before})).captured,10);writes=0;
  assert.equal((await recordLineupAccuracy(inputs,{connect,now:before+60000})).changed,0);assert.equal(writes,0);
  assert.equal((await recordLineupAccuracy(inputs.slice(0,9).map(actual),{connect,now:after})).evaluated,9);assert.equal(await publicLineupAccuracy({connect,cache:null,now:after}),null);
  await recordLineupAccuracy([actual(inputs[9])],{connect,now:after});assert.equal((await lineupAccuracySummary({connect,now:after})).accuracyPct,86.4);
  const cache=createReadCache({now:()=>after});reads=0;assert.equal((await publicLineupAccuracy({connect,cache,now:after})).validMatches,10);await publicLineupAccuracy({connect,cache,now:after});assert.equal(reads,1);
  writes=0;await recordLineupAccuracy(inputs.map(actual),{connect,now:after+60000});assert.equal(writes,0);assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload,original);
 }finally{await f.close();}
});
