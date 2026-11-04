import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {presenceProbability} from '../public/src/fanta/presence-probability.mjs';
import {playBadge,renderStudio} from '../public/src/fanta/formazione-studio.mjs';
import {draftFrom,canDropOn,dropOn,nextLabel,lineupOf} from '../public/src/fanta/squadra.mjs';
import {enableDrag} from '../public/src/fanta/trascina.mjs';
import {readPresenceMinutes} from '../fanta/play-probabilities.mjs';import {createReadCache} from '../lib/read-cache.mjs';
import {fixtureDb} from './fanta/helpers.mjs';import {mountFanta} from '../public/src/fanta/app.mjs';import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';
const roster='PDCA'.split('').map((role,i)=>({id:'p'+i,name:'Player '+role,role,club:'Inter',stats:{minutes:450,teamMatches:10},next:{opponent:'Juventus',home:i%2===0,kickoff:'2026-11-03T20:45:00Z'}}));
test('current probabilities beat minute estimates; stale forecasts never masquerade as current',()=>{
 const p=roster[0];assert.deepEqual(presenceProbability(p),{pct:50,source:'minutes-estimate'});
 assert.equal(presenceProbability({...p,play:{pct:0,source:'official'}}).pct,0);
 assert.equal(presenceProbability({...p,play:{pct:95,source:'giornata-precedente'}}).pct,50);
 assert.equal(presenceProbability({...p,stats:{minutes:0,teamMatches:4}}).pct,0);
 assert.equal(presenceProbability({...p,stats:{minutes:null,teamMatches:4}}),null);
 assert.equal(presenceProbability({...p,stats:{minutes:100,teamMatches:0}}),null);
 assert.equal(presenceProbability({...p,stats:{minutes:9999,teamMatches:4}}).pct,100);
 assert.equal(presenceProbability({...p,stats:{},seasonStats:{games:{minutes:270}},matches:6}).pct,50);
 assert.match(playBadge(p),/is-estimated/);assert.match(playBadge({...p,play:{pct:20,source:'official'}}),/is-actual/);
 assert.match(playBadge({...p,status:{type:'injured'}}),/Infortunato/);
});
test('compact editor shows opponent initials, roles and legal drop targets, never kickoff dates or duplicate available players',()=>{
 const draft=draftFrom(null,roster);draft.slots.P0='p0';draft.bench=['p1'];
 const {document}=parseHTML(renderStudio({data:{roster,round:{number:12,deadline:'2026-11-20'},rules:{formations:['4-4-2']}},draft,dirty:true},{role:'tutti'},0));
 assert.equal(nextLabel({opponent:'Inter',home:true}),'INT');assert.equal(nextLabel({opponent:'Inter',home:false}),'@ INT');assert.equal(nextLabel(null),'–');
 assert.equal(document.querySelectorAll('.fs-grid [data-st-player]').length,2);
 assert.equal(document.querySelector('[data-drop="slot:P0"]').dataset.dragId,'p0');
 assert.equal(document.querySelectorAll('.fs-grid [data-drag-axis="up"]').length,2);
 assert.ok(!document.querySelector('.fs-grid').textContent.includes('2026-11-03'));
 assert.match(document.querySelector('.fs-legend').textContent,/Probabilità effettiva/);assert.match(document.querySelector('.fs-legend').textContent,/Stimata/);
});
test('touch drag separates horizontal scrolling from upward placement and highlights only matching roles',()=>{
 const {window,document}=parseHTML('<html><body><div id="root"><button id="source" data-drag-id="p1" data-drag-from="list" data-drag-axis="up">D</button>'+['P0','D0','D1','C0','A0'].map(s=>'<button data-drop="slot:'+s+'"></button>').join('')+'</div></body></html>');
 const old={window:globalThis.window,document:globalThis.document};globalThis.window=window;globalThis.document=document;
 const root=document.getElementById('root'),source=document.getElementById('source'),controller=new AbortController();let draft=draftFrom(null,roster),calls=0,target=document.querySelector('[data-drop="slot:D0"]');
 document.elementFromPoint=()=>target;source.getBoundingClientRect=()=>({left:0,top:100,width:80,height:100});
 const event=(el,type,x,y,id=1,pointerType='touch')=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:id,pointerType,button:0,isPrimary:true});el.dispatchEvent(e);return e;};
 try{
  enableDrag(root,{signal:controller.signal,canDrop:(d,t)=>canDropOn(draft,roster,d,t,null),onDrop:(d,t)=>{calls++;draft=dropOn(draft,d,t,null,roster);}});
  for(const [i,role] of [...'PDCA'].entries()){
   source.dataset.dragId='p'+i;event(source,'pointerdown',20,150);event(window,'pointermove',20,100);
   assert.ok([...root.querySelectorAll('.is-droppable')].every(t=>t.dataset.drop.startsWith('slot:'+role)));
   assert.ok(root.querySelectorAll('.is-droppable').length);event(window,'pointercancel',20,100);
  }source.dataset.dragId='p1';
  event(source,'pointerdown',20,150);event(window,'pointermove',55,149);assert.equal(document.querySelector('.fanta-ghost'),null);event(window,'pointerup',55,149);assert.equal(calls,0);
  event(source,'pointerdown',20,150);event(window,'pointermove',21,130);
  assert.ok(document.querySelector('.fanta-ghost'));assert.deepEqual([...root.querySelectorAll('.is-droppable')].map(t=>t.dataset.drop),['slot:D0','slot:D1']);
  event(window,'pointerup',21,50,2);assert.equal(calls,0);assert.ok(document.querySelector('.fanta-ghost'));
  event(window,'pointermove',21,50);event(window,'pointerup',21,50);assert.equal(calls,1);assert.equal(draft.slots.D0,'p1');assert.equal(document.querySelector('.fanta-ghost'),null);assert.equal(root.querySelectorAll('.is-droppable').length,0);
  target=document.querySelector('[data-drop="slot:A0"]');event(source,'pointerdown',20,150);event(window,'pointermove',20,90);event(window,'pointerup',20,70);assert.equal(calls,1);
  event(source,'pointerdown',20,150);event(window,'pointermove',20,90);event(window,'pointercancel',20,70);assert.equal(calls,1);assert.equal(document.querySelector('.fanta-ghost'),null);
  event(source,'pointerdown',20,150);event(window,'pointermove',20,90);controller.abort();assert.equal(document.querySelector('.fanta-ghost'),null);assert.ok(!document.body.classList.contains('fanta-dragging'));
 }finally{controller.abort();for(const [k,v]of Object.entries(old)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('minute estimates are a cached read of existing season/club data, not an external refresh',async()=>{
 const f=await fixtureDb();try{
  const c=await f.connect(),player=(await c.query('SELECT id,club_id FROM fanta.players LIMIT 1')).rows[0],other=(await c.query('SELECT id FROM fanta.clubs WHERE id<>$1 LIMIT 1',[player.club_id])).rows[0].id;
  await c.query('INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES($1,99999,2026,2,$2,$3,$4,$5,$6)', ['presence-fixture','2026-10-10','FT',player.club_id,other,'{}']);
  await c.query('INSERT INTO fanta.player_stats(fixture_id,player_id,data,digest) VALUES($1,$2,$3,$4)', ['presence-fixture',player.id,JSON.stringify({minutes:45}),'test']);
  let reads=0;const db={query:(...a)=>{reads++;return c.query(...a);}},cache=createReadCache(),players=[{id:player.id,clubId:player.club_id}];
  const first=await readPresenceMinutes(db,players,2026,{cache,now:Date.parse('2026-11-03')});assert.equal(first[player.id].minutes,45);assert.ok(first[player.id].teamMatches>=1);await readPresenceMinutes(db,players,2026,{cache,now:Date.parse('2026-11-03')});assert.equal(reads,1);
  assert.deepEqual(await readPresenceMinutes(db,[{...players[0],seasonStats:{games:{minutes:90}}}],2026,{cache}),{});assert.equal(reads,1);
  assert.deepEqual(await readPresenceMinutes(db,players,2025,{cache,now:Date.parse('2026-11-03')}),{});c.release();
 }finally{await f.close();}
});

test('studio sheet handles real controller drops, retains horizontal position, saves once and reloads the assigned player',async()=>{
 const {window,document}=parseHTML('<html><head></head><body><div id="app"></div><div id="v2-sheet-root" hidden></div></body></html>');
 const keys=['window','document','location','history','localStorage','scrollTo','requestAnimationFrame','setInterval','clearInterval'],old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.assign(globalThis,{window,document,location:{hash:'#/fanta/squadra',pathname:'/',search:''},history:{pushState(){},replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},scrollTo(){},requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){}});
 const pause=()=>new Promise(r=>setTimeout(r,5));let instance;
 try{
  const api=createDemoFantaApi({delay:0}),root=document.getElementById('app');let saves=0;
  instance=mountFanta(root,{api:{...api,saveLineup:(...args)=>{saves++;return api.saveLineup(...args);}},initialTab:'squadra'});
  for(let i=0;i<30&&!root.querySelector('[data-studio="open"]');i++)await pause();
  const click=q=>{const el=document.querySelector(q);assert.ok(el,q);el.dispatchEvent(new window.Event('click',{bubbles:true}));};click('[data-studio="open"]');
  const source=document.querySelector('.fs-grid [data-drag-id]'),id=source.dataset.dragId,role=(await api.team('lega-quasi')).roster.find(p=>p.id===id).role;
  const target=document.querySelector('.fs [data-drop="slot:'+role+'0"]');document.elementFromPoint=()=>target;source.getBoundingClientRect=()=>({left:0,top:200,width:90,height:100});
  document.querySelector('.fs-grid').scrollLeft=80;document.querySelector('.fs-tabs').scrollLeft=20;
  const event=(el,type,x,y)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:1,pointerType:'touch',button:0,isPrimary:true});el.dispatchEvent(e);};
  event(source,'pointerdown',20,250);event(window,'pointermove',20,150);event(window,'pointerup',20,50);
  assert.equal(document.querySelector('.fs [data-drop="slot:'+role+'0"]').dataset.dragId,id);assert.equal(document.querySelector('.fs-grid').scrollLeft,80);assert.equal(document.querySelector('.fs-tabs').scrollLeft,20);assert.equal(document.querySelectorAll('.fs-grid [data-drag-id="'+id+'"]').length,0);
  click('.fs [data-lineup="best"]');click('.fs [data-lineup="save"]');click('.fs [data-lineup="save"]');await pause();assert.equal(saves,1);assert.match(document.querySelector('.fs-bar').textContent,/Salvata/);assert.ok((await api.team('lega-quasi')).lineup.starters.includes(id));
 }finally{instance?.destroy();for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});

test('clear buttons and dragging down remove draft selections only, preserve the module and respect saving locks',async()=>{
 const {window,document}=parseHTML('<html><head></head><body><div id="app"></div><div id="v2-sheet-root" hidden></div></body></html>');
 const keys=['window','document','location','history','localStorage','scrollTo','requestAnimationFrame','setInterval','clearInterval'],old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.assign(globalThis,{window,document,location:{hash:'#/fanta/squadra',pathname:'/',search:''},history:{pushState(){},replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},scrollTo(){},requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){}});let instance;
 const pause=()=>new Promise(r=>setTimeout(r,5)),click=q=>document.querySelector(q).dispatchEvent(new window.Event('click',{bubbles:true}));
 try{
  const api=createDemoFantaApi({delay:0}),root=document.getElementById('app');let writes=0;instance=mountFanta(root,{api:{...api,saveLineup:(...a)=>{writes++;return api.saveLineup(...a);}},initialTab:'squadra'});
  for(let i=0;i<30&&!root.querySelector('[data-studio="open"]');i++)await pause();click('[data-studio="open"]');assert.equal(document.querySelector('.fs [data-lineup="clear"]').disabled,true);
  click('.fs [data-lineup="best"]');const occupied=()=>[...document.querySelectorAll('.fs-pitch [data-drag-id]')].map(e=>e.dataset.dragId);const starters=occupied();assert.equal(starters.length,11);assert.equal(document.querySelectorAll('.fs-bcell').length,14);
  const field=document.querySelector('.fs-pitch [data-drag-id]'),id=field.dataset.dragId,dock=document.querySelector('.fs-dock');field.getBoundingClientRect=()=>({left:0,top:100,width:60,height:40});document.elementFromPoint=()=>dock;
  const event=(target,type,y)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:20,clientY:y,pointerId:7,pointerType:'touch',button:0,isPrimary:true});target.dispatchEvent(e);};
  event(field,'pointerdown',120);event(window,'pointermove',150);assert.ok(dock.classList.contains('is-droppable'));event(window,'pointermove',400);event(window,'pointerup',400);
  assert.equal(occupied().length,10);assert.ok(!occupied().includes(id));assert.ok(document.querySelector('.fs-grid [data-drag-id="'+id+'"]'));assert.equal(document.querySelectorAll('.fs-bcell').length,14);
  click('.fs [data-lineup="clear-bench"]');assert.equal(document.querySelectorAll('.fs-bcell').length,0);assert.equal(occupied().length,10);assert.equal(document.querySelector('.fs [data-lineup="clear-bench"]').disabled,true);
  click('.fs [data-lineup="clear"]');assert.equal(occupied().length,0);assert.equal(document.querySelectorAll('.fs-grid [data-drag-id]').length,25);assert.equal(document.querySelector('.fs-mod.is-active').textContent,'4-4-2');assert.equal(writes,0);assert.equal((await api.team('lega-quasi')).lineup,null);
  const data=await api.team('lega-quasi'),draft=draftFrom({formation:'4-4-2',starters:data.roster.map(p=>p.id)},data.roster),locked=parseHTML(renderStudio({data:{...data,round:{...data.round,locked:true}},draft,dirty:true,saving:true},{role:'tutti'})).document;
  for(const action of ['clear','clear-bench','best'])assert.equal(locked.querySelector('[data-lineup="'+action+'"]').hasAttribute('disabled'),true);
 }finally{instance?.destroy();for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});

test('undo restores the current-round saved lineup in both editors with no write or redundant save',async()=>{
 const {window,document}=parseHTML('<html><head></head><body><div id="app"></div><div id="v2-sheet-root" hidden></div></body></html>');
 const keys=['window','document','location','history','localStorage','scrollTo','requestAnimationFrame','setInterval','clearInterval'],old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.assign(globalThis,{window,document,location:{hash:'#/fanta/squadra',pathname:'/',search:''},history:{pushState(){},replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},scrollTo(){},requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){}});
 let instance,writes=0;const pause=()=>new Promise(r=>setTimeout(r,5)),click=q=>{const el=document.querySelector(q);assert.ok(el,q);assert.equal(el.disabled,false,q);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 try{
  const api=createDemoFantaApi({delay:0}),data=await api.team('lega-quasi'),{bestLineup}=await import('../public/src/fanta/squadra.mjs');
  const saved=await api.saveLineup('lega-quasi',data.round.number,lineupOf(bestLineup(draftFrom(null,data.roster),data.roster,data.rules.benchMax)));
  instance=mountFanta(document.getElementById('app'),{api:{...api,saveLineup:(...a)=>{writes++;return api.saveLineup(...a);}},initialTab:'squadra'});await instance.ready;
  for(let i=0;i<30&&!document.querySelector('[data-studio="open"]');i++)await pause();
  assert.equal(document.querySelector('[data-lineup="restore"]').disabled,true);
  click('[data-lineup="clear"]');click('[data-lineup="restore"]');assert.equal(document.querySelector('[data-lineup="save"]').disabled,true);assert.equal(document.querySelector('[data-lineup="restore"]').disabled,true);
  click('[data-studio="open"]');const occupied=()=>[...document.querySelectorAll('.fs-pitch [data-drag-id]')].map(el=>el.dataset.dragId).sort();
  assert.deepEqual(occupied(),[...saved.starters].sort());click('.fs [data-lineup="clear"]');assert.equal(occupied().length,0);click('.fs [data-lineup="restore"]');assert.deepEqual(occupied(),[...saved.starters].sort());
  assert.deepEqual([...document.querySelectorAll('.fs-bcell')].map(el=>el.dataset.stPlayer),saved.bench);assert.equal(document.querySelector('.fs [data-lineup="save"]').disabled,true);assert.equal(writes,0);assert.deepEqual((await api.team('lega-quasi')).lineup,saved);
 }finally{instance?.destroy();for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
