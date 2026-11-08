import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {renderSlipV2,patchSlipV2,bindSlipV2} from '../public/src/v2/slip-v2.mjs';
import {createFantaSlips} from '../public/src/fanta/schedine.mjs';
import {demoSlipServices} from '../public/src/fanta/demo-slips.mjs';
const make=(extra={})=>({id:'round',number:11,deadline:new Date(Date.now()+86400000).toISOString(),kickoff:new Date(Date.now()+86400000).toISOString(),rules:{maxStake:20},matches:[1,2,3].map(id=>({id:'m'+id,home:'Casa '+id,away:'Ospite '+id,odds:{1:2,X:3,2:4}})),...extra});
const render=(round,picks={})=>renderSlipV2({round,picks,stake:10,credits:500,esc:String,fmt:String,date:()=> 'domani'});
test('one compact status contains missing picks; stake choices stay in a closed accessible picker',()=>{
 const {document}=parseHTML(render(make())),bar=document.querySelector('.v2-slipbar');assert.equal(bar.querySelector('.v2-state').textContent,'Mancano 3 partite');assert.equal(bar.querySelector('details').hasAttribute('open'),false);assert.equal(bar.querySelectorAll('.v2-stakes').length,1);assert.ok(bar.querySelector('.v2-stake-panel #stake'));assert.equal(bar.querySelector('#save-slip').disabled,true);assert.match(bar.querySelector('.v2-error').className,/sr-only/);assert.equal(bar.querySelector('[data-v2-stake-menu]').getAttribute('aria-label'),'Modifica la puntata in crediti');
});
test('quick amounts close the picker, custom decimals are preserved, Escape restores focus and save returns its promise',async()=>{
 const {document,window}=parseHTML('<html><body><div id="root">'+render(make(),{m1:'1',m2:'1',m3:'1'})+'</div></body></html>'),root=document.querySelector('#root'),amounts=[];const pending=Promise.resolve('saved');
 bindSlipV2(root,{onStake:n=>amounts.push(n),onSave:()=>pending,onPick(){},onToggle(){}});
 const picker=root.querySelector('details');picker.setAttribute('open','');root.querySelector('[data-v2-stake="20"]').click();assert.deepEqual(amounts,[20]);assert.equal(picker.hasAttribute('open'),false);
 picker.setAttribute('open','');const field=root.querySelector('#stake');field.value='6.5';field.oninput();assert.deepEqual(amounts,[20,6.5]);assert.equal(picker.hasAttribute('open'),true);
 const event=new window.Event('keydown',{bubbles:true,cancelable:true});event.key='Escape';picker.dispatchEvent(event);assert.equal(picker.hasAttribute('open'),false);
 picker.setAttribute('open','');assert.equal(root.querySelector('#save-slip').onclick(),pending);assert.equal(picker.hasAttribute('open'),false);assert.equal(await pending,'saved');
});
test('confirmed, points-only and closed slips keep their original action rules',()=>{
 const picks={m1:'1',m2:'1',m3:'1'},round=make({slip:{picks,stake:10,odds:8}}),saved=parseHTML(render(round,picks)).document;assert.equal(saved.querySelector('#save-slip').disabled,true);assert.match(saved.querySelector('.v2-state').textContent,/Confermata/);
 const points=parseHTML(render(make({pointsOnly:true}),picks)).document;assert.equal(points.querySelector('details'),null);assert.ok(points.querySelector('#save-slip'));
 const closed=make({closed:true});assert.equal(parseHTML(render(closed,picks)).document.querySelector('.v2-slipbar'),null);
});

test('choices and extra markets preserve the same shirt elements, headers, input and surrounding detail',()=>{
 const round=make();round.matches.forEach(m=>{m.home='Inter';m.away='Juventus';});const options={round,picks:{},stake:10,credits:500,esc:String,fmt:String,date:()=> 'domani'};
 const {document}=parseHTML('<html><body><main>'+renderSlipV2(options)+'</main><section id="detail"><details open><summary>Formazione</summary></details></section></body></html>');
 const root=document.querySelector('main'),shirts=[...root.querySelectorAll('.club-kit svg')],headers=[...root.querySelectorAll('.v2-match-head')],input=root.querySelector('#stake'),detail=document.querySelector('#detail');assert.equal(shirts.length,6);
 for(const picks of [{m1:'1'},{m1:'X'},{m1:'1X',m2:'2'}]){assert.equal(patchSlipV2(root,{...options,picks,openMatch:'m1'}),true);assert.deepEqual([...root.querySelectorAll('.club-kit svg')],shirts);assert.deepEqual([...root.querySelectorAll('.v2-match-head')],headers);assert.equal(root.querySelector('#stake'),input);assert.equal(document.querySelector('#detail'),detail);assert.ok(detail.querySelector('details[open]'));}
 assert.equal(root.querySelector('[data-pick="m1"][data-value="1X"]').getAttribute('aria-pressed'),'true');
 patchSlipV2(root,{...options,picks:{m1:'2'},openMatch:null});assert.equal(root.querySelector('.v2-odds-extra'),null);assert.deepEqual([...root.querySelectorAll('.club-kit svg')],shirts);
 assert.equal(patchSlipV2(root,{...options,round:{...round,id:'different-round'}}),false);assert.deepEqual([...root.querySelectorAll('.club-kit svg')],shirts);
});

test('Fanta picking, expanding markets and changing stake do not redraw the app or recreate team images',()=>{
 const {document}=parseHTML('<html><body><main></main></body></html>'),root=document.querySelector('main'),services=demoSlipServices(),context={leagueId:'lega-quasi',competitionId:'demo-main'},storage={getItem:()=>null,setItem(){},removeItem(){}};let draws=0;
 const slips=createFantaSlips({services,storage,teamResolver:name=>({name,branding:{type:'image',imageUrl:'/fanta-api/team/logo/image?id='+encodeURIComponent(name)}}),redraw:()=>{draws++;root.innerHTML=slips.render(context);slips.bind(root,context);}});
 root.innerHTML=slips.render(context);slips.bind(root,context);const images=[...root.querySelectorAll('.v2-match-head img')],input=root.querySelector('#stake');assert.ok(images.length>0);
 const first=root.querySelector('[data-pick]');first.onclick();root.querySelector('[data-v2-more]').onclick();const amount=root.querySelector('#stake');amount.value='13.5';amount.oninput();
 assert.equal(draws,0);assert.deepEqual([...root.querySelectorAll('.v2-match-head img')],images);assert.equal(root.querySelector('#stake'),input);assert.match(root.querySelector('[data-v2-stake-current]').textContent,/13,5/);assert.equal(services.snapshot().leagues[0].members[0].fantasyWallets['lega-quasi'].credits,500);
});
