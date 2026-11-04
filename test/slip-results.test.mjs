import test from'node:test';import assert from'node:assert/strict';import{parseHTML}from'linkedom';
import{inlineResultView,patchSlipResults,increasedScore}from'../public/src/slip-results.mjs';
import{createApi}from'../netlify/functions/api.mjs';import{emptyState}from'../lib/db.mjs';import{session,newLeague}from'../lib/game.mjs';
test('kickoff, goals, colour changes and final result patch only the fixture nodes',()=>{
 const {document}=parseHTML('<main id="app"><article data-match-card="m" data-result-score="null"><span data-match-status></span><span data-inline-result></span><div data-market-track><button data-pick="m" data-value="1" class="selected">1</button><button data-pick="m" data-value="X">X</button></div><div data-pick-feedback></div></article><input id="stake" value="12"></main><dialog open><details open>Formation</details></dialog>');
 const root=document.querySelector('main'),row=root.querySelector('article'),market=root.querySelector('[data-market-track]'),dialog=document.querySelector('dialog'),formation=dialog.firstElementChild,button=root.querySelector('button');market.scrollLeft=77;const html=dialog.innerHTML;
 const m={id:'m',status:'NS',score:null},r={matches:[m]};patchSlipResults(root,r,{m:'1'},true);assert.equal(root.querySelector('[data-inline-result]').textContent,'');
 m.status='LIVE';m.liveScore=[0,0];patchSlipResults(root,r,{m:'1'},true);assert.match(row.textContent,/LIVE/);assert.match(row.textContent,/0 – 0/);assert.ok(button.classList.contains('pick-losing'));assert.equal(row.classList.contains('goal-flash'),false);
 m.liveScore=[1,0];patchSlipResults(root,r,{m:'1'},true);assert.ok(row.classList.contains('goal-flash'));assert.ok(button.classList.contains('pick-winning'));assert.match(row.textContent,/1 – 0/);
 row.classList.remove('goal-flash');patchSlipResults(root,r,{m:'1'},true);assert.equal(row.classList.contains('goal-flash'),false);
 m.status='FT';m.score=[1,0];patchSlipResults(root,r,{m:'1'},true);assert.doesNotMatch(root.querySelector('[data-inline-result]').textContent,/LIVE/);assert.equal(root.querySelector('button'),button);assert.equal(market.scrollLeft,77);assert.equal(document.querySelector('#stake').value,'12');assert.equal(dialog.innerHTML,html);assert.equal(dialog.firstElementChild,formation);
 assert.equal(increasedScore([2,0],[1,0]),false);assert.equal(inlineResultView({status:'NS'}),'');
});
test('results route is league-scoped, read-only, and excludes formations, odds and credentials',async()=>{
 const s=emptyState(),u={id:'u',username:'u',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Mine'),token=session(s,u.id);s.rounds.push({id:'r',league:l.id,matches:[{id:'m',status:'LIVE',liveScore:[1,0],details:{secret:'heavy'},lineups:{players:[]},odds:{'1':2}}]});
 let reads=0;const api=createApi({read:async(fn,opt)=>{reads++;assert.equal(opt.kind,'results');return fn(s);},transact:async()=>{throw Error('write forbidden');}}),call=(league=l.id,round='r')=>api(new Request('https://test.local/api/results?'+new URLSearchParams({league,round}),{headers:{cookie:'sid='+token}}));
 const response=await call();assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.matches[0].liveScore,[1,0]);assert.equal(data.matches[0].details,undefined);assert.equal(data.matches[0].lineups,undefined);assert.equal(data.matches[0].odds,undefined);assert.equal((await call('foreign')).status,403);assert.equal((await call(l.id,'foreign')).status,404);assert.equal(reads,3);
});
