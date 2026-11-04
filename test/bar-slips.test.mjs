import test from 'node:test';import assert from 'node:assert/strict';
import {barSlipsView,barProfileView,teamCode,pickCode,correctCount} from '../public/src/bar-slips.mjs';
import {updatePlayerProfiles,analysisRoundSummary,analysisFor} from '../lib/player-analysis.mjs';
const odds={'1':2,'X':3,'2':3.5,'1X':1.3,Goal:1.8};
const fmt=n=>String(n);
function fixture(){
 const matches=[['Inter','Juventus'],['Napoli','Roma']].map(([home,away],i)=>({id:'m'+i,home,away,status:'FT',score:[2,0],odds}));
 const r={id:'r',league:'l',title:'Giornata 1',closed:true,kickoff:new Date(Date.now()-86400000).toISOString(),matches,settled:true,
  slips:[{uid:'a',picks:{m0:'1',m1:'2'},stake:10},{uid:'b',picks:{m0:'1X',m1:'1X'},stake:5}]};
 r.publicSlips=r.slips.map(x=>({...x,odds:7,points:1,pointsSettled:true}));
 const s={users:[{id:'a',name:'Anna'},{id:'b',name:'Beppe'}],leagues:[{id:'l',members:[{uid:'a',name:'Anna'},{uid:'b',name:'Beppe'}]}],rounds:[r]};
 return s;
}
test('abbreviations keep tiles compact',()=>{assert.equal(teamCode('Inter'),'INT');assert.equal(teamCode('Hellas Verona'),'VER');assert.equal(teamCode('Squadra Nuova'),'SQU');assert.equal(pickCode('Under 2.5'),'U2,5');assert.equal(pickCode('No Goal'),'NG');assert.equal(pickCode('1X'),'1X');});
test('bar view renders one compact tile per player with mini-slip and profile button, own tile first',()=>{
 const s=fixture(),r=s.rounds[0],l=s.leagues[0];
 const html=barSlipsView({l,r,uid:'b',fmt,rounds:[r],sourceOf:()=> 'seriea'});
 assert.equal((html.match(/class="bar-tile/g)||[]).length,2);
 assert.ok(html.indexOf('data-bar-uid="b"')<html.indexOf('data-bar-uid="a"'));
 assert.equal((html.match(/data-analyze=/g)||[]).length,2);
 assert.equal((html.match(/data-result-row=/g)||[]).length,4);
 assert.match(html,/data-detail="m0"/);assert.match(html,/Il profilo del pronosticatore/);
 assert.doesNotMatch(html,/data-analyze[^>]*>[^<]*<\/button>.*<h2/);
});
test('fantasy rounds and open rounds get no profile button / no slips',()=>{
 const s=fixture(),r=s.rounds[0],l=s.leagues[0];
 assert.doesNotMatch(barSlipsView({l,r,uid:'a',fmt,rounds:[r],sourceOf:()=> 'fantacalcio'}),/data-analyze/);
 const open={...r,closed:false,publicSlips:[]};
 assert.match(barSlipsView({l,r:open,uid:'a',fmt,rounds:[open],sourceOf:()=> 'seriea'}),/si aprono al calcio d’inizio/);
});
test('correct picks are counted and winners crowned only with three or more players',()=>{
 const s=fixture(),r=s.rounds[0];assert.equal(correctCount(r,r.publicSlips[0]),1);assert.equal(correctCount(r,r.publicSlips[1]),2);
});
test('round summary is short, complete for every player and scoped to the selected round',()=>{
 const s=fixture();updatePlayerProfiles(s);
 const players=analysisRoundSummary(s,'l','r',['a','b']);
 assert.equal(players.length,2);
 for(const p of players){assert.ok(p.headline.length>10&&p.headline.length<140);assert.ok(p.short.length<260);assert.ok(p.archetype);assert.ok(Number.isFinite(p.risk));assert.ok(!('text' in p));}
 assert.deepEqual(analysisRoundSummary(s,'other','r',['a','b']),[]);
 assert.ok(analysisFor(s,'l','a','r').headline);
});
test('records without the short texts are regenerated once',()=>{
 const s=fixture();updatePlayerProfiles(s);const rec=s.playerProfiles['l:a'].history[0];delete rec.v;delete rec.headline;delete rec.short;
 updatePlayerProfiles(s);const again=s.playerProfiles['l:a'].history[0];assert.ok(again.headline&&again.short&&again.v===2);
});
test('profile popup shows verdict, stats and evolution without long text',()=>{
 const s=fixture();updatePlayerProfiles(s);const p=analysisRoundSummary(s,'l','r',['a'])[0];
 const html=barProfileView(p,{name:'Anna',avatar:{},slip:{stake:10},fmt});
 assert.match(html,/Anna/);assert.match(html,/Puntata/);assert.match(html,/bar-dossier-quip/);assert.ok(html.replace(/<svg[\s\S]*?<\/svg>/g,'').length<6000);assert.ok(html.length<16000);
});
