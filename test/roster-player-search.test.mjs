import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {bindRosterPlayerSearch,renderRosterAdmin} from '../public/src/fanta/mercato.mjs';

const assigned={id:'assigned',name:'Già Assegnato',role:'A',club:'Lecce',price:15};
const team={id:'t',name:'Atletico Poco'};
const data={team,roster:[assigned]};
const league={members:[{team},{team:{id:'other',name:'Hellas Madonna'}}]};

test('roster addition fetches on the fourth surname letter and clears a selection when the search changes',async()=>{
 const {document,Event}=parseHTML('<html><body>'+renderRosterAdmin(data,league,{rosterKind:'add'})+'</body></html>');
 const form=document.querySelector('form'),input=form.querySelector('[data-roster-search]');
 const results=form.querySelector('[data-roster-results]'),submit=form.querySelector('button[type=submit]');
 let resolve,calls=0;
 bindRosterPlayerSearch(form,()=>{calls++;return new Promise(done=>{resolve=done;});});
 const search=value=>{input.value=value;input.dispatchEvent(new Event('input'));};
 search("Pá v'");
 assert.equal(calls,0);
 assert.equal(results.hidden,true);
 assert.equal(submit.disabled,true);
 search('Pávl');
 search('Ketel');
 assert.equal(calls,1);
 resolve([
  {id:'p1',name:'Strahinja Pavlović',surname:'Pavlović',role:'D',club:'Milan'},
  {id:'p2',name:'C. De Ketelaere',role:'C',club:'Atalanta'},
  {id:'p3',name:'Ketel Altri',surname:'Altri',role:'A',club:'Napoli'},
 ]);
 await new Promise(setImmediate);
 assert.deepEqual([...results.querySelectorAll('input')].map(option=>option.value),['p2']);
 const radio=results.querySelector('input');radio.setAttribute('checked','');radio.dispatchEvent(new Event('change',{bubbles:true}));
 assert.equal(submit.disabled,false);
 search('pavlovic');
 await new Promise(setImmediate);
 assert.deepEqual([...results.querySelectorAll('input')].map(option=>option.value),['p1']);
 assert.equal(submit.disabled,true);
 search('XYZW');
 await new Promise(setImmediate);
 assert.match(form.querySelector('[data-roster-status]').textContent,/Nessun calciatore/);
 assert.equal(calls,1);
});

test('remove, reprice and move retain the current roster selector',()=>{
 for(const kind of ['remove','price','move']){
  const {document}=parseHTML(renderRosterAdmin(data,league,{rosterKind:kind}));
  assert.deepEqual([...document.querySelectorAll('select[name=playerId] option')].map(option=>option.value),[assigned.id]);
  assert.equal(document.querySelector('[data-roster-search]'),null);
  assert.equal(!!document.querySelector('input[name=price]'),kind!=='remove');
  assert.equal(!!document.querySelector('select[name=toTeamId]'),kind==='move');
 }
});
