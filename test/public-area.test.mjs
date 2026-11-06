import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {checkEmail,checkUsername,checkPassword} from '../public/src/pubblico/convalida.mjs';
import {email} from '../lib/account.mjs';
import {mountPublic} from '../public/src/pubblico/app.mjs';
import {renderLanding,renderDemoChooser} from '../public/src/pubblico/landing.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('public validation follows account email, username and password bounds',()=>{
 for(const value of ['a@b.c','nome+tag@esempio.it',' a@b.it ','bad','a<b@c.it','a@b>c.it','a b@c.it','a'.repeat(255)+'@x.it']){let valid=true;try{email(value);}catch{valid=false;}assert.equal(checkEmail(value)===null,valid,value);}
 for(const value of ['abc','ABC','a.b-c_d','a'.repeat(60)])assert.equal(checkUsername(value),null);
 for(const value of ['a','a b','tiffano','TiFFano','a'.repeat(61)])assert.ok(checkUsername(value));
 for(const n of [0,9,201])assert.ok(checkPassword('a'.repeat(n)));for(const n of [10,200])assert.equal(checkPassword('a'.repeat(n)),null);
});
test('showcase escapes personalized invites and never offers the disabled Bar demo',()=>{
 assert.ok(!renderDemoChooser({barDemo:false}).includes('data-go="demo-bar"'));
 assert.ok(renderDemoChooser({barDemo:true}).includes('data-go="demo-bar"'));
 const html=renderLanding({invite:{code:'CODE',info:{league:'<script>',inviter:'<b>'}},barDemo:false});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
function harness(hash='#accedi',overrides={}){
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>'),storage=new Map();let url=new URL('https://example.test/'+hash);
 const history={pushState(_a,_b,path){url=new URL(path,url);},replaceState(_a,_b,path){url=new URL(path,url);}};
 Object.assign(globalThis,{window,document,history,location:{get hash(){return url.hash;},get search(){return url.search;},get pathname(){return url.pathname;}},scrollTo:()=>{},matchMedia:()=>({matches:true}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
 const calls=[],api={features:async()=>({barDemo:false}),inviteInfo:async()=>null,login:async p=>{calls.push(p);return {ok:true};},register:async()=>({pendingVerification:true}),forgotPassword:async()=>({message:'Inviato'}),resendVerification:async()=>({message:'Inviato'}),activate:async()=>({ok:true}),resetPassword:async()=>({ok:true}),...overrides};
 const root=document.getElementById('root'),logged=[];const controller=mountPublic(root,{api,onLoggedIn:r=>logged.push(r)});
 const input=(name,value)=>{const el=root.querySelector('[name="'+name+'"]');el.value=value;el.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const submit=()=>root.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 return {root,input,submit,controller,window,logged,calls};
}
test('double submit calls login once, retains disabled progress until completion and destroys old handlers',async()=>{
 let finish,count=0;const h=harness('#accedi',{login:()=>{count++;return new Promise(r=>finish=r);}});await flush();
 h.input('identity','utente');h.input('password','Password-finta');h.submit();h.submit();assert.equal(count,1);assert.equal(h.root.querySelector('button[type="submit"]').disabled,true);assert.match(h.root.textContent,/Accesso in corso/);
 finish({ok:true});await flush();assert.equal(h.logged.length,1);h.controller.destroy();
});
test('registration uses only email and password and renders mailbox, one-minute resend cooldown and route back',async()=>{
 const h=harness('#registrati');await flush();assert.equal(h.root.querySelectorAll('input').length,2);
 h.input('email','nuovo@example.test');h.input('password','Password-finta');h.submit();await flush();assert.match(h.root.textContent,/Controlla la tua email/);assert.match(h.root.textContent,/Reinvia tra 60 s/);assert.ok(h.root.querySelector('[data-pb-resend]').disabled);h.controller.destroy();
});

test('email-only registration is single-flight and email correction sends the previous address, never a username',async()=>{
 let complete;const sent=[],h=harness('#registrati',{register:p=>{sent.push(p);return sent.length===1?new Promise(r=>complete=r):Promise.resolve({pendingVerification:true});}});await flush();
 h.input('email','typo@example.test');h.input('password','Password-finta');h.submit();h.submit();assert.equal(sent.length,1);assert.equal(h.root.querySelector('[type=submit]').disabled,true);assert.equal('username' in sent[0],false);
 complete({pendingVerification:true});await flush();h.root.querySelector('[data-go=register-edit]').click();h.input('email','correct@example.test');h.input('password','Password-finta');h.submit();await flush();
 assert.equal(sent.length,2);assert.equal(sent[1].previousEmail,'typo@example.test');assert.equal(sent[1].correctEmail,true);assert.equal('username' in sent[1],false);h.controller.destroy();
});
test('expired links stay recoverable and activation only happens on explicit submit',async()=>{
 let calls=0;const h=harness('#action=verify&token=finto',{activate:async()=>{calls++;throw Error('Link scaduto');}});await flush();assert.equal(calls,0);h.submit();await flush();assert.match(h.root.textContent,/Link scaduto/);assert.ok(h.root.querySelector('[data-go="resend"]'));h.controller.destroy();
});

test('typing hidden passwords, validation and late feature responses keep the same native input node',async()=>{
 let features;const h=harness('#registrati',{features:()=>new Promise(r=>features=r)}),password=h.root.querySelector('[name=password]');
 for(const char of 'Quasi-Password!'){h.input('password',password.value+char);assert.equal(h.root.querySelector('[name=password]'),password);assert.equal(password.type,'password');}
 features({barDemo:false});await flush();assert.equal(h.root.querySelector('[name=password]'),password);assert.equal(password.value,'Quasi-Password!');
 h.root.querySelector('[data-pb-eye]').click();assert.equal(h.root.querySelector('[name=password]'),password);assert.equal(password.type,'text');assert.equal(password.value,'Quasi-Password!');
 h.root.querySelector('[data-pb-eye]').click();assert.equal(password.type,'password');h.controller.destroy();
});

test('autofilled values submit without input events and failed login can be retried',async()=>{
 let attempts=0;const h=harness('#accedi',{login:async p=>{h.calls.push(p);if(++attempts===1)throw Error('Credenziali errate');return {ok:true};}});await flush();
 h.root.querySelector('[name=identity]').value='autofill';h.root.querySelector('[name=password]').value='Password-autofill!';h.submit();await flush();assert.equal(h.calls[0].password,'Password-autofill!');assert.equal(h.root.querySelector('[type=submit]').disabled,false);
 h.submit();await flush();assert.equal(h.logged.length,1);h.controller.destroy();
});

test('returning to landing while login is pending prevents a late transition into the account',async()=>{
 let finish;const h=harness('#accedi',{login:()=>new Promise(r=>finish=r)});await flush();h.input('identity','quasi');h.input('password','Password-finta');h.submit();h.root.querySelector('[data-go=home]').click();finish({ok:true});await flush();assert.equal(h.logged.length,0);assert.equal(h.root.querySelector('[data-pb-form]'),null);h.controller.destroy();
});
