import test from 'node:test';
import assert from 'node:assert/strict';
import {auctionAction,auctionTickDue} from '../fanta/auction.mjs';
import {DEFAULT_RULES} from '../fanta/rules.mjs';
import {LAMPO,lampoDuration,lampoShownSeconds} from '../public/src/auction-formats.mjs';

const config={nomination:'random',playerOrder:'mixed',budget:500};
const teams=['u1','u2','u3'].map(userId=>({id:userId,userId,roster:[]}));
const players=['D','A','P','C'].flatMap(role=>Array.from({length:5},(_,i)=>({id:role+i,role,name:role+i})));
const fresh=()=>({league:{id:'lega',adminUid:'u1'},teams,players,rules:DEFAULT_RULES,auction:{status:'none',version:1,log:[],order:[]}});
let serial=0;
const action=(s,kind,input,who,now,extra={})=>auctionAction(s,kind,input,who,{admin:who==='u1',now,id:()=>String(++serial),rng:()=>0,...extra});

test('lampo draws by role, keeps early time, stretches the last three seconds and compensates measured latency',()=>{
 let s=action(fresh(),'start-now',{type:'lampo',mode:'manual',config},'u1',1000);
 assert.equal(s.auction.mode,'live');
 assert.equal(s.auction.config.nomination,'random');
 assert.equal(s.auction.config.playerOrder,'roles');
 s=action(s,'lobby-start',{},'u1',1000);
 s=action(s,'read',{},'server',11000);
 const lot=s.auction.lot,initialEnd=Date.parse(lot.endsAt);
 assert.equal(lot.player.role,'P');
 assert.equal(s.auction.caller,null);
 assert.equal(initialEnd-11000,lampoDuration(20));
 assert.equal(lampoShownSeconds(22000),20);
 assert.equal(lampoShownSeconds(5000),3);
 assert.equal(lampoShownSeconds(2500),1.5);
 s=action(s,'bid',{lotId:lot.id,amount:1},'u1',12000);
 assert.equal(s.auction.lot.endsAt,lot.endsAt);
 s=action(s,'bid',{lotId:lot.id,amount:2},'u2',initialEnd-800);
 const renewed=Date.parse(s.auction.lot.endsAt);
 assert.equal(renewed-(initialEnd-800),lampoDuration(10));
 assert.equal(s.auction.lot.timerSeconds,10);
 assert.throws(()=>action(s,'bid',{lotId:lot.id,amount:3},'u3',renewed+200,{latencyGrace:100}),/lotto è già chiuso/);
 assert.equal(auctionTickDue(s.auction,renewed+LAMPO.maxGrace-1),false);
 const late=action(s,'bid',{lotId:lot.id,amount:3},'u3',renewed+450,{receivedAt:renewed+120,latencyGrace:200});
 assert.equal(late.auction.lot.leader,'u3');
 assert.equal(auctionTickDue(s.auction,renewed+LAMPO.maxGrace),true);
 const sold=action(s,'read',{},'server',renewed+LAMPO.maxGrace);
 assert.equal(sold.auction.lastSale.team,'u2');
});

test('asta a chiamata uses the turn holder and starts with portieri even for old mixed settings',()=>{
 let s=action(fresh(),'start-now',{type:'iniziale',mode:'live',config},'u1',1000);
 s=action(s,'lobby-start',{},'u1',1000);
 s=action(s,'read',{},'server',11000);
 assert.equal(s.auction.currentRole,'P');
 assert.equal(s.auction.config.nomination,'personal');
 const caller=s.auction.caller;
 assert.throws(()=>action(s,'nominate',{playerId:'D0'},caller,11001),/ruolo/);
 assert.equal(action(s,'nominate',{playerId:'P0'},caller,11001).auction.lot.timerSeconds,60);
});
