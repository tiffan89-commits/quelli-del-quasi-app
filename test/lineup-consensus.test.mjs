import test from 'node:test';import assert from 'node:assert/strict';
import {consensusLineups,publicLineups} from '../lib/lineup-consensus.mjs';
import {additionalForecasts,forecastMatches,parseSos,parseGazzetta,parseCorriere} from '../lib/forecast-sources.mjs';
import {probableLineupsDue,loadProbableLineups} from '../lib/lineups.mjs';
import {formationRows,renderLineup,bindLineupPitch} from '../public/src/lineup-pitch.mjs';
const now=new Date('2026-10-31T08:00:00Z');
const names=Array.from({length:11},(_,i)=>'Player'+i);
function source(i){return {kind:'probable',source:'Private source '+i,sourceUrl:'https://private.test',teams:['Milan','Inter'].map((team,j)=>({team,side:j?'away':'home',formation:'4-3-3',players:names.map(name=>({name})),bench:[{name:'Alternative'}],ballots:[{players:[{name:'Player10'},{name:'Alternative'}]}]}))};}
test('five sources vote once per player, give starters and bench percentages and generate coherent duels',()=>{
 const input=Array.from({length:5},(_,i)=>source(i));for(let i=3;i<5;i++){input[i].teams[0].players[10]={name:'Alternative'};input[i].teams[0].bench=[{name:'Player10'}];}
 const c=consensusLineups([...input,input[0]]),t=c.teams[0];assert.equal(c.sourceCount,5);assert.equal(t.players.length,11);assert.equal(t.players.find(p=>p.name==='Player10').probability,60);assert.equal(t.bench.find(p=>p.name==='Alternative').probability,40);assert.deepEqual(t.ballots[0].players.map(p=>p.probability),[60,40]);assert.equal(t.players[0].probability,100);
 const dto=publicLineups(c),html=renderLineup({lineups:dto});assert.ok(!JSON.stringify(dto).includes('Private source'));assert.ok(!JSON.stringify(dto).includes('private.test'));assert.match(html,/Stima basata su 5 fonti/);assert.doesNotMatch(html,/duel-donut|Ballottaggi/);assert.match(html,/Altri giocatori a disposizione/);assert.equal(formationRows(t).flat().length,11);
});
test('officials replace forecasts immediately; incomplete and duplicate sources never pad the count',async()=>{
 const a=source(1),b=source(2);b.teams[0].players.pop();assert.equal(consensusLineups([a,b,a]).sourceCount,1);const official={...a,kind:'official'};assert.equal(consensusLineups([a,official]),official);
 const m={id:'m',home:'Milan',away:'Inter',status:'NS',kickoff:'2026-10-31T19:45:00Z',lineups:official};assert.equal(probableLineupsDue(m,now),false);let calls=0;await loadProbableLineups({},m,async()=>calls++,now);assert.equal(calls,0);
});
test('probable checks run every hour through match day, with no freeze while waiting for officials',()=>{
 const m={status:'NS',kickoff:'2026-10-31T19:45:00Z',lineupCheckedAt:'2026-10-31T17:30:00Z'};assert.equal(probableLineupsDue(m,new Date('2026-10-31T18:29:59Z')),false);assert.equal(probableLineupsDue(m,new Date('2026-10-31T18:30:00Z')),true);m.status='FT';assert.equal(probableLineupsDue(m,new Date('2026-10-31T18:30:00Z')),false);
});
test('source coverage validates fixture, season and day instead of attaching another round',()=>{
 const m={id:'m',home:'Milan',away:'Inter',kickoff:'2026-10-31T19:45:00Z'},calendar={season:2026,rounds:[{number:10,matches:[m]}]},x={...source(1),round:10,season:'2026',day:'31/10'};
 assert.equal(forecastMatches(x,m,calendar),true);assert.equal(forecastMatches({...x,round:9},m,calendar),false);assert.equal(forecastMatches({...x,season:'2025'},m,calendar),false);assert.equal(forecastMatches({...x,day:'01/11'},m,calendar),false);
});
test('failed additional sources are cached per hourly pass, never counted as available and retried next pass',async()=>{
 const m={id:'m',home:'Milan',away:'Inter',kickoff:'2026-10-31T19:45:00Z'},s={football:{calendar:{season:2026,rounds:[{number:10,matches:[m]}]}}};let calls=0;const fetcher=async()=>{calls++;return {ok:false,status:503};};
 assert.deepEqual(await additionalForecasts(s,m,fetcher,now),[]);await additionalForecasts(s,m,fetcher,new Date(+now+3599000));assert.equal(calls,3);await additionalForecasts(s,m,fetcher,new Date(+now+3600000));assert.equal(calls,6);
});
test('all three new HTML adapters parse eleven starters per side and reject truncated cards',()=>{
 const sos=`<article data-match-id="m"><header><h2>Milan</h2><span>4-3-3</span><h2>Inter</h2><span>3-5-2</span><time datetime="2026-10-31T19:45:00Z"></time></header><section><h3>Titolari</h3>${['a','b'].map(side=>'<ul>'+names.map(n=>`<li><div><span>95%</span><span>${side+n}</span></div></li>`).join('')+'</ul>').join('')}</section></article>`;
 const gazzetta=`<h2>Campionato 2026/27</h2><h3>10° Giornata</h3><div class="bck-box-match-details"><a class="details-team__name">Milan</a><a class="details-team__name">Inter</a><div class="has-text-centered">Sabato 31/10</div>${['home','away'].map(side=>`<div class="lineup-team is--${side}">${names.map(n=>`<li class="lineup-team__player"><span class="lineup-team__name">${side+n}</span><span class="lineup-team__number">1</span></li>`).join('')}</div>`).join('')}</div>`;
 const corriere=`<h1>10° giornata</h1><div class="ProbabiliFormazioni_wrapper__hash"><time>sabato 31.10.2026 ore 20:45</time><div class="ProbabiliFormazioni_teamName__hash">Milan</div><div>4-3-3</div><div class="ProbabiliFormazioni_teamName__hash">Inter</div><div>3-5-2</div>${['home','away'].map(side=>names.map(n=>`<span class="ProbabiliFormazioni_${side}Player__hash">${side+n}</span><span>1</span>`).join('')).join('')}</div>`;
 assert.equal(parseGazzetta(gazzetta.replace('31/10','1/11'))[0].day,'01/11');
 for(const [html,parse]of [[sos,parseSos],[gazzetta,parseGazzetta],[corriere,parseCorriere]]){assert.equal(parse(html)[0].teams[1].players.length,11);assert.equal(parse(html.replace('awayPlayer10','').replace('bPlayer10','')).length,0);}
});
test('collapsing removes empty space and switching teams resizes only after horizontal scroll settles',async()=>{
 let heights=[900,1400];const listeners={},tabs=[0,1].map(i=>({dataset:{pitchTab:String(i)},setAttribute(){}})),teams=[0,1].map(i=>({getBoundingClientRect:()=>({height:heights[i]})}));
 const slides={style:{},clientWidth:390,scrollLeft:0,closest:()=>null,scrollTo({left}){this.scrollLeft=left;}},root={querySelector:()=>slides,querySelectorAll:s=>s==='[data-pitch-tab]'?tabs:s==='.pitch-team'?teams:[],addEventListener:(n,fn)=>listeners[n]=fn,removeEventListener:(n,fn)=>{if(listeners[n]===fn)delete listeners[n];}};
 bindLineupPitch(root);assert.equal(slides.style.height,'900px');heights[0]=500;listeners.toggle();assert.equal(slides.style.height,'500px');tabs[1].onclick();assert.equal(slides.style.height,'500px');slides.scrollLeft=130;slides.onscroll();assert.equal(slides.style.height,'500px');slides.scrollLeft=390;slides.onscroll();await new Promise(r=>setTimeout(r,180));assert.equal(slides.style.height,'1400px');heights[1]=600;listeners.toggle();assert.equal(slides.style.height,'600px');root._pitchCleanup();assert.equal(listeners.toggle,undefined);
});
test('surname initials and compound surnames do not create fake ballots between the same player',()=>{
 const input=Array.from({length:5},(_,i)=>source(i));input.forEach((s,i)=>s.teams[0].players[0]={name:i%2?'De Winter K.':'De Winter'});const c=consensusLineups(input);assert.equal(c.teams[0].players[0].probability,100);assert.ok(!c.teams[0].bench.some(p=>p.name.includes('Winter')));
 const html=renderLineup({lineups:publicLineups(c)});assert.ok(!html.includes('portrait-fallback'));assert.ok(!html.includes('<img')); // Missing portraits expose only the existing card background.
});
