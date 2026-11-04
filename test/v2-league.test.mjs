import test from 'node:test';
import assert from 'node:assert/strict';
import {isLeagueAdmin,attentionOf} from '../public/src/v2/league-switcher.mjs';
test('passo 9: ruoli presidente, coadmin e membro',()=>{
 assert.equal(isLeagueAdmin({admin:'a'},'a'),true);
 assert.equal(isLeagueAdmin({admin:'a',admins:['b']},'b'),true);
 assert.equal(isLeagueAdmin({admin:'a',admins:['b']},'c'),false);
});
test('passo 9: avvisi di collegamento, schedina mancante e salvata',()=>{
 const l={admin:'a',fantasyConnections:[{server:true,status:'error'}],rounds:[]};
 assert.equal(attentionOf(l,'a').level,'warn');assert.equal(attentionOf(l,'b').level,'ok');
 l.fantasyConnections=[];l.rounds=[{kickoff:'2099-01-01',source:'seriea',matches:[{id:'m'}]}];
 assert.deepEqual(attentionOf(l,'a'),{level:'todo',text:'Schedina Serie A da compilare'});
 l.rounds[0].slip={picks:{m:'1'}};assert.deepEqual(attentionOf(l,'a'),{level:'ok',text:'Schedina Serie A salvata'});
});
