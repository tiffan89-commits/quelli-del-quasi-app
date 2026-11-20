import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {presidentPanel,bindPresidentPanel} from '../public/src/president-panel.mjs';
import {renderLeagueChip} from '../public/src/v2/league-switcher.mjs';
import {tabForPage,routeForTab,renderTabBar} from '../public/src/v2/tabs.mjs';
import {renderLeagueSheet} from '../public/src/v2/league-switcher.mjs';
test('panel keeps only permitted closed groups, escaped summaries and contextual links',()=>{
 const html=presidentPanel({groups:{associazioni:{summary:'18 membri',html:'<form id="unchanged"></form>'}}}),{document}=parseHTML(html);
 assert.deepEqual([...document.querySelectorAll('.president-group')].map(d=>d.dataset.presidentSection),['associazioni']);assert.equal(document.querySelectorAll('details[open]').length,0);assert.ok(document.querySelector('#unchanged'));assert.ok(!document.querySelector('script'));assert.equal(tabForPage('admin'),'legainfo');assert.equal(tabForPage('impostazioni'),'legainfo');
 assert.equal(document.querySelector('.president-heading').textContent,'Impostazioni');assert.equal(document.querySelector('.president-context'),null);
});
test('the header reserves its chip for choosing the league',()=>{
 const league={name:'Bar',admin:'a',members:[]};for(const uid of ['a','member']){const {document}=parseHTML(renderLeagueChip(league,uid,String,String));assert.equal(!!document.querySelector('.president-entry'),false);assert.equal(document.querySelector('.v2-league-chip .president-entry'),null);}
});
test('member search filters rows without replacing forms, choices or sending requests',()=>{
 const {document}=parseHTML('<main><input data-member-search><p data-member-count></p><form><div data-member-name="Èderson"><input type="checkbox" checked></div><div data-member-name="Mario"></div></form></main>'),root=document.querySelector('main'),form=root.querySelector('form');bindPresidentPanel(root);const search=root.querySelector('input');search.value='mario';search.oninput();assert.equal(root.querySelectorAll('[hidden]').length,1);assert.equal(root.querySelector('form'),form);assert.ok(root.querySelector('input[type=checkbox]').hasAttribute('checked'));search.value='';search.oninput();assert.equal(root.querySelectorAll('[hidden]').length,0);
});
test('Bar navigation distinguishes Oggi and league information; switcher has no scattered settings',()=>{
 assert.equal(routeForTab('oggi').page,'lega');assert.equal(routeForTab('legainfo').page,'barleague');assert.equal(tabForPage('barleague'),'legainfo');const {document}=parseHTML(renderTabBar('legainfo'));assert.equal(document.querySelectorAll('button').length,5);assert.equal(document.querySelector('[aria-current]').textContent,'Lega');const sheet=renderLeagueSheet([{id:'x',name:'Test',admin:'a',members:[]}],'x','a',String);assert.doesNotMatch(sheet,/data-bar-page="admin"|Regolamento del Bar|Invita amici|Entra con codice/);assert.match(sheet,/Leghe disponibili/);
});
