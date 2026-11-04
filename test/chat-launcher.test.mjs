import test from 'node:test';import assert from 'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import {parseHTML} from'linkedom';import {topBar} from'../public/src/fanta/shell.mjs';
const source=fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8');
test('floating chat is a single body launcher; changing linked leagues retains the correct unread count and leaving hides it',()=>{
 const {window,document}=parseHTML('<html><body><div id="app"></div></body></html>');const leagues=[{id:'bar-a',chat:{unread:2}},{id:'bar-b',chat:{unread:7}}];let closes=0;
 const ctx={document,state:{user:{id:'u',emailVerified:true},leagues},L:()=>leagues[0],$:q=>document.querySelector(q),bindSupportDrag(){},openLeagueChat(){},closeLeagueChat(){closes++;},console};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function chatLauncherView'),source.indexOf('function closeLeagueChat')),ctx);
 vm.runInContext('syncChatLauncher(state.leagues[0])',ctx);const original=document.getElementById('open-chat');assert.equal(original.parentElement,document.body);assert.equal(original.querySelector('.chat-fab-unread').textContent,'2');
 vm.runInContext('syncChatLauncher(state.leagues[1])',ctx);assert.equal(document.querySelectorAll('#open-chat').length,1);assert.equal(document.getElementById('open-chat'),original);assert.equal(original.querySelector('.chat-fab-unread').textContent,'7');assert.equal(vm.runInContext('chatLeague().id',ctx),'bar-b');
 document.getElementById('app').innerHTML=vm.runInContext('chatLauncherView(state.leagues[0],state.user)',ctx);vm.runInContext('syncChatLauncher(state.leagues[0])',ctx);assert.equal(document.querySelectorAll('#open-chat').length,1);assert.equal(document.getElementById('open-chat').parentElement,document.body);
 vm.runInContext('syncChatLauncher(null)',ctx);assert.equal(document.querySelectorAll('#open-chat').length,0);assert.equal(closes,1);
});
test('Fanta header has no duplicate chat action; fullscreen suppression covers formation, logo, Quasi and an open widget',()=>{
 const html=topBar({mode:'fanta',league:{name:'Test',accent:'#fff'}});assert.doesNotMatch(html,/data-fanta-chat|Apri chat/);
 const css=fs.readFileSync(new URL('../public/chat.css',import.meta.url),'utf8');for(const selector of ['body.fs-open #open-chat','body.fs-open #league-chat-widget','html.studio-active #open-chat','html.studio-active #league-chat-widget','body:has(dialog.fanta-logo-editor[open]) #open-chat','body:has(dialog.fanta-logo-editor[open]) #league-chat-widget'])assert.ok(css.includes(selector));
});
