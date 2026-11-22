import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {openMatchPage,closeMatchPage} from '../public/src/match-page.mjs';
import {mountFootballMatch,updateFootballMatch} from '../public/src/live-match-view.mjs';
import {quasiBanner} from '../public/src/quasi-scene.mjs';

function gesture(Event,target,from,to){
 for(const [type,point] of [['touchstart',from],['touchmove',to],['touchend',to]]){
  const event=new Event(type,{bubbles:true,cancelable:true});
  const touch={clientX:point[0],clientY:point[1]};
  event.touches=type==='touchend'?[]:[touch];
  event.changedTouches=[touch];
  target.dispatchEvent(event);
 }
}
test('match page preserves slip DOM and draft, retains app chrome and releases pitch listeners on close',()=>{
 const {document}=parseHTML('<html><body><div id="app-header"><header>Bar Fanta</header></div><div id="app"><main><input value="draft"></main><nav>Oggi</nav></div></body></html>');const input=document.querySelector('input');let cleaned=0,closed=0;
 const page=openMatchPage({document,onClose:()=>closed++});page._pitchCleanup=()=>cleaned++;page.innerHTML='<h2>Venezia – Udinese</h2>';assert.equal(page.tagName,'MAIN');assert.equal(page.previousElementSibling.id,'app');assert.equal(document.querySelector('dialog'),null);assert.equal(document.querySelector('#app input'),input);assert.ok(document.body.classList.contains('match-page-active'));assert.equal(document.querySelector('nav').textContent,'Oggi');
 page.close();assert.equal(page.open,false);assert.equal(document.querySelector('#match-page-root'),null);assert.equal(input.value,'draft');assert.equal(cleaned,1);assert.equal(closed,1);assert.ok(!document.body.classList.contains('match-page-active'));closeMatchPage();assert.equal(closed,1);
});
test('full-page match detail preserves the schedina and dismisses on a vertical pull without closing on horizontal swipes',()=>{
 const {document,Event}=parseHTML('<html><body><div id="app"><main><button id="match">Partita</button><input value="draft"></main></div></body></html>');
 const origin=document.querySelector('#match'),draft=document.querySelector('input');
 let focused=false;
 origin.focus=()=>{focused=true;};
 const page=openMatchPage({document,trigger:origin});
 page.innerHTML='<header>Squadre e risultato</header><p>Formazioni</p>';
 assert.equal(page.tagName,'MAIN');
 assert.ok(document.body.classList.contains('match-page-active'));
 const heading=page.querySelector('header');
 gesture(Event,heading,[170,48],[43,60]);
 assert.equal(page.open,true);
 page.scrollTop=90;
 gesture(Event,page.querySelector('p'),[170,48],[180,154]);
 assert.equal(page.open,true);
 page.scrollTop=0;
 gesture(Event,heading,[170,48],[180,154]);
 assert.equal(page.open,false);
 assert.equal(document.querySelector('#match-page-root'),null);
 assert.equal(document.querySelector('input'),draft);
 assert.equal(draft.value,'draft');
 assert.equal(focused,true);
});
test('swiping below the score switches match tabs and leaves pitch swipes and pull-to-close independent',()=>{
 const {document,Event}=parseHTML('<html><body><div id="app"></div></body></html>');
 const page=openMatchPage({document});
 try{
  const teams=['Parma','Roma'].map(team=>({team,formation:'4-4-2',players:[{name:team+' Giocatore',role:'A'}],bench:[]}));
  mountFootballMatch(page,{home:'Parma',away:'Roma',status:'LIVE',liveScore:[0,0],lineups:{kind:'official',teams}});
  const active=()=>page.querySelector('[data-live-match-panel]:not([hidden])');
  const close=page.querySelector('#close-modal');
  assert.equal(close.parentElement.className,'live-match-scoreboard');
  assert.doesNotMatch(page.querySelector('.live-match-header').textContent,/Giornata|Serie A/);
  gesture(Event,active(),[220,310],[75,315]);
  assert.equal(active().dataset.liveMatchPanel,'statistiche');
  gesture(Event,active(),[220,310],[75,315]);
  assert.equal(active().dataset.liveMatchPanel,'formazioni');
  gesture(Event,page.querySelector('.pitch-slides'),[75,310],[220,315]);
  assert.equal(active().dataset.liveMatchPanel,'formazioni');
  const player=page.querySelector('[data-pitch-player-detail]'),popup=page.querySelector('.live-player-dialog');
  gesture(Event,player,[130,350],[220,354]);
  assert.equal(popup.hasAttribute('open'),false);
  gesture(Event,player,[130,350],[132,352]);
  assert.equal(popup.hasAttribute('open'),true);
  gesture(Event,popup.querySelector('.live-player-heading'),[140,410],[142,535]);
  assert.equal(popup.hasAttribute('open'),false);
  assert.equal(page.open,true);
  gesture(Event,active().querySelector('.pitch-tabs'),[75,310],[220,315]);
  assert.equal(active().dataset.liveMatchPanel,'statistiche');
  gesture(Event,active(),[75,310],[220,315]);
  assert.equal(active().dataset.liveMatchPanel,'cronaca');
  gesture(Event,active(),[175,310],[170,225]);
  assert.equal(active().dataset.liveMatchPanel,'cronaca');
  page.scrollTop=90;
  gesture(Event,active(),[170,310],[175,440]);
  assert.ok(page.open);
  page.scrollTop=0;
  gesture(Event,active(),[170,310],[175,440]);
  assert.equal(page.open,false);
 }finally{closeMatchPage();}
});
test('formation keeps the title out and the unavailable groups collapsed until opened, including after a refresh',()=>{
 const {document}=parseHTML('<html><body><div id="app"></div></body></html>');
 const page=openMatchPage({document});
 try{
  const teams=['Juventus','Venezia'].map(team=>({team,formation:'3-5-2',players:[],bench:[],unavailable:[{name:'Rossi',status:'Infortunato'}]}));
  const match={home:'Juventus',away:'Venezia',status:'NS',lineups:{kind:'probable',teams}};
  mountFootballMatch(page,match);
  const panel=page.querySelector('#live-match-formazioni');
  assert.equal(panel.hidden,false);
  assert.equal(panel.querySelector('.lineup-section>h3'),null);
  assert.deepEqual([...panel.querySelectorAll('.pitch-tabs button')].map(button=>button.textContent),['Juventus','Venezia']);
  const unavailable=()=>panel.querySelector('details.match-availability');
  assert.equal(unavailable().hasAttribute('open'),false);
  unavailable().setAttribute('open','');
  const header=page.querySelector('#close-modal'),tabs=page.querySelector('.live-match-tabs');
  page._pitchPage=1;
  page._pitchFlips=new Set([1]);
  updateFootballMatch(page,{lineups:{kind:'official',teams}},{refreshLineup:true});
  assert.equal(page.querySelector('#close-modal'),header);
  assert.equal(page.querySelector('.live-match-tabs'),tabs);
  assert.equal(panel.querySelector('[data-pitch-tab="1"]').getAttribute('aria-selected'),'true');
  assert.equal(page._pitchFlips.has(1),true);
  assert.equal(unavailable().hasAttribute('open'),true);
  updateFootballMatch(page,{status:'1H'});
  assert.equal(unavailable(),null);
 }finally{closeMatchPage();}
});
test('formation tabs jump straight to the selected team while swiping still selects the visible pitch',()=>{
 const {document}=parseHTML('<html><body><div id="app"></div></body></html>');
 const page=openMatchPage({document});
 try{
  const teams=['Sassuolo','Genoa'].map(team=>({team,formation:'3-4-3',players:[],bench:[]}));
  mountFootballMatch(page,{home:'Sassuolo',away:'Genoa',status:'NS',lineups:{kind:'probable',teams}});
  const slides=page.querySelector('.pitch-slides'),tabs=[...page.querySelectorAll('[data-pitch-tab]')];
  Object.defineProperty(slides,'clientWidth',{value:360});
  const scrolls=[];
  slides.scrollTo=options=>{scrolls.push(options);slides.scrollLeft=options.left;};
  const selected=()=>tabs.find(tab=>tab.getAttribute('aria-selected')==='true')?.textContent;
  tabs[1].click();
  assert.equal(selected(),'Genoa');
  assert.equal(slides.scrollLeft,360);
  tabs[0].click();
  assert.equal(selected(),'Sassuolo');
  assert.deepEqual(scrolls,[{left:360,behavior:'instant'},{left:0,behavior:'instant'}]);
  slides.scrollLeft=360;
  slides.onscroll();
  assert.equal(selected(),'Genoa');
 }finally{closeMatchPage();}
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
