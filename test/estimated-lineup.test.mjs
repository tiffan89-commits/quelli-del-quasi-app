import test from 'node:test';import assert from 'node:assert/strict';
import {selectEstimatedLineup} from '../lib/estimated-lineup.mjs';import {enrichPresence} from '../lib/lineup-presence.mjs';import {normalizePitchLayout,explicitPitchRows} from '../public/src/pitch-layout.mjs';
const p=(id,role,probability,more={})=>({playerId:'af:'+id,apiId:id,name:'Giocatore '+id,role,footballPosition:role,probability,...more});
test('higher estimates do not replace any available starter in the source formation',()=>{
 const team={players:[p(1,'P',60,{grid:'1:1'}),p(2,'D',20,{grid:'2:1'}),p(3,'D',50,{grid:'2:2'}),p(4,'C',40,{grid:'3:4'})],bench:[p(5,'D',90,{grid:'5:1'}),p(6,'D',70),p(7,'C',65),p(8,'A',90)]};
 const before=structuredClone(team),out=selectEstimatedLineup(team);assert.deepEqual(out.players.map(p=>p.apiId),[1,2,3,4]);assert.deepEqual(out.players.map(p=>p.grid),['1:1','2:1','2:2','3:4']);assert.deepEqual(out.bench.map(p=>p.apiId).sort(),[5,6,7,8]);assert.ok(out.bench.every(p=>!p.grid));assert.deepEqual(team,before);assert.equal(out.forecastBase[1].apiId,2);
});
test('ties, unknown estimates, unavailable/inactive players and incompatible roles do not cause arbitrary changes',()=>{
 const out=selectEstimatedLineup({players:[p(1,'D',90),p(2,'C',null),p(3,'A',80)],bench:[p(4,'D',90),p(5,'C',90),p(6,'A',90,{availability:'injured'}),p(7,'A',90,{active:false}),p(8,'P',90)]});assert.deepEqual(out.players.map(p=>p.apiId),[1,2,3]);assert.equal(out.selectionChanges.length,0);
 const unavailable=selectEstimatedLineup({players:[p(1,'D',null,{availability:'suspended',grid:'2:1'})],bench:[p(2,'D',20)]});assert.equal(unavailable.players[0].apiId,2);assert.equal(unavailable.players[0].grid,'2:1');assert.equal(unavailable.bench.length,0);
});
test('a rejected defender leaves a specific slot and a compatible available player can complete the formation',()=>{
 const roles=['P',...Array(4).fill('D'),...Array(5).fill('C'),'A'];
 const team=normalizePitchLayout({team:'Milan',formation:'4-4-1-1',players:roles.map((role,i)=>p(i+1,role,90))});
 const third=team.players.find(p=>p.grid==='2:2');
 const catalog=[...team.players.filter(p=>p!==third),p(20,'D',85,{shirtName:'Difensore'}),p(21,'D',90,{status:{type:'injured'}}),p(22,'C',90)]
  .map(x=>({...x,id:x.playerId,club:'Milan',stats:{minutes:x.probability*9,teamMatches:10}}));
 const expected=enrichPresence({kind:'probable',teams:[team]},catalog).teams[0];
 assert.equal(expected.players.length,11);
 assert.equal(expected.players.find(p=>p.grid==='2:2').shirtName,'Difensore');
 assert.ok(!expected.bench.some(p=>p.apiId===20));
 assert.equal(expected.selectionChanges.at(-1).reason,'vacant-slot');
});
test('a different Fanta role leaves the source starter in place and never blocks filling the other defensive slot',()=>{
 const roles=['P',...Array(3).fill('D'),...Array(5).fill('C'),'A','A'];
 const source=normalizePitchLayout({team:'Parma',formation:'3-5-2',players:roles.map((role,i)=>p(i+1,role,90))});
 const partial={...source,players:source.players.filter(p=>p.grid!=='2:3')};
 const catalog=[...partial.players.map(p=>p.apiId===2?{...p,name:'Carboni',role:'C',probability:10}:p),p(20,'C',95),p(21,'C',80,{footballPosition:'Defender'}),p(22,'D',95,{footballPosition:'Midfielder'})]
  .map(x=>({...x,id:x.playerId,club:'Parma',stats:{minutes:x.probability*9,teamMatches:10}}));
 const input={kind:'probable',teams:[partial]},output=enrichPresence(input,catalog),team=output.teams[0];
 assert.equal(team.players.length,11);
 assert.deepEqual(team.players.filter(p=>p.grid.startsWith('2:')).map(p=>[p.apiId,p.role,p.footballPosition]),[[2,'C','D'],[3,'D','D'],[21,'C','D']]);
 assert.ok(team.bench.some(p=>p.apiId===20));assert.ok(team.bench.some(p=>p.apiId===22));
 assert.deepEqual(enrichPresence(output,catalog),output);
});
test('club football positions cover a genuinely unavailable starter; repeat is stable and official wins',()=>{
 const roles=['P',...Array(4).fill('D'),...Array(4).fill('C'),...Array(2).fill('A')],players=roles.map((role,i)=>p(i+1,role,i===1?20:90)),team=normalizePitchLayout({team:'Juventus',formation:'4-4-2',players,bench:[]}),lineups={kind:'probable',teams:[team]};
 const catalog=[...players,p(20,'D',85),p(21,'D',90,{status:{type:'injured'}}),p(22,'C',90)].map(x=>({...x,id:x.playerId,club:'Juventus',stats:{minutes:x.probability*9,teamMatches:10},...(x.apiId===2?{status:{type:'injured'}}:{})}));catalog.push({...catalog.find(p=>p.apiId===20),id:'af:30',playerId:'af:30',apiId:30,club:'Inter'});
 const before=structuredClone(lineups),one=enrichPresence(lineups,catalog),t=one.teams[0];assert.equal(t.players[1].apiId,20);assert.equal(t.players[1].grid,'2:1');assert.ok(!t.bench.some(p=>p.apiId===2));assert.ok(!t.players.some(p=>[21,30].includes(p.apiId)));assert.equal(new Set(t.players.map(p=>p.apiId)).size,11);assert.ok(explicitPitchRows(t));assert.deepEqual(t.players.map(p=>p.role),roles);assert.deepEqual(enrichPresence(one,catalog),one);assert.deepEqual(lineups,before);
 const newer=catalog.map(p=>p.apiId===2?{...p,status:{type:'ok'}}:p);assert.equal(enrichPresence(one,newer).teams[0].players[1].apiId,2,'a recovered source starter returns to the original slot');
 const official=enrichPresence({...lineups,kind:'official'},catalog);assert.deepEqual(official.teams[0].players.map(p=>p.apiId),players.map(p=>p.apiId));assert.ok(official.teams[0].players.every(p=>p.probability===100));assert.equal(official.teams[0].xiModel,undefined);
});
