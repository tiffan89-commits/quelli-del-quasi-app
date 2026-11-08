import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createFriendsRelease} from '../runtime/friends-release.mjs';

test('Friends & Family selects the frontend from the authenticated session and preserves a stable fallback',async()=>{
 const root=await mkdtemp(join(tmpdir(),'quasi-friends-')),stableDir=join(root,'stable'),candidateDir=join(root,'releases'),revision='2cee709';
 const expires=Date.now()+3600000,token='a'.repeat(43),hash=createHash('sha256').update(token).digest('hex'),sid='sid='+token;
 const config={enabled:true,revision,emails:new Set(['pilot@example.com'])};
 let lookups=0,account={email:'pilot@example.com',expires};
 const server=createFriendsRelease({stableDir,candidateDir,loadConfig:async()=>config,secret:'test-key-at-least-thirty-two-characters',
  identify:async value=>{lookups++;return value===hash?account:null;}});
 try{
  await mkdir(stableDir);
  await mkdir(join(candidateDir,revision,'build','chunks'),{recursive:true});
  await writeFile(join(stableDir,'index.html'),'<head><script type="module" src="/build/app.mjs"></script></head>stable');
  await writeFile(join(candidateDir,revision,'index.html'),'<head><meta name="qdq-app-css" content="/build/app.css"><script type="module" src="/build/app.mjs"></script></head>candidate');
  await writeFile(join(candidateDir,revision,'build','chunks','test-ABC.mjs'),'export const verified=true;');
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const get=(path,cookie)=>fetch('http://127.0.0.1:'+server.address().port+path,{headers:cookie?{cookie}:{}});
  const asset='/_friends/assets/'+revision+'/chunks/test-ABC.mjs';
  let response=await get('/');
  assert.equal(response.headers.get('x-quasi-release'),'stable');
  assert.match(await response.text(),/src="\/build\/app.mjs"/);
  assert.equal(lookups,0);
  assert.equal((await get(asset,sid)).status,404);
  response=await get('/invito/ABC123?mode=fanta',sid);
  assert.equal(response.headers.get('x-quasi-release'),'friends-'+revision);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.match(response.headers.get('x-robots-tag'),/noindex/);
  const body=await response.text();
  assert.ok(body.includes('/_friends/assets/'+revision+'/app.css'));
  assert.ok(body.includes('/_friends/assets/'+revision+'/app.mjs'));
  const grant=response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);
  assert.equal((await get(asset,sid+'; '+grant)).status,200);
  assert.equal((await get(asset,grant)).status,404);
  assert.equal((await get(asset,'sid='+'b'.repeat(43)+'; '+grant)).status,404);
  assert.equal((await get(asset,sid+'; '+grant+'A')).status,404);
  assert.equal(lookups,1);
  account={email:'other@example.com',expires};
  response=await get('/_friends/channel',sid+'; '+grant);
  assert.deepEqual(await response.json(),{channel:'stable',revision:null});
  assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  config.emails.clear();
  assert.equal((await get(asset,sid+'; '+grant)).status,404);
  config.enabled=false;
  assert.equal((await get('/',sid+'; '+grant)).headers.get('x-quasi-release'),'stable');
 }finally{
  if(server.listening){server.close();await once(server,'close');}
  await rm(root,{recursive:true,force:true});
 }
});
