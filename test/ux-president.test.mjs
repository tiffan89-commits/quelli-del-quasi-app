import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {presidentPanel,presidentTodos,barPresidentTasks,bindPresidentPanel} from '../public/src/president-panel.mjs';
import {renderLeagueChip} from '../public/src/v2/league-switcher.mjs';
import {tabForPage} from '../public/src/v2/tabs.mjs';
test('panel keeps four ordered closed groups, escaped summaries and contextual links',()=>{
 const html=presidentPanel({name:'<script>',groups:{persone:{summary:'18 membri',html:'<form id="unchanged"></form>'}}}),{document}=parseHTML(html);
 assert.deepEqual([...document.querySelectorAll('.president-group')].map(d=>d.dataset.presidentSection),['persone','regole','calendario','identita']);assert.equal(document.querySelectorAll('details[open]').length,0);assert.ok(document.querySelector('#unchanged'));assert.ok(!document.querySelector('script'));assert.equal(tabForPage('admin'),null);
 assert.equal(presidentTodos([]),'');assert.equal(barPresidentTasks({nativeFantaLink:{}}).length,0);
});
test('president entry is only shown to an admin, outside league selector button',()=>{
 const league={name:'Bar',admin:'a',members:[]};for(const uid of ['a','member']){const {document}=parseHTML(renderLeagueChip(league,uid,String,String));assert.equal(!!document.querySelector('.president-entry'),uid==='a');assert.equal(document.querySelector('.v2-league-chip .president-entry'),null);}
});
test('member search filters rows without replacing forms, choices or sending requests',()=>{
 const {document}=parseHTML('<main><input data-member-search><p data-member-count></p><form><div data-member-name="Èderson"><input type="checkbox" checked></div><div data-member-name="Mario"></div></form></main>'),root=document.querySelector('main'),form=root.querySelector('form');bindPresidentPanel(root);const search=root.querySelector('input');search.value='mario';search.oninput();assert.equal(root.querySelectorAll('[hidden]').length,1);assert.equal(root.querySelector('form'),form);assert.ok(root.querySelector('input[type=checkbox]').hasAttribute('checked'));search.value='';search.oninput();assert.equal(root.querySelectorAll('[hidden]').length,0);
});
