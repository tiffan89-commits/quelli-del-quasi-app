import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {routeForTab} from '../public/src/v2/tabs.mjs';
import {currentSlipRound} from '../public/src/slip-state.mjs';
import {findBarSlip} from '../public/src/fanta/bar-slip.mjs';
import {renderHome,homeTeam} from '../public/src/fanta/home.mjs';
import {fantasyMatchView} from '../public/src/bar-fanta-match.mjs';
import {patchFantasyMatch} from '../public/src/fantasy-live-detail.mjs';
import {liveSnapshot} from '../lib/live-snapshot.mjs';
import {LIVE_SNAPSHOT_SQL} from '../lib/live-snapshot.mjs';
import {fixtureDb} from './fanta/helpers.mjs';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const nativeFanta={leagueId:'native',competitionId:'native:main'};
const match={id:'m',home:'Casa',away:'Ospiti',status:'LIVE',liveScore:[1,0],fantasyPoints:[70,60],odds:{1:2,X:3,2:4},details:{at:'r1',teams:[{name:'Casa',formation:'4-4-2',players:[{id:'p',name:'Punta',starter:true,grade:6,fantagrade:6,events:[]}]},{name:'Ospiti',players:[]}]}};
const round={id:'r',source:'fantacalcio',number:8,nativeFanta,kickoff:'2026-11-01T12:00Z',competitionKey:'native-key',matches:[match]};
test('Bar navigation remains Serie A while Fanta slips retain their current round',()=>{
 const plain={id:'plain',rounds:[]},linked={id:'bar',rounds:[round]};
 assert.deepEqual(routeForTab('schedina',plain,[plain,linked]),{page:'schedina',sourceScope:'seriea'});
 assert.deepEqual(routeForTab('classifica',linked,[plain,linked]),{page:'classifiche',sourceScope:'seriea'});
 const old={...round,id:'old',number:1,archived:true},future={...round,id:'future',number:9,kickoff:'2026-11-08T12:00Z'};
 assert.equal(currentSlipRound([old,future,round],Date.parse('2026-11-02')).id,'r');
 assert.equal(currentSlipRound([old,future,{...round,settled:true}],Date.parse('2026-11-02')).id,'future');
});
test('home banner resolves own league, competition, round and matchup without fetching',()=>{
 const h={league:{id:'native'},competition:{id:'native:main'},round:{number:8},match:{home:{name:'Casa'},away:{name:'Ospiti'}}};
 assert.equal(findBarSlip(h,[]),null);
 assert.equal(findBarSlip({...h,competition:{id:'other'}},[{id:'bar',rounds:[round]}]),null);
 assert.equal(findBarSlip(h,[{id:'bar',rounds:[round]}]).saved,false);
 const bar=findBarSlip(h,[{id:'bar',rounds:[{...round,slip:{savedAt:'2026-10-31T12:00Z'}}]}]);assert.equal(bar.saved,true);assert.equal(bar.league,'bar');assert.equal(bar.round,'r');assert.equal(bar.match,'m');assert.equal(bar.closed,true);
 const home={...h,bar,me:{teamId:'a',teamName:'Casa',position:1,points:12,fantapoints:200,form:[]},lineup:{},standings:[],round:{number:8,state:'in-corso'},match:{...h.match,live:{home:{points:70},away:{points:60}}}};
 const html=renderHome(home);assert.match(html,/Segui la schedina/);assert.match(html,/data-bar-league="bar".*data-bar-round="r"/);assert.doesNotMatch(renderHome({...home,bar:{...bar,saved:false}}),/Segui la schedina/);
 assert.match(renderHome({...home,bar:{...bar,closed:false}}),/Segui la schedina/);
 const ordered=renderHome({...home,nextLineup:{round:9,formation:'4-3-3',savedAt:'2026-11-02T12:00Z'},lastResult:{round:7,matchupId:'last',home:{name:'Casa',goals:2},away:{name:'Ospiti',goals:1}}});
 assert.match(ordered,/fanta-match-link[\s\S]+data-round="7" data-mu="last"[\s\S]+4-3-3 salvata/);
 const {document}=parseHTML(html),tile=document.querySelector('.fanta-match-link');assert.equal(tile.dataset.round,'8');assert.ok(tile.textContent.includes('La tua sfida'));assert.equal(tile.querySelector('[data-mode="bar"]'),null);assert.ok(document.querySelector('.fanta-bar-link'));
 const own={id:'a',name:'La mia squadra',branding:{type:'design',design:{text:'MIA',shape:'shield'}}},away={...home,match:{...home.match,home:{id:'other',name:'Altri'},away:own}};
 assert.equal(homeTeam(away),own);assert.equal(homeTeam({...away,match:null,standings:[{team:own}]}),own);
 const crest=parseHTML(renderHome(away)).document.querySelector('.fanta-hero-crest');assert.match(crest.textContent,/MIA/);assert.equal(crest.dataset.action,'edit-logo');assert.match(crest.getAttribute('aria-label'),/La mia squadra/);
});
test('live fantasy score and player votes patch in place, preserving formations and expanded sections',()=>{
 const html=fantasyMatchView(match,round,esc,(h,a)=>h+' – '+a,String);
 assert.match(html,/1 – 0/);assert.match(html,/Fantapunti live/);
 const {document}=parseHTML('<html><body><dialog>'+html+'</dialog></body></html>'),root=document.querySelector('dialog');
 root.querySelector('.live-score').setAttribute('data-live-detail-score','');
 const section=root.querySelector('.lineup-section'),pitch=root.querySelector('.pitch-slides'),accordion=root.querySelector('.lineup-votes');accordion.open=true;
 const updated=structuredClone(match);updated.liveScore=[2,0];updated.fantasyPoints=[74,60];updated.details.teams[0].players[0]={id:'p',grade:7,fantagrade:10,events:[{label:'Gol'},{label:'Gol'}]};
 patchFantasyMatch(root,updated);
 assert.equal(root.querySelector('.lineup-section'),section);assert.equal(root.querySelector('.pitch-slides'),pitch);assert.equal(accordion.open,true);
 assert.equal(root.querySelector('.live-score').textContent,'2 – 0');assert.match(root.querySelector('[data-fantasy-points]').textContent,/74 – 60/);
 assert.equal(root.querySelector('[data-fantasy-grade="pitch"]').textContent,'10');assert.equal(root.querySelector('[data-fantasy-events]').textContent,'Gol ×2');
});
test('DB-only minute snapshot carries fantasy points and revisions without downloading all formations',async()=>{
 const f=await fixtureDb();try{
  const state={users:[{id:'u1',emailVerified:true}],leagues:[{id:'bar',members:[{uid:'u1',credits:500,points:0}],rules:{}}],rounds:[{...round,league:'bar',rules:{},slips:[]}],ledger:[],football:{calendar:{rounds:[]}}};
  await f.db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[JSON.stringify(state)]);
  const saved=(await f.db.query(LIVE_SNAPSHOT_SQL,['bar'])).rows[0].payload;
  const view=liveSnapshot(saved,state.users[0],'bar'),m=view.rounds[0].matches[0];
  assert.deepEqual(m.liveScore,[1,0]);assert.deepEqual(m.fantasyPoints,[70,60]);assert.equal(m.detailRevision,'r1');
  assert.equal(m.details,undefined);assert.equal(m.lineups,undefined);assert.equal(JSON.stringify(view).includes('Punta'),false);
 }finally{await f.close();}
});
