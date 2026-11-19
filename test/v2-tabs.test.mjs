import test from 'node:test';import assert from 'node:assert/strict';
import {TABS,tabForPage,routeForTab,defaultSource} from '../public/src/v2/tabs.mjs';
test('Bar tabs separate the Quasi and rankings, always use Serie A and leave Fanta to the header',()=>{
 assert.deepEqual(TABS.map(t=>t.id),['schedina','classifica','oggi','quasi','legainfo']);
 assert.equal(tabForPage('lega'),'oggi');for(const page of ['schedina','calendario','altri'])assert.equal(tabForPage(page),'schedina');
 assert.equal(tabForPage('classifiche'),'classifica');assert.equal(tabForPage('quasi'),'quasi');
 for(const [tab,page] of [['oggi','lega'],['schedina','schedina'],['classifica','classifiche'],['quasi','quasi']])assert.deepEqual(routeForTab(tab),{page,sourceScope:'seriea'});
});
test('Bar uses Serie A as its default source',()=>{
 assert.equal(defaultSource(null),'seriea');assert.equal(defaultSource({nativeFanta:true}),'seriea');
});
