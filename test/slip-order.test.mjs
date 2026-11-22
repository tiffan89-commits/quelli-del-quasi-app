import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {orderSlipMatches,groupMatches} from '../public/match-layout.mjs';
import {renderSlipV2} from '../public/src/v2/slip-v2.mjs';
import {barSlipsView} from '../public/src/bar-slips.mjs';
import {patchSlipResults} from '../public/src/slip-results.mjs';
import {alignSerieASlipKickoffs} from '../public/src/slip-state.mjs';
import {mergeLiveSnapshot} from '../public/src/live-channel.mjs';
const ids=xs=>xs.map(x=>x.id);
const domOrder=root=>[...root.querySelectorAll('[data-match-card],[data-result-row]')].map(x=>x.dataset.matchCard||x.dataset.resultRow);
const fmt=String,esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const match=(id,kickoff,status='NS')=>({id,home:'Casa '+id,away:'Ospite '+id,kickoff,status,odds:{'1':2,X:3,'2':4,X2:1.5}});
const fixture=source=>({id:'r',source,title:'Giornata 1',kickoff:'2099-01-01T10:00:00Z',rules:{maxStake:20},matches:[match('late','2099-01-01T22:00:00+01:00'),match('early','2099-01-01T15:00:00+01:00'),match('middle','2099-01-01T18:00:00+01:00')]});
const render=round=>renderSlipV2({round,picks:{middle:'X2'},stake:12,openMatch:'middle',esc,fmt,date:String});

test('slip order uses real kickoff instants, LIVE priority and stable ties without modifying source data',()=>{
 const matches=[match('unknown',null),match('late','2026-11-01T15:00:00Z'),match('tie1','2026-10-31T15:00:00+01:00'),match('live2','2026-10-31T18:00:00+01:00','LIVE'),match('tie2','2026-10-31T14:00:00Z'),match('live1','2026-10-31T15:00:00+01:00','LIVE'),match('invalid','not-a-date')];
 const before=structuredClone(matches);
 assert.deepEqual(ids(orderSlipMatches(matches)),['live1','live2','tie1','tie2','late','unknown','invalid']);assert.deepEqual(matches,before);
 // The calendar retains its separate chronological grouping: live priority is confined to slips.
 assert.equal(groupMatches(matches)[0].matches[0].id,'tie1');
});

test('Serie A and fantasy slips initially display all fixtures in kickoff order, with live fixtures on top',()=>{
 for(const source of ['seriea','fantacalcio']){
  const r=fixture(source),before=ids(r.matches);
  assert.deepEqual(domOrder(parseHTML('<main>'+render(r)+'</main>').document),['early','middle','late']);
  r.matches[0].status='LIVE';
  assert.deepEqual(domOrder(parseHTML('<main>'+render(r)+'</main>').document),['late','early','middle']);assert.deepEqual(ids(r.matches),before);
 }
});

test('live transitions move existing rows, then restore chronological order at full time without rebuilding controls or lineups',()=>{
 const r=fixture('seriea'),picks={middle:'X2'},beforeIds=ids(r.matches);
 const {document}=parseHTML('<html><body><main>'+render(r)+'</main><dialog open><section class="lineup-section"><details open><summary>Panchina</summary><img src="/portrait"></details></section></dialog></body></html>');
 const root=document.querySelector('main'),list=root.querySelector('[data-slip-match-list]'),nodes=new Map([...root.querySelectorAll('[data-match-card]')].map(n=>[n.dataset.matchCard,n]));
 const panel=nodes.get('middle').querySelector('.v2-odds-extra'),stake=document.querySelector('#stake'),modal=document.querySelector('dialog'),lineup=modal.firstElementChild,portrait=modal.querySelector('img');
 const heading=list.querySelector('h1'),footer=list.lastElementChild;panel.scrollLeft=55;stake.value='12';root.scrollTop=240;
 let clicks=0;nodes.get('late').querySelector('[data-detail]').onclick=()=>clicks++;
 let moves=0;const insert=list.insertBefore.bind(list);list.insertBefore=(...args)=>{moves++;return insert(...args);};
 patchSlipResults(root,r,picks,false);assert.equal(moves,0);
 r.matches[0].status='LIVE';r.matches[0].liveScore=[0,0];patchSlipResults(root,r,picks,true);
 assert.deepEqual(domOrder(root),['late','early','middle']);assert.ok(moves>0);
 const unchanged=moves;patchSlipResults(root,r,picks,true);assert.equal(moves,unchanged);
 r.matches[2].status='LIVE';r.matches[2].liveScore=[1,0];patchSlipResults(root,r,picks,true);assert.deepEqual(domOrder(root),['middle','late','early']);
 r.matches[0].status='FT';r.matches[0].score=[0,0];patchSlipResults(root,r,picks,true);assert.deepEqual(domOrder(root),['middle','early','late']);
 r.matches[2].status='FT';r.matches[2].score=[1,0];patchSlipResults(root,r,picks,true);assert.deepEqual(domOrder(root),['early','middle','late']);
 for(const [id,node] of nodes)assert.equal(root.querySelector('[data-match-card="'+id+'"]'),node);
 assert.equal(nodes.get('middle').querySelector('.v2-odds-extra'),panel);assert.equal(panel.scrollLeft,55);assert.equal(stake.value,'12');assert.equal(root.scrollTop,240);
 assert.equal(list.querySelector('h1'),heading);assert.equal(list.lastElementChild,footer);assert.equal(modal.firstElementChild,lineup);assert.equal(modal.querySelector('img'),portrait);assert.ok(modal.querySelector('details').hasAttribute('open'));
 nodes.get('late').querySelector('[data-detail]').click();assert.equal(clicks,1);assert.deepEqual(picks,{middle:'X2'});assert.deepEqual(ids(r.matches),beforeIds);
});

test('each Bar mini-slip uses the same order and independently promotes its live row',()=>{
 const r=fixture('seriea');r.closed=true;r.publicSlips=['u','v'].map(uid=>({uid,stake:1,picks:{early:'1',middle:'X2',late:'2'}}));
 const l={id:'l',members:[{uid:'u',name:'Uno'},{uid:'v',name:'Due'}]};
 const {document}=parseHTML('<html><body>'+barSlipsView({l,r,uid:'u',fmt,rounds:[r],sourceOf:()=> 'seriea'})+'</body></html>');
 const lists=[...document.querySelectorAll('.bar-bets')],rows=lists.map(list=>[...list.children]);
 for(const list of lists)assert.deepEqual(domOrder(list),['early','middle','late']);
 r.matches[0].status='LIVE';r.matches[0].liveScore=[0,0];patchSlipResults(document,r,{},true);
 lists.forEach((list,i)=>{assert.deepEqual(domOrder(list),['late','early','middle']);for(const row of rows[i])assert.ok([...list.children].includes(row));});
});

test('the Bar ticket stays chronological across kickoff and full time even when the league has an outdated date',()=>{
 const saturday=match('como','2026-11-21T14:00:00Z','FT');
 const juventus=match('juventus','2026-11-23T19:45:00Z');
 const bologna=match('bologna','2026-11-22T17:00:00Z');
 const monza=match('monza','2026-11-23T17:30:00Z');
 const r={...fixture('seriea'),number:12,matches:[monza,juventus,bologna,saturday]};
 const official=[saturday,
  {...juventus,kickoff:'2026-11-22T11:30:00Z'},
  {...bologna,kickoff:'2026-11-22T14:00:00Z'},
  {...monza,kickoff:'2026-11-23T19:45:00Z'}
 ];
 const state={leagues:[{id:'l',members:[],rounds:[r]}],calendar:{rounds:[{number:12,matches:official}]}};
 alignSerieASlipKickoffs(r,state.calendar);
 const {document}=parseHTML(renderSlipV2({round:r,barTicket:true,esc,fmt,date:String}));
 const list=document.querySelector('.ticket-matches'),row=list.querySelector('[data-match-card="juventus"]');
 const groups=()=>[...list.querySelectorAll('.ticket-day:not([hidden])')].map(x=>x.textContent);
 assert.deepEqual(groups(),['SAB 21 NOV','DOM 22 NOV','LUN 23 NOV']);
 assert.deepEqual(domOrder(list),['como','juventus','bologna','monza']);
 assert.equal(row.querySelector('time').textContent,'12:30');
 list.scrollTop=80;
 let moves=0;
 const insert=list.insertBefore.bind(list);list.insertBefore=(...args)=>{moves++;return insert(...args);};
 for(const changes of [{status:'LIVE',liveScore:[4,0],clock:"90+3'"},{status:'FT',score:[4,0],liveScore:null,clock:null}]){
  mergeLiveSnapshot(state,{league:'l',rounds:[{id:r.id,matches:[{id:'juventus',kickoff:'2026-11-23T19:45:00Z',...changes}]}],
   calendar:[{...official[1],...changes}]});
  patchSlipResults(document,r,{},false);
  assert.deepEqual(domOrder(list),['como','juventus','bologna','monza']);
  assert.deepEqual(groups(),['SAB 21 NOV','DOM 22 NOV','LUN 23 NOV']);
  assert.equal(list.querySelector('[data-match-card="juventus"]'),row);
  assert.equal(list.scrollTop,80);
  assert.equal(row.querySelector('.inline-live')!==null,changes.status==='LIVE');
 }
 assert.equal(row.querySelector('.inline-score').textContent,'4 – 0');
 assert.equal(moves,0);
});
