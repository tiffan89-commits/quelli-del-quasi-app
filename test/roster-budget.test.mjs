import test from 'node:test';
import assert from 'node:assert/strict';
import {balancedPilotRosters} from '../fanta/auto-coach.mjs';

test('pilot spends leftovers on affordable same-role upgrades at real catalog prices',()=>{
 const players=Object.entries({P:[1,2,10],D:[1,3,40],C:[1,3,40],A:[1,3,40]}).flatMap(([role,values])=>values.map(value=>({id:role+value,role,value})));
 const before=structuredClone(players),options={teams:1,budget:20,slots:{P:1,D:1,C:1,A:1},seed:'upgrade'};
 const [roster]=balancedPilotRosters(players,options);
 assert.equal(roster.reduce((n,p)=>n+p.price,0),19);
 assert.ok(roster.some(p=>p.id==='P10'));
 assert.ok(roster.every(p=>p.price===p.value));
 assert.deepEqual(players,before);
 assert.deepEqual([roster],balancedPilotRosters(players,options));
});

test('pilot keeps unavailable and already owned players out of upgrades and stops at an affordable optimum',()=>{
 const slots={P:1,D:1,C:1,A:1},players=['P','D','C','A'].flatMap(role=>Array.from({length:16},(_,i)=>({id:role+i,role,value:i+1}))).concat({id:'blocked',role:'P',value:15,active:false});
 const rosters=balancedPilotRosters(players,{teams:3,budget:40,slots,seed:'shared'}),used=new Set(rosters.flat().map(p=>p.id));
 assert.equal(used.size,12);assert.ok(!used.has('blocked'));
 for(const r of rosters){
  const spent=r.reduce((n,p)=>n+p.price,0);assert.ok(spent<=40);
  assert.deepEqual(r.map(p=>p.role).sort(),['A','C','D','P']);
  for(const old of r)assert.ok(!players.some(p=>p.active!==false&&!used.has(p.id)&&p.role===old.role&&p.value>old.value&&p.value-old.value<=40-spent));
 }
});
