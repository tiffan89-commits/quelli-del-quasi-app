import test from 'node:test';import assert from 'node:assert/strict';import {previewGate} from '../runtime/preview-gate.mjs';
import {once} from 'node:events';import {createServer} from '../runtime/server.mjs';
test('private tunnel requires its signed cookie for static files and APIs; access URL redirects without leaking its key',()=>{
 const env={SELFHOST_PREVIEW_KEY:'synthetic-gate-key-at-least-32-characters'},now=Date.now(),origin='https://private.example.test',req={method:'GET',headers:{}};
 for(const path of ['/','/api/state','/fanta-api/me','/build/app.mjs'])assert.equal(previewGate(req,new URL(path,origin),{env,now}).status,401);
 const access=previewGate(req,new URL('/_preview/access?key='+env.SELFHOST_PREVIEW_KEY,origin),{env,now});assert.equal(access.status,303);assert.equal(access.headers.get('location'),'/');assert.equal(access.headers.get('referrer-policy'),'no-referrer');const cookie=access.headers.get('set-cookie').split(';')[0];assert.match(cookie,/__Host-quasi-preview=/);assert.match(access.headers.get('set-cookie'),/HttpOnly; Secure/);
 assert.equal(previewGate({...req,headers:{cookie}},new URL('/api/state',origin),{env,now}),null);assert.equal(previewGate({...req,headers:{cookie:cookie+'bad'}},new URL('/',origin),{env,now}).status,401);assert.equal(previewGate({...req,headers:{cookie}},new URL('/',origin),{env,now:now+86400001}).status,401);assert.equal(previewGate(req,new URL('/healthz',origin),{env,now}),null);
});
test('private preview can link directly only to the three review pages, never arbitrary URLs',()=>{const env={SELFHOST_PREVIEW_KEY:'synthetic-gate-key-at-least-32-characters'},req={method:'GET',headers:{}};for(const next of ['/prendi-squadra.html','/campagna.html','/entra-fanta.html','//evil.example','https://evil.example','/api/state','/prendi-squadra.html?key=secret']){const url=new URL('https://preview.example/_preview/access');url.searchParams.set('key',env.SELFHOST_PREVIEW_KEY);url.searchParams.set('next',next);const r=previewGate(req,url,{env});assert.equal(r.status,303);assert.equal(r.headers.get('location'),['/prendi-squadra.html','/campagna.html','/entra-fanta.html'].includes(next)?next:'/');assert.doesNotMatch(r.headers.get('location'),/synthetic|evil|secret/);}});

test('private home server sends noindex even on denied responses and overrides production robots after access',async()=>{
 const oldKey=process.env.SELFHOST_PREVIEW_KEY,oldFlag=process.env.SELFHOST_TEST_INSTANCE;
 process.env.SELFHOST_PREVIEW_KEY='synthetic-preview-key-at-least-32-characters';process.env.SELFHOST_TEST_INSTANCE='true';
 const server=createServer({origin:'https://private.example.test'});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
 const denied=await fetch(base+'/');assert.equal(denied.status,401);assert.equal(denied.headers.get('x-robots-tag'),'noindex, nofollow');
 const access=await fetch(base+'/_preview/access?key='+process.env.SELFHOST_PREVIEW_KEY,{redirect:'manual'});assert.equal(access.status,303);assert.equal(access.headers.get('x-robots-tag'),'noindex, nofollow');const cookie=access.headers.getSetCookie()[0].split(';')[0];
 const robots=await fetch(base+'/robots.txt',{headers:{cookie}});assert.equal(robots.status,200);assert.equal(robots.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(await robots.text(),'User-agent: *\nDisallow: /\n');assert.match(robots.headers.get('content-type'),/text\/plain/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));if(oldKey===undefined)delete process.env.SELFHOST_PREVIEW_KEY;else process.env.SELFHOST_PREVIEW_KEY=oldKey;if(oldFlag===undefined)delete process.env.SELFHOST_TEST_INSTANCE;else process.env.SELFHOST_TEST_INSTANCE=oldFlag;}
});
