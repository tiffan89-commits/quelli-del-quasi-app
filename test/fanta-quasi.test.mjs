import test from 'node:test';
import assert from 'node:assert/strict';
import {fantaQuasiPage,fantaQuasiTeaser,composeWaitlistMessage,bindFantaQuasi,FANTA_SEASON} from '../public/src/fanta-quasi.mjs';
import {parseHTML} from 'linkedom';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('la pagina Fantacalcio mostra il percorso e il modulo solo a chi ha un account verificato',()=>{
 const verified=fantaQuasiPage({},{id:'u',emailVerified:true},esc);
 assert.match(verified,/id="fq-form"/);assert.match(verified,/Mettimi in lista/);assert.match(verified,new RegExp(FANTA_SEASON));
 const demo=fantaQuasiPage({},{id:'d',demo:true},esc);
 assert.doesNotMatch(demo,/id="fq-form"/);assert.match(demo,/Dalla demo non è possibile/);
 assert.match(fantaQuasiTeaser(esc),/data-app-mode="fanta"/);
});
test('il messaggio di prenotazione riassume ruolo, dimensione e note',()=>{
 const m=composeWaitlistMessage({role:'Presidente di lega',size:'8',note:''});
 assert.match(m,/Ruolo: Presidente di lega/);assert.match(m,/Dimensione lega: 8/);assert.doesNotMatch(m,/Note:/);assert.ok(m.length>=10);
 assert.match(composeWaitlistMessage({role:'Giocatore',size:'4–6',note:'Serve il mercato'}),/Note: Serve il mercato/);
});
test('il modulo non chiede più quali funzioni servono',()=>{
 const html=fantaQuasiPage({},{id:'u',emailVerified:true},esc);
 assert.doesNotMatch(html,/Cosa ti serve|name="feature"/);assert.match(html,/name="role"/);assert.match(html,/name="size"/);assert.match(html,/name="note"/);
 assert.match(html,/textarea name="note" required/);assert.doesNotMatch(html,/facoltativo/);
});

test('waitlist confirmation comes from the authenticated server state, not stale local storage',()=>{
 const html=fantaQuasiPage({},{id:'u',emailVerified:true,fantacalcioWaitlistSeason:FANTA_SEASON},esc);assert.match(html,/Sei in lista/);assert.doesNotMatch(html,/id="fq-form"/);
});

test('waitlist form sends selections and required message, prevents double submission and recovers errors',async()=>{
 const originalDocument=globalThis.document,originalFormData=globalThis.FormData;
 const {document}=parseHTML('<html><body>'+fantaQuasiPage({},{id:'u',emailVerified:true},esc)+'</body></html>');
 let fields={role:'Giocatore',size:'10',note:'Messaggio dal form'},calls=0,resolve,done=0;
 globalThis.document=document;globalThis.FormData=class{get(k){return fields[k];}};
 try{
  const u={id:'u',emailVerified:true};bindFantaQuasi({user:u,api:async(route,p)=>{calls++;assert.equal(route,'fantacalcio-waitlist');assert.deepEqual(p,fields);return new Promise(r=>resolve=r);},onDone:()=>done++});
  const form=document.querySelector('#fq-form'),event={preventDefault(){}};
  const pending=form.onsubmit(event);await form.onsubmit(event);assert.equal(calls,1);resolve({ok:true,message:'Sei in lista'});await pending;assert.equal(done,1);assert.equal(u.fantacalcioWaitlistSeason,FANTA_SEASON);
  fields={...fields,note:'  '};await form.onsubmit(event);assert.equal(calls,1);assert.match(document.querySelector('#fq-status').textContent,/Scrivi un messaggio/);
  fields.note='Nuovo messaggio';bindFantaQuasi({user:u,api:async()=>{throw Error('Connessione assente');}});await form.onsubmit(event);assert.match(document.querySelector('#fq-status').textContent,/Connessione assente/);assert.equal(document.querySelector('button[type=submit]').disabled,false);
 }finally{globalThis.document=originalDocument;globalThis.FormData=originalFormData;}
});
