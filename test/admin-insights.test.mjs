import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {accessToken,fetchAnalytics,reportRequests,decodeReport,AnalyticsError} from '../lib/admin-insights/google.mjs';
import {summarizeProduct,loadProduct,PRODUCT_SQL} from '../lib/admin-insights/product.mjs';
import {recommend,dashboard,evaluateImprovement,analyticsSummary} from '../lib/admin-insights/analysis.mjs';
import {refreshInsights,readInsights,updateSuggestion,requestRefresh,emptyReport} from '../lib/admin-insights/service.mjs';
import {renderInsights,mountAdminInsights} from '../public/src/admin-insights.mjs';
import {emptyState} from '../lib/db.mjs';
import {sha} from '../lib/game.mjs';
import {createApi} from '../netlify/functions/api.mjs';
import {parseHTML} from 'linkedom';

function memory(){const data=new Map();let n=0;return {data,async get(k){return structuredClone(data.get(k)?.data||null);},async getWithMetadata(k){return structuredClone(data.get(k)||null);},async setJSON(k,v,o={}){const prior=data.get(k);if(o.onlyIfNew&&prior||o.onlyIfMatch&&prior?.etag!==o.onlyIfMatch)return {modified:false};const etag=String(++n);data.set(k,{data:structuredClone(v),etag});return {modified:true,etag};}};}
const now=Date.parse('2026-11-05T12:00:00Z');
const summary=(sessions=150,rate=.5)=>({rows:[{dateRange:'current',sessions,totalUsers:100,newUsers:70,engagedSessions:sessions*rate,engagementRate:rate},{dateRange:'previous',sessions:100,totalUsers:90,newUsers:30,engagementRate:.6}],metadata:{}});
const google=()=>({fetchedAt:new Date(now).toISOString(),summary:summary(),daily:{rows:[]},campaigns:{rows:[]},events:{rows:[]},devices:{rows:[]},pages:{rows:[]}});
const product=()=>summarizeProduct({users:[{id:'u',createdAt:'2026-11-03',verified:true,lastLoginAt:'2026-11-04'}],stats:{days:{'2026-11-04':{requests:200,errors:10,users:{u:10}}}},leagues:1},{coached:2,teams:10},now);

test('Google requests preserve unique period totals, compare equal complete periods, and batch at most five reports',()=>{
 const r=reportRequests();assert.equal(r.length,6);assert.deepEqual(r[0].dimensions,[]);assert.deepEqual(r[0].dateRanges,[{startDate:'28daysAgo',endDate:'yesterday',name:'current'},{startDate:'56daysAgo',endDate:'29daysAgo',name:'previous'}]);assert.equal(r[1].dateRanges[0].endDate,'yesterday');assert.ok(!JSON.stringify(r).includes('userId'));
});
test('Google uses fixed token endpoint, signed service assertion, readonly scope and cached tokens; private key never reaches API reports',async()=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:2048}),credentials={type:'service_account',client_email:'reader@example.invalid',private_key:pair.privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://untrusted.invalid/'};let calls=0;
 const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://oauth2.googleapis.com/token');const jwt=new URLSearchParams(init.body).get('assertion'),[head,body,sig]=jwt.split('.'),claims=JSON.parse(Buffer.from(body,'base64url'));assert.equal(claims.scope,'https://www.googleapis.com/auth/analytics.readonly');assert.equal(createVerify('RSA-SHA256').update(head+'.'+body).verify(pair.publicKey,Buffer.from(sig,'base64url')),true);return Response.json({access_token:'local-test-access',expires_in:3600});};
 assert.equal(await accessToken(credentials,{fetcher,now}),'local-test-access');assert.equal(await accessToken(credentials,{fetcher,now:now+1000}),'local-test-access');assert.equal(calls,1);
});
test('provider denial is sanitized and never returns token-bearing provider body',async()=>{const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});await assert.rejects(()=>accessToken({type:'service_account',client_email:'x',private_key:key},{now,fetcher:async()=>new Response('SECRET_CONTENT',{status:403})}),e=>e.code==='google-permission-or-api-disabled'&&!e.message.includes('SECRET'));});
test('Google response decoding retains numeric precision and exposes threshold and truncation warnings',()=>{const d=decodeReport({dimensionHeaders:[{name:'dateRange'}],metricHeaders:[{name:'engagementRate'}],rows:[{dimensionValues:[{value:'current'}],metricValues:[{value:'0.123456'}]}],metadata:{subjectToThresholding:true,dataLossFromOtherRow:true},rowCount:10});assert.equal(d.rows[0].engagementRate,.123456);assert.equal(d.metadata.thresholded,true);assert.equal(d.metadata.truncated,true);});
test('all six reports use two batch calls, checked response counts and configured property',async()=>{
 const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});const calls=[];
 const result=await fetchAnalytics({env:{GA4_PROPERTY_ID:'562275036'},credentials:{type:'service_account',client_email:'reports@test.invalid',private_key:key},now,fetcher:async(url,init)=>{calls.push(url);if(url.includes('oauth2'))return Response.json({access_token:'test',expires_in:3600});assert.equal(url,'https://analyticsdata.googleapis.com/v1beta/properties/562275036:batchRunReports');const body=JSON.parse(init.body);assert.ok(body.requests.length<=5);return Response.json({reports:body.requests.map(()=>({rows:[],rowCount:0}))});}});
 assert.equal(calls.length,3);assert.equal(result.property,'562275036');assert.equal(result.excludesToday,true);
});
test('product data is projected and read in a readonly consistent transaction; output contains no user IDs or email',async()=>{
 const queries=[];let released=false;const c={query:async(sql)=>{queries.push(sql);return {rows:sql===PRODUCT_SQL?[{data:{users:[{id:'PRIVATE-ID',createdAt:'2026-11-03',verified:true,email:'PRIVATE@invalid'}]}}]:[{}]};},release:()=>released=true};const p=await loadProduct({connect:async()=>c,now});assert.match(queries[0],/READ ONLY/);assert.equal(queries.at(-1),'COMMIT');assert.equal(released,true);assert.ok(!JSON.stringify(p).includes('PRIVATE'));assert.equal(p.registered7,1);
});
test('missing registration dates do not become new accounts and absent request denominators are unknown, not zero percent',()=>{const p=summarizeProduct({users:[{id:'old',verified:true}]},{},now);assert.equal(p.registered7,0);assert.equal(p.unknownRegistrationDates,1);assert.equal(p.errorRate,null);});
test('recommendations separate sample limitations from actual product errors and never invent Google visits',()=>{const r={...emptyReport(),product:product()};const list=recommend(r);assert.ok(list.some(s=>s.id==='connect-google'));assert.ok(list.some(s=>s.id==='reduce-errors'));assert.equal(analyticsSummary(null),null);assert.equal(dashboard(r).method.generatedAI,false);});
test('improvement evaluation waits for complete disjoint weeks and meaningful samples; does not declare causality',()=>{
 const appliedAt='2026-10-10T12:00:00Z',start=Date.parse('2026-10-03');const days=Array.from({length:15},(_,i)=>({date:new Date(start+i*86400000).toISOString().slice(0,10),requests:100,errors:i<7?10:i===7?99:2}));const task={status:'applied',appliedAt,metric:'errorRate'};
 assert.equal(evaluateImprovement(task,{product:{days}},Date.parse('2026-10-15')).state,'observing');const result=evaluateImprovement(task,{product:{days}},now);assert.equal(result.state,'improved');assert.equal(result.deltaPoints,-8);assert.match(result.message,/non prova/);assert.equal(evaluateImprovement(task,{product:{days:days.slice(2)}},now).state,'insufficient');
});
test('Google improvement windows follow the property timezone and exclude the entire application day',()=>{
 const start=Date.parse('2026-10-05'),rows=Array.from({length:15},(_,i)=>({date:new Date(start+i*86400000).toISOString().slice(0,10).replaceAll('-',''),sessions:100,engagedSessions:i<7?30:i===7?100:50}));
 const result=evaluateImprovement({status:'applied',appliedAt:'2026-10-11T23:30:00Z',metric:'engagementRate'},{google:{summary:{metadata:{timeZone:'Europe/Rome'}},daily:{rows}}},now);
 assert.equal(result.before.from,'2026-10-05');assert.equal(result.before.to,'2026-10-11');assert.equal(result.after.from,'2026-10-13');assert.equal(result.deltaPoints,20);
});
test('speed recommendations measure the same route before and after and display milliseconds, not percentages',()=>{
 const start=Date.parse('2026-10-03'),days=Array.from({length:15},(_,i)=>({date:new Date(start+i*86400000).toISOString().slice(0,10),requests:100,routes:{profile:{calls:10,milliseconds:i<7?20000:5000}}}));
 const r=evaluateImprovement({status:'applied',appliedAt:'2026-10-10T12:00:00Z',metric:'latency:profile'},{product:{days}},now);
 assert.equal(r.state,'improved');assert.equal(r.before.value,2000);assert.equal(r.after.value,500);assert.equal(r.before.unit,'ms');assert.equal(r.relativeChangePct,-75);
});
test('cached Admin reads and workflow writes never invoke Google or sports/game mutations; duplicate workflow writes are idempotent',async()=>{
 const store=memory();await store.setJSON('report',{...emptyReport(),product:product()});await updateSuggestion({id:'reduce-errors',status:'applied',note:'Ridotte le attese'},{store,now});const first=await readInsights({store,now});assert.equal(first.suggestions.find(s=>s.id==='reduce-errors').workflow.status,'applied');assert.equal((await updateSuggestion({id:'reduce-errors',status:'applied',note:'Ridotte le attese'},{store,now:now+1000})).unchanged,true);assert.equal((await store.get('workflow')).history.length,1);await assert.rejects(()=>updateSuggestion({id:'invented',status:'applied'},{store,now}),e=>e.status===404);
});
test('refresh is cached hourly, Google refreshes at six hours and failures preserve previous actual report',async()=>{
 const store=memory(),env={ADMIN_INSIGHTS_ENABLED:'true',GA4_PROPERTY_ID:'562275036',GA4_CREDENTIALS_FILE:'private.json'};let g=0,p=0;
 const options={store,env,now,google:async()=>{g++;return google();},product:async()=>{p++;return product();}};
 await refreshInsights(options);assert.equal(g,1);assert.equal(p,1);assert.equal((await refreshInsights({...options,now:now+60000})).skipped,'cached');await refreshInsights({...options,now:now+3600000});assert.equal(g,1);assert.equal(p,2);
 await refreshInsights({...options,now:now+6*3600000,google:async()=>{throw new AnalyticsError('google-quota');}});const result=await readInsights({store,now});assert.equal(result.googleStatus,'stale');assert.equal(result.google.fetchedAt,google().fetchedAt);assert.equal(result.googleError,'google-quota');
});
test('concurrent workers share a lease and manual refresh requests are deduplicated for 15 minutes',async()=>{
 const store=memory(),env={ADMIN_INSIGHTS_ENABLED:'true'};let p=0,release;const gate=new Promise(r=>release=r),options={store,env,now,product:async()=>{p++;await gate;return product();}};
 const a=refreshInsights(options);await new Promise(r=>setImmediate(r));const b=await refreshInsights(options);assert.equal(b.skipped,'busy');release();await a;assert.equal(p,1);await requestRefresh({store,now});assert.equal((await requestRefresh({store,now:now+1000})).reused,true);
});
test('insight routes require a live MFA admin before touching reports and reject wrong methods and cross-origin posts',async()=>{
 const s=emptyState();s.users=[{id:'a',adminOnly:true,role:'system-admin'},{id:'p',emailVerified:true}];s.systemAdminId='a';const sid='admin-test-session',player='player-test-session';s.sessions=[{uid:'a',token:sha(sid),expires:now+86400000000,admin:true,mfaAt:now},{uid:'p',token:sha(player),expires:now+86400000000}];let calls=0;const api=createApi({transact:async fn=>fn(s),insightService:{readInsights:async()=>{calls++;return {ok:true};}}});
 const req=(token,method='GET',origin)=>new Request('https://example.test/api/platform-insights',{method,headers:{...(token?{cookie:'sid='+token}:{}),...(origin?{origin}:{})}});
 assert.equal((await api(req())).status,403);assert.equal((await api(req(player))).status,403);assert.equal(calls,0);assert.equal((await api(req(sid))).status,200);assert.equal(calls,1);assert.equal((await api(req(sid,'POST'))).status,405);assert.equal((await api(req(sid,'POST','https://evil.invalid'))).status,403);
});
test('Admin UI escapes external labels, shows unknown data honestly and does not sum daily users into unique totals',()=>{
 const r={...emptyReport(),product:product(),google:google()};r.google.campaigns.rows=[{sessionSourceMedium:'<script>bad</script>',sessionCampaignName:'test',sessions:10,engagedSessions:5}];const html=renderInsights(dashboard(r,{},now));assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('&lt;script&gt;'));assert.match(html,/non sono persone/);assert.match(html,/non un modello generativo/);assert.match(html,/100/);
});
test('Admin insight actions disable controls immediately and ignore repeated clicks until save resolves',async()=>{
 const {document}=parseHTML('<section id="view"></section>');const target=document.querySelector('#view');let resolveSave,saves=0;const data=dashboard({...emptyReport(),product:product()}, {},now);
 const api=async(path)=>path==='platform-insights'?data:path==='platform-insights-task'?(saves++,await new Promise(r=>resolveSave=r),{ok:true}):{ok:true};
 const stop=mountAdminInsights(target,api);await new Promise(r=>setImmediate(r));const b=target.querySelector('[data-insight-status="applied"]');const first=target.onclick({target:b});assert.equal(b.disabled,true);await target.onclick({target:b});assert.equal(saves,1);resolveSave();await first;stop();
});
