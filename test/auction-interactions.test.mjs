import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {mountFanta} from '../public/src/fanta/app.mjs';import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';
import {auctionAction,auctionView,teamBudget} from '../fanta/auction.mjs';import {DEFAULT_RULES} from '../fanta/rules.mjs';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('release dialog survives refund clicks, live refresh and failed submission; close exits the release screen and stale polls cannot reopen it',async()=>{
 const demo=createDemoFantaApi({delay:0}),leagues=await demo.leagues(),home=await demo.home(leagues[0].id),original=await demo.auction(leagues[0].id);
 const a={...original,status:'running',phase:'releases',releaseBatchId:'batch1',isAdmin:true,table:{...original.myRoster[0],ownerTeam:{id:original.me,name:'La mia squadra'}},releases:[]};let state=structuredClone(a),failRelease=true,released;
 const {document,window}=parseHTML('<html><body><div id="app"></div><div id="v2-sheet-root" hidden></div></body></html>');
 const keys=['document','window','navigator','localStorage','scrollTo','setInterval','clearInterval','FormData'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),timers=new Map();let count=0,app;
 Object.defineProperties(globalThis,{document:{value:document,configurable:true},window:{value:window,configurable:true},navigator:{value:{onLine:true},configurable:true},localStorage:{value:{getItem:()=>null,setItem(){}},configurable:true},scrollTo:{value:()=>{},configurable:true},setInterval:{value:fn=>{timers.set(++count,fn);return count;},configurable:true},clearInterval:{value:id=>timers.delete(id),configurable:true},FormData:{value:class{constructor(form){this.map=new Map([...form.querySelectorAll('input[name]')].filter(e=>e.type!=='radio'||e.hasAttribute('checked')).map(e=>[e.name,e.value]));}get(k){return this.map.get(k);}[Symbol.iterator](){return this.map[Symbol.iterator]();}},configurable:true}});
 const api={...demo,auction:async()=>structuredClone(state),auctionAssigned:async()=>[{...a.table,team:a.table.ownerTeam}],auctionRelease:async(id,playerId,refund)=>{released={id,playerId,refund};if(failRelease)throw Error('Riprova lo svincolo');state={...state,version:state.version+1,table:null};return structuredClone(state);},auctionClose:async()=>{state={...state,status:'ended',table:null,version:state.version+1};return structuredClone(state);}};
 const root=document.getElementById('app'),sheet=document.getElementById('v2-sheet-root'),click=el=>el.dispatchEvent(new window.Event('click',{bubbles:true}));
 try{
 app=mountFanta(root,{api,bootstrap:{me:{access:'full'},leagues,home}});
 const open=document.createElement('button');open.dataset.tab='asta';root.append(open);click(open);await flush();
 click(root.querySelector('[data-release]'));let form=sheet.querySelector('form');assert.ok(form);
 const radio=form.querySelector('[value="custom"]');for(const e of form.querySelectorAll('input[type=radio]'))e.removeAttribute('checked');radio.setAttribute('checked','');click(radio);assert.equal(sheet.querySelector('form'),form,'refund click must not open player details');
 form.querySelector('[name=refund]').value='0';radio.dispatchEvent(new window.Event('change',{bubbles:true}));assert.match(form.querySelector('[data-refund-preview]').textContent,/0 crediti/);
 const poll=[...timers.values()].find(f=>f.name==='pollAuction');state.version++;await poll();assert.equal(sheet.querySelector('form'),form,'poll must preserve entered values and DOM');
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.match(form.querySelector('[data-form-error]').textContent,/Riprova/);assert.equal(sheet.querySelector('form'),form);
 failRelease=false;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(released.playerId,a.table.id);assert.equal(released.refund,0);assert.equal(sheet.hidden,true);
 click(root.querySelector('[data-asta-close]'));await flush();assert.match(root.textContent,/Asta chiusa/);assert.doesNotMatch(root.textContent,/Prima facciamo spazio/);
 state={...a,version:1};await poll();assert.match(root.textContent,/Asta chiusa/,'stale in-flight snapshot must not undo close');
 }finally{app?.destroy();for(const [k,d]of saved)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
test('release auction closes safely in both modes, refunds and undo persist exact budgets, and restart creates a new release batch',()=>{
 for(const mode of ['manual','live']){
 let s={league:{adminUid:'u1'},rules:structuredClone(DEFAULT_RULES),players:[{id:'p',role:'A',name:'Calciatore'}],teams:[{id:'t1',userId:'u1',creditAdjustment:0,roster:[{id:'p',role:'A',name:'Calciatore',price:10}]},{id:'t2',userId:'u2',roster:[]}],auction:{status:'none',version:1,log:[],order:[]}};
 s=auctionAction(s,'start-now',{mode,type:'riparazione'},'u1',{admin:true,now:1000});const batch=s.auction.releaseBatchId,before=teamBudget(s.teams[0],s.rules).credits;
 s=auctionAction(s,'table',{playerId:'p'},'u1',{admin:true,now:1001});assert.throws(()=>auctionAction(s,'close',{},'u2',{now:1002}),/presidente/);
 for(const refund of [0,1,5,10]){const released=auctionAction(s,'release',{playerId:'p',refund},'u1',{admin:true,now:1003});assert.equal(teamBudget(released.teams[0],s.rules).credits,before+refund);assert.deepEqual(auctionAction(released,'release-undo',{playerId:'p'},'u1',{admin:true,now:1004}).teams,s.teams);}
 const cancelled=auctionAction(s,'cancel-lot',{playerId:'p'},'u1',{admin:true,now:1004});assert.equal(cancelled.auction.table,null);assert.equal(cancelled.auction.callDeadline,null);assert.deepEqual(cancelled.teams,s.teams);
 const closed=auctionAction(s,'close',{},'u1',{admin:true,now:1005});assert.equal(closed.auction.status,'ended');assert.equal(closed.auction.table,null);assert.deepEqual(closed.teams,s.teams);assert.equal(auctionView(closed,'u1').status,'ended');
 const restarted=auctionAction(closed,'start-now',{mode,type:'riparazione'},'u1',{admin:true,now:2000});assert.notEqual(restarted.auction.releaseBatchId,batch);const bidding=auctionAction(restarted,'releases-done',{},'u1',{admin:true,now:2001});assert.equal(bidding.auction.phase,'bidding');assert.throws(()=>auctionAction(bidding,'release',{playerId:'p',refund:1},'u1',{admin:true,now:2002}),/chiusa/);
 }
});
