import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {placeAppFooter,restoreAppFooter} from '../public/src/app-footer.mjs';import {uxViewport} from '../scripts/ux-viewport.mjs';
test('Bar and Fanta share the footer with the privacy and consent controls',()=>{
 const {document}=parseHTML('<html><body><div id="app"><main><footer class="footer"><p>Copyright</p></footer></main><nav class="v2-tabbar"></nav></div><footer class="analytics-footer"><a href="/privacy.html">Privacy</a><button data-analytics-preferences>Preferenze statistiche</button></footer></body></html>'),root=document.querySelector('#app'),control=document.querySelector('button');let opened=0;control.addEventListener('click',()=>opened++);
 placeAppFooter(root);
 assert.match(root.querySelector('.v2-tabbar > [data-app-footer]').textContent,/^© \d{4} QUELLI DEL QUASI\. Gioco fantasy con solo crediti virtualiPrivacyPreferenze statistiche$/);
 assert.equal(root.querySelector('main .footer'),null);
 assert.equal(control.parentElement.hidden,false);
 root.innerHTML='<main class="fanta-main"><h1>Fanta</h1></main><nav class="v2-tabbar"></nav>';
 placeAppFooter(root);placeAppFooter(root);
 assert.equal(document.querySelectorAll('.v2-tabbar > [data-app-footer]').length,1);
 assert.equal(document.querySelectorAll('.analytics-footer').length,1);
 assert.equal(root.querySelector('[data-app-footer] button'),control);
 assert.equal(control.parentElement.hidden,false);
 control.click();assert.equal(opened,1);
 restoreAppFooter(document);root.innerHTML='<main>Accesso</main>';
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
