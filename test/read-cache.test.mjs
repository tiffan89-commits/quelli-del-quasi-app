import test from 'node:test';import assert from 'node:assert/strict';
import {createReadCache} from '../lib/read-cache.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {fixtureDb} from './fanta/helpers.mjs';
import {profileTransaction} from '../lib/db.mjs';
test('profile transactions exclude sports data, preserve it when updating a name, and skip no-op writes',async()=>{
 const f=await fixtureDb();try{const original=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;original.football={large:'cached-sports-data'};original.rounds=[{id:'keep'}];await f.db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(original)]);let writes=0;const connect=async()=>{const c=await f.connect();return {query:(sql,...args)=>{if(/^UPDATE/.test(sql))writes++;return c.query(sql,...args);},release:()=>c.release()};};
  await profileTransaction(s=>{assert.equal(s.football,undefined);assert.deepEqual(s.rounds,[]);},{connect});assert.equal(writes,0);
  await profileTransaction(s=>{s.users[0].name='New';},{connect});assert.equal(writes,1);const after=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.deepEqual(after.football,original.football);assert.deepEqual(after.rounds,original.rounds);assert.equal(after.users[0].name,'New');
 }finally{await f.close();}
});
test('private read cache deduplicates concurrent reads, shares across instances, invalidates revisions and isolates mutable callers',async()=>{
 const rows=new Map(),store={get:async k=>rows.get(k),setJSON:async(k,v)=>rows.set(k,structuredClone(v))};let reads=0,stamp=1;const cache=createReadCache({store,now:()=>stamp}),load=async()=>{reads++;await Promise.resolve();return {nested:{value:reads}};};
 const [a,b]=await Promise.all([cache.read('leagueA','1',load),cache.read('leagueA','1',load)]);assert.equal(reads,1);a.nested.value=99;assert.equal(b.nested.value,1);
 assert.equal((await createReadCache({store,now:()=>stamp}).read('leagueA','1',load)).nested.value,1);assert.equal(reads,1);
 await cache.read('leagueA','2',load);assert.equal(reads,2);await cache.read('leagueB','2',load);assert.equal(reads,3);
 stamp+=300001;await cache.read('leagueA','2',load);assert.equal(reads,4);
 const broken=createReadCache({store:{get:async()=>{throw Error('offline');},setJSON:async()=>{throw Error('offline');}}});assert.equal((await broken.read('a','1',load)).nested.value,5);
 await assert.rejects(broken.read('failed','1',async()=>{throw Error('db unavailable');}),/db unavailable/);assert.equal((await broken.read('failed','1',load)).nested.value,6);
});
test('native league cache avoids heavy SQL reads; writes invalidate other instances and revoked members cannot read cached data',async()=>{
 const f=await fixtureDb();try{let fullReads=0;const connect=async()=>{const c=await f.connect();return {query:(sql,...args)=>{if(sql.startsWith('SELECT l.*,row_to_json'))fullReads++;return c.query(sql,...args);},release:()=>c.release()};};const cache=createReadCache(),store=sqlFantaStore({connect,readCache:cache});
 await store.league('u1','fanta-lucas-a',s=>s.league.name);await store.league('u2','fanta-lucas-a',s=>s.league.name);assert.equal(fullReads,1);
 await f.db.query("UPDATE fanta.leagues SET name='Changed'");assert.equal(await store.league('u1','fanta-lucas-a',s=>s.league.name),'Changed');assert.equal(fullReads,2);
 await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");await assert.rejects(store.league('u2','fanta-lucas-a',s=>s.league.name),/non accessibile/);
 }finally{await f.close();}
});
