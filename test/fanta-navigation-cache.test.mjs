import test from 'node:test';import assert from 'node:assert/strict';import {createFantaApi} from '../public/src/fanta/api.mjs';
import {parseHTML} from 'linkedom';import {retainAppHeader,modeSwitch} from '../public/src/mode-switch.mjs';
test('Fanta navigation coalesces reads, isolates instances, invalidates writes and keeps auction polling fresh',async()=>{
 const original=globalThis.fetch;let calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,method:init?.method||'GET'});return Response.json({ok:true});};
 try{const a=createFantaApi();await Promise.all([a.team('one'),a.team('one')]);assert.equal(calls.length,1);await a.team('two');assert.equal(calls.length,2);await createFantaApi().team('one');assert.equal(calls.length,3);
  await a.auction('one');await a.auction('one');assert.equal(calls.length,5);await a.saveSettings({notify:{}});await a.team('one');assert.equal(calls.length,7);
 }finally{globalThis.fetch=original;}
});
test('Changing apps preserves the mother header node and replaces only its product information',()=>{
 const previous=globalThis.document,{document}=parseHTML('<html><body><div id="app"></div></body></html>');globalThis.document=document;
 try{const root=document.getElementById('app');root.innerHTML='<header class="v2-top"><button class="v2-league-chip">Lega Bar</button>'+modeSwitch('bar')+'</header><main>Bar</main>';retainAppHeader(root);const header=document.querySelector('.v2-top');
  root.innerHTML='<header class="v2-top"><span></span></header>';retainAppHeader(root);assert.equal(document.querySelector('.v2-top'),header);assert.ok(header.textContent.includes('Lega Bar'));
  root.innerHTML='<header class="v2-top fanta-top"><button class="v2-league-chip">Lega Fanta</button>'+modeSwitch('fanta')+'</header><main>Fanta</main>';retainAppHeader(root);assert.equal(document.querySelector('.v2-top'),header);assert.equal(root.querySelector('.v2-top'),null);assert.ok(header.textContent.includes('Lega Fanta'));assert.equal(document.querySelectorAll('[aria-label="Modalità"]').length,1);
 }finally{globalThis.document=previous;}
});
