import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {totalOdds,renderSlipV2,bindSlipV2} from '../public/src/v2/slip-v2.mjs';
import {patchSlipResults} from '../public/src/slip-results.mjs';
import {QUOTA_SCORING} from '../public/scoring.mjs';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const round=()=>({id:'r',kickoff:'2099-01-01T12:00:00Z',rules:{maxStake:20},matches:[1,2,3].map(id=>({id:String(id),home:'Casa '+id,away:'Ospite '+id,odds:{'1':2,'X':3,'2':4,'X2':1.5},status:'NS'}))});
const view=r=>renderSlipV2({round:r,picks:{'1':'1'},esc,fmt:String,date:String});
test('passo 9: quota totale assente o prodotto di tre scelte',()=>{
 const r=round();assert.equal(totalOdds(r,{}),null);assert.equal(totalOdds(r,{'1':'1','2':'X','3':'2'}),24);
});
test('passo 9: ogni gara espone gli agganci per aggiornare solo il risultato',()=>{
 const r=round(),{document}=parseHTML('<html><body>'+view(r)+'</body></html>');
 assert.equal(document.querySelectorAll('[data-match-card]').length,3);
 assert.equal(document.querySelectorAll('[data-inline-result]').length,3);
 const row=document.querySelector('[data-match-card="1"]'),choice=row.querySelector('[data-pick]');
 r.matches[0].status='LIVE';r.matches[0].liveScore=[1,0];r.matches[0].clock="25'";
 patchSlipResults(document,r,{'1':'1'},true);
 assert.equal(document.querySelector('[data-match-card="1"]'),row);
 assert.equal(row.querySelector('[data-pick]'),choice);
 assert.match(row.querySelector('[data-inline-result]').textContent,/LIVE.*1 – 0/);
 assert.ok(choice.classList.contains('pick-winning'));
});
test('passo 9: mercati aggiuntivi e callback mantengono gli identificatori',()=>{
 const {document}=parseHTML('<html><body>'+renderSlipV2({round:round(),openMatch:'1',esc,fmt:String,date:String})+'</body></html>');
 const calls=[];bindSlipV2(document,{onPick:(...a)=>calls.push(['pick',...a]),onToggle:id=>calls.push(['toggle',id]),onStake:v=>calls.push(['stake',v]),onSave:()=>calls.push(['save'])});
 document.querySelector('[data-pick="1"][data-value="X2"]').click();
 document.querySelector('[data-v2-more="2"]').click();document.querySelector('[data-v2-stake="20"]').click();
 document.querySelector('#save-slip').click();
 assert.deepEqual(calls,[['pick','1','X2'],['toggle','2'],['stake',20],['save']]);
});
const f=String;
test('passo 9: le gare restano apribili e i mercati si richiudono anche dopo la scelta',()=>{
 const r={matches:[{id:'m',home:'Casa',away:'Fuori',odds:{'1':2,'X2':1.5}}]};
 const closed=renderSlipV2({round:r,picks:{m:'X2'},openMatch:null,esc:f,fmt:f,date:f});
 assert.match(closed,/data-detail="m"/);assert.doesNotMatch(closed,/class="v2-odds-extra"/);
 const open=renderSlipV2({round:r,picks:{m:'X2'},openMatch:'m',esc:f,fmt:f,date:f});
 assert.match(open,/class="v2-odds-extra"/);
 const points=renderSlipV2({round:{...r,pointsOnly:true},openMatch:'m',esc:f,fmt:f,date:f});
 assert.doesNotMatch(points,/data-v2-more|data-value="X2"/);
});

test('an unpriced preview allows local picks but blocks confirmation and removes repeated slip text',()=>{
 const r=round();delete r.matches[1].odds;
 const options={round:{...r,preview:true},picks:{1:'1',2:'1',3:'1'},esc,fmt:String,date:String};
 const {document}=parseHTML(renderSlipV2(options));
 assert.equal(document.querySelectorAll('[data-pick]:not([disabled])').length,9);
 assert.ok(document.querySelector('#save-slip').hasAttribute('disabled'));
 assert.match(document.querySelector('.v2-state').textContent,/Anteprima/);
 assert.equal(document.querySelector('[data-v2-slip-total]').textContent,'?');
 assert.equal(document.querySelector('[data-pick="2"][data-value="1"]>span').textContent,'?');
 assert.match(document.querySelector('[data-os-footer]').textContent,/\? = Quota in arrivo.*Gioco fantasy con solo crediti virtuali/);
 assert.equal(document.querySelector('.slip-odds-legend').hidden,false);
 assert.equal(parseHTML(view(round())).document.querySelector('.slip-odds-legend').hidden,true);
 assert.doesNotMatch(document.body?.textContent||document.toString(),/una scelta per partita|Punti per gli esiti|Regolamento/);
 const standard=parseHTML(renderSlipV2({...options,round:r})).document;
 assert.equal(standard.querySelectorAll('[data-pick]:not([disabled])').length,0);
 assert.equal(standard.querySelector('#save-slip'),null);
});

test('quota scoring shows only points for a hit and uses the accepted quote on a closed slip',()=>{
 const r=round();r.closed=true;r.rules.scoring=QUOTA_SCORING;
 r.slip={picks:{1:'1'},acceptedOdds:{1:1.35}};
 const {document}=parseHTML(view(r)),selected=document.querySelector('[data-pick="1"][data-value="1"]');
 assert.equal(selected.querySelector('.points-gain').textContent,'+1,35');
 assert.equal(selected.querySelector('.points-loss'),null);
 assert.match(selected.getAttribute('aria-label'),/0 punti se sbagliato/);
});
