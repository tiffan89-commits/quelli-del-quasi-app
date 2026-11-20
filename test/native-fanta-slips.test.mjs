import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {createFantaSlips,fantaSlipContext} from '../public/src/fanta/schedine.mjs';
import {FANTA_TABS} from '../public/src/fanta/shell.mjs';
import {competitionSwitcher} from '../public/src/fanta/competitions-ui.mjs';
import {renderGiornata} from '../public/src/fanta/giornata.mjs';
import {scoreLineup} from '../fanta/rules.mjs';
const now=Date.parse('2026-11-03T12:00:00Z');
before(t=>t.mock.timers.enable({apis:['Date'],now}));after(t=>t.mock.timers.reset());
function fixture({loadMatchup}={}){
 const round=(id,native,competition)=>({id,title:'Giornata 11',number:11,source:'fantacalcio',nativeFanta:{leagueId:native,competitionId:competition},competitionKey:competition,virtualBookmaker:true,kickoff:'2026-11-06T19:45:00Z',rules:{maxStake:20},matches:[{id:'m'+id,home:'Casa '+id,away:'Ospite '+id,status:'NS',kickoff:'2026-11-06T19:45:00Z',odds:{1:2,X:3,2:4}}]});
 const snapshot={user:{id:'u'},leagues:[{id:'bar-a',nativeFantaLink:{leagueId:'a'},members:[{uid:'u',name:'Tu',credits:123,fantasyWallets:{a:{credits:480}}}],rounds:[round('a-camp','a','camp'),round('a-coppa','a','coppa')]},{id:'bar-b',nativeFantaLink:{leagueId:'b'},members:[{uid:'u',name:'Tu',credits:333,fantasyWallets:{b:{credits:499}}}],rounds:[round('b-camp','b','camp')]}]};
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const {document}=parseHTML('<html><body><main id="app"></main></body></html>'),root=document.getElementById('app');let clock=now,context={leagueId:'a',competitionId:'camp'},saves=0,pending;
 const services={snapshot:()=>snapshot,save:async p=>{saves++;await new Promise(resolve=>pending=resolve);const l=snapshot.leagues.find(l=>l.id===p.league),r=l.rounds.find(r=>r.id===p.round);r.slip={picks:p.picks,stake:p.stake,savedAt:'2026-11-03T13:00:00Z'};}};
 let controller;const redraw=()=>{root.innerHTML=controller.render(context);root.querySelectorAll('.pitch-team').forEach(e=>e.getBoundingClientRect=()=>({height:500}));controller.bind(root,context);};controller=createFantaSlips({services,redraw,loadMatchup,storage,now:()=>clock});redraw();
 return {root,snapshot,storage,data,controller,redraw,get saves(){return saves;},resolve:()=>pending(),setNow:n=>{clock=n;controller.tick(context);},switch:c=>{context=c;redraw();}};
}
test('dedicated navigation keeps five tabs; competition selector appears only for multiple competitions',()=>{
 assert.deepEqual(FANTA_TABS.map(t=>t[0]),['schedine','classifica','oggi','squadra','lega']);assert.equal(competitionSwitcher([{id:'one',name:'Campionato'}],'one'),'');assert.match(competitionSwitcher([{id:'one',name:'Campionato'},{id:'two',name:'Coppa'}],'one'),/data-competition-switch/);
});
test('native slip inherits active league and competition; credits and drafts stay isolated without a local league picker',()=>{
 const f=fixture();assert.match(f.root.ownerDocument.body.textContent,/480/);assert.doesNotMatch(f.root.textContent,/Casa a-coppa|Casa b-camp/);assert.equal(f.root.querySelector('[data-fanta-bar-select]'),null);
 f.root.querySelector('[data-pick][data-value="1"]').onclick();assert.equal(f.data.size,1);
 f.switch({leagueId:'a',competitionId:'coppa'});assert.match(f.root.ownerDocument.body.textContent,/Casa a-coppa/);assert.equal(f.root.querySelector('[data-pick][data-value="1"]').getAttribute('aria-pressed'),'false');
 f.switch({leagueId:'b',competitionId:'camp'});assert.match(f.root.ownerDocument.body.textContent,/499/);assert.doesNotMatch(f.root.textContent,/Casa a-camp/);
 f.switch({leagueId:'a',competitionId:'camp'});assert.equal(f.root.querySelector('[data-pick][data-value="1"]').getAttribute('aria-pressed'),'true');
});
test('native save uses existing slip contract, preserves saved version and blocks duplicate clicks',async()=>{
 const f=fixture();f.root.querySelector('[data-pick][data-value="1"]').onclick();const save=f.root.querySelector('#save-slip');const pending=save.onclick();await save.onclick();assert.equal(f.saves,1);assert.equal(f.root.querySelector('#save-slip').disabled,true);f.resolve();await pending;assert.match(f.root.ownerDocument.body.textContent,/Schedina confermata/);assert.equal(f.data.size,0);assert.equal(f.snapshot.leagues[0].rounds[0].slip.picks['ma-camp'],'1');
});
test('closed native slip uses saved choices and colours, keeps public slips private before deadline, and honours admin disable',()=>{
 const f=fixture(),r=f.snapshot.leagues[0].rounds[0];r.slip={picks:{'ma-camp':'1'},stake:10};r.closed=true;r.kickoff='2026-11-01T14:00Z';r.matches[0].score=[2,0];r.matches[0].status='FT';f.redraw();assert.ok(f.root.querySelector('#save-slip')===null);assert.ok(f.root.querySelector('[data-value="1"]').classList.contains('pick-winning'));
 f.root.querySelector('[data-fanta-slip-sub="league"]').onclick();assert.doesNotMatch(f.root.innerHTML,/data-bar-uid/);assert.match(f.root.ownerDocument.body.textContent,/Nessuna schedina salvata/);
 f.snapshot.leagues[0].fantaSlipsEnabled=false;f.redraw();assert.match(f.root.ownerDocument.body.textContent,/presidente ha disattivato/);assert.equal(f.root.querySelector('[data-pick]'),null);
});
test('only rounds belonging to the selected native league and competition are returned',()=>{
 const f=fixture();assert.deepEqual(fantaSlipContext(f.snapshot,'a','coppa').rounds.map(r=>r.id),['a-coppa']);assert.equal(fantaSlipContext(f.snapshot,'absent','camp').league,undefined);
});
test('Studio Live keeps the saved starters on the pitch and marks only the actual fantasy replacement',()=>{
 const players=[
  {id:'bisseck',name:'Bisseck',role:'D',status:'sv'},
  {id:'birindelli',name:'Birindelli',role:'D',status:'sv'},
  {id:'olivera',name:'Olivera',role:'D',status:'voted',vote:6,fantavote:6},
  {id:'reserve',name:'Riserva',role:'D',status:'sv'},
 ];
 const lineup=scoreLineup({formation:'4-4-2',starters:['bisseck','birindelli'],bench:['olivera','reserve']},players);
 assert.equal(lineup.total,6);
 const home={...lineup,team:{name:'Fly Emigrates'}},away={team:{name:'Herta Vernello'},hidden:true};
 const {document}=parseHTML(renderGiornata({matchup:{home,away}}));
 const pitch=document.querySelector('.fanta-pitch');
 const bisseck=pitch.querySelector('[data-player=bisseck]');
 const birindelli=pitch.querySelector('[data-player=birindelli]');
 assert.ok(bisseck.classList.contains('is-sv'));
 assert.equal(bisseck.querySelector('[data-fantasy-grade]'),null);
 assert.ok(bisseck.querySelector('.pitch-event.is-sub'));
 assert.equal(bisseck.querySelector('.live-studio-replacement').textContent,'Entra Olivera');
 assert.equal(birindelli.querySelector('[data-fantasy-grade]').textContent,'s.v.');
 assert.equal(birindelli.querySelector('.pitch-event.is-sub'),null);
 assert.equal(pitch.querySelector('[data-player=olivera]'),null);
 const olivera=document.querySelector('.live-studio-reserves [data-player=olivera]');
 assert.ok(olivera.classList.contains('is-entered'));
 assert.match(olivera.querySelector('.live-studio-bench-status').textContent,/Subentrato/);
 assert.ok([...document.querySelectorAll('.live-studio-reserves .fanta-token:not(.is-entered) .live-studio-bench-status')].every(badge=>badge.textContent==='Riserva'));
 assert.equal(olivera.querySelector('[data-fantasy-grade]').textContent,'6');
});
test('native app opens dedicated slips, keeps slip picks away from lineup handlers, and moves results under Oggi',async()=>{
 const {mountFanta}=await import('../public/src/fanta/app.mjs'),{createDemoFantaApi}=await import('../public/src/fanta/demo-api.mjs');
 const f=fixture(),document=f.root.ownerDocument,window=document.defaultView,demo=createDemoFantaApi({delay:0}),leagues=await demo.leagues(),h=await demo.home(leagues[0].id);
 h.round.state='in-corso';h.league={...h.league,id:'a'};h.competition={id:'camp',name:'Campionato'};h.competitions=[h.competition];
 const selectPrototype=Object.getPrototypeOf(document.createElement('select'));
 const selectedOptions=Object.getOwnPropertyDescriptor(selectPrototype,'selectedOptions');
 Object.defineProperty(selectPrototype,'selectedOptions',{configurable:true,get(){return this.querySelectorAll('option[selected]');}});
 const keys=['document','window','navigator','localStorage','scrollTo','setInterval','clearInterval'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let app;const timers=[];
 Object.defineProperties(globalThis,{document:{value:document,configurable:true},window:{value:window,configurable:true},navigator:{value:{onLine:true},configurable:true},localStorage:{value:f.storage,configurable:true},scrollTo:{value:()=>{},configurable:true},setInterval:{value:fn=>{timers.push(fn);return timers.length;},configurable:true},clearInterval:{value:()=>{},configurable:true}});
 const click=el=>el.dispatchEvent(new window.Event('click',{bubbles:true}));
 try{
  app=mountFanta(f.root,{api:{...demo,round:(id,n)=>{assert.equal(id,'a');assert.equal(Number(n),h.round.number);return demo.round(leagues[0].id,n);},matchup:(_id,n,m)=>demo.matchup(leagues[0].id,n,m)},initialTab:'schedine',slipServices:{snapshot:()=>f.snapshot},bootstrap:{me:{access:'full'},leagues:[{...leagues[0],id:'a'}],home:h}});
  assert.match(f.root.ownerDocument.body.textContent,/Schedina del Fanta/);assert.equal(f.root.querySelector('[data-competition-switch]'),null);assert.equal(f.root.querySelector('.fanta-top .v2-credits'),null);
  click(f.root.querySelector('[data-pick][data-value="1"]'));assert.equal(f.root.querySelector('[data-pick][data-value="1"]').getAttribute('aria-pressed'),'true');
  assert.equal(f.root.querySelectorAll('nav [data-tab]').length,5);
  click(f.root.querySelector('[data-tab="oggi"]'));assert.equal(f.root.querySelector('.fanta-today-tabs'),null);assert.ok(f.root.querySelector('[data-tab="schedine"]'));
  const tile=f.root.querySelector('.bar-home-cta');assert.ok(tile);assert.equal(Number(tile.dataset.round),h.round.number);assert.equal(tile.querySelector('button'),null);
  click(tile);await new Promise(resolve=>setTimeout(resolve,10));
  const studio=f.root.querySelector('.fanta-live-studio');
  assert.ok(studio);assert.match(studio.querySelector('h1').textContent,new RegExp('Giornata '+h.round.number));
  assert.equal(studio.querySelector('.fanta-view,.fanta-sb'),null);
  assert.ok(studio.querySelector('.pitch-slides'));
  click(studio.querySelector('[data-action="close-live-studio"]'));
  assert.equal(f.root.querySelector('.fanta-live-studio'),null);assert.ok(f.root.querySelector('.bar-home-cta'));
 }finally{app?.destroy();if(selectedOptions)Object.defineProperty(selectPrototype,'selectedOptions',selectedOptions);else delete selectPrototype.selectedOptions;for(const [k,v]of saved){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
});
test('the existing local clock locks a native slip at kickoff without a request',()=>{
 const f=fixture();f.root.querySelector('[data-pick][data-value="1"]').onclick();assert.equal(f.root.querySelector('#save-slip').disabled,false);
 f.setNow(Date.parse('2026-11-06T19:45:00Z'));assert.ok(f.root.querySelector('#save-slip')===null);assert.equal(f.root.querySelector('[data-pick]').disabled,true);assert.equal(f.saves,0);
});
test('a changed saved version keeps the local draft but blocks overwrite until the user chooses the saved slip',()=>{
 const f=fixture();f.root.querySelector('[data-pick][data-value="1"]').onclick();f.snapshot.leagues[0].rounds[0].slip={picks:{'ma-camp':'2'},stake:10,savedAt:'new-version'};f.redraw();
 assert.match(f.root.ownerDocument.body.textContent,/altro dispositivo/);assert.equal(f.root.querySelector('#save-slip').disabled,true);f.root.querySelector('[data-fanta-slip-reload]').click();assert.equal(f.root.querySelector('[data-value="2"]').getAttribute('aria-pressed'),'true');assert.equal(f.saves,0);
});


test('opening a native slip match reads saved XIs once, renders club jerseys and next opponents, handles an unsaved side',async()=>{
 let calls=0,resolve;const f=fixture({loadMatchup:async(context,round,match)=>{calls++;assert.equal(context.leagueId,'a');assert.equal(round.number,11);return new Promise(r=>resolve=r);}});
 const pending=f.root.querySelector('[data-detail]').onclick();await f.root.querySelector('[data-detail]').onclick();assert.equal(calls,1);
 const fixturePlayer={id:'maldini',name:'Maldini',role:'A',club:'Cagliari',status:'to-play',opponent:'Frosinone',home:true,kickoff:'2026-11-07T14:00:00Z'};
 const livePlayer={id:'p',name:'Mario Rossi',shirtName:'Rossi',role:'A',jersey:11,club:'Inter',status:'playing',opponent:'Juventus',home:false,kickoff:'2026-11-07T14:00:00Z',events:{goals:2,yellow:1},vote:7,fantavote:12.5};
 const matchup={official:false,state:'in-corso',home:{team:{name:'Casa'},formation:'4-4-2',starters:[livePlayer,fixturePlayer],bench:[],modifier:{applies:false}},away:{team:{name:'Ospite'},starters:[],bench:[]}};
 resolve(matchup);await pending;
 const page=f.root.ownerDocument.getElementById('match-page-root');
 assert.match(page.innerHTML,/>ROSSI<\/text>/);
 assert.equal(page.querySelectorAll('.is-goals').length,2);
 assert.equal(page.querySelector('.lineup-votes'),null);
 assert.equal(page.querySelectorAll('.match-headline .team-logo').length,2);
 assert.match(page.textContent,/Formazione non ancora salvata/);
 assert.equal(page.querySelectorAll('.fanta-shirt-back').length,2);
 const {document:giornata}=parseHTML(renderGiornata({round:{round:{number:11,state:'in-corso'},rounds:[],matchups:[]},matchup,side:'home',view:'campo'}));
 assert.match(giornata.querySelector('.fanta-token svg').getAttribute('aria-label'),/numero \d+/);
 for(const view of [page,giornata]){
  assert.equal(view.querySelector('.pitch-next-opponent').textContent,'FRO');
  assert.equal(view.querySelector('.pitch-next-kickoff').textContent,'sab 15:00');
  assert.equal(view.querySelector('.pitch-player-club'),null);
  const marker=view.querySelector('.is-goals').parentElement;
  assert.equal(marker.previousElementSibling.textContent,'12,5');
  assert.equal(marker.parentElement.querySelector('[data-pitch-fixture]'),null);
 }
 await f.root.querySelector('[data-detail]').onclick();assert.equal(calls,1);f.root.ownerDocument.getElementById('match-page-root').close();
});
