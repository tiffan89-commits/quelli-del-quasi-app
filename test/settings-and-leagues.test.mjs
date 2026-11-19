import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderLeagueChip,renderLeagueSheet} from '../public/src/v2/league-switcher.mjs';
import {topBar} from '../public/src/fanta/shell.mjs';
import {modeSwitch} from '../public/src/mode-switch.mjs';
import {renderFantaPresident} from '../public/src/fanta/lega.mjs';
import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';
import {rewardsView} from '../public/src/progression-ui.mjs';
import {stateFor,newLeague} from '../lib/game.mjs';
import {barHomeInvite} from '../public/src/bar-home-invite.mjs';

test('both modes show only the named league selector and mode control in the header',()=>{
 const league={id:'l',name:'Bar di prova',members:[{uid:'member',points:5,credits:500}],nativeFantaLink:{leagueId:'linked'}};
 for(const html of [renderLeagueChip(league,'member',String,String,modeSwitch('bar')),topBar({mode:'fanta',league})]){
  const {document}=parseHTML(html),button=document.querySelector('.v2-league-chip');
  assert.equal(button.getAttribute('aria-label'),'Cambia lega, Bar di prova');
  assert.equal(button.querySelector('small').textContent,'Lega');
  assert.equal(document.querySelectorAll('.fanta-mode-btn').length,2);
  assert.equal(document.querySelector('.settings-entry,.league-add,.v2-credits'),null);
 }
 const html=renderLeagueSheet([league],'l','member',String,{fantas:[{id:'linked',position:4,lineupPending:true}]});
 const {document}=parseHTML(html);
 assert.equal(document.querySelector('dialog h2').textContent,'Le tue leghe');
 assert.equal(document.querySelector('[aria-current=true] small').textContent,'Bar 1° · Fanta 4°');
 assert.equal(document.querySelector('[data-league-pending]').hidden,false);
 assert.deepEqual([...document.querySelectorAll('[data-league-entry]')].map(b=>b.dataset.leagueEntry),['create-league','join-code']);
 assert.equal(document.querySelector('form'),null);
});

test('a Fanta member who opens the president route returns to the league without management controls',async()=>{
 const data=await createDemoFantaApi({delay:0}).league('lega-quasi');data.isAdmin=false;data.league.role='member';
 const html=renderFantaPresident(data,{invite:{code:'TEST',name:'Bar test'}}),{document}=parseHTML(html);
 assert.ok(document.querySelector('.lega-hub'));assert.match(html,/Apri impostazioni/);
 assert.doesNotMatch(html,/Pannello del presidente|data-league-size-form|data-competition-create-form|data-team-link-form|data-president-section/);
});

test('invitation code is readable by current members only; state rendering changes no game data',()=>{
 const state={users:[],sessions:[],leagues:[],rounds:[],ledger:[],football:{fixtures:{},rounds:{}}},admin={id:'a',name:'A',emailVerified:true},member={id:'m',name:'M',emailVerified:true},outsider={id:'o',emailVerified:true};state.users.push(admin,member,outsider);const league=newLeague(state,admin,'Bar test');league.members.push({uid:'m',credits:42,points:3});league.removedMembers=[{uid:'o'}];const before=JSON.stringify(state);const dto=stateFor(state,member);assert.equal(dto.leagues[0].code,league.code);assert.equal(dto.leagues[0].removedMembers,undefined);assert.equal(stateFor(state,outsider).leagues.length,0);assert.equal(JSON.stringify(state),before);
});

test('Quasi rewards open as a paginated collection without the catalogue or guide',()=>{const {document}=parseHTML(rewardsView({rewards:[{ids:['king-title','king-crown','king-title']}]}));const section=document.getElementById('rewards-collection');assert.equal(section.hasAttribute('open'),false);assert.ok(section.hasAttribute('data-os-paged-detail'));assert.equal(section.querySelector('.pill').textContent,'2');assert.equal(section.querySelectorAll('details').length,0);});

test('Bar home invite is shared by president and members, excludes computers and hides when full',()=>{
 const league={code:'TEST',name:'Bar test',admin:'a',members:[{uid:'a'},{uid:'b'}],nativeFantaLink:{maxMembers:4,coachIds:['a']}};
 for(const id of ['a','b']){const html=barHomeInvite(league,{id},String);assert.match(html,/2\/4 iscritti/);assert.match(html,/wa.me/);assert.match(html,/Invita con WhatsApp/);assert.doesNotMatch(html,/<button|data-share-league/);}
 assert.equal(barHomeInvite(league,{id:'outsider'},String),'');
 league.nativeFantaLink.coachIds=['a','c','d'];assert.equal(barHomeInvite(league,{id:'a'},String),'');
 league.nativeFantaLink.maxMembers=2;assert.equal(barHomeInvite(league,{id:'a'},String),'');
});
