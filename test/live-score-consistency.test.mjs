import test from 'node:test';import assert from 'node:assert/strict';
import {publishMatches} from '../lib/operations/workflows.mjs';
import {applyApiFootball,apiFootballTimeline} from '../lib/api-football.mjs';
import {emptyState} from '../lib/db.mjs';import {ensureCalendar} from '../lib/calendar.mjs';
const snap=(id,score,time)=>({id,status:'LIVE',liveScore:score,scoreUpdatedAt:time,details:{events:score[1]?[{kind:'goal',side:'away'}]:[]}});
function cache(){let data=null,version=0;return {get data(){return data;},getWithMetadata:async()=>data?{data:structuredClone(data),etag:String(version)}:null,setJSON:async(_k,value,opts)=>{if(opts.onlyIfNew&&data||opts.onlyIfMatch&&opts.onlyIfMatch!==String(version))return {modified:false};data=structuredClone(value);version++;return {modified:true};}};}
test('public live score and goal events stay together and late responses cannot restore zero-zero',async()=>{
 const store=cache(),newer=snap('a',[0,1],'2026-11-02T20:28:00Z'),old=snap('a',[0,0],'2026-11-02T20:25:00Z');await publishMatches([newer],{store});assert.equal((await publishMatches([old],{store})).changed,false);assert.deepEqual(store.data.matches[0].liveScore,[0,1]);assert.equal(store.data.matches[0].events[0].side,'away');
 await publishMatches([snap('a',[0,0],'2026-11-02T20:29:00Z')],{store});assert.deepEqual(store.data.matches[0].liveScore,[0,0],'newer VAR corrections may lower the score');assert.deepEqual(store.data.matches[0].events,[]);
 await Promise.all([publishMatches([snap('b',[1,0],'2026-11-02T20:28:00Z')],{store}),publishMatches([snap('c',[1,1],'2026-11-02T20:28:00Z')],{store})]);assert.deepEqual(store.data.matches.map(m=>m.id),['a','b','c']);
});
test('partial provider events replace stale goals and explicit cancelled goals never count as goals',()=>{
 const s=emptyState();ensureCalendar(s);const m=s.football.calendar.rounds.flatMap(r=>r.matches).find(m=>m.home==='Atalanta'&&m.away==='Parma');Object.assign(m,{status:'LIVE',score:null,liveScore:[0,0],scoreUpdatedAt:'2026-11-02T20:25:00Z',details:{events:[{kind:'goal',side:'home'}]}});
 const raw={fixture:{id:1550178,date:m.kickoff,status:{short:'1H',elapsed:43}},league:{id:135,season:2026},teams:{home:{id:499,name:m.home},away:{id:523,name:m.away}},goals:{home:0,away:1},events:[{type:'Goal',detail:'Normal Goal',team:{id:523},time:{elapsed:41},player:{id:1,name:'Marcatore'}}]};
 applyApiFootball(s,[raw],'2026-11-02T20:28:00Z');assert.deepEqual(m.liveScore,[0,1]);assert.equal(m.details.events.length,1);assert.equal(m.details.events[0].side,'away');assert.equal(m.details.complete,false);
 applyApiFootball(s,[{...raw,goals:{home:0,away:0},events:[]}],'2026-11-02T20:26:00Z');assert.deepEqual(m.liveScore,[0,1]);assert.equal(m.details.events.length,1);
 raw.events[0].detail='Goal Disallowed';assert.equal(apiFootballTimeline(raw)[0].kind,'var');
});
