import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createClarity,clarityLocationAllowed} from '../public/src/clarity.mjs';
import {createAnalytics,CONSENT_KEY,LEGACY_CONSENT_KEY,readConsent} from '../public/src/analytics.mjs';
function fixture({host='quellidelquasi.com',pathname='/',hash='#/bar/oggi',search='',gpc=false}={}){
 const {document}=parseHTML('<html><head></head><body><div id="profile">Private name</div><div id="chat">Private chat</div><input value="private-password"></body></html>');
 const values=new Map(),listeners=new Map(),scheduled=[],removed=[];
 Object.defineProperty(document,'cookie',{get:()=> '_clck=old; _clsk=session; sid=private-session',set:v=>removed.push(v)});
 const win={location:{protocol:'https:',hostname:host,pathname,hash,search},navigator:{globalPrivacyControl:gpc},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const config={enabled:true,measurementId:'G-TEST123',clarityProjectId:'z8vq8o76ja',hostnames:['quellidelquasi.com']};
 return {win,doc:document,config,values,listeners,removed,scheduled,flush:()=>{while(scheduled.length)scheduled.shift()();},scripts:()=>[...document.querySelectorAll('script')]};
}
test('Clarity creates no vendor queue, script or tracking event before consent or after refusal',()=>{
 const f=fixture(),c=createClarity(f);c.page();c.event('slip_saved');assert.equal(f.win.clarity,undefined);assert.equal(f.scripts().length,0);c.consent(false);assert.equal(f.win.clarity,undefined);assert.equal(f.scripts().length,0);assert.ok(f.removed.every(v=>!v.startsWith('sid')));
});
test('opt-in loads only the specified async project, masks all present and future app views, and denies ad storage',()=>{
 const f=fixture(),c=createClarity({...f,screen:()=>'/bar/oggi'});c.consent(true);c.page();assert.equal(f.scripts().length,1);assert.equal(f.scripts()[0].src,'https://www.clarity.ms/tag/z8vq8o76ja');assert.equal(f.scripts()[0].async,true);assert.equal(f.doc.documentElement.getAttribute('data-clarity-mask'),'true');
 const calls=f.win.clarity.q;assert.ok(calls.some(a=>a[0]==='consentv2'&&a[1].ad_Storage==='denied'&&a[1].analytics_Storage==='granted'));assert.ok(!calls.some(a=>a[0]==='identify'));assert.ok(!JSON.stringify(calls).includes('Private'));f.doc.body.innerHTML='<p>New private view</p>';assert.equal(f.doc.documentElement.getAttribute('data-clarity-mask'),'true');
});
test('admin, account tokens, invitation links, private query strings and profile views never load Clarity',()=>{
 for(const input of [{pathname:'/admin.html'},{pathname:'/account'},{pathname:'/privacy.html'},{pathname:'/invito/private-code'},{hash:'#action=reset&token=secret'},{hash:'#/bar/oggi?league=private'},{hash:'#/fanta/admin'},{hash:'#/bar/profilo'},{search:'?slip=private&round=10'},{search:'?utm_source=email@example.org'}]){const f=fixture(input),c=createClarity(f);c.consent(true);assert.equal(f.scripts().length,0,JSON.stringify(input));assert.equal(f.win.clarity,undefined);}
 assert.equal(clarityLocationAllowed({pathname:'/',hash:'#/fanta/giornata',search:'?utm_source=meta&utm_campaign=test_1'}),true);
});
test('local, preview, unexpected host and global privacy control never load the project',()=>{
 for(const input of [{host:'127.0.0.1'},{host:'casa.quellidelquasi.com'},{host:'quellidelquasi.com.evil.invalid'},{gpc:true}]){const f=fixture(input),c=createClarity(f);c.consent(true);assert.equal(f.scripts().length,0);assert.equal(f.win.clarity,undefined);}
});
test('withdrawal removes queued grants and prevents a late tag from queuing a start',()=>{
 const f=fixture(),c=createClarity(f);c.consent(true);const stub=f.win.clarity;stub('start',{projectId:'z8vq8o76ja'});c.consent(false);stub('start',{projectId:'z8vq8o76ja'});
 assert.ok(!stub.q.some(a=>a[0]==='start'));assert.ok(!stub.q.some(a=>a[0]==='consentv2'&&a[1].analytics_Storage==='granted'));assert.equal(c.running,false);assert.ok(f.removed.some(x=>x.startsWith('_clck=')));assert.ok(f.removed.some(x=>x.startsWith('_clsk=')));
});
test('loaded SDK stops on revocation, clears only its cookies and resumes with the existing configuration without another script',()=>{
 const f=fixture(),c=createClarity(f);c.consent(true);f.win.clarity('start',{projectId:'z8vq8o76ja',upload:'https://f.clarity.ms/collect'});const calls=[];f.win.clarity=(...a)=>calls.push(a);c.consent(false);c.event('lineup_saved');assert.ok(calls.some(a=>a[0]==='stop'));assert.ok(!calls.some(a=>a[0]==='event'));c.consent(true);assert.ok(calls.some(a=>a[0]==='start'&&a[1].projectId==='z8vq8o76ja'));assert.equal(f.scripts().length,1);assert.ok(f.removed.every(x=>!x.startsWith('sid=')));
});
test('entering a sensitive SPA view pauses recording before deferred Google page updates',()=>{
 const f=fixture(),a=createAnalytics({...f,schedule:fn=>f.scheduled.push(fn)});a.start();a.consent(true);f.flush();const stub=f.win.clarity;stub('start',{projectId:'z8vq8o76ja'});const calls=[];f.win.clarity=(...x)=>calls.push(x);f.win.location.hash='#/bar/profilo';f.listeners.get('quasi:navigation')();assert.ok(calls.some(x=>x[0]==='stop'));assert.equal(f.scheduled.length,1);
});
test('a previous Google-only grant requires renewed consent; a previous refusal stays refused',()=>{
 const f=fixture(),at=Date.now();f.values.set(LEGACY_CONSENT_KEY,JSON.stringify({version:1,granted:true,at}));assert.equal(readConsent(f.win.localStorage,at),null);const a=createAnalytics({...f,now:()=>at,schedule:fn=>f.scheduled.push(fn)});a.start();f.flush();assert.equal(f.scripts().length,0);
 f.values.set(LEGACY_CONSENT_KEY,JSON.stringify({version:1,granted:false,at}));assert.equal(readConsent(f.win.localStorage,at),false);
});
test('new consent is persisted for both versions and withdrawal from an older tab revokes the new provider too',()=>{
 const f=fixture(),a=createAnalytics({...f,schedule:fn=>f.scheduled.push(fn)});a.start();a.consent(true);f.flush();assert.equal(JSON.parse(f.values.get(CONSENT_KEY)).version,2);assert.equal(JSON.parse(f.values.get(LEGACY_CONSENT_KEY)).version,1);
 f.values.set(LEGACY_CONSENT_KEY,JSON.stringify({version:1,granted:false,at:Date.now()}));f.listeners.get('storage')({key:LEGACY_CONSENT_KEY});assert.equal(a.granted,false);assert.equal(JSON.parse(f.values.get(CONSENT_KEY)).granted,false);
});
test('request outcomes create only generic Clarity events, never URLs, request bodies or player identity',()=>{
 const f=fixture(),a=createAnalytics({...f,schedule:fn=>f.scheduled.push(fn)});a.start();a.consent(true);f.flush();a.request('/api/slip?token=private','POST',true,200,200);a.request('/fanta-api/lineup','POST',false,200,503);const calls=f.win.clarity.q.filter(x=>x[0]==='event');assert.deepEqual(calls.map(x=>x[1]),['slip_saved','lineup_saved_failed']);assert.ok(!JSON.stringify(calls).includes('private'));assert.ok(calls.every(x=>x.length===2));
});
