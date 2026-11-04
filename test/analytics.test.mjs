import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONSENT_KEY,readConsent,analyticsScreen,analyticsCampaign,requestOperation,createAnalytics} from '../public/src/analytics.mjs';
function fixture({host='quellidelquasi.com',gpc=false,choice}={}){
 const values=new Map(),scripts=[],callbacks=[],events=new Map(),removed=[];let now=10000000000;
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 if(choice!==undefined)storage.setItem(CONSENT_KEY,JSON.stringify({version:1,granted:choice,at:now}));
 const win={location:{protocol:'https:',hostname:host,pathname:'/',hash:'#/bar/oggi?lega=private-league',search:'?token=private-token&utm_source=facebook'},navigator:{globalPrivacyControl:gpc},localStorage:storage,addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
 const doc={head:{append:s=>scripts.push(s)},createElement:()=>({}),referrer:'https://example.org/reset?token=secret'};
 Object.defineProperty(doc,'cookie',{get:()=> '_ga=abc; _ga_TEST=def; sid=private-session',set:v=>removed.push(v)});
 const controller=createAnalytics({win,doc,config:{enabled:true,measurementId:'G-TEST123',hostnames:['quellidelquasi.com']},now:()=>now,schedule:fn=>callbacks.push(fn)});
 return {win,doc,scripts,events,removed,controller,storage,values,advance:ms=>now+=ms,flush:()=>{while(callbacks.length)callbacks.shift()();}};
}
test('no script, measurement, ping or event queue exists before consent or after refusal',()=>{
 const f=fixture();f.controller.start();f.controller.page();f.controller.request('/api/slip','POST',true,25);f.flush();assert.equal(f.win.dataLayer,undefined);assert.equal(f.scripts.length,0);
 f.controller.consent(false);f.flush();assert.equal(f.win.dataLayer,undefined);assert.equal(f.scripts.length,0);assert.equal(readConsent(f.storage,10000000000),false);
});
test('opt-in loads one deferred tag, one page view and strips private URLs and referrers',()=>{
 const f=fixture();f.controller.start();f.controller.consent(true);assert.equal(f.scripts.length,0);f.flush();assert.equal(f.scripts.length,1);
 const calls=f.win.dataLayer;assert.equal(Object.prototype.toString.call(calls[0]),'[object Arguments]');assert.equal(calls.filter(c=>c[0]==='config').length,1);assert.equal(calls.filter(c=>c[1]==='page_view').length,1);
 assert.equal(calls.find(c=>c[0]==='config')[2].allow_google_signals,false);assert.equal(calls.find(c=>c[0]==='config')[2].send_page_view,false);
 f.controller.page();assert.equal(calls.filter(c=>c[1]==='page_view').length,1);
 f.win.location.hash='#/fanta/squadra?lega=another-secret&giornata=8';f.events.get('quasi:navigation')();f.flush();assert.equal(calls.filter(c=>c[1]==='page_view').length,2);
 assert.doesNotMatch(JSON.stringify(calls),/private|another-secret|giornata=|token=/);assert.equal(calls.at(-1)[2].page_path,'/fanta/squadra');assert.equal(calls.at(-1)[2].page_referrer,'https://example.org/');
});
test('revocation cancels queued opt-ins, blocks future events and leaves session cookies alone',()=>{
 const f=fixture();f.controller.start();f.controller.consent(true);f.controller.consent(false);f.flush();assert.equal(f.scripts.length,0);
 f.controller.consent(true);f.flush();const count=f.win.dataLayer.length;f.controller.consent(false);f.controller.page();f.controller.request('/api/login','POST',true,12);f.flush();assert.equal(f.win.dataLayer.length,count);assert.equal(f.win['ga-disable-G-TEST123'],true);assert.ok(f.removed.length>0);assert.ok(f.removed.every(c=>c.startsWith('_ga')));
});
test('writes are counted only after an opted-in request outcome and never contain its body or error text',()=>{
 const f=fixture({choice:true});f.controller.start();f.flush();f.controller.request('/api/slip','POST',true,145.7);f.controller.request('/fanta-api/lineup','POST',false,28001,503);f.controller.request('/api/profile','POST',true,10);f.controller.request('/api/state','GET',true,20);
 const events=f.win.dataLayer.filter(c=>c[0]==='event'&&c[1]!=='page_view');assert.equal(events.length,2);assert.equal(events[0][1],'slip_saved');assert.equal(events[0][2].duration_ms,146);assert.equal(events[1][2].operation,'lineup_saved');assert.equal(events[1][2].status_group,'5xx');assert.equal(requestOperation('/api/slip?league=private','GET'),null);
});
test('local previews, unknown hosts and global privacy control never load Google',()=>{
 for(const options of [{host:'localhost',choice:true},{host:'preview.trycloudflare.com',choice:true},{host:'quellidelquasi.com.evil.test',choice:true},{gpc:true,choice:true}]){const f=fixture(options);f.controller.start();f.controller.consent(true);f.flush();assert.equal(f.controller.enabled,false);assert.equal(f.scripts.length,0);assert.equal(f.win.dataLayer,undefined);}
});
test('expired consent and cross-tab withdrawal do not keep tracking enabled',()=>{
 const f=fixture({choice:true});f.advance(181*86400000);assert.equal(readConsent(f.storage,10000000000+181*86400000),null);
 const other=fixture({choice:true});other.controller.start();other.flush();other.storage.setItem(CONSENT_KEY,JSON.stringify({version:1,granted:false,at:10000000000}));other.events.get('storage')({key:CONSENT_KEY});assert.equal(other.controller.granted,false);assert.equal(other.win['ga-disable-G-TEST123'],true);
});
test('account links and unknown screens never leak arbitrary hash contents',()=>{
 assert.equal(analyticsScreen({hash:'#action=reset&token=secret'}),'/account');assert.equal(analyticsScreen({hash:'#/fanta/my-private-username?email=foo@bar.it'}),'/fanta/altro');assert.equal(analyticsScreen({pathname:'/invito/private-code'}),'/inizio');assert.deepEqual(analyticsCampaign('?utm_source=facebook&utm_campaign=test_1&utm_medium=foo%40bar.it&email=secret'),{campaign_source:'facebook',campaign_name:'test_1'});
});
test('production entry points share one analytics controller instead of splitting consent and request tracking',()=>{
 const meta=JSON.parse(fs.readFileSync(new URL('../docs/BUILD-METAFILE.json',import.meta.url),'utf8'));
 const owners=Object.entries(meta.outputs).filter(([,output])=>Object.keys(output.inputs).includes('public/src/analytics.mjs')).map(([name])=>name);assert.equal(owners.length,1);
 const reachable=(entry,target,seen=new Set())=>{if(entry===target)return true;if(seen.has(entry))return false;seen.add(entry);return (meta.outputs[entry]?.imports||[]).filter(i=>!i.external&&i.kind!=='dynamic-import').some(i=>reachable(i.path,target,seen));};
 assert.ok(reachable('dist/build/app.mjs',owners[0]));assert.ok(reachable('dist/build/analytics-start.mjs',owners[0]));
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/src="\/build\/analytics-start\.mjs"/);assert.doesNotMatch(html,/<script[^>]+src="https:\/\/www\.googletagmanager/);
});
