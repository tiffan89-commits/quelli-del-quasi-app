import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {openMatchPage,closeMatchPage} from '../public/src/match-page.mjs';
import {quasiBanner} from '../public/src/quasi-scene.mjs';
test('match page preserves slip DOM and draft, retains app chrome and releases pitch listeners on close',()=>{
 const {document}=parseHTML('<html><body><div id="app-header"><header>Bar Fanta</header></div><div id="app"><main><input value="draft"></main><nav>Oggi</nav></div></body></html>');const input=document.querySelector('input');let cleaned=0,closed=0;
 const page=openMatchPage({document,onClose:()=>closed++});page._pitchCleanup=()=>cleaned++;page.innerHTML='<h2>Venezia – Udinese</h2>';assert.equal(page.tagName,'MAIN');assert.equal(page.previousElementSibling.id,'app');assert.equal(document.querySelector('dialog'),null);assert.equal(document.querySelector('#app input'),input);assert.ok(document.body.classList.contains('match-page-active'));assert.equal(document.querySelector('nav').textContent,'Oggi');
 page.close();assert.equal(page.open,false);assert.equal(document.querySelector('#match-page-root'),null);assert.equal(input.value,'draft');assert.equal(cleaned,1);assert.equal(closed,1);assert.ok(!document.body.classList.contains('match-page-active'));closeMatchPage();assert.equal(closed,1);
});
test('home character links directly to the Quasi studio rather than account settings',()=>{const html=quasiBanner({},'Mister');assert.match(html,/data-open-quasi-studio/);assert.doesNotMatch(html,/data-page="profilo"/);});
