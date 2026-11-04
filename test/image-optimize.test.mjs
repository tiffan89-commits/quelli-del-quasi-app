import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {optimizePortrait,imageDimensions,PORTRAIT_VERSION} from '../lib/image-optimize.mjs';
import {migrateStoredPortraits} from '../lib/player-media.mjs';import {memoryPlayerStore} from '../lib/player-store.mjs';
test('portraits are smaller, retina-sized, versioned WebP assets with bounded dimensions',async()=>{
 const bytes=await fs.readFile(new URL('../public/assets/icons/icon-192.png',import.meta.url)),result=await optimizePortrait(bytes,'image/png');assert.equal(result.mime,'image/webp');assert.ok(result.data.length<bytes.length);assert.ok(result.width>=140&&result.width<=160);assert.ok(result.height<=214);assert.deepEqual(imageDimensions(result.data,result.mime),[result.width,result.height]);assert.equal(result.digest,createHash('sha256').update(result.data).digest('hex'));assert.equal(result.optimizationVersion,PORTRAIT_VERSION);
});
test('portrait conversion is a data-only idempotent migration; old immutable URLs remain valid',async()=>{
 const data=await fs.readFile(new URL('../public/assets/icons/icon-192.png',import.meta.url)),digest=createHash('sha256').update(data).digest('hex');const store=memoryPlayerStore([{id:'apifootball:1',team:'milan',season:'2026',mime:'image/png',data,digest}]);let writes=0;const save=store.save;store.save=rows=>{writes++;return save(rows);};assert.equal(await migrateStoredPortraits(store),1);assert.equal(await migrateStoredPortraits(store),0);assert.equal(writes,1);assert.ok(await store.asset('apifootball:1',digest));assert.equal((await store.catalog())[0].mime,'image/webp');
});
test('malformed and decompression-bomb headers are rejected before loading a codec',async()=>{
 await assert.rejects(optimizePortrait(Buffer.alloc(40),'image/png'),/non valida/);const header=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(header);header.writeUInt32BE(99999,16);header.writeUInt32BE(99999,20);await assert.rejects(optimizePortrait(header,'image/png'),/Dimensioni/);
});
