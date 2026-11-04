import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePitchLayout,canonicalPitchRows,explicitPitchRows} from '../public/src/pitch-layout.mjs';
import {formationRows} from '../public/src/lineup-pitch.mjs';import {consensusLineups} from '../lib/lineup-consensus.mjs';import {parseEditorialLineups} from '../lib/editorial-lineups.mjs';
const juve={team:'Juventus',formation:'3-4-1-2',pitchOrder:'right-to-left',players:['Vicario','Kalulu','Bremer','Lucumi','McKennie','Koopmeiners','Douglas Luiz','Cabal','Alajbegovic','Woltemade','Kolo Muani'].map(name=>({name,role:name==='Cabal'?'D':'C'}))};
test('right-to-left editorial rows become canonical: McKennie right and Cabal left, for home and away, independent of fantasy role',()=>{
 for(const side of ['home','away']){const t=normalizePitchLayout({...juve,side}),rows=canonicalPitchRows(t);assert.deepEqual(rows[2].map(p=>p.name),['Cabal','Douglas Luiz','Koopmeiners','McKennie']);assert.equal(t.players.find(p=>p.name==='McKennie').grid,'3:4');assert.equal(t.players.find(p=>p.name==='Cabal').grid,'3:1');assert.deepEqual(normalizePitchLayout(t),t);assert.deepEqual(formationRows(t)[2].map(p=>p.name),rows[2].map(p=>p.name));}
 const fanta={...juve,pitchOrder:'left-to-right'};assert.equal(canonicalPitchRows(fanta)[2][0].name,'McKennie','coach-defined fantasy slot order must not be mirrored');
});
test('complete coordinates win over shuffled player arrays and stale formation text; broken grids fall back as a whole',()=>{
 const normalized=normalizePitchLayout(juve),shuffled={...normalized,formation:'4-4-2',players:[...normalized.players].reverse()};assert.deepEqual(canonicalPitchRows(shuffled),canonicalPitchRows(normalized));assert.equal(normalizePitchLayout(shuffled).formation,'3-4-1-2');
 const broken={...juve,players:juve.players.map(p=>({...p,grid:'2:1'}))};assert.equal(explicitPitchRows(broken),null);assert.equal(normalizePitchLayout(broken).players.find(p=>p.name==='McKennie').grid,'3:4');
});
test('consensus uses the chosen source module and its slots, never coordinates pooled from a different source',()=>{
 const team=(formation,ids)=>normalizePitchLayout({team:'Juventus',formation,players:ids.map(id=>({name:'Player '+id,apiId:id}))}),a=team('4-4-2',Array.from({length:11},(_,i)=>i+1)),b=team('3-5-2',[1,2,3,4,5,6,7,8,9,10,12]);
 const src=(name,t)=>({source:name,kind:'probable',teams:[t,{...t,team:'Inter'}]});const c=consensusLineups([src('a',a),src('b',b),src('c',b)]).teams[0];assert.equal(c.formation,'3-5-2');assert.equal(canonicalPitchRows(c)[2].length,5);assert.equal(c.players.find(p=>p.apiId===8).grid,b.players.find(p=>p.apiId===8).grid);assert.equal(new Set(c.players.map(p=>p.grid)).size,11);
});
test('editorial adapter records the list direction and prefers the module actually drawn on the source pitch',()=>{
 const cards=['Juventus','Inter'].map(team=>'<div class="team-card"><h3 class="team-name">'+team+'</h3><span class="team-formation">4-4-2</span>'+Array.from({length:11},(_,i)=>'<div class="player-item"><span class="player-name">Player '+i+'</span></div>').join('')+'</div>').join('');
 const html='<li class="match" data-match-id="x"><a class="match-score" href="/calendario/11/2026-27/x"></a><span class="matchweek">11</span><div class="team-home" data-team-formation="3-5-2"></div><div class="team-away" data-team-formation="4-3-3"></div>'+cards+'</li>';
 const result=parseEditorialLineups(html)[0];assert.equal(result.teams[0].formation,'3-5-2');assert.equal(result.teams[1].formation,'4-3-3');assert.equal(result.teams[0].pitchOrder,'right-to-left');
});
