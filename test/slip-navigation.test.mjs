import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {defaultSlipRound,selectableSlipRounds,selectablePublicSlipRounds} from '../public/src/slip-state.mjs';
import {createFantaSlips} from '../public/src/fanta/schedine.mjs';
import {communityView,createVerdictCard} from '../public/src/community.mjs';
const now=Date.parse('2026-11-03T14:00Z'),odds={1:2,X:3,2:4};
const round=(number,extra={})=>({id:'r'+number,title:'Giornata '+number,number,kickoff:'2026-11-06T19:45Z',matches:[{id:'m'+number,home:'Casa',away:'Ospiti',odds,status:'NS'}],...extra});
const past=round(10,{settled:true,closed:true,kickoff:'2026-11-01T14:00Z',matches:[{id:'m10',home:'Casa',away:'Ospiti',odds,status:'FT',score:[2,0]}]}),open=round(11);
const source=fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8');
test('two normal choices, all older results and only one open future; hidden future deep links cannot insert a new option',()=>{
 const old=round(9,{...past,id:'r9',number:9}),unpriced=round(12,{matches:[{id:'m12',status:'NS'}]}),later=round(13);
 assert.deepEqual(selectableSlipRounds([open,past],now).map(r=>r.id),['r10','r11']);
 const rounds=[later,unpriced,old,past,open];
 assert.deepEqual(selectableSlipRounds(rounds,now).map(r=>r.id),['r9','r10','r11']);
 assert.deepEqual(selectablePublicSlipRounds(rounds,now),selectableSlipRounds(rounds,now));
 assert.equal(defaultSlipRound(rounds,now).id,'r11');
 assert.equal(defaultSlipRound([past,unpriced],now).id,'r10');
});
test('future closed or incorrectly settled placeholders never leak after the active day, in any slip selector',()=>{
 const later=[13,14,15,16,17].map(n=>round(n,{closed:true,settled:true,kickoff:'2026-10-01T12:00Z'}));
 const twelfth=round(12,{kickoff:'2026-11-13T19:45Z'}),rounds=[...later,twelfth,open,past];
 for(const select of [selectableSlipRounds,selectablePublicSlipRounds]){
  assert.deepEqual(select(rounds,now).map(r=>r.number),[10,11]);
  assert.deepEqual(select(rounds,Date.parse(open.kickoff)).map(r=>r.number),[10,11,12]);
 }
 assert.equal(defaultSlipRound(rounds,now).number,11);
 assert.equal(defaultSlipRound(rounds,Date.parse(open.kickoff)).number,12);
 const unavailable=round(12,{kickoff:'2026-11-13T19:45Z',matches:[]});
 assert.deepEqual(selectableSlipRounds([past,{...open,closed:true},unavailable,round(13,{kickoff:'2026-11-20T19:45Z'})],Date.parse(open.kickoff)).map(r=>r.number),[10,11]);
});
test('entering Bar slip starts on open round; pressing its active menu is a true no-op, preserving draft and scroll',()=>{
 let rendered=0,persisted=0,hydrated=0,scrolled=0;const ctx={chatOpen:false,page:'lega',selectedRoundId:'r10',slipScope:'bar',sourceScope:'seriea',dashboardSource:'seriea',L:()=>({id:'l'}),writeAppRoute:()=>{},persistDraft:()=>persisted++,hydrateDraft:()=>hydrated++,render:()=>rendered++,window:{scrollTo:()=>scrolled++}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function navigatePage('),source.indexOf('\nfunction nativeSlipServices')),ctx);
 vm.runInContext("navigatePage('schedina')",ctx);assert.equal(ctx.selectedRoundId,null);assert.equal(ctx.slipScope,'mine');assert.equal(rendered,1);assert.equal(hydrated,1);
 const counts=[rendered,persisted,hydrated,scrolled];ctx.selectedRoundId='r10';vm.runInContext("navigatePage('schedina')",ctx);assert.equal(ctx.selectedRoundId,'r10');assert.deepEqual([rendered,persisted,hydrated,scrolled],counts);
});
test('Bar subsection switch pins displayed round across mine, bar and verdict',()=>{
 const {document}=parseHTML('<button data-slip-scope="mine"></button><button data-slip-scope="bar"></button><button data-slip-scope="community"></button>');
 const ctx={document,r:past,selectedRoundId:null,slipScope:'mine',persistDraft:()=>{},hydrateDraft:()=>{},render:()=>{}};vm.createContext(ctx);
 const start=source.indexOf('  document.querySelectorAll("[data-slip-scope]")'),end=source.indexOf('  if ($("#open-studio"))',start);vm.runInContext(source.slice(start,end),ctx);
 for(const sub of ['bar','community','mine']){document.querySelector(`[data-slip-scope="${sub}"]`).onclick();assert.equal(ctx.selectedRoundId,'r10');assert.equal(ctx.slipScope,sub);}
});
test('Fanta subsections preserve old selection, re-entry resets to open and unknown future routes are ignored',()=>{
 const previous={location:globalThis.location,history:globalThis.history};globalThis.location={hash:'',pathname:'/',search:''};globalThis.history={pushState:(_,__,hash)=>{globalThis.location.hash=hash.slice(hash.indexOf('#'));}};
 try{
  const rounds=[past,open,round(12,{matches:[]})].map(r=>({...r,source:'fantacalcio',competitionKey:'comp',nativeFanta:{leagueId:'native',competitionId:'comp'}}));
  const league={id:'bar',nativeFantaLink:{leagueId:'native'},members:[{uid:'u',credits:500}],rounds},context={leagueId:'native',competitionId:'comp'},storage={getItem:()=>null,setItem:()=>{}};
  const slips=createFantaSlips({services:{snapshot:()=>({user:{id:'u'},leagues:[league]})},redraw:()=>{},storage,now:()=>now});
  assert.equal(slips.context(context).round.id,'r11');
  globalThis.location.hash='#/fanta/schedine?lega=native&giornata=r10';
  const root=parseHTML('<html><body>'+slips.render(context)+'</body></html>').document;slips.bind(root,context);root.querySelector('[data-fanta-slip-sub="league"]').onclick();assert.equal(slips.context(context).round.id,'r10');
  globalThis.location.hash='#/fanta/schedine?lega=native';slips.enter();assert.equal(slips.context(context).round.id,'r11');
  globalThis.location.hash='#/fanta/schedine?lega=native&giornata=r12';assert.equal(slips.context(context).round.id,'r11');
 }finally{globalThis.location=previous.location;globalThis.history=previous.history;}
});
test('verdict and postcard read the chosen historical round instead of the latest winner',()=>{
 const league={name:'Bar',members:[{uid:'u',name:'Vecchio campione'},{uid:'v',name:'Nuovo campione'}],rounds:[{...past,publicSlips:[{uid:'u',picks:{m10:'1'},stake:10,prize:20}]}],community:{seriea:{recap:{round:'r11',winners:['v'],points:9},history:[{id:'r10',players:[{uid:'u',points:1,wrong:0,correct:1,total:1,picks:{m10:'1'},stake:10}]}],honours:[]}}};
 const html=communityView(league,'seriea',String,String,null,past);assert.match(html,/Giornata 10/);assert.match(html,/1 punti/);assert.doesNotMatch(html,/9 punti/);
 const card=createVerdictCard(league,'seriea',null,null,'r10');assert.match(card,/Vecchio campione/);assert.match(card,/2 – 0/);assert.doesNotMatch(card,/Nuovo campione/);
});
