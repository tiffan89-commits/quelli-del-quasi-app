import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeClarity,fetchClarity,ClarityError} from '../lib/admin-insights/clarity.mjs';
import {refreshInsights,readInsights,requestRefresh,emptyReport} from '../lib/admin-insights/service.mjs';
import {recommend,dashboard} from '../lib/admin-insights/analysis.mjs';
import {renderInsights} from '../public/src/admin-insights.mjs';
const now=Date.parse('2026-11-05T14:00:00Z'),hour=3600000;
const metric=(metricName,...information)=>({metricName,information});
const sample=()=>[metric('Traffic',{totalSessionCount:'100',totalBotSessionCount:'2',distinctUserCount:'75',pagesPerSessionPercentage:1.33}),metric('ScrollDepth',{averageScrollDepth:75.62}),...['DeadClickCount','RageClickCount','ExcessiveScroll','QuickbackClick','ScriptErrorCount','ErrorClickCount'].map(name=>metric(name,{sessionsCount:'100',sessionsWithMetricPercentage:4,subTotal:'8'})),metric('Device',{name:'Mobile',sessionsCount:80}),metric('Browser',{name:'<script>provider</script>',sessionsCount:50}),metric('PopularPages',{url:'https://site.invalid/?token=PRIVATE',visitsCount:5})];
function memory(){const values=new Map();let n=0;return {values,async get(k){return structuredClone(values.get(k)?.data||null);},async getWithMetadata(k){return structuredClone(values.get(k)||null);},async setJSON(k,v,o={}){const prev=values.get(k);if(o.onlyIfNew&&prev||o.onlyIfMatch&&prev?.etag!==o.onlyIfMatch)return {modified:false};const etag=String(++n);values.set(k,{data:structuredClone(v),etag});return {modified:true,etag};}};}
const product=async()=>null;
test('export uses exactly one fixed Microsoft request, no dimensions, no redirects and a server-only bearer header',async()=>{
 let count=0;const c=await fetchClarity({env:{CLARITY_EXPORT_TOKEN:'unit-test-token'},now,fetcher:async(url,init)=>{count++;assert.equal(url,'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3');assert.equal(init.headers.Authorization,'Bearer unit-test-token');assert.equal(init.redirect,'error');return Response.json(sample());}});
 assert.equal(count,1);assert.equal(c.sessions,100);assert.equal(c.users,75);assert.equal(c.scrollDepthPct,75.62);assert.equal(c.friction.rageClicks.affectedPct,4);assert.equal(c.from,'2026-11-02T14:00:00.000Z');assert.ok(!JSON.stringify(c).includes('PRIVATE'));assert.ok(!JSON.stringify(c).includes('unit-test-token'));
});
test('unknown or incomplete metrics stay unknown, zero is retained, invalid percentages rejected and unique users never summed',()=>{
 const c=decodeClarity([metric('Traffic',{totalSessionCount:10,distinctUserCount:5},{totalSessionCount:20,distinctUserCount:9}),metric('RageClickCount',{sessionsCount:0,sessionsWithMetricPercentage:0,subTotal:0}),metric('DeadClickCount',{sessionsCount:10,sessionsWithMetricPercentage:101})],{now});
 assert.equal(c.sessions,null);assert.equal(c.users,null);assert.equal(c.friction.rageClicks.affectedPct,0);assert.equal(c.friction.deadClicks.affectedPct,null);assert.equal(c.friction.scriptErrors.affectedPct,null);assert.ok(c.missingMetrics.includes('ScriptErrorCount'));
});
test('authentication, quota and network failures are sanitized, without retrying or exposing provider bodies',async()=>{
 for(const [status,code]of [[401,'clarity-authentication'],[403,'clarity-permission'],[429,'clarity-quota'],[500,'clarity-report-error']]){let calls=0;await assert.rejects(()=>fetchClarity({env:{CLARITY_EXPORT_TOKEN:'SECRET'},fetcher:async()=>{calls++;return new Response('SECRET BODY',{status});}}),e=>e.code===code&&!e.message.includes('SECRET'));assert.equal(calls,1);}
 await assert.rejects(()=>fetchClarity({env:{CLARITY_EXPORT_TOKEN:'SECRET'},fetcher:async()=>{throw Error('SECRET');}}),e=>e.code==='clarity-unreachable');
});
test('invalid, duplicate and oversized exports are rejected without leaking content',async()=>{
 for(const body of ['not json','{}',JSON.stringify([metric('Traffic',{}),metric('Traffic',{})]),'x'.repeat(2_000_001)])await assert.rejects(()=>fetchClarity({env:{CLARITY_EXPORT_TOKEN:'test'},fetcher:async()=>new Response(body)}),e=>e.code==='clarity-response-invalid');
});
test('disabled or missing token does not contact Microsoft',async()=>{
 let calls=0;await assert.rejects(()=>fetchClarity({env:{},fetcher:async()=>calls++}),e=>e.code==='clarity-not-configured');
 const store=memory();await refreshInsights({store,env:{ADMIN_INSIGHTS_ENABLED:'true'},product,clarity:async()=>calls++,now});assert.equal(calls,0);assert.equal((await readInsights({store,now})).clarityStatus,'not-configured');
});
test('shared export cache refreshes at 12 hours; reads and hourly product refreshes make no Clarity calls',async()=>{
 const store=memory(),env={ADMIN_INSIGHTS_ENABLED:'true',CLARITY_EXPORT_TOKEN:'SECRET'};let calls=0;
 const options={store,env,now,product,clarity:async({now})=>{calls++;return decodeClarity(sample(),{now});}};
 await refreshInsights(options);await readInsights({store,now});await refreshInsights({...options,now:now+hour});await refreshInsights({...options,now:now+11*hour});assert.equal(calls,1);await refreshInsights({...options,now:now+12*hour});assert.equal(calls,2);
 const c=(await readInsights({store,now:now+12*hour})).clarity;assert.equal(c.sessions,100);assert.equal(c.users,75);assert.ok(!JSON.stringify([...store.values]).includes('SECRET'));
});
test('manual refresh and restart cannot bypass six-hour minimum or duplicate a report total',async()=>{
 const store=memory(),env={ADMIN_INSIGHTS_ENABLED:'true',CLARITY_EXPORT_TOKEN:'test'};let calls=0;
 const options={store,env,now,product,clarity:async()=>{calls++;return decodeClarity(sample(),{now});}};
 await refreshInsights(options);
 for(const t of [1,2,5,6]){await requestRefresh({store,now:now+t*hour});await refreshInsights({...options,now:now+t*hour});assert.equal(calls,t===6?2:1);}
 assert.equal((await readInsights({store,now})).clarity.sessions,100);
 // A worker crash after reserving an attempt still suppresses a new request.
 await store.setJSON('clarity-export-attempt',{at:now+7*hour,nextAt:now+13*hour});await requestRefresh({store,now:now+8*hour});await refreshInsights({...options,now:now+8*hour});assert.equal(calls,2);
});
test('provider failure preserves previous report and quota errors wait 24 hours even after manual refresh',async()=>{
 const store=memory(),env={ADMIN_INSIGHTS_ENABLED:'true',CLARITY_EXPORT_TOKEN:'test'},options={store,env,now,product,clarity:async()=>decodeClarity(sample(),{now})};await refreshInsights(options);
 let failures=0;const fail=async()=>{failures++;throw new ClarityError('clarity-quota');};await refreshInsights({...options,now:now+12*hour,clarity:fail});
 await requestRefresh({store,now:now+19*hour});await refreshInsights({...options,now:now+19*hour,clarity:fail});assert.equal(failures,1);const r=await readInsights({store,now});assert.equal(r.clarityStatus,'stale');assert.equal(r.clarity.sessions,100);assert.equal(r.nextClarityAt,new Date(now+36*hour).toISOString());
});
test('concurrent workers share a lease and export only once',async()=>{
 const store=memory();let calls=0,release;const gate=new Promise(r=>release=r),options={store,env:{ADMIN_INSIGHTS_ENABLED:'true',CLARITY_EXPORT_TOKEN:'test'},now,product,clarity:async()=>{calls++;await gate;return decodeClarity(sample(),{now});}};
 const first=refreshInsights(options);await new Promise(r=>setImmediate(r));assert.equal((await refreshInsights(options)).skipped,'busy');release();await first;assert.equal(calls,1);
});
test('Clarity suggestions use metric-specific samples, stale or small reports do not trigger diagnoses',()=>{
 const clarity=decodeClarity(sample(),{now}),report={...emptyReport(),clarity,clarityStatus:'ready'};
 assert.ok(recommend(report).some(s=>s.id==='clarity-errors'));assert.ok(recommend(report).some(s=>s.id==='clarity-rage'));
 assert.ok(!recommend({...report,clarityStatus:'stale'}).some(s=>s.id.startsWith('clarity-')));
 clarity.friction.scriptErrors.sessions=6;assert.ok(!recommend(report).some(s=>s.id==='clarity-errors'));
 assert.equal(recommend(report).find(s=>s.id==='clarity-rage').metric,null);
});
test('Admin renders real aggregates, small sample and partial warnings; escapes labels and explains overlapping windows',()=>{
 const clarity=decodeClarity(sample(),{now});clarity.sessions=6;clarity.missingMetrics=['x'];const html=renderInsights(dashboard({...emptyReport(),clarity,clarityStatus:'ready'}, {},now));
 assert.match(html,/Sessioni Clarity/);assert.match(html,/Campione ancora piccolo/);assert.match(html,/parziali/);assert.match(html,/finestre sovrapposte non vengono sommate/);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>provider'));assert.ok(!html.includes('PRIVATE'));
 assert.match(renderInsights(dashboard(emptyReport(),{},now)),/Esportazione non configurata/);
});
