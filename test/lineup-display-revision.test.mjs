import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {playerSurname,playerJersey,opponentLabel} from '../public/src/player-label.mjs';
import {officialLineups} from '../lib/official-lineups.mjs';import {enrichPresence} from '../lib/lineup-presence.mjs';
import {presenceProbability} from '../public/src/fanta/presence-probability.mjs';import {probabilityFor} from '../fanta/play-probabilities.mjs';
import {footballStatistics,bindFootballStatistics} from '../public/src/football-statistics.mjs';
import {renderSlipV2} from '../public/src/v2/slip-v2.mjs';import {renderTabBar} from '../public/src/v2/tabs.mjs';import {renderLeagueChip} from '../public/src/v2/league-switcher.mjs';
import {renderFantasyLineup,renderLineup} from '../public/src/lineup-pitch.mjs';
import {PGlite} from '@electric-sql/pglite';import {patchSports} from '../lib/operations/sports-db.mjs';
const esc=x=>String(x??'').replaceAll('<','&lt;'),fmt=String;
const raw={teams:{home:{id:1,name:'Milan'},away:{id:2,name:'Inter'}},lineups:[1,2].map(id=>({team:{id},formation:'4-4-2',startXI:Array.from({length:11},(_,i)=>({player:{id:id*100+i,name:'Firstname Surname'+i,number:i+1,pos:i===0?'G':i<5?'D':i<9?'M':'F'}})),substitutes:[{player:{id:id*100+99,name:'Backup Keeper',number:99,pos:'G'}}]}))};

test('jerseys show surnames only, preserve compound family names and recover numbers from cached season data',()=>{
 for(const [name,family] of [['Albert Guðmundsson','Guðmundsson'],['C. De Ketelaere','De Ketelaere'],['Davis K.','Davis'],['Juan Jesus','Juan Jesus'],['Lorenzo De Silvestri','De Silvestri']])assert.equal(playerSurname(name),family);
 assert.equal(playerSurname({name:'Jacobo Ramón Naveros',surname:'Ramón'}),'Ramón');assert.equal(playerJersey({jersey:'',seasonStats:{games:{number:32}}}),32);
 assert.equal(opponentLabel({opponent:'AC Milan',home:false}),'@ MIL');assert.equal(opponentLabel({opponent:'Juventus',home:true}),'JUV');
 const html=renderFantasyLineup({teams:[{name:'Fantasy Club',formation:'4-4-2',players:[{name:'Albert Guðmundsson',club:'Inter',starter:true,jersey:11,role:'A',next:{opponent:'Juventus',home:false}}]}]});
 assert.match(html,/>GUÐMUNDSSON<\/text>/);assert.doesNotMatch(html,/>ALBERT GUÐM/);assert.match(html,/@JUV/);assert.match(html,/>11<\/text>/);
});

test('a complete official XI supersedes probable percentages, gives 100/0 and rejects incomplete payloads',()=>{
 const l=officialLineups(raw,'2026-11-03');assert.equal(l.kind,'official');assert.equal(l.teams[0].players[0].jersey,1);assert.equal(l.teams[0].players[0].probability,100);assert.equal(l.teams[1].bench[0].probability,0);
 const incomplete=structuredClone(raw);incomplete.lineups[1].startXI.pop();assert.equal(officialLineups(incomplete),null);
 const p={id:'af:100',name:'Name',club:'Milan',status:{type:'injured'},stats:{minutes:90,teamMatches:10}};
 const play=probabilityFor(p,[{number:11,players:[{id:'af:100',pct:100,kind:'official'}]}],11);assert.equal(play.source,'official');assert.deepEqual(presenceProbability({...p,play}),{pct:100,source:'official'});
 assert.equal(probabilityFor(p,[{number:10,players:[{id:'af:100',pct:100,kind:'official'}]}],11),null);
});

test('forecast and available players use the same estimates as the editor; unavailable starters are replaced by role',()=>{
 const catalog=[{id:'af:1',apiId:1,name:'Mario Rossi',team:'Milan',club:'Milan',role:'D',number:4,stats:{minutes:450,teamMatches:10},status:{type:'ok'}},{id:'af:2',apiId:2,name:'Marco Bianchi',team:'Milan',club:'Milan',role:'D',number:5,stats:{minutes:270,teamMatches:10},status:{type:'ok'}}];
 const l={kind:'probable',teams:[{team:'Milan',players:[{name:'Rossi',probability:100}],bench:[{name:'Bianchi',probability:0}],ballots:[{players:[{name:'Rossi'},{name:'Bianchi'}]}]}]};
 let result=enrichPresence(l,catalog);assert.equal(result.teams[0].players[0].probability,presenceProbability(catalog[0]).pct);assert.equal(result.teams[0].players[0].jersey,4);assert.deepEqual(result.teams[0].ballots,[]);assert.equal(result.teams[0].bench[0].probability,30);
 catalog[0].status={type:'suspended'};result=enrichPresence(l,catalog);assert.equal(result.teams[0].players[0].playerId,'af:2');assert.equal(result.teams[0].bench.length,0);assert.equal(result.teams[0].players[0].probabilityKind,'minutes-estimate');
});

test('match statistics initially show four rows; player statistics show five per selected team with a working selector',()=>{
 const statistics=['home','away'].map(side=>({side,statistics:Array.from({length:9},(_,i)=>({type:'Type'+i,value:i}))})),playerStats=['home','away'].flatMap(side=>Array.from({length:8},(_,i)=>({side,name:side+' '+i,minutes:90-i})));
 const {document,window}=parseHTML(footballStatistics({home:'Milan',away:'Inter',details:{statistics,playerStats}}));
 const outer=document.querySelector('.match-statistics');assert.equal(outer.querySelector(':scope>.match-stats-scroll tbody').children.length,4);assert.equal(outer.querySelector('.statistics-more tbody').children.length,5);
 const section=document.querySelector('.player-statistics'),home=section.querySelector('[data-stats-panel=home]'),away=section.querySelector('[data-stats-panel=away]');assert.equal(home.querySelector(':scope>.match-stats-scroll tbody').children.length,5);assert.equal(home.querySelector('.statistics-more tbody').children.length,3);assert.equal(away.hidden,true);
 bindFootballStatistics(document);section.querySelector('[data-stats-team=away]').dispatchEvent(new window.Event('click'));assert.equal(home.hidden,true);assert.equal(away.hidden,false);
});
test('available-player panel includes the club roster once, sorted by independent estimate, excludes unavailable and inactive players; official bench is preserved',()=>{
 const catalog=[['1','Titolare',90],['2','Alternativa',21],['3','Rientrante',53],['4','Indisponibile',50],['5','Inattivo',40],['6','Nessun minuto',0]].map(([id,name,pct])=>({id:'af:'+id,apiId:Number(id),club:'Juventus',name,role:'D',stats:{minutes:pct*9,teamMatches:10},status:{type:id==='4'?'injured':'ok'},active:id!=='5'}));
 const lineup={kind:'probable',teams:[{team:'Juventus',players:[{name:'Titolare',playerId:'af:1'}],bench:[{name:'Alternativa',playerId:'af:2'}],ballots:[{players:[{name:'Titolare'},{name:'Alternativa'}]}]}]};
 const result=enrichPresence(lineup,catalog),team=result.teams[0];assert.deepEqual(team.bench.map(p=>p.playerId),['af:3','af:2','af:6']);assert.deepEqual(team.bench.map(p=>p.probability),[55,25,0]);assert.deepEqual(team.ballots,[]);
 const {document}=parseHTML(renderLineup({lineups:result})),panel=document.querySelector('.lineup-bench');assert.equal(panel.hasAttribute('open'),false);assert.match(panel.textContent,/Altri giocatori a disposizione/);assert.doesNotMatch(document.toString(),/Ballottaggi|duel-donut|Indisponibile|Inattivo/);
 assert.equal(document.querySelectorAll('.bench-stickers .player-probability.estimated').length,3);
 const official=enrichPresence({...lineup,kind:'official'},catalog);assert.equal(official.teams[0].players[0].probability,100);assert.deepEqual(official.teams[0].bench.map(p=>p.playerId),['af:2']);assert.equal(official.teams[0].bench[0].probability,0);
});

test('Bar slip uses supplied crests and puts the shared settings control in the mother header',()=>{
 const round={number:11,kickoff:'2099-01-01',matches:[{id:'m',home:'Milan',away:'Inter',odds:{1:2,X:3,2:4}}],rules:{maxStake:20}};
 const html=renderSlipV2({round,esc,fmt,date:String});assert.match(html,/stemma-milan.svg/);assert.match(html,/stemma-inter.svg/);assert.doesNotMatch(renderTabBar('profilo'),/data-v2-tab="profilo"/);
 assert.match(renderLeagueChip({name:'Bar',members:[]},'u',esc,fmt,'',null,'crediti Bar',true),/data-bar-page="admin"[^>]+aria-label="Apri impostazioni"/);
});

test('shared sports persistence copies official lineups to Bar rounds while leaving existing slips intact',async()=>{
 const db=new PGlite();await db.exec('CREATE TABLE fanta_state(id int PRIMARY KEY,payload jsonb)');
 const m={id:'m',home:'Milan',away:'Inter'},slips=[{uid:'u',picks:{m:'1'},stake:10}],s={football:{calendar:{season:2026,rounds:[{number:10,matches:[m]}]},rounds:{}},rounds:[{id:'bar-r',league:'none',matches:[{...m}],slips}],leagues:[],ledger:[]};
 try{await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(s)]);const lineups=officialLineups(raw,'2026-11-03');await patchSports(['m'],state=>state.football.calendar.rounds[0].matches[0].lineups=lineups,{connect:async()=>({query:(...a)=>db.query(...a),release(){}})});
 const after=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(after.rounds[0].matches[0].lineups.kind,'official');assert.deepEqual(after.rounds[0].slips,slips);
 }finally{await db.close();}
});
