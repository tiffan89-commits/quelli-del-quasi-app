import {parseHTML} from 'linkedom';import {renderStudio} from '../public/src/fanta/formazione-studio.mjs';
import {renderTeamCalendar,teamCalendarWindow} from '../public/src/fanta/squadra.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';import {renderPickSheet,renderBenchSheet,renderSquadra,draftFrom} from '../public/src/fanta/squadra.mjs';import {orderRounds} from '../public/src/fanta/formato.mjs';
test('assigned players disappear from the studio pool, while the saved overview exposes no editing selectors',async()=>{
 const api=createDemoFantaApi({delay:0}),data=await api.team('lega-quasi'),draft=draftFrom(null,data.roster),rolePlayers=data.roster.filter(p=>p.role==='D');draft.slots.D0=rolePlayers[0].id;draft.bench=[rolePlayers[1].id];const sq={data,draft,sub:'formazione',filter:'tutti'};
 for(const html of [renderPickSheet(sq,'D1',true),renderBenchSheet(sq)]){assert.ok(!html.includes('data-pick="'+rolePlayers[0].id+'"'));assert.ok(!html.includes('data-pick="'+rolePlayers[1].id+'"'));assert.ok(!html.includes('data-bench-pick="'+rolePlayers[0].id+'"'));assert.ok(!html.includes('data-bench-pick="'+rolePlayers[1].id+'"'));assert.ok(html.includes(rolePlayers[2].id));}
 const swap=renderPickSheet(sq,'D1',false);assert.ok(swap.includes('data-pick="'+rolePlayers[0].id+'"'));assert.ok(swap.indexOf('data-pick="'+rolePlayers[2].id+'"')<swap.indexOf('data-pick="'+rolePlayers[0].id+'"'));
 const overview=parseHTML(renderSquadra(sq)).document;assert.equal(overview.querySelector('[data-lineup],[data-list-add],[data-slot],[data-formation],[data-drag-id]'),null);assert.ok(overview.querySelector('[data-studio="open"]'));
 assert.equal(overview.querySelector('.fanta-view-module'),null);
 assert.equal(overview.querySelector('[data-pitch-flip]').textContent.trim(),'Panchina');
 assert.ok(overview.querySelector('.pitch-flip-back').hasAttribute('inert'));
 const bench=parseHTML(renderSquadra({...sq,benchFlipped:true})).document;
 assert.ok(bench.querySelector('.pitch-flip-front').hasAttribute('inert'));
 assert.equal(bench.querySelector('.pitch-flip-back').hasAttribute('inert'),false);
 let doc=parseHTML(renderStudio(sq,{role:'tutti'})).document;assert.equal(doc.querySelectorAll('.fs-grid [data-st-player="'+rolePlayers[0].id+'"]').length,0);assert.equal(doc.querySelectorAll('.fs-grid [data-st-player="'+rolePlayers[1].id+'"]').length,1);assert.ok(doc.querySelector('.fs-grid [data-st-player="'+rolePlayers[2].id+'"]'));draft.slots.D0=null;doc=parseHTML(renderStudio(sq,{role:'tutti'})).document;assert.ok(doc.querySelector('.fs-grid [data-st-player="'+rolePlayers[0].id+'"]'));
 assert.deepEqual(orderRounds([1,2,3,4,5].map(number=>({number})),3).map(r=>r.number),[3,4,5,2,1]);
});
test('demo also opens a physical auction immediately without an automatic-start race',async()=>{const api=createDemoFantaApi({delay:0});await api.auctionMode('lega-quasi','manual');await api.auctionClose('lega-quasi');const opened=await api.auctionStartNow('lega-quasi','manual');assert.equal(opened.mode,'manual');assert.equal(opened.status,'running');});

test('team calendar starts at the first round and points to the exact Studio Live matchup',()=>{
 const match=(round,official)=>({id:'sfida-'+round,round,official,home:{team:{name:'Casa'},goals:official?0:null,points:official?50:null},away:{team:{name:'Ospite'},goals:official?2:null,points:official?72:null}});
 const {document}=parseHTML(renderTeamCalendar({round:{number:3},calendar:[match(3,false),match(1,true),match(4,false),match(2,true)]}));
 const tiles=[...document.querySelectorAll('.fanta-team-fixture')];
 assert.deepEqual(tiles.map(t=>t.dataset.mu),['sfida-1','sfida-2','sfida-3','sfida-4']);
 assert.equal(tiles[0].querySelector('.team-calendar-score').textContent,'0–2');
 assert.equal(tiles[0].dataset.go,'giornata');
 assert.equal(tiles[0].dataset.round,'1');
});

test('at round ten the team calendar opens on 8 to 11 and extends by four on either side',()=>{
 const calendar=Array.from({length:18},(_,i)=>({id:'m'+(i+1),round:i+1}));
 const data={round:{number:11},calendarCurrent:10,calendar};
 const rounds=range=>teamCalendarWindow(data,range).fixtures.map(m=>m.round);
 assert.deepEqual(rounds(),[8,9,10,11]);
 assert.deepEqual(rounds({earlier:4}),[4,5,6,7,8,9,10,11]);
 assert.deepEqual(rounds({later:4}),[8,9,10,11,12,13,14,15]);
 assert.equal(teamCalendarWindow({...data,calendarCurrent:1}).hasEarlier,false);
});
