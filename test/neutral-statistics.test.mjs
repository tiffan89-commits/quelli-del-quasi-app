import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {compareStat} from '../public/src/fanta/stat-comparison.mjs';
import {evaluateIndividual} from '../fanta/statistical-votes/individual.mjs';
import {calculateVote} from '../fanta/votes.mjs';
import {voteConfig,configDigest} from '../fanta/statistical-votes/config.mjs';
import {renderPlayerSheet} from '../public/src/fanta/giornata.mjs';
const player=metrics=>({id:'af:test',name:'Quasi Mediano',role:'C',club:'Quasi FC',minutes:90,onField:true,final:true,metrics,events:{},fixture:{kickoff:'2026-11-01T15:00:00Z',leagueId:135,duration:90},presence:{starter:true},context:{}});
test('a small shortfall or surplus is neutral; materially different values retain their direction',()=>{
 assert.equal(compareStat(86.49,84.31,{rate:true,scale:10,policy:{scaleFraction:.25,volumeFraction:.1,rateFloor:2}}).comparison,'near');
 assert.equal(compareStat(1,1.21,{scale:1.5}).comparison,'near');
 assert.equal(compareStat(0,1.21,{scale:1.5}).comparison,'below');
 assert.equal(compareStat(2,1.21,{scale:1.5}).comparison,'above');
 assert.equal(compareStat(null,1).comparison,'unknown');
});
test('all role metrics near the reference produce exactly six before other match or event factors',()=>{
 const metrics={passesTotal:51,passAccuracy:82,keyPasses:1.25,foulsDrawn:1.15,tackles:1.4,interceptions:.9,duelsTotal:10,duelsWon:5.1,dribblesAttempts:1.9,dribbles:1.045,shotsTotal:1.7,shotsOn:.595};
 const input=player(metrics),v=evaluateIndividual(input);
 assert.equal(v.value,6);assert.equal(v.delta,0);
 for(const f of Object.values(v.features)){assert.equal(f.comparison,'near',f.key);assert.equal(f.score,0,f.key);}
 const vote=calculateVote(input);assert.equal(vote.vote,6);assert.ok(vote.stats.every(s=>s.comparison==='near'&&s.score===0));
 const {document}=parseHTML(renderPlayerSheet(vote));assert.equal(document.querySelectorAll('.fanta-stat.is-neutral').length,vote.stats.length);assert.equal(document.querySelectorAll('.fanta-stat.is-down').length,0);
});
test('negligible contributions remain zero outside the neutral band, with existing short-minute shrinkage',()=>{
 const at=value=>evaluateIndividual(player({passesTotal:value})).features.passesTotal;
 const boundary=at(50).expected-at(50).neutralBand;assert.equal(at(boundary).score,0);assert.equal(at(boundary-.001).score,0);
 assert.ok(at(30).score<at(45).score);
 const rate=pct=>evaluateIndividual(player({passesTotal:50,passAccuracy:pct})).features.passAccuracy;
 assert.equal(rate(80.5).score,0);assert.equal(rate(85.5).score,0);
 assert.ok(Math.abs(rate(80.499).score)<.0001);
 const short=evaluateIndividual({...player({passesTotal:52/9}),minutes:10}).features.passesTotal;assert.equal(short.score,0);
});
test('neutral comparison remains in the serialized vote and legacy details use the same band',()=>{
 const p=calculateVote(player({passesTotal:50,passAccuracy:82}));
 for(const s of p.stats){delete s.comparison;delete s.neutralBand;}
 const {document}=parseHTML(renderPlayerSheet(p));assert.equal(document.querySelectorAll('.fanta-stat.is-neutral').length,2);
 assert.notEqual(configDigest(voteConfig()),configDigest(voteConfig({neutralStats:{scaleFraction:0,volumeFraction:0,rateFloor:0}})));
 assert.throws(()=>voteConfig({neutralStats:{rateFloor:-.1}}),/Fascia neutra/);
});
