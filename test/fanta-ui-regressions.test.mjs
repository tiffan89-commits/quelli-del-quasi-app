import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {renderPlayerSheet,events} from '../public/src/fanta/giornata.mjs';import {fixtureTime,pts,extremeClass} from '../public/src/fanta/formato.mjs';import {preferredFanta,barModeSwitch} from '../public/src/fanta-mode.mjs';
import {renderLega} from '../public/src/fanta/lega.mjs';
test('standings show games played and highlight only fantasy points, never league points',()=>{
 const teams=[{id:'a',name:'Prima',manager:'Uno',color:'#abc'},{id:'b',name:'Seconda',manager:'Due',color:'#def'}],data={league:{name:'Test',season:'2026/27',maxMembers:2},members:teams.map((team,i)=>({team,isMe:i===0})),standings:teams.map((team,i)=>({team,position:i+1,played:2,points:i?0:6,fantapoints:i?130:150,won:i?0:2,drawn:0,lost:i?2:0,form:[]})),rules:{table:'Regole'},auction:{status:'none'}};
 const {document}=parseHTML('<html><body>'+renderLega(data,{sub:'classifica'})+'</body></html>');assert.equal(document.querySelector('[title="Partite giocate"]').textContent,'PG');assert.equal(document.querySelectorAll('td:last-child .is-best-score').length,1);assert.equal(document.querySelectorAll('td:last-child .is-worst-score').length,1);assert.equal(document.querySelectorAll('td:nth-last-child(2) .is-best-score,td:nth-last-child(2) .is-worst-score').length,0);
});
test('historical player details keep available votes and clearly report missing breakdowns rather than crashing',()=>{
 const p={id:'historical',name:'Nome storico',role:'A',club:'Roma',status:'voted',vote:6.5,fantavote:9.5,events:{goals:1}};
 let html=renderPlayerSheet(p,{official:true});assert.match(html,/dettagli di questa prestazione non sono disponibili/);assert.match(html,/6,5/);assert.match(html,/9,5/);assert.doesNotMatch(html,/undefined|NaN/);
 html=renderPlayerSheet({...p,breakdown:{start:6,lines:[],bonus:[]}});assert.match(html,/Statistiche non disponibili/);
});
test('goals and assists have one icon each and cards have distinct accessible descriptions',()=>{
 const {document}=parseHTML('<html><body>'+events({goals:2,assists:2,yellow:1,red:1})+'</body></html>');assert.equal(document.querySelectorAll('.ev-goal').length,2);assert.equal(document.querySelectorAll('.ev-assist svg').length,2);assert.equal(document.querySelectorAll('[aria-label="Cartellino giallo"]').length,1);assert.equal(document.querySelectorAll('[aria-label="Cartellino rosso"]').length,1);
});
test('match times are readable in Italy, unavailable points remain missing and tied rankings stay neutral',()=>{
 assert.match(fixtureTime('2026-11-01T19:45:00Z'),/20:45/);assert.equal(pts(null),'–');assert.equal(pts(0),'0,0');assert.equal(extremeClass([{points:0},{points:0}],'points',0),'');const rows=[{points:3},{points:0}];assert.equal(extremeClass(rows,'points',3),'is-best-score');assert.equal(extremeClass(rows,'points',0),'is-worst-score');
});
test('remembered Fanta preferences do not load Fanta on startup; the Bar switch itself does not fetch data',()=>{
 const priorStorage=globalThis.localStorage,priorFetch=globalThis.fetch;let calls=0;globalThis.localStorage={getItem:()=> 'fanta'};globalThis.fetch=()=>{calls++;throw Error('unexpected preload');};try{assert.equal(preferredFanta(),false);assert.match(barModeSwitch(false),/data-app-mode="fanta"/);assert.match(barModeSwitch(true),/data-app-mode="fanta"/);assert.equal(calls,0);}finally{globalThis.localStorage=priorStorage;globalThis.fetch=priorFetch;}
});
