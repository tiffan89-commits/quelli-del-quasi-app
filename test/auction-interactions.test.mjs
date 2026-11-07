import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {mountFanta} from '../public/src/fanta/app.mjs';import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';
import {auctionAction,auctionView,teamBudget} from '../fanta/auction.mjs';import {DEFAULT_RULES} from '../fanta/rules.mjs';
import {auctionAudio,renderAsta,shownSeconds} from '../public/src/fanta/asta.mjs';
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
 click(root.querySelector('[data-asta-close]'));assert.ok(sheet.querySelector('[data-auction-close-confirm]'));
 click(sheet.querySelector('[data-auction-close-confirm]'));await flush();assert.match(root.textContent,/Asta chiusa/);assert.doesNotMatch(root.textContent,/Prima facciamo spazio/);
 state={...a,version:1};await poll();assert.match(root.textContent,/Asta chiusa/,'stale in-flight snapshot must not undo close');
 }finally{app?.destroy();for(const [k,d]of saved)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
test('wizard choices independently control draw mode, role order and team order, and offers stay limited in the room',()=>{
 const state={league:{adminUid:'u1'},rules:{...DEFAULT_RULES,roster:{P:1,D:1,C:1,A:1}},teams:['t1','t2'].map((id,i)=>({id,name:id,userId:'u'+(i+1),roster:[]})),players:[{id:'striker',name:'Punta',role:'A'},{id:'keeper',name:'Portiere',role:'P'}],auction:{status:'none',version:1,log:[],order:[]}};
 const opts={admin:true,now:1000,rng:()=>0,id:()=> 'lot'};
 const start=(nomination,playerOrder,teamOrder)=>{
  const lobby=auctionAction(state,'start-now',{mode:'live',type:'iniziale',config:{budget:650,nomination,playerOrder,teamOrder}},'u1',opts);
  assert.equal(lobby.auction.phase,'lobby');assert.equal(lobby.auction.caller,null);
  assert.throws(()=>auctionAction(lobby,'lobby-start',{},'u2',{...opts,admin:false}),/presidente/);
  const countdown=auctionAction(lobby,'lobby-start',{},'u1',opts);
  assert.equal(Date.parse(countdown.auction.lobbyEndsAt),11000);
  assert.deepEqual(auctionAction(countdown,'lobby-start',{},'u1',{...opts,now:2000}).auction,countdown.auction);
  assert.equal(auctionAction(countdown,'read',{},'server',{...opts,now:10999}).auction.phase,'lobby');
  return auctionAction(countdown,'read',{},'server',{...opts,now:11000});
 };
 const personal=start('personal','roles',['t2','t1']);assert.equal(personal.auction.caller,'t2');assert.equal(personal.auction.currentRole,'P');
 assert.throws(()=>auctionAction(personal,'nominate',{playerId:'striker'},'u2',opts),/ruolo/);
 assert.throws(()=>start('personal','roles',['t1','t1']),/ordine/);
 const random=start('random','mixed',null);assert.equal(random.auction.lot.player.id,'striker');assert.equal(random.auction.lot.leader,null);assert.equal(random.auction.lot.bid,0);assert.equal(teamBudget(random.teams[0],random.rules).credits,650);
 let next=start('random','roles',null);assert.equal(next.auction.lot.player.id,'keeper');
 for(let i=1;i<=7;i++)next=auctionAction(next,'bid',{lotId:'lot',amount:i},i%2?'u1':'u2',{...opts,now:11000+i});
 assert.equal(next.auction.lot.history.length,7);const view=auctionView(next,'u1');assert.deepEqual(view.lot.history.map(h=>h.amount),[3,4,5,6,7]);
 const {document}=parseHTML(renderAsta(view));assert.deepEqual([...document.querySelectorAll('.fanta-a-history li b')].map(x=>Number(x.textContent)),[7,6,5,4,3]);
 assert.equal(document.querySelectorAll('[data-auction-panel]').length,3);assert.equal(document.querySelectorAll('.auction-page-head [data-ends]').length,1);
});

test('the last five displayed seconds span three real seconds and each of them beeps once',async()=>{
 let played=0;
 class Audio {state='running';currentTime=0;resume(){return Promise.resolve();}createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},start(){played++;},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}}
 const sound=auctionAudio({AudioContext:Audio});sound.alert('first');assert.equal(played,0);
 assert.equal(shownSeconds(3000,5,3,30),5);assert.equal(shownSeconds(30000,5,3,30),30);
 await sound.set(true);for(const n of [3,3,2,2,1,1])sound.alert('first',n);assert.equal(played,3);
 sound.offer();assert.equal(played,4);
 await sound.set(false);sound.alert('third');sound.offer();assert.equal(played,4);
});

test('initial and repair auctions depend on roster completion; disabled computers never enter the caller rotation',()=>{
 const rules={...DEFAULT_RULES,roster:{P:1,D:0,C:0,A:0}},config={budget:500,nomination:'personal',playerOrder:'roles',teamOrder:['cpu','human']};
 const players=[{id:'p1',role:'P',name:'Portiere 1'},{id:'p2',role:'P',name:'Portiere 2'}];
 const state={league:{adminUid:'owner',maxMembers:2},rules,players,teams:[{id:'cpu',roster:[]},{id:'human',userId:'owner',roster:[]}],auction:{status:'none',version:1,log:[],order:[]}};
 const opts={admin:true,now:1000};
 assert.throws(()=>auctionAction(state,'start-now',{mode:'live',type:'riparazione',config},'owner',opts),/Completa tutte le rose/);
 const lobby=auctionAction(state,'start-now',{mode:'live',type:'iniziale',computerTeams:false,config},'owner',opts);
 const countdown=auctionAction(lobby,'lobby-start',{},'owner',opts);
 const bidding=auctionAction(countdown,'read',{},'server',{now:11000});
 assert.equal(bidding.auction.caller,'human');
 assert.equal(auctionView(bidding,'owner').computerTeamsActive,false);
 const called=auctionAction(bidding,'nominate',{playerId:'p1'},'owner',{now:11001});
 assert.throws(()=>auctionAction(called,'bid',{lotId:called.auction.lot.id,amount:2},null,{now:11002,computerTeam:'cpu'}),/Non puoi partecipare/);
 const complete=structuredClone(state);complete.teams.forEach((t,i)=>t.roster.push({...players[i],price:1}));
 assert.throws(()=>auctionAction(complete,'start-now',{mode:'live',type:'iniziale',config},'owner',opts),/rose sono complete/);
 const repair=auctionAction(complete,'start-now',{mode:'live',type:'riparazione',config},'owner',opts);
 assert.equal(repair.auction.phase,'releases');
 assert.equal(auctionAction(repair,'releases-done',{},'owner',opts).auction.phase,'lobby');
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
