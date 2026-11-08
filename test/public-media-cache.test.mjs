import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('service worker reuses bundled Quasi images but leaves private and external requests alone',async()=>{
 const handlers={},media=new Map();let requests=0;
 const store={match:async r=>media.get(r.url),put:async(r,v)=>media.set(r.url,v),keys:async()=>[],delete:async()=>{}};
 const origin='https://quellidelquasi.com',source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
 vm.runInNewContext(source,{URL,Response,caches:{open:async()=>store},fetch:async()=>{requests++;return new Response('fake-webp',{headers:{'content-type':'image/webp'}});},self:{location:{origin},addEventListener:(key,fn)=>handlers[key]=fn}});
 const request=async(url,destination='image')=>{let response,stored;handlers.fetch({request:{url,method:'GET',destination},respondWith:p=>response=p,waitUntil:p=>stored=p});await stored;return response;};
 const asset=origin+'/assets/rooms-v2/test.webp';
 assert.equal(await (await request(asset)).text(),'fake-webp');
 assert.equal(await (await request(asset)).text(),'fake-webp');
 assert.equal(requests,1);
 assert.equal(await request(origin+'/api/bar-team-asset?test=1'),undefined);
 assert.equal(await request('https://outside.example/assets/rooms-v2/test.webp'),undefined);
 assert.equal(await request(origin+'/assets/rooms-v2/test.html'),undefined);
 assert.equal(await request(asset,'script'),undefined);
});
