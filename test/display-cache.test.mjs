import test from 'node:test';import assert from 'node:assert/strict';
import {displayCache,clearDisplayCaches,linkedBarTarget} from '../public/src/display-cache.mjs';
import {createFantaApi} from '../public/src/fanta/api.mjs';
test('mode return follows selected Fanta league rather than previous Bar, retaining explicit round navigation',()=>{
 const bars=[{id:'bar-a',nativeFantaLink:{leagueId:'fanta-a'}},{id:'bar-b',nativeFantaLink:{leagueId:'fanta-b'}}];
 assert.deepEqual(linkedBarTarget(bars,'fanta-b',{page:'schedina',round:'round-b'}),{league:'bar-b',page:'schedina',round:'round-b'});
 assert.deepEqual(linkedBarTarget(bars,'private',{page:'lega'}),{page:'lega'});
});
test('display snapshots persist, expire, tolerate quota errors and clear on logout',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),get length(){return values.size;},key:i=>[...values.keys()][i]};
 const c=displayCache('test:viewer',{storage});c.set('league',{name:'A'});assert.equal(c.get('league',60000).name,'A');assert.equal(values.size,1);assert.equal(c.get('league',-1),null);const version=c.generation;clearDisplayCaches('viewer',{storage});c.set('late',{name:'Old'},version);assert.equal(c.get('late',60000),null);assert.equal(values.size,0);
 const broken=displayCache('test:quota',{storage:{getItem(){throw Error('blocked');},setItem(){throw Error('quota');}}});assert.doesNotThrow(()=>broken.set('x',{ok:true}));
});
test('Fanta snapshots survive remount per user, writes invalidate all instances and auctions bypass cache',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>Response.json({name:'response-'+(++calls)});
 try{const a=createFantaApi({userId:'cache-user-a'}),b=createFantaApi({userId:'cache-user-a'}),other=createFantaApi({userId:'cache-user-b'});
 await a.team('one');await b.team('one');assert.equal(calls,1);await other.team('one');assert.equal(calls,2);
 await a.saveSettings({notify:{}});await b.team('one');assert.equal(calls,4);
 await b.auction('one');await b.auction('one');assert.equal(calls,6);
 clearDisplayCaches('cache-user-a');await b.team('one');assert.equal(calls,7);
 }finally{globalThis.fetch=original;clearDisplayCaches('cache-user-a');clearDisplayCaches('cache-user-b');}
});
