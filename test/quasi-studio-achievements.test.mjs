import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE_ROOMS,ROOM_REWARDS,canonicalRoomRewardId,roomById,roomAsset} from '../public/src/locker-rooms.mjs';
import {AVATAR_OPTIONS,avatarSvg,normalizeAvatar} from '../public/src/avatar.mjs';
import {REWARD_CATALOG} from '../public/src/reward-catalog.mjs';
import {STUDIO_TABS,studioChoices,applyStudioChoice} from '../public/src/quasi-studio.mjs';
import {rosterView} from '../public/src/quasi-roster.mjs';
import {syncRoundRewards,ownedRewardIds} from '../lib/progression.mjs';
import {emptyState} from '../lib/db.mjs';
test('all forty rooms have separate packaged art; every legacy ID maps once to a stable owned room',()=>{
 const rooms=[...BASE_ROOMS,...ROOM_REWARDS];assert.equal(rooms.length,40);assert.equal(new Set(rooms.map(r=>roomAsset(r.id))).size,40);
 for(const r of rooms)assert.ok(fs.existsSync(new URL('../public'+roomAsset(r.id),import.meta.url)));
 for(let n=1;n<=100;n++){const old='room-'+String(n).padStart(3,'0'),id=canonicalRoomRewardId(old);assert.ok(roomById(id));assert.equal(canonicalRoomRewardId(id),id);assert.equal(normalizeAvatar({rewardRoom:old},[old]).rewardRoom,id);}
 assert.equal(canonicalRoomRewardId('room-100'),'room-100');for(let n=1;n<100;n++)assert.notEqual(canonicalRoomRewardId('room-'+String(n).padStart(3,'0')),'room-100');
});
test('studio shows free choices and only owned cosmetics; choosing base clears that reward slot',()=>{
 const choices=studioChoices('room',['room-100']);assert.equal(choices.length,11);assert.ok(choices.some(c=>c.value==='room-100'));assert.equal(studioChoices('room').length,10);
 const next=applyStudioChoice({rewardRoom:'room-100',rewardHat:'king-crown'},choices[0]);assert.equal(next.rewardRoom,'none');assert.equal(next.rewardHat,'king-crown');assert.equal(next.room,'base-room-01');
});
test('every studio tile has a distinct caption of at most two words in its category',()=>{
 const ids=REWARD_CATALOG.map(reward=>reward.id);
 for(const [category] of STUDIO_TABS){
  const choices=studioChoices(category,ids),labels=new Set();
  for(const {label,value} of choices){
   assert.match(label??'',/^\S+(?: \S+)?$/,`${category}: ${value}`);
   assert.equal(labels.has(label),false,`${category}: ${label}`);
   labels.add(label);
  }
 }
 assert.ok(studioChoices('outfit',ids).some(choice=>choice.label==='Quadretti blu'));
});
test('outfit colors recolor the fabric and pattern while retaining the unlocked garment and its original option',()=>{
 const kit=REWARD_CATALOG.find(r=>r.type==='outfit'&&r.motif===5&&r.color==='#5289b9');
 const [original]=studioChoices('color');
 const saved=normalizeAvatar({rewardOutfit:kit.id,color:'#ec8758'},[kit.id]);
 assert.equal(saved.customOutfitColor,false);
 assert.match(avatarSvg(saved),/fill="#5289b9"/);
 const red=applyStudioChoice(saved,{key:'color',value:'#bd514b'});
 const orange=applyStudioChoice(red,{key:'color',value:'#ec8758'});
 for(const [avatar,color] of [[red,'#bd514b'],[orange,'#ec8758']]){
  const payload=normalizeAvatar(avatar,[kit.id]),svg=avatarSvg(payload);
  assert.equal(payload.rewardOutfit,kit.id);
  assert.equal(payload.customOutfitColor,true);
  assert.ok(svg.includes('data-avatar-outfit="'+kit.id+'"'));
  assert.ok(svg.includes('fill="'+color+'"'));
  assert.doesNotMatch(svg,/fill="#5289b9"/);
  assert.equal(normalizeAvatar({customOutfitColor:'true'}).customOutfitColor,false);
 }
 const cssId=svg=>svg.replace(/\bqa[0-9a-z]+/g,'clip');
 assert.equal(cssId(avatarSvg(applyStudioChoice(orange,original))),cssId(avatarSvg(saved)));
 const jacket=applyStudioChoice({outfit:'jacket'},{key:'color',value:'#bd514b'});
 assert.equal((avatarSvg(jacket).match(/fill="#bd514b"/g)||[]).length>=3,true);
});
test('new outfits, hairstyles and beards render independently of the profile, with personalized choices preserved',()=>{
 const shape=svg=>svg.replace(/\bqa[0-9a-z]+/g,'clip');
 for(const key of ['outfit','hair','beard']){
  const choices=AVATAR_OPTIONS[key].values.map(([value])=>value);
  assert.equal(new Set(choices.map(value=>shape(avatarSvg({[key]:value})))).size,choices.length);
 }
 const female=applyStudioChoice(normalizeAvatar({}),{key:'character',value:'female'});
 const male=applyStudioChoice(normalizeAvatar({}),{key:'character',value:'male'});
 assert.equal(female.hair,'bob');assert.equal(female.outfit,'tennis-dress');
 assert.equal(male.hair,'fade');assert.equal(male.outfit,'jersey');assert.equal(male.beard,'stubble');
 assert.notEqual(shape(avatarSvg({character:'female'})),shape(avatarSvg({character:'male'})));
 const changed=applyStudioChoice({...male,hair:'pony',outfit:'wrap-dress',beard:'goatee'},{key:'character',value:'female'});
 assert.deepEqual([changed.hair,changed.outfit,changed.beard],['pony','wrap-dress','goatee']);
 assert.equal(studioChoices('outfit',[],'female')[0].value,'pleated-skirt');
 assert.ok(studioChoices('outfit',[],'male').some(choice=>choice.value==='denim-skirt'));
});
test('member gallery uses three, four or six columns with complete scenes and escaped nicknames',()=>{
 const member={uid:'a',name:'<img onerror=bad>',avatar:{room:'base-room-03',rewardTitle:'king-title'}};
 let html=rosterView({members:[member],admin:'a'},'a');assert.match(html,/roster-three/);assert.match(html,/room-base-room-03-thumb-[a-f0-9]+\.webp/);assert.match(html,/King del betting/);assert.doesNotMatch(html,/<img onerror=bad>/);assert.match(html,/data-quasi-edit/);
 html=rosterView({members:Array.from({length:6},(_,i)=>({...member,uid:String(i)}))},'outsider');assert.match(html,/roster-four/);assert.doesNotMatch(html,/data-quasi-edit/);
});

