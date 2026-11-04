import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML}from'linkedom';
import {mountFanta}from'../public/src/fanta/app.mjs';import{createDemoFantaApi}from'../public/src/fanta/demo-api.mjs';
for(const scenario of ['new-member','owns-another-team','timeout-after-commit'])test('team choice '+scenario+': scoped picker, one claim and recovery into the assigned team',async()=>{
 const {window,document}=parseHTML('<html><head></head><body><div id="app"></div><div id="v2-sheet-root" hidden></div></body></html>'),keys=['Event','window','document','location','history','localStorage','scrollTo','requestAnimationFrame','setInterval','clearInterval'],old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.assign(globalThis,{Event:window.Event,window,document,location:{hash:'#/fanta/squadra',pathname:'/',search:''},history:{pushState(){},replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},scrollTo(){},requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){}});let instance,resolveClaim,claims=0,teamReads=0;
 try{
 const demo=createDemoFantaApi({delay:0}),leagues=await demo.leagues(),home=await demo.home(leagues[0].id),id=leagues[0].id,team=home.me.teamId,choices=[{id,name:'Il Bar del nuovo allenatore',teams:[{id:team,name:'Panchina libera',available:true,color:'#608ca8'},{id:'taken',name:'Già allenata',available:false}]}];
 const bootstrap={me:{access:'full',user:{username:'nuovo'}},leagues:scenario==='owns-another-team'?[{...leagues[0],id:'other-league'}]:[],teamChoices:choices,choiceLeagueId:id};
 const api={...demo,claimTeam:(league,t)=>{claims++;assert.equal(league,id);assert.equal(t,team);return new Promise((resolve,reject)=>resolveClaim=scenario==='timeout-after-commit'?()=>reject(Error('Tempo scaduto')):resolve);},bootstrap:async()=>({me:bootstrap.me,leagues,home,teamChoices:[],choiceLeagueId:null}),team:(...a)=>{teamReads++;return demo.team(...a);}};
 instance=mountFanta(document.getElementById('app'),{api,bootstrap,initialTab:'squadra'});await instance.ready;
 assert.match(document.getElementById('app').textContent,/Scegli la tua squadra/);assert.equal(teamReads,0);assert.equal(document.querySelector('[data-team-claim="taken"]').disabled,true);
 const pick=document.querySelector('[data-team-claim="'+team+'"]');pick.dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(claims,1);assert.ok([...document.querySelectorAll('[data-team-claim]')].every(e=>e.disabled));assert.match(document.getElementById('app').textContent,/Assegnazione/);
 document.querySelector('[data-team-claim="'+team+'"]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(claims,1);resolveClaim({league:{id},team:{id:team}});
 for(let i=0;i<30&&!document.querySelector('.fanta-home');i++)await new Promise(r=>setTimeout(r,5));assert.equal(document.querySelector('[data-team-claim]'),null);assert.equal(instance.leagueId,id,document.body.textContent);assert.ok(document.querySelector('.fanta-home'));assert.ok(document.querySelector('.v2-tabbar'));
 }finally{instance?.destroy();for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
