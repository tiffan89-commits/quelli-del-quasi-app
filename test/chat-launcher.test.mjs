import {paintChatBadges,mergeChatSummary} from '../public/src/chat-badges.mjs';
import {renderLeagueSheet} from '../public/src/v2/league-switcher.mjs';
import {hubTile} from '../public/src/league-hub.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {topBar,tabBar} from '../public/src/fanta/shell.mjs';
import {renderTabBar} from '../public/src/v2/tabs.mjs';
const source=fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8');
test('Bar and Fanta synchronize the unread badge with the tile, selector and each league row',()=>{
 const {document}=parseHTML('<html><body><div id="app">'+renderTabBar('oggi')+hubTile('chat','Chat','Apri chat')+'</div></body></html>'),leagues=[{id:'bar-a',chat:{unread:2}},{id:'bar-b',chat:{unread:7}}];
 const ctx={document,state:{leagues},L:()=>leagues[0],closeLeagueChat(){},paintChatBadges,mergeChatSummary};
 document.body.insertAdjacentHTML('beforeend',renderLeagueSheet(leagues,'bar-a','u',String));vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('let chatLeagueId='),source.indexOf('function closeLeagueChat')),ctx);
 vm.runInContext('syncChatLauncher(state.leagues[0])',ctx);
 const dot=document.querySelector('[data-v2-tab=legainfo] [data-chat-badge]');assert.equal(dot.textContent,'');assert.equal(dot.hidden,false);assert.match(dot.getAttribute('aria-label'),/^9 /);
 assert.equal(document.querySelector('[data-chat-tile-badge]').textContent,'2');
 document.getElementById('app').innerHTML=tabBar('lega')+hubTile('chat','Chat','Apri chat');
 leagues[0].chat.unread=0;
 assert.equal(document.querySelector('[data-league-chat-dot="bar-b"]').hidden,false);
 vm.runInContext('syncChatLauncher(state.leagues[1])',ctx);
 assert.equal(document.querySelector('[data-tab=lega] [data-chat-badge]').textContent,'');
 assert.equal(document.querySelector('[data-chat-tile-badge]').textContent,'7');
 assert.equal(document.querySelector('[data-league-chat-dot="bar-a"]').hidden,true);
 assert.equal(document.querySelector('[data-league-chat-dot="bar-b"]').hidden,false);
 leagues[1].chat.unread=0;vm.runInContext('chatBadge()',ctx);
 assert.equal(document.querySelector('[data-chat-badge]').hidden,true);assert.equal(document.querySelector('[data-chat-tile-badge]').hidden,true);
 assert.equal(document.querySelector('[data-league-chat-dot="bar-b"]').hidden,true);
 assert.equal(document.querySelector('#open-chat'),null);
});
test('a read acknowledgement for the current snapshot clears the badge and a stale response cannot revive it',()=>{
 const next=mergeChatSummary({unread:2,latest:4,read:2,revision:1},{unread:0,latest:4,read:4,revision:1});
 assert.equal(next.unread,0);
 assert.equal(mergeChatSummary(next,{unread:2,latest:4,read:2,revision:1}),next);
 assert.equal(mergeChatSummary(next,{unread:1,latest:5,read:4,revision:1}).unread,1);
});

test('chat entry stays out of the Fanta header and the widget stays out of fullscreen editors',()=>{
 const html=topBar({mode:'fanta',league:{name:'Test',accent:'#fff'}});assert.doesNotMatch(html,/data-fanta-chat|Apri chat/);
 const css=fs.readFileSync(new URL('../public/chat.css',import.meta.url),'utf8');
 for(const selector of ['body.fs-open #league-chat-widget','html.studio-active #league-chat-widget','body:has(dialog.fanta-logo-editor[open]) #league-chat-widget'])assert.ok(css.includes(selector));
});

test('a submission notification keeps the exact league and round when the app is open',async()=>{
 const handlers={},origin='https://quellidelquasi.com';let notification,posted,pending;
 const client={url:origin+'/#/fanta/oggi',focus:async()=>{},postMessage:data=>{posted=data;}};
 const self={location:{origin},addEventListener:(event,fn)=>{handlers[event]=fn;},
  clients:{matchAll:async()=>[client]},registration:{showNotification:async(title,data)=>{notification=data;}}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,URLSearchParams});
 const url='/#/bar/schedina?lega=legata&giornata=turno12';
 handlers.push({data:{json:()=>({kind:'slip-reminder',url,league:'legata'})},waitUntil:fn=>{pending=fn;}});
 await pending;assert.equal(notification.data.url,url);
 handlers.notificationclick({notification:{...notification,close(){}},waitUntil:fn=>{pending=fn;}});
 await pending;
 assert.equal(posted.round,'turno12');assert.equal(posted.url,origin+url);assert.equal(posted.type,'open-slip');
});

test('the notification opens the requested league from an already open app window',async()=>{
 const handlers={},origin='https://quellidelquasi.com';let opened,focused=false,work;
 const app={url:origin+'/#/fanta/oggi',navigate:async url=>{opened=url;return {focus:async()=>{focused=true;}};}};
 const self={location:{origin},addEventListener:(event,fn)=>{handlers[event]=fn;},clients:{matchAll:async()=>[{url:origin+'/privacy'},app]}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
 handlers.notificationclick({notification:{data:{kind:'chat',league:'lega:una'},close(){}},waitUntil:p=>{work=p;}});
 await work;assert.equal(opened,origin+'/?chat=lega%3Auna');assert.ok(focused);
});
