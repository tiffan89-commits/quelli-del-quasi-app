import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {placeAppFooter,restoreAppFooter} from '../public/src/app-footer.mjs';import {uxViewport} from '../scripts/ux-viewport.mjs';
test('Bar and Fanta place copyright and the existing consent controls in settings',()=>{
 const {document}=parseHTML('<html><body><div id="app"><main><footer class="footer">Copyright</footer></main><nav class="v2-tabbar"></nav></div><footer class="analytics-footer"><a href="/privacy.html">Privacy</a><button data-analytics-preferences>Preferenze statistiche</button></footer></body></html>'),root=document.querySelector('#app'),control=document.querySelector('button');let opened=0;control.addEventListener('click',()=>opened++);
 placeAppFooter(root);
 assert.equal(root.querySelector('main .footer,.v2-tabbar [data-app-footer]'),null);
 assert.equal(control.parentElement.hidden,true);
 root.innerHTML='<main class="fanta-main"><div data-settings-legal></div></main><nav class="v2-tabbar"></nav>';
 placeAppFooter(root);placeAppFooter(root);
 assert.match(root.querySelector('[data-settings-legal] p').textContent,/QUELLI DEL QUASI/);
 assert.equal(document.querySelectorAll('.analytics-footer').length,1);
 assert.equal(root.querySelector('[data-settings-legal] button'),control);
 assert.equal(control.parentElement.hidden,false);
 control.click();assert.equal(opened,1);
 restoreAppFooter(document);
 assert.equal(control.parentElement.parentElement,document.body);
 assert.equal(control.parentElement.hidden,false);
 control.click();assert.equal(opened,2);
});

test('one bottom allowance follows actual fixed bars and does not reserve space for sticky desktop bars',()=>{
 const {document,window}=parseHTML('<html><body><div id="app"><main></main><nav class="v2-tabbar"></nav><div class="v2-slipbar"></div></div><footer class="analytics-footer"></footer></body></html>');const root=document.querySelector('#app'),nav=document.querySelector('nav'),bar=document.querySelector('.v2-slipbar');window.innerHeight=844;window.getComputedStyle=()=>({position:'fixed'});nav.getBoundingClientRect=()=>({top:752});bar.getBoundingClientRect=()=>({top:688});
 placeAppFooter(root);assert.equal(document.documentElement.style.getPropertyValue('--app-bottom-space'),'168px');window.getComputedStyle=()=>({position:'sticky'});placeAppFooter(root);assert.equal(document.documentElement.style.getPropertyValue('--app-bottom-space'),'12px');
});
test('isolated viewport supports the two requested sizes and only known app screens',()=>{
 assert.match(uxViewport(new URLSearchParams('w=390&screen=bar-schedina')),/width:390px;height:844px/);assert.match(uxViewport(new URLSearchParams('w=1280&screen=fanta-oggi')),/width:1280px;height:800px/);assert.match(uxViewport(new URLSearchParams('screen=https://example.test')),/src="\/#\/bar\/oggi"/);
});
