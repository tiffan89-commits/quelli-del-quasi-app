import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE_ROOMS,ROOM_REWARDS,canonicalRoomRewardId,roomById,roomAsset} from '../public/src/locker-rooms.mjs';
import {normalizeAvatar} from '../public/src/avatar.mjs';
import {studioChoices,applyStudioChoice} from '../public/src/quasi-studio.mjs';
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
test('member gallery uses three, four or six columns with complete scenes and escaped nicknames',()=>{
 const member={uid:'a',name:'<img onerror=bad>',avatar:{room:'base-room-03',rewardTitle:'king-title'}};
 let html=rosterView({members:[member],admin:'a'},'a');assert.match(html,/roster-three/);assert.match(html,/room-base-room-03-thumb-[a-f0-9]+\.webp/);assert.match(html,/King del betting/);assert.doesNotMatch(html,/<img onerror=bad>/);assert.match(html,/data-quasi-edit/);
 html=rosterView({members:Array.from({length:6},(_,i)=>({...member,uid:String(i)}))},'outsider');assert.match(html,/roster-four/);assert.doesNotMatch(html,/data-quasi-edit/);
});

