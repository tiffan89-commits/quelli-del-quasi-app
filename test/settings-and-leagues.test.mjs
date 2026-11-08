import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderLeagueChip,renderLeagueSheet,bindLeagueSwitcher} from '../public/src/v2/league-switcher.mjs';
import {topBar,leagueSheet} from '../public/src/fanta/shell.mjs';
import {modeSwitch} from '../public/src/mode-switch.mjs';
import {renderFantaPresident} from '../public/src/fanta/lega.mjs';
import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';
import {rewardsView} from '../public/src/progression-ui.mjs';
import {stateFor,newLeague} from '../lib/game.mjs';
import {barHomeInvite} from '../public/src/bar-home-invite.mjs';

test('both products expose one settings gear and a plus inside the league selector, without profile or down arrow',()=>{
 const league={id:'l',name:'Bar di prova',admin:'admin',role:'member',members:[{uid:'member',credits:500}]};
 for(const html of [renderLeagueChip(league,'member',String,String,modeSwitch('bar')),topBar({mode:'fanta',league,credits:100,slipCredits:500})]){
  const {document}=parseHTML(html);assert.equal(document.querySelectorAll('.settings-entry').length,1);assert.equal(document.querySelector('.settings-entry').getAttribute('aria-label'),'Apri impostazioni');assert.ok(document.querySelector('.settings-entry svg'));assert.equal(document.querySelectorAll('.league-add').length,1);assert.equal(document.querySelector('.league-add').textContent,'+');assert.equal(document.querySelector('.league-add').parentElement,document.querySelector('.v2-league-chip'));assert.equal(document.querySelector('.league-add').tagName,'SPAN');assert.equal(document.querySelector('.v2-league-chip button'),null);assert.equal(document.querySelector('.ux-profile'),null);assert.ok(!html.includes('▾'));
 }
 for(const html of [renderLeagueSheet([league],'l','member',String),leagueSheet([league],'l')]){const {document}=parseHTML(html);assert.equal([...document.querySelectorAll('.league-actions button')].map(b=>b.textContent).join('|'),'Entra in una lega|Crea lega · Bar + Fanta');}
});

test('plus opens the existing join/create sheet and switches forms without requesting data',()=>{
 const oldDocument=globalThis.document,oldAdd=globalThis.addEventListener;
 const {document}=parseHTML('<body>'+renderLeagueChip({name:'Bar',members:[]},'member',String,String)+'<div id="v2-sheet-root" hidden></div></body>');
 globalThis.document=document;globalThis.addEventListener=()=>{};
 try{bindLeagueSwitcher({leagues:[],uid:'member',esc:String});document.querySelector('.league-add').closest('button').onclick();assert.equal(document.getElementById('v2-sheet-root').hidden,false);document.querySelector('[data-v2-action="join"]').onclick();assert.equal(document.getElementById('v2-form-join').hidden,false);assert.equal(document.getElementById('v2-form-create').hidden,true);document.querySelector('[data-v2-action="create"]').onclick();assert.equal(document.getElementById('v2-form-join').hidden,true);assert.equal(document.getElementById('v2-form-create').hidden,false);}finally{globalThis.document=oldDocument;globalThis.addEventListener=oldAdd;}
});

test('member settings include invites and the shared account, but no president controls or labels',async()=>{
 const data=await createDemoFantaApi({delay:0}).league('lega-quasi');data.isAdmin=false;data.league.role='member';
 const html=renderFantaPresident(data,{invite:{code:'TEST',name:'Bar test'},accountHtml:'<form id="profile-name"></form>',me:{user:{name:'Membro'},settings:{notify:{results:true}}}}),{document}=parseHTML(html);
 assert.equal(document.querySelector('h1').textContent,'Il tuo banco di comando');assert.equal(document.querySelector('.profile-logout').closest('details'),null);assert.equal(document.querySelectorAll('.profile-logout').length,1);assert.match(html,/Invita nella lega/);assert.ok(document.querySelector('#profile-name'));assert.ok(document.querySelector('[data-notify="results"][checked]'));assert.equal(document.querySelectorAll('details[open]').length,0);assert.doesNotMatch(html,/Pannello del presidente|data-league-size-form|data-competition-create-form|data-fanta-slips-form|data-team-link-form|Modifica identità nel Bar/);
});

test('invitation code is readable by current members only; state rendering changes no game data',()=>{
 const state={users:[],sessions:[],leagues:[],rounds:[],ledger:[],football:{fixtures:{},rounds:{}}},admin={id:'a',name:'A',emailVerified:true},member={id:'m',name:'M',emailVerified:true},outsider={id:'o',emailVerified:true};state.users.push(admin,member,outsider);const league=newLeague(state,admin,'Bar test');league.members.push({uid:'m',credits:42,points:3});league.removedMembers=[{uid:'o'}];const before=JSON.stringify(state);const dto=stateFor(state,member);assert.equal(dto.leagues[0].code,league.code);assert.equal(dto.leagues[0].removedMembers,undefined);assert.equal(stateFor(state,outsider).leagues.length,0);assert.equal(JSON.stringify(state),before);
});

test('Quasi reward collection starts collapsed',()=>{const {document}=parseHTML(rewardsView({rewards:[]},String));assert.equal(document.getElementById('rewards-collection').hasAttribute('open'),false);});

test('Bar home invite is shared by president and members, excludes computers and hides when full',()=>{
 const league={code:'TEST',name:'Bar test',admin:'a',members:[{uid:'a'},{uid:'b'}],nativeFantaLink:{maxMembers:4,coachIds:['a']}};
 for(const id of ['a','b']){const html=barHomeInvite(league,{id},String);assert.match(html,/2\/4 iscritti/);assert.match(html,/wa.me/);assert.match(html,/data-president-group="persone"/);}
 assert.equal(barHomeInvite(league,{id:'outsider'},String),'');
 league.nativeFantaLink.coachIds=['a','c','d'];assert.equal(barHomeInvite(league,{id:'a'},String),'');
 league.nativeFantaLink.maxMembers=2;assert.equal(barHomeInvite(league,{id:'a'},String),'');
});
