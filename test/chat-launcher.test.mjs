import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {topBar,tabBar} from '../public/src/fanta/shell.mjs';
import {renderTabBar} from '../public/src/v2/tabs.mjs';
const source=fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8');
test('Bar and Fanta share a count of unread chat messages in Lega',()=>{
 const {document}=parseHTML('<html><body><div id="app">'+renderTabBar('oggi')+'</div></body></html>'),leagues=[{id:'bar-a',chat:{unread:2}},{id:'bar-b',chat:{unread:7}}];
 const ctx={document,state:{leagues},L:()=>leagues[0],closeLeagueChat(){}};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('let chatLeagueId='),source.indexOf('function closeLeagueChat')),ctx);
 vm.runInContext('syncChatLauncher(state.leagues[0])',ctx);
 assert.equal(document.querySelector('[data-v2-tab=legainfo] [data-chat-badge]').textContent,'9');
 document.getElementById('app').innerHTML=tabBar('lega');
 leagues[0].chat.unread=0;
 vm.runInContext('syncChatLauncher(state.leagues[1])',ctx);
 assert.equal(document.querySelector('[data-tab=lega] [data-chat-badge]').textContent,'7');
 leagues[1].chat.unread=0;vm.runInContext('chatBadge()',ctx);
 assert.equal(document.querySelector('[data-chat-badge]').hidden,true);
 assert.equal(document.querySelector('#open-chat'),null);
});
test('chat entry stays out of the Fanta header and the widget stays out of fullscreen editors',()=>{
 const html=topBar({mode:'fanta',league:{name:'Test',accent:'#fff'}});assert.doesNotMatch(html,/data-fanta-chat|Apri chat/);
 const css=fs.readFileSync(new URL('../public/chat.css',import.meta.url),'utf8');
 for(const selector of ['body.fs-open #league-chat-widget','html.studio-active #league-chat-widget','body:has(dialog.fanta-logo-editor[open]) #league-chat-widget'])assert.ok(css.includes(selector));
});
