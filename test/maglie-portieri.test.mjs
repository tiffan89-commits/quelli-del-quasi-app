import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {shirtBack,goalkeeperShirt,GOALKEEPER_KITS} from '../public/src/fanta/maglie-portieri.mjs';
import {renderLineup,renderFantasyLineup,shirtSurname} from '../public/src/lineup-pitch.mjs';
import {playerVisual} from '../public/src/fanta/player-visual.mjs';
import {LEAGUE_COLORS,leagueAccent,linkedLeagueIdentity,leagueEmblem} from '../public/src/league-theme.mjs';
import {updateLeagueProfile} from '../lib/community.mjs';

test('supplied jerseys retain their design, readable names, number, goalkeeper kit and safe text',async()=>{
 assert.equal(await fs.readFile(new URL('../public/src/fanta/maglie-portieri.mjs',import.meta.url),'utf8'),await fs.readFile(new URL('../docs/maglie-figurine/maglie-portieri.mjs',import.meta.url),'utf8'));
 const back=shirtBack('Udinese',32,'Ekkelenkamp',{nameSize:5});
 assert.match(back,/>EKKELENKAMP</);assert.match(back,/>32</);assert.match(back,/textLength="24"/);assert.match(back,/fill-opacity=".8"/);
 assert.doesNotMatch(shirtBack('Venezia',9,'Adams'),/fill-opacity=".8"/);
 const goalie=shirtBack('Udinese',40,'Okoye',{goalkeeper:true});assert.ok(goalie.includes(GOALKEEPER_KITS.Udinese.a));assert.match(goalie,/L2.5 28/);
 assert.match(goalkeeperShirt('Udinese'),/fanta-shirt-gk/);assert.match(shirtBack('Sconosciuto','','Rossi'),/#5d6b62/);
 const escaped=shirtBack('Udinese','<',"D'Angelo <");assert.doesNotMatch(escaped,/D'ANGELO </);assert.match(escaped,/D&#39;ANGELO &lt;/);assert.match(escaped,/numero &lt;/);
 assert.equal(shirtSurname('Davis K.'),'Davis');assert.equal(shirtSurname('Rossi É.'),'Rossi');assert.equal(shirtSurname('Juan Jesus'),'Juan Jesus');
});

test('real and fantasy lineups show one drawn jersey per player, no portrait requests, separate probability and accessible name',()=>{
 const players=Array.from({length:11},(_,i)=>({id:String(i),name:i===0?'Okoye M.':'Davis K.',jersey:i+1,photo:'/api/player-photo?id='+i,probability:80,probabilityKind:'consensus'}));
 const {document}=parseHTML(renderLineup({lineups:{kind:'probable',teams:[{team:'Udinese',formation:'3-5-2',players}]}}));
 assert.equal(document.querySelectorAll('.pitch-player svg').length,11);assert.equal(document.querySelectorAll('img,[data-deferred-src],.player-number').length,0);
 assert.equal(document.querySelectorAll('.row-5 .pitch-player').length,5);assert.equal(document.querySelector('.player-sticker .player-probability'),null);assert.equal(document.querySelectorAll('.player-probability.estimated').length,11);
 assert.equal(document.querySelectorAll('.pitch-player-name.sr-only').length,11);assert.match(document.querySelector('[data-fantasy-player="0"]').innerHTML,new RegExp(GOALKEEPER_KITS.Udinese.a));
 assert.doesNotMatch(document.toString(),/player-photo|Davis K\.<\/text>/);
 const fantasy=renderFantasyLineup({teams:[{name:'Fantasy United',formation:'3-5-2',players:players.map((p,i)=>({...p,starter:true,club:'Udinese',role:i===0?'P':'C'}))}]});
 assert.doesNotMatch(fantasy,/<img|player-photo/);assert.match(fantasy,/#ffffff/);assert.match(fantasy,/Udinese/);
 assert.doesNotMatch(playerVisual({club:'Inter',role:'A',photoUrl:'/api/player-photo?id=1'}),/<img|player-photo/);
 assert.match(playerVisual({club:'Inter',role:'P'}),/fanta-shirt-gk/);
});

test('new crests are local vector assets; missing clubs never reference the old official images',async()=>{
 const source=await fs.readFile(new URL('../public/team-logos.js',import.meta.url),'utf8');const logos=vm.runInNewContext(source+';TEAM_LOGOS');
 assert.equal(Object.keys(logos).length,23);for(const value of new Set(Object.values(logos))){assert.match(value,/^\/assets\/club-crests\/stemma-/);const svg=await fs.readFile(new URL('../public'+value,import.meta.url),'utf8');assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|<foreignObject|(?:href|src)=["']https?:/);}
});

test('league identity preserves its saved palette across products, accepts Blu server-side and escapes emblems',()=>{
 const bar={id:'bar',nativeFantaLink:{leagueId:'fanta'},branding:{emblem:'Q&B',accent:'#7bc8f7',motto:'Buona quasi'}},fanta={id:'fanta',accent:'#d6f77b'};
 assert.equal(linkedLeagueIdentity(null,[{id:'unlinked'}]),null);
 assert.ok(LEAGUE_COLORS.some(([value,name])=>value==='#7bc8f7'&&name==='Blu'));
 updateLeagueProfile(bar,{accent:'#c8b6ff',emblem:'Q&B',motto:'Salvato'});assert.equal(leagueAccent(linkedLeagueIdentity(fanta,[bar])),'#c8b6ff');assert.equal(fanta.accent,'#d6f77b');
 assert.match(leagueEmblem(bar),/Q&amp;B/);assert.match(leagueEmblem({...bar,branding:{emblem:'<img>'}}),/&lt;img&gt;/);
});
