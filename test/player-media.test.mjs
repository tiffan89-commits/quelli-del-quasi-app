import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState} from '../lib/db.mjs';import {session} from '../lib/game.mjs';import {ensureCalendar} from '../lib/calendar.mjs';
import {memoryPlayerStore} from '../lib/player-store.mjs';
import {parseSquad,runPlayerMediaBatch,matchPortrait,enrichLineupPortraits} from '../lib/player-media.mjs';
import {createApi} from '../netlify/functions/api.mjs';
const stamp=Date.parse('2026-10-31T08:00:00Z');
test('one squad call imports the entire roster and downloads only missing images, with a daily reserve',async()=>{
 const s=emptyState();s.football.calendar={season:2026,rounds:[]};s.football.playerMediaJob={season:'2026',teams:[{id:'489',name:'Milan',doneAt:0}],quota:{day:'2026-10-31',used:0}};const store=memoryPlayerStore(),calls=[];
 const response={response:[{team:{id:489},players:Array.from({length:35},(_,i)=>({id:i+1,name:'Player '+i,photo:'https://media.api-sports.io/football/players/'+(i+1)+'.png'}))}]};
 const fetcher=async url=>{calls.push(url);return url.includes('/players/squads?')?new Response(JSON.stringify(response),{headers:{'x-ratelimit-requests-remaining':'98'}}):new Response(Buffer.alloc(40,7),{headers:{'content-type':'image/png'}});};
 const options={transact:async fn=>fn(s),store,fetcher,env:{API_FOOTBALL_KEY:'fake-key'},now:()=>stamp};const r=await runPlayerMediaBatch(options);assert.equal(r.players,35);assert.equal(r.photos,35);assert.equal(calls.filter(u=>u.includes('v3.football')).length,1);assert.equal((await store.catalog(['Milan'])).length,35);assert.ok(!JSON.stringify(s).includes('fake-key'));
 await runPlayerMediaBatch(options);assert.equal(calls.length,36);
 delete s.football.playerMediaJob.completedAt;s.football.playerMediaJob.teams[0].doneAt=0;await runPlayerMediaBatch(options);assert.equal(calls.length,37); // Metadata refresh reuses all 35 stored bytes.
 delete s.football.playerMediaJob.completedAt;s.football.playerMediaJob.teams[0].doneAt=0;s.football.playerMediaJob.quota.used=85;const blocked=await runPlayerMediaBatch(options);assert.match(blocked.error,/Quota/);assert.equal(calls.length,37);
});
test('portrait mapping is team-scoped, supports surname-first initials and refuses ambiguous identities',()=>{
 const rows=[{id:'1',team:'milan',name:'M. Maignan',digest:'a'.repeat(64)},{id:'2',team:'inter',name:'I. Martinez'},{id:'3',team:'inter',name:'J. Martinez'}];
 assert.equal(matchPortrait({name:'Maignan M.'},'Milan',rows).id,'1');assert.equal(matchPortrait({name:'Martinez'},'Inter',rows),null);assert.equal(matchPortrait({name:'Maignan'},'Inter',rows),null);
 const result=enrichLineupPortraits({teams:[{team:'Milan',players:[{name:'Maignan'}],bench:[{name:'Maignan'}]}]},rows);assert.match(result.teams[0].players[0].photo,/^\/api\/player-photo/);assert.equal(result.teams[0].bench[0].photo,result.teams[0].players[0].photo);
 const missing=enrichLineupPortraits({teams:[{team:'Milan',players:[{name:'Maignan'}]}]},[{...rows[0],digest:'2ff7d52a628fce5d954c58480dde4e47396db4bb405b7b7d6a6567134bf86422'}]);assert.equal(missing.teams[0].players[0].photo,null);
 const squad=parseSquad({response:[{team:{id:1},players:[{id:2,name:'Test',photo:'https://private.test/leak'}]}]},{id:1,name:'Milan'},2026);assert.equal(squad[0].sourcePhoto,null);
});
test('portrait endpoint requires login and returns stored versioned bytes and conditional 304',async()=>{
 const s=emptyState();s.users.push({id:'u',username:'test',emailVerified:true});const token=session(s,'u'),digest='a'.repeat(64),data=Buffer.alloc(30,9),store=memoryPlayerStore([{id:'apifootball:1',team:'milan',digest,mime:'image/png',data}]);
 const api=createApi({transact:async fn=>fn(s),playerStore:store}),url='https://example.test/api/player-photo?id=apifootball:1&v='+digest;
 assert.equal((await api(new Request(url))).status,401);
 const headers={cookie:'sid='+token},r=await api(new Request(url,{headers}));assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);assert.match(r.headers.get('cache-control'),/private/);
 assert.equal((await api(new Request(url,{headers:{...headers,'if-none-match':'"'+digest+'"'}}))).status,304);assert.equal((await api(new Request(url.replace('apifootball:1','apifootball:2'),{headers}))).status,404);
});
test('state reads portrait metadata after releasing the game transaction, never while holding its write lock',async()=>{
 const s=emptyState();s.users.push({id:'u',username:'test',name:'Test',emailVerified:true});const token=session(s,'u'),cal=ensureCalendar(s),m=cal.rounds[0].matches[0];m.lineups={kind:'probable',source:'private-source',teams:[{team:m.home,players:[{name:'Test'}]},{team:m.away,players:[{name:'Other'}]}]};let active=false,calls=0;
 const api=createApi({transact:async fn=>{active=true;try{return await fn(s);}finally{active=false;}},playerStore:{catalog:async()=>{assert.equal(active,false);calls++;return [];}}});
 const r=await api(new Request('https://example.test/api/state',{headers:{cookie:'sid='+token}}));assert.equal(r.status,200);assert.equal(calls,0);assert.ok(!JSON.stringify(await r.json()).includes('private-source'));const detail=await api(new Request('https://example.test/api/match?id='+encodeURIComponent(m.id),{headers:{cookie:'sid='+token}}));assert.equal(detail.status,200);assert.equal(calls,1);
});
