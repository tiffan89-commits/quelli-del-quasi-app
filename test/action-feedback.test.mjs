import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {withButtonFeedback,installActionFeedback} from '../public/src/action-feedback.mjs';import {requestJson} from '../public/src/live-channel.mjs';
test('pending actions have visible labels, disable their button and block a second submit until completion',async()=>{
 const {document,window}=parseHTML('<html><body><form><button>Accedi</button></form></body></html>'),button=document.querySelector('button'),form=document.querySelector('form');installActionFeedback(document);let finish,calls=0;
 const pending=withButtonFeedback(button,()=>{calls++;return new Promise(resolve=>finish=resolve);});assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');assert.match(button.textContent,/Accesso in corso/);
 await withButtonFeedback(button,()=>{calls++;});let prevented=false,stopped=false;const handlers={};installActionFeedback({addEventListener:(type,fn)=>handlers[type]=fn});handlers.submit({type:'submit',target:form,submitter:button,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true});assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(calls,1);
 finish();await pending;assert.equal(button.textContent,'Accedi');assert.equal(!!button.disabled,false);assert.equal(button.hasAttribute('aria-busy'),false);
});
test('identical in-flight mutations share a single network call, and failed responses allow a later retry',async()=>{
 let calls=0,finish;const fetcher=()=>{calls++;return new Promise(resolve=>finish=resolve);},options={method:'POST',body:'{"pick":"1"}',fetcher};
 const a=requestJson('/api/slip',options),b=requestJson('/api/slip',options);assert.equal(calls,1);finish({ok:true,json:async()=>({ok:true})});assert.deepEqual(await a,await b);
 await assert.rejects(requestJson('/api/slip',{...options,fetcher:async()=>({ok:false,status:503,json:async()=>({error:'busy'})})}),/busy/);
 assert.deepEqual(await requestJson('/api/slip',{...options,fetcher:async()=>({ok:true,json:async()=>({ok:true})})}),{ok:true});
});
