import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountPublic} from '../public/src/pubblico/app.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function harness(hash='#accedi',extra={}){
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>'),storage=new Map(),assigned=[];let url=new URL('https://quasi.test/'+hash);
 Object.assign(globalThis,{window,document,history:{pushState(_a,_b,p){url=new URL(p,url);},replaceState(_a,_b,p){url=new URL(p,url);}},location:{get hash(){return url.hash;},get search(){return url.search;},get pathname(){return url.pathname;},assign:u=>assigned.push(u)},scrollTo:()=>{},matchMedia:()=>({matches:true}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
 const logged=[],api={features:async()=>({barDemo:true,socialProviders:['google','facebook']}),inviteInfo:async()=>null,socialStart:async()=>({authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=test'}),socialStatus:async()=>({ready:true,email:'mario@gmail.com',provider:'google'}),socialComplete:async()=>({ok:true}),...extra},root=document.querySelector('#root');const controller=mountPublic(root,{api,onLoggedIn:r=>logged.push(r)});return {root,window,controller,assigned,logged};
}
test('late provider discovery inserts buttons without replacing a password field or typed text',async()=>{
 let deliver;const h=harness('#accedi',{features:()=>new Promise(r=>deliver=r)}),input=h.root.querySelector('[name=password]');input.value='Saved-password';deliver({socialProviders:['google','facebook']});await flush();assert.equal(h.root.querySelector('[name=password]'),input);assert.equal(input.value,'Saved-password');assert.equal(h.root.querySelectorAll('[data-social-provider]').length,2);assert.equal(h.root.querySelector('[data-social-provider=apple]'),null);h.controller.destroy();
});
test('social redirect is single-flight, disables both password and social submissions and allows a recoverable failure',async()=>{
 let finish,calls=0;const h=harness('#accedi',{socialStart:()=>{calls++;return new Promise(r=>finish=r);}});await flush();h.root.querySelector('[data-social-provider=google]').click();h.root.querySelector('[data-social-provider=google]').click();assert.equal(calls,1);assert.equal(h.root.querySelector('[type=submit]').disabled,true);assert.ok([...h.root.querySelectorAll('[data-social-provider]')].every(b=>b.disabled));finish({authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=test'});await flush();assert.equal(h.assigned.length,1);h.controller.destroy();
});
test('existing Google account completes automatically with no username or password form and no duplicate callback',async()=>{
 let calls=0;const h=harness('#social',{socialComplete:async()=>{calls++;return {ok:true,invite:'LEGACODE'};}});await flush();await flush();assert.equal(calls,1);assert.equal(h.logged.length,1);assert.equal(h.logged[0].invite,'LEGACODE');assert.equal(h.root.querySelector('[name=username]'),null);h.controller.destroy();
});
test('Facebook email confirmation is explicit and does not announce an active account before verification',async()=>{
 const h=harness('#social',{socialStatus:async()=>({ready:true,provider:'facebook',email:'mario@example.test'}),socialComplete:async()=>({ok:true,pendingVerification:true,identity:'mario@example.test'})});await flush();await flush();assert.equal(h.logged.length,0);assert.match(h.root.textContent,/Controlla la tua email/);assert.match(h.root.textContent,/mario@example.test/);h.controller.destroy();
});
test('cancelling at the provider returns to normal login with back navigation and an explanatory message',()=>{
 const h=harness('#social-error=cancelled');assert.match(h.root.textContent,/Accesso annullato/);assert.ok(h.root.querySelector('[name=identity]'));assert.ok(h.root.querySelector('[data-go=home]'));h.controller.destroy();
});
test('a late social response after navigating home cannot open the account or send the browser to a provider',async()=>{
 let finish;const h=harness('#accedi',{socialStart:()=>new Promise(r=>finish=r)});await flush();h.root.querySelector('[data-social-provider=google]').click();h.root.querySelector('[data-go=home]').click();finish({authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth'});await flush();assert.equal(h.assigned.length,0);assert.equal(h.logged.length,0);h.controller.destroy();
});
