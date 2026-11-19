import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {openMatchPage,closeMatchPage} from '../public/src/match-page.mjs';
import {quasiBanner} from '../public/src/quasi-scene.mjs';
test('match page preserves slip DOM and draft, retains app chrome and releases pitch listeners on close',()=>{
 const {document}=parseHTML('<html><body><div id="app-header"><header>Bar Fanta</header></div><div id="app"><main><input value="draft"></main><nav>Oggi</nav></div></body></html>');const input=document.querySelector('input');let cleaned=0,closed=0;
 const page=openMatchPage({document,onClose:()=>closed++});page._pitchCleanup=()=>cleaned++;page.innerHTML='<h2>Venezia – Udinese</h2>';assert.equal(page.tagName,'MAIN');assert.equal(page.previousElementSibling.id,'app');assert.equal(document.querySelector('dialog'),null);assert.equal(document.querySelector('#app input'),input);assert.ok(document.body.classList.contains('match-page-active'));assert.equal(document.querySelector('nav').textContent,'Oggi');
 page.close();assert.equal(page.open,false);assert.equal(document.querySelector('#match-page-root'),null);assert.equal(input.value,'draft');assert.equal(cleaned,1);assert.equal(closed,1);assert.ok(!document.body.classList.contains('match-page-active'));closeMatchPage();assert.equal(closed,1);
});
test('lineup sheet preserves the schedina and dismisses on a vertical pull, keeping horizontal swipes inside it',()=>{
 const {document,Event}=parseHTML('<html><body><div id="app"><main><button id="match">Partita</button><input value="draft"></main></div></body></html>');
 const create=document.createElement.bind(document);
 document.createElement=(name,...args)=>{
  const node=create(name,...args);
  if(name==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;};}
  return node;
 };
 const origin=document.querySelector('#match'),draft=document.querySelector('input');
 let focused=false;
 origin.focus=()=>{focused=true;};
 const sheet=openMatchPage({document,kind:'lineup',trigger:origin});
 assert.equal(sheet.tagName,'DIALOG');
 assert.ok(document.body.classList.contains('match-sheet-active'));
 assert.ok(!document.body.classList.contains('match-page-active'));
 const gesture=(target,from,to)=>{
  for(const [type,key,point] of [['touchstart','touches',from],['touchend','changedTouches',to]]){
   const event=new Event(type,{bubbles:true});event[key]=[{clientX:point[0],clientY:point[1]}];target.dispatchEvent(event);
  }
 };
 const grip=sheet.querySelector('[data-sheet-grip]');
 gesture(grip,[170,48],[43,60]);
 assert.equal(sheet.open,true);
 sheet.scrollTop=90;
 gesture(sheet.querySelector('p'),[170,48],[180,154]);
 assert.equal(sheet.open,true);
 sheet.scrollTop=0;
 gesture(grip,[170,48],[180,154]);
 assert.equal(sheet.open,false);
 assert.equal(document.querySelector('#match-page-root'),null);
 assert.equal(document.querySelector('input'),draft);
 assert.equal(draft.value,'draft');
 assert.equal(focused,true);
});
test('home character links directly to the Quasi studio rather than account settings',()=>{const html=quasiBanner({},'Mister');assert.match(html,/data-open-quasi-studio/);assert.doesNotMatch(html,/data-page="profilo"/);});

import {renderFantasyLineup} from '../public/src/lineup-pitch.mjs';
import {patchFantasyMatch} from '../public/src/fantasy-live-detail.mjs';
test('only started players show the live grade; future players retain their next fixture until a real vote arrives',()=>{
 const{document}=parseHTML('<html><body>'+renderFantasyLineup({teams:[{name:'Fantasy',players:[{id:'a',starter:true,role:'A',name:'Mario Rossi',club:'Venezia',grade:6,jersey:10,next:{opponent:'Udinese',home:false}},{id:'b',starter:true,role:'D',name:'Luca Bianchi',club:'Lazio',grade:null,next:{opponent:'Napoli',home:false,kickoff:'2026-11-08T11:30:00Z'}}]}]})+'</body></html>');
 const first=document.querySelector('[data-fantasy-player="a"]'),second=document.querySelector('[data-fantasy-player="b"]');assert.equal(first.querySelector('.pitch-next-opponent'),null);assert.equal(first.querySelector('.pitch-player-club'),null);assert.equal(first.querySelector('[data-fantasy-grade]').hidden,false);assert.ok(second.querySelector('.pitch-next-opponent'));assert.equal(second.querySelector('[data-fantasy-grade]').hidden,true);
 patchFantasyMatch(document.body,{details:{teams:[{players:[{id:'b',grade:null,fantagrade:null}]}]}});assert.equal(second.querySelector('[data-fantasy-grade]').hidden,true);
 assert.equal(second.querySelector('.pitch-next-opponent').textContent,'@NAP');
 assert.equal(second.querySelector('.pitch-next-kickoff').textContent,'dom 12:30');
 assert.equal(second.querySelector('.pitch-player-club'),null);
 patchFantasyMatch(document.body,{details:{teams:[{players:[{id:'b',vote:6.5,fantavote:9.5,events:{goals:1}}]}]}});
 assert.equal(second.querySelector('[data-pitch-fixture]').hidden,true);
 assert.equal(second.querySelector('[data-fantasy-grade]').hidden,false);
 assert.equal(second.querySelector('[data-fantasy-grade]').textContent,'9,5');
 assert.ok(second.querySelector('.is-goals svg'));
});
