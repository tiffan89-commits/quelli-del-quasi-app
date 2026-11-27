import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {routeForTab} from '../public/src/v2/tabs.mjs';
import {currentSlipRound} from '../public/src/slip-state.mjs';
import {findBarSlip} from '../public/src/fanta/bar-slip.mjs';
import {renderHome,homeTeam} from '../public/src/fanta/home.mjs';
import {playableFantaSlip} from '../public/src/fanta/schedine.mjs';
import {renderLega} from '../public/src/fanta/lega.mjs';
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
 const home={...h,bar,me:{teamId:'a',teamName:'Casa',position:1,points:12,fantapoints:200,form:[]},lineup:{},standings:[],round:{number:8,state:'in-corso'},match:{home:{id:'a',name:'Casa'},away:{id:'b',name:'Ospiti'},live:{home:{points:70},away:{points:60}}}};
 const {document}=parseHTML(renderHome(home)),cta=document.querySelector('.bar-home-cta');assert.equal(cta.dataset.round,'8');assert.match(cta.textContent,/Giornata 8 live.*70.*fp parziali/);
 const ordered=renderHome({...home,lastResult:{round:7,matchupId:'last',home:{id:'a',name:'Casa',goals:2},away:{id:'b',name:'Ospiti',goals:1}}});
 assert.match(ordered,/class="bar-home-last" data-go="giornata" data-round="7" data-mu="last"/);
 const own={id:'a',name:'La mia squadra',branding:{type:'design',design:{text:'MIA',shape:'shield'}}},away={...home,match:{...home.match,home:{id:'other',name:'Altri'},away:own}};
 assert.equal(homeTeam(away),own);assert.equal(homeTeam({...away,match:null,standings:[{team:own}]}),own);
 const crest=parseHTML(renderHome(away)).document.querySelector('.home-team-crest');assert.match(crest.textContent,/MIA/);assert.equal(crest.dataset.action,'edit-logo');assert.match(crest.getAttribute('aria-label'),/La mia squadra/);
});
test('social Fanta home shows personal match stories, form, credits and a single play action',()=>{
 const me={id:'me',name:'Squadra mia'},rival={id:'them',name:'Squadra rivale'};
 const starters=Array.from({length:11},(_,i)=>({id:'p'+i,name:'Titolare '+i,vote:i<6?5+i/2:null,fantavote:i<6?4+i:null,events:{goals:i===4?1:0}}));
 const now=Date.parse('2026-11-19T08:00Z');
 const home={league:{id:'fanta',season:'2026/27'},me:{teamId:'me',teamName:me.name,position:3,points:9,fantapoints:260,form:['P','N','V']},round:{number:5,state:'da-schierare',deadline:'2026-11-19T16:00Z'},match:{home:me,away:rival},lineup:{},
  lastResult:{round:4,matchupId:'old',home:{...rival,goals:1},away:{...me,goals:2,points:75},outcome:'V'},
  standings:[{team:rival,position:5,form:['V','N','P']}],balances:{slip:480,auction:47},storyData:{lastMatch:{away:{team:me,starters}},tradeCount:1}};
 const view=state=>parseHTML(renderHome(state,now)).document;
 const doc=view(home),result=doc.querySelector('#fanta-story-results + template');
 assert.match(result.innerHTML,/Marcatori.*Titolare 4/s);
 const votes=[...result.content.querySelectorAll('.home-story-votes li')];
 assert.deepEqual(votes.map(li=>li.querySelector('span').textContent),starters.map(p=>p.name));
 assert.equal(votes[0].querySelector('b').textContent,'5,0');
 assert.equal(votes[10].querySelector('b').textContent,'s.v.');
 assert.ok(doc.querySelector('#fanta-story-top'));assert.ok(doc.querySelector('#fanta-story-opponent'));assert.ok(doc.querySelector('#fanta-story-market'));
 assert.equal(doc.querySelectorAll('.primary').length,1);assert.match(doc.querySelector('.bar-home-cta').textContent,/Schiera la formazione · Giornata 5/);
 assert.match(doc.querySelector('.bar-home-last-top').textContent,/2–1/);
 assert.equal(doc.querySelectorAll('.bar-home-segments i').length,5);assert.equal(doc.querySelectorAll('.bar-home-segments .is-pending').length,2);
 assert.match(doc.querySelector('.home-last-footer').textContent,/480 cr schedina · 47 cr asta/);
 const saved=view({...home,lineup:{savedAt:'2026-11-19T08:00Z'},storyData:{}});
 assert.match(saved.querySelector('.bar-home-cta').textContent,/Modifica formazione · Giornata 5/);
 assert.equal(saved.querySelector('#fanta-story-market,#fanta-story-top'),null);
});
test('Fanta home links the open lineup and slip beside an older live round, using the saved state and exact destination',()=>{
 const now=Date.parse('2026-11-19T08:00Z'),deadline='2026-11-20T16:00Z';
 const ticket={...round,id:'open-slip',number:9,closed:false,kickoff:deadline,matches:[{...match,status:'NS',liveScore:null,kickoff:deadline}]};
 const data={league:{},uid:'me',eligible:[ticket]};
 const home={league:{id:'native'},me:{teamId:'me',teamName:'Casa'},round:{number:8,state:'in-corso'},
  nextLineup:{round:9,deadline,open:true},playableSlip:playableFantaSlip(data,true,now)};
 const view=h=>parseHTML(renderHome(h,now)).document;
 const doc=view(home);
 assert.match(doc.querySelector('.bar-home-cta').textContent,/Giornata 8 live/);
 const lineup=doc.querySelector('[data-go="formazione"]'),slip=doc.querySelector('[data-go="schedine"]');
 assert.match(lineup.textContent,/Schiera la formazione/);assert.equal(lineup.dataset.round,'9');
 assert.match(slip.textContent,/Inserisci schedina del Fanta/);assert.equal(slip.dataset.round,'open-slip');
 const saved=view({...home,nextLineup:{...home.nextLineup,savedAt:deadline},playableSlip:{...ticket,slip:{savedAt:deadline}}});
 assert.match(saved.querySelector('[data-go="formazione"]').textContent,/Modifica formazione/);
 assert.match(saved.querySelector('[data-go="schedine"]').textContent,/Modifica schedina del Fanta/);
 assert.equal(view({...home,nextLineup:{...home.nextLineup,open:false}}).querySelector('[data-go="formazione"]'),null);
 assert.equal(playableFantaSlip(data,false,now),null);
 assert.equal(playableFantaSlip({...data,eligible:[{...ticket,waitingForOpen:true}]},true,now),null);
 assert.equal(playableFantaSlip(data,true,Date.parse(deadline)),null);
});
test('Fanta calendar renders in ascending order and opens the current round in the vertical track',()=>{
 const round=(number,state)=>({number,state,matchups:[]});
 const rounds=[round(3,'da-schierare'),round(4,'futura'),round(2,'calcolata'),round(1,'calcolata')];
 const model={league:{id:'fanta',name:'Lega'},calendar:{current:3,last:4,rounds}};
 const view=(ui={})=>parseHTML(renderLega(model,{sub:'calendario',...ui})).document;
 const doc=view();
 assert.ok(doc.querySelector('.fanta-calendar-scroll[data-os-content][data-os-flow]'));
 assert.deepEqual([...doc.querySelectorAll('[data-lega-round]')].map(b=>b.dataset.legaRound),['1','2','3','4']);
 assert.equal(doc.querySelector('.fanta-cal-round.is-current.is-open button').dataset.legaRound,'3');
 assert.equal(doc.querySelector('[data-lega-round="2"]').getAttribute('aria-expanded'),'false');
 assert.equal(view({openRound:2}).querySelector('[aria-expanded="true"]').dataset.legaRound,'2');
 assert.equal(view({openRound:-1}).querySelector('[aria-expanded="true"]'),null);
});
test('live fantasy score and player votes patch in place, preserving formations and expanded sections',()=>{
 const html=fantasyMatchView(match,round,esc,(h,a)=>h+' – '+a,String);
 assert.match(html,/1 – 0/);assert.match(html,/Fantapunti live/);
 const {document}=parseHTML('<html><body><dialog>'+html+'</dialog></body></html>'),root=document.querySelector('dialog');
 const section=root.querySelector('.lineup-section'),pitch=root.querySelector('.pitch-slides');assert.equal(root.querySelector('.lineup-votes'),null);
 const updated=structuredClone(match);updated.liveScore=[2,0];updated.fantasyPoints=[74,60];updated.details.teams[0].players[0]={id:'p',grade:7,fantagrade:10,events:[{label:'Gol'},{label:'Gol'}]};
 patchFantasyMatch(root,updated);
 assert.equal(root.querySelector('.lineup-section'),section);assert.equal(root.querySelector('.pitch-slides'),pitch);assert.equal(root.querySelector('.lineup-votes'),null);
 assert.equal(root.querySelector('[data-live-detail-score]').textContent,'2 – 0');assert.match(root.querySelector('[data-fantasy-points]').textContent,/74 – 60/);
 assert.equal(root.querySelector('[data-fantasy-grade="pitch"]').textContent,'10');assert.equal(root.querySelectorAll('.is-goals').length,2);
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
import {crossingsFor} from '../public/src/bar-home-stories.mjs';

test('Bar crossings calculate points separately from net credits, including committed stakes',()=>{
 const round={id:'r1',kickoff:'2026-11-21T17:00Z'};
 const league={members:[
  {uid:'u',name:'Io',points:10,credits:495,committedCredits:25},
  {uid:'p',name:'Punti',points:12,credits:470},
  {uid:'c',name:'Crediti',points:8,credits:490,committedCredits:20},
 ],community:{seriea:{history:[{id:round.id,players:[
  {uid:'u',points:4,prize:35,stake:15},{uid:'p',points:9,prize:0,stake:10},{uid:'c',points:3,prize:5,stake:10},
 ]}]}}};
 const history={pointsTotal:10,capital:520};
 assert.deepEqual(crossingsFor(league,'u',round,history),{ahead:[],behind:['Punti']});
 assert.deepEqual(crossingsFor(league,'u',round,history,'credits'),{ahead:['Crediti'],behind:[]});
});
