import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {renderLineup,bindLineupPitch,availablePlayerRole} from '../public/src/lineup-pitch.mjs';
const lineup={kind:'probable',teams:['Juventus','Inter'].map((team,j)=>({team,players:[{name:'Titolare',role:'P'}],bench:['P','D','C','A'].map((role,i)=>({playerId:'af:'+(100*j+i+1),name:team+' '+role,role,probability:25+i*5}))}))};
test('available-player filters show only the selected role, keep each team independent, resize and clean up without reloads',()=>{
 const {document,window}=parseHTML('<main>'+renderLineup({lineups:lineup})+'</main>'),root=document.querySelector('main'),teams=[...root.querySelectorAll('.pitch-team')],panels=[...root.querySelectorAll('.lineup-bench')];
 teams.forEach(team=>team.getBoundingClientRect=()=>({height:100+50*[...team.querySelectorAll('[data-available-role]')].filter(p=>!p.hidden).length}));bindLineupPitch(root);
 const click=(panel,role)=>panel.querySelector('[data-lineup-role="'+role+'"]').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(panels[0].querySelectorAll('[data-lineup-role]').length,5);assert.equal(root.querySelector('.pitch-slides').style.height,'300px');
 click(panels[0],'D');assert.deepEqual([...panels[0].querySelectorAll('[data-available-role]')].filter(p=>!p.hidden).map(p=>p.dataset.availableRole),['D']);assert.equal(panels[0].querySelector('[data-lineup-role="D"]').getAttribute('aria-pressed'),'true');assert.equal(root.querySelector('.pitch-slides').style.height,'150px');
 assert.equal([...panels[1].querySelectorAll('[data-available-role]')].filter(p=>!p.hidden).length,4);assert.equal(panels[0].querySelector('[data-lineup-role-empty]').hidden,true);
 click(panels[0],'all');assert.equal([...panels[0].querySelectorAll('[data-available-role]')].filter(p=>!p.hidden).length,4);
 root._pitchCleanup();click(panels[0],'P');assert.equal([...panels[0].querySelectorAll('[data-available-role]')].filter(p=>!p.hidden).length,4);
});
test('API position aliases map to fantasy roles; unknown roles and empty selections remain explicit; official and fantasy bench order is unchanged',()=>{
 for(const [position,role]of [['G','P'],['Goalkeeper','P'],['D','D'],['Defender','D'],['M','C'],['Midfielder','C'],['F','A'],['Attacker','A'],['','other']])assert.equal(availablePlayerRole({position}),role);
 const onlyDefender={...lineup,teams:[{...lineup.teams[0],bench:[{name:'Difensore',role:'D',probability:40},{name:'Senza ruolo',probability:null}]}]},html=renderLineup({lineups:onlyDefender});
 const {document,window}=parseHTML('<main>'+html+'</main>'),root=document.querySelector('main');bindLineupPitch(root);assert.ok(root.querySelector('[data-lineup-role="other"]'));root.querySelector('[data-lineup-role="P"]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(root.querySelector('[data-lineup-role-empty]').hidden,false);assert.equal([...root.querySelectorAll('[data-available-role]')].filter(p=>!p.hidden).length,0);root._pitchCleanup();
 for(const kind of ['official','fantasy']){const html=renderLineup({lineups:{...lineup,kind}});assert.doesNotMatch(html,/data-lineup-role=/);assert.ok(html.indexOf('Juventus P')<html.indexOf('Juventus D'));}
});
