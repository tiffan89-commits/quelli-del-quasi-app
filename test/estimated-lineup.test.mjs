import test from 'node:test';import assert from 'node:assert/strict';
import {selectEstimatedLineup} from '../lib/estimated-lineup.mjs';import {enrichPresence} from '../lib/lineup-presence.mjs';import {normalizePitchLayout,explicitPitchRows} from '../public/src/pitch-layout.mjs';
const p=(id,role,probability,more={})=>({playerId:'af:'+id,apiId:id,name:'Giocatore '+id,role,probability,...more});
test('higher estimates replace the weakest compatible starters, retain each exact slot and move outgoing players to available',()=>{
 const team={players:[p(1,'P',60,{grid:'1:1'}),p(2,'D',20,{grid:'2:1'}),p(3,'D',50,{grid:'2:2'}),p(4,'C',40,{grid:'3:4'})],bench:[p(5,'D',90,{grid:'5:1'}),p(6,'D',70),p(7,'C',65),p(8,'A',90)]};
 const before=structuredClone(team),out=selectEstimatedLineup(team);assert.deepEqual(out.players.map(p=>p.apiId),[1,5,6,7]);assert.deepEqual(out.players.map(p=>p.grid),['1:1','2:1','2:2','3:4']);assert.deepEqual(out.bench.map(p=>p.apiId).sort(),[2,3,4,8]);assert.ok(out.bench.every(p=>!p.grid));assert.deepEqual(team,before);assert.equal(out.forecastBase[1].apiId,2);
});
test('ties, unknown estimates, unavailable/inactive players and incompatible roles do not cause arbitrary changes',()=>{
 const out=selectEstimatedLineup({players:[p(1,'D',90),p(2,'C',null),p(3,'A',80)],bench:[p(4,'D',90),p(5,'C',90),p(6,'A',90,{availability:'injured'}),p(7,'A',90,{active:false}),p(8,'P',90)]});assert.deepEqual(out.players.map(p=>p.apiId),[1,2,3]);assert.equal(out.selectionChanges.length,0);
 const unavailable=selectEstimatedLineup({players:[p(1,'D',null,{availability:'suspended',grid:'2:1'})],bench:[p(2,'D',20)]});assert.equal(unavailable.players[0].apiId,2);assert.equal(unavailable.players[0].grid,'2:1');assert.equal(unavailable.bench.length,0);
});
test('full roster estimates drive the XI even for candidates absent from the editorial bench; repeat is stable and official wins',()=>{
 const roles=['P',...Array(4).fill('D'),...Array(4).fill('C'),...Array(2).fill('A')],players=roles.map((role,i)=>p(i+1,role,i===1?20:90)),team=normalizePitchLayout({team:'Juventus',formation:'4-4-2',players,bench:[]}),lineups={kind:'probable',teams:[team]};
 const catalog=[...players,p(20,'D',85),p(21,'D',90,{status:{type:'injured'}}),p(22,'C',90)].map(x=>({...x,id:x.playerId,club:'Juventus',stats:{minutes:x.probability*9,teamMatches:10}}));catalog.push({...catalog.find(p=>p.apiId===20),id:'af:30',playerId:'af:30',apiId:30,club:'Inter'});
 const before=structuredClone(lineups),one=enrichPresence(lineups,catalog),t=one.teams[0];assert.equal(t.players[1].apiId,20);assert.equal(t.players[1].grid,'2:1');assert.ok(t.bench.some(p=>p.apiId===2));assert.ok(!t.players.some(p=>[21,30].includes(p.apiId)));assert.equal(new Set(t.players.map(p=>p.apiId)).size,11);assert.ok(explicitPitchRows(t));assert.deepEqual(t.players.map(p=>p.role),roles);assert.deepEqual(enrichPresence(one,catalog),one);assert.deepEqual(lineups,before);
 const newer=catalog.map(p=>p.apiId===20?{...p,stats:{minutes:90,teamMatches:10}}:p.apiId===2?{...p,stats:{minutes:810,teamMatches:10}}:p);assert.equal(enrichPresence(one,newer).teams[0].players[1].apiId,2,'new estimates can restore the original starter');
 const official=enrichPresence({...lineups,kind:'official'},catalog);assert.deepEqual(official.teams[0].players.map(p=>p.apiId),players.map(p=>p.apiId));assert.ok(official.teams[0].players.every(p=>p.probability===100));assert.equal(official.teams[0].xiModel,undefined);
});
