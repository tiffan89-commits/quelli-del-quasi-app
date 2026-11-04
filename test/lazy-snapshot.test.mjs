import test from 'node:test';import assert from 'node:assert/strict';
import {compactClientState} from '../lib/client-snapshot.mjs';
import {createApi} from '../netlify/functions/api.mjs';
import {emptyState} from '../lib/db.mjs';import {ensureCalendar} from '../lib/calendar.mjs';import {session,newLeague} from '../lib/game.mjs';
test('compact navigation keeps live events and detail revisions but excludes unopened heavy match content',()=>{
 const past={id:'past',status:'FT',frozen:{'1':{value:2,audit:'large-history'}},pointOffers:{'1':{correct:1,wrong:-1,source:'esito secco'}},lineups:{updatedAt:'a',teams:[{players:[{name:'P'}]}]},details:{updatedAt:'b',complete:true,events:[{kind:'goal'}]},oddsModel:{heavy:true}};
 const live={...structuredClone(past),id:'live',status:'LIVE'};const data=compactClientState({calendar:{rounds:[{matches:[past]}]},leagues:[{rounds:[{matches:[live]}]}]});
 assert.equal(data.compact,true);assert.equal(past.lineups,undefined);assert.equal(past.details,undefined);assert.equal(past.oddsModel,undefined);assert.equal(past.lineupRevision,'a');assert.equal(past.detailRevision,'b');assert.equal(past.detailsComplete,true);assert.equal(live.details.events[0].kind,'goal');assert.equal(live.lineups,undefined);
 assert.equal(past.frozen,undefined);assert.deepEqual(past.pointOffers,{'1':{correct:1,wrong:-1}});
});
test('selected-match reads are scoped to membership, do not write or fetch external sources and strip source names',async()=>{
 const s=emptyState(),u={id:'u',username:'p',name:'P',emailVerified:true},other={id:'o',username:'o',name:'O',emailVerified:true};s.users.push(u,other);ensureCalendar(s);const l=newLeague(s,u,'Own'),foreign=newLeague(s,other,'Other'),token=session(s,u.id);
 s.rounds.push({id:'r',league:l.id,slips:[],rules:l.rules,matches:[{id:'fm',home:'H',away:'A',details:{complete:true,teams:[{name:'H',players:[{name:'A',vote:6}]}]}}]});const m=s.football.calendar.rounds[0].matches[0];m.lineups={source:'hidden-source',kind:'probable',sourceCount:5,teams:[]};let reads=0,catalogs=0;
 const api=createApi({read:async(fn,opt)=>{reads++;assert.ok(['match','game'].includes(opt.kind));return fn(structuredClone(s));},transact:async()=>{throw Error('Read route attempted write');},playerStore:{catalog:async()=>{catalogs++;return [];}}});const call=q=>api(new Request('https://test.local/api/'+q,{headers:{cookie:'sid='+token}}));
 const nav=await call('state?lite=1');assert.equal(nav.status,200);assert.equal(catalogs,0);assert.equal((await nav.json()).compact,true);
 const result=await call('match?id='+m.id);assert.equal(result.status,200);assert.ok(!JSON.stringify(await result.json()).includes('hidden-source'));assert.equal(catalogs,1);
 assert.equal((await call('match?id=fm&round=r&league='+foreign.id)).status,403);assert.equal((await call('match?id=fm&round=wrong&league='+l.id)).status,404);assert.equal((await call('match?id=fm&round=r&league='+l.id)).status,200);assert.equal(reads,5);
});
