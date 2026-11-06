import test from 'node:test';import assert from 'node:assert/strict';import {redact} from '../runtime/observability.mjs';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {enqueueJob,processOne} from '../runtime/queue.mjs';
test('local operator reports redact nested keys, serialized JSON, environment secrets and connection URLs',()=>{
 const old=process.env.LOCAL_TEST_API_KEY;process.env.LOCAL_TEST_API_KEY='synthetic-private-value';
 try{assert.deepEqual(redact({ok:true,token:'secret',nested:{password:'pwd',response:[{apiKey:'key',goals:2}]}}),{ok:true,token:'[redatto]',nested:{password:'[redatto]',response:[{apiKey:'[redatto]',goals:2}]}});assert.equal(redact('{"authorization":"bearer secret","status":200}'),'{"authorization":"[redatto]","status":200}');assert.equal(redact('value synthetic-private-value'),'value [redatto]');assert.equal(redact('postgres://u:pwd@localhost/db'),'[connessione redatta]');}finally{if(old===undefined)delete process.env.LOCAL_TEST_API_KEY;else process.env.LOCAL_TEST_API_KEY=old;}
});
test('a reserved live consumer runs while a long maintenance job is waiting, and responses persist without duplicate claims',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quasi-live-lane-')),old=process.env.SELFHOST_DATA_DIR;process.env.SELFHOST_DATA_DIR=directory;
 let release;const wait=new Promise(r=>release=r),seen=[];
 try{await enqueueJob({name:'slow',payload:{id:'maintenance'}});await enqueueJob({name:'live',payload:{id:'live:1'}});const slow=processOne(async j=>{seen.push(j.name);await wait;return {status:200};},{accept:j=>j.name==='slow'});
  for(let i=0;i<30&&!seen.includes('slow');i++)await new Promise(r=>setTimeout(r,5));assert.ok(seen.includes('slow'));
  const live=await processOne(async j=>{seen.push(j.name);return {status:200,token:'private'};},{accept:j=>j.name==='live'});assert.equal(live.ok,true);assert.deepEqual(live.response,{status:200,token:'[redatto]'});release();await slow;assert.deepEqual(seen,['slow','live']);assert.equal(await processOne(()=>assert.fail('Duplicate execution')),null);
 }finally{release();if(old===undefined)delete process.env.SELFHOST_DATA_DIR;else process.env.SELFHOST_DATA_DIR=old;if(path.dirname(directory)!==os.tmpdir()||!path.basename(directory).startsWith('quasi-live-lane-'))throw Error('Unsafe cleanup');await fs.rm(directory,{recursive:true,force:true});}
});
