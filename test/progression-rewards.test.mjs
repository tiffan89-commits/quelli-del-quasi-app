import test from 'node:test';import assert from 'node:assert/strict';
import {REWARD_CATALOG,rewardById} from '../public/src/reward-catalog.mjs';
import {BASE_ROOMS,ROOM_REWARDS,roomSvg} from '../public/src/locker-rooms.mjs';
import {syncRoundRewards,ownedRewardIds,progressionFor} from '../lib/progression.mjs';
import {normalizeAvatar,avatarSvg} from '../public/src/avatar.mjs';
import {applyStudioChoice} from '../public/src/quasi-studio.mjs';
import {dashboardModel} from '../public/src/league-dashboard.mjs';
import {emptyState} from '../lib/db.mjs';import {session} from '../lib/game.mjs';import {createApi} from '../netlify/functions/api.mjs';
function fixture(count=20){const s=emptyState();s.users=Array.from({length:count},(_,i)=>({id:'u'+i,username:'u'+i,name:'Player '+i,emailVerified:true}));const l={id:'l',name:'Test',admin:'u0',rules:{initial:500},members:s.users.map(u=>({uid:u.id,credits:500,points:0}))};s.leagues=[l];const r={id:'r',league:'l',title:'Giornata 1',kickoff:'2026-10-25T12:00:00Z',settled:true,matches:Array.from({length:10},(_,i)=>({id:'m'+i,score:[1,0],status:'FT'})),slips:[]};s.rounds=[r];return{s,l,r};}
const perfect=(uid,patch={})=>({uid,picks:Object.fromEntries(Array.from({length:10},(_,i)=>['m'+i,'1'])),points:10,stake:10,prize:2000,odds:200,creditsSettled:true,...patch});
test('catalog has one thousand original cosmetic variants, 30 reward rooms, 10 distinct free rooms and 8 achievement gifts',()=>{
 assert.equal(REWARD_CATALOG.length,1041);assert.equal(new Set(REWARD_CATALOG.map(x=>x.id)).size,1041);assert.equal(new Set(REWARD_CATALOG.map(x=>x.name)).size,1041);assert.equal(BASE_ROOMS.length,10);assert.equal(ROOM_REWARDS.length,30);assert.equal(new Set(BASE_ROOMS.map(r=>roomSvg(r.id))).size,10);assert.equal(new Set(ROOM_REWARDS.map(r=>roomSvg(r.id))).size,30);assert.ok(Buffer.byteLength(roomSvg('room-100'))<10000);
});
test('everyone eligible gets a persistent day award; repeated calls neither duplicate gifts nor alter balances',()=>{const{s,l,r}=fixture(80);r.slips=[perfect('u0'),perfect('u1')];const before=JSON.stringify(l.members);syncRoundRewards(s,1);assert.equal(Object.keys(s.playerRewards).length,80);const ids=Object.values(s.playerRewards).map(a=>a.find(x=>x.round===r.id).ids[0]);assert.ok(new Set(ids).size>70);assert.ok(ownedRewardIds(s,'u0').includes('king-crown'));assert.ok(ownedRewardIds(s,'u1').includes('king-crown'));assert.ok(ownedRewardIds(s,'u0').includes('room-100'));const saved=JSON.stringify(s.playerRewards);syncRoundRewards(s,2);assert.equal(JSON.stringify(s.playerRewards),saved);assert.equal(JSON.stringify(l.members),before);});
test('resort requires a perfect difficult settled slip and cannot be allocated randomly',()=>{for(const patch of [{odds:99},{prize:999},{picks:Object.fromEntries(Array.from({length:10},(_,i)=>['m'+i,'1X']))}]){const{s,r}=fixture();r.slips=[perfect('u0',patch)];syncRoundRewards(s);assert.ok(!ownedRewardIds(s,'u0').includes('room-100'));assert.ok(Object.values(s.playerRewards).every(a=>!a[0].ids.includes('room-100')));}});
test('unsettled or void rounds, admin and late joining players do not receive retroactive rewards',()=>{const{s,l,r}=fixture(3);s.users[1].adminOnly=true;l.members[2].joinedAt='2026-10-30T12:00:00Z';r.settled=false;syncRoundRewards(s);assert.deepEqual(s.playerRewards,{});r.settled=true;syncRoundRewards(s);assert.deepEqual(Object.keys(s.playerRewards),['u0']);});
test('fantasy charts isolate each league and exclude future committed stakes',()=>{const{s,l,r}=fixture(1);Object.assign(r,{source:'fantacalcio',virtualBookmaker:true,competitionKey:'A',competitionName:'A',slips:[perfect('u0',{points:2,prize:0})]});const other={...structuredClone(r),id:'r2',competitionKey:'B',competitionName:'B',kickoff:'2026-10-26T12:00:00Z',slips:[perfect('u0',{points:3,prize:30})]};s.rounds.push(other,{...structuredClone(r),id:'future',settled:false,slips:[{uid:'u0',stake:20}]});Object.assign(l.members[0],{fantasyWallet:{initial:500,credits:490},competitionPoints:{A:2,B:3}});const p=progressionFor(s,l,'u0');assert.deepEqual(p.fantacalcioByLeague.A.history.map(r=>r.pointsTotal),[2]);assert.deepEqual(p.fantacalcioByLeague.B.history.map(r=>r.pointsTotal),[3]);assert.equal(p.fantacalcioByLeague.A.initial,500);assert.equal(p.fantacalcioByLeague.B.initial,500);assert.equal(p.fantacalcioByLeague.A.capital,490);assert.equal(p.fantacalcioByLeague.B.capital,520);});

test('dashboard selects the individual fantasy competition while rankings remain aggregated',()=>{const{s,l}=fixture(1),now=Date.parse('2026-10-30T12:00:00Z');l.rounds=[{id:'a8',source:'fantacalcio',competitionKey:'A',title:'Giornata 8',kickoff:'2026-10-31T14:00:00Z',matches:[{}]},{id:'b7',source:'fantacalcio',competitionKey:'B',title:'Giornata 7',kickoff:'2026-10-31T14:00:00Z',matches:[{}]}];assert.equal(dashboardModel(l,'u0','fantacalcio',now,'A').round.id,'a8');assert.equal(dashboardModel(l,'u0','fantacalcio',now,'B').round.id,'b7');});
test('equipping awards is authorized by the server and stores no SVG or arbitrary fields',async()=>{const{s,r}=fixture(1);r.slips=[perfect('u0')];syncRoundRewards(s);const token=session(s,'u0'),api=createApi({transact:async fn=>fn(s,{query:async()=>({rows:[{attempts:1}]})}),env:{}}),call=avatar=>api(new Request('https://example.test/api/profile-avatar',{method:'POST',headers:{cookie:'sid='+token,'Content-Type':'application/json'},body:JSON.stringify({avatar})}));let response=await call({rewardHat:'king-crown',rewardRoom:'room-100',body:'stocky'});assert.equal(response.status,200);assert.equal(s.users[0].avatar.rewardHat,'king-crown');const locked=REWARD_CATALOG.find(r=>!ownedRewardIds(s,'u0').includes(r.id)&&r.type==='outfit');assert.equal((await call({rewardOutfit:locked.id})).status,403);assert.equal(normalizeAvatar({rewardHat:'king-crown'},[]).rewardHat,'none');assert.doesNotMatch(avatarSvg({room:'<script>',body:'evil',skin:'" onload="alert(1)'}),/onload|<script|evil/);});

test('each reward uniform replaces the basic garment across body types',()=>{
 const stripClipIds=svg=>svg.replace(/\bqa[0-9a-z]+/g,'clip');
 for(let motif=0;motif<10;motif++){
  const kit=REWARD_CATALOG.find(item=>item.type==='outfit'&&item.motif===motif);
  for(const [outfit,body] of [['stripes','slim'],['jacket','stocky'],['scarf','athletic']]){
   const svg=avatarSvg({outfit,body,rewardOutfit:kit.id});
   assert.ok(svg.includes('data-avatar-outfit="'+kit.id+'"'));
   assert.equal(stripClipIds(svg),stripClipIds(avatarSvg({outfit:'jersey',body,rewardOutfit:kit.id})));
  }
  const free=applyStudioChoice({rewardOutfit:kit.id},{key:'outfit',value:'stripes'});
  assert.equal(free.rewardOutfit,'none');
  assert.ok(avatarSvg(free).includes('data-avatar-outfit="stripes"'));
 }
 const charm=REWARD_CATALOG.find(item=>item.type==='charm');
 const equipped=applyStudioChoice({accessory:'ball'},{key:'rewardCharm',value:charm.id});
 assert.equal(equipped.accessory,'none');
 assert.equal(applyStudioChoice(equipped,{key:'accessory',value:'ticket'}).rewardCharm,'none');
});
