import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {dashboardModel,countdownLabel,leagueDashboard} from '../public/src/league-dashboard.mjs';
import {playerRanking} from '../public/src/bar-fanta-rankings.mjs';
import {mergeLiveSnapshot} from '../public/src/live-channel.mjs';
import {normalizeAvatar,avatarSvg,DEFAULT_AVATAR} from '../public/src/avatar.mjs';
import {emptyState} from '../lib/db.mjs';
import {session,stateFor} from '../lib/game.mjs';
import {createApi} from '../netlify/functions/api.mjs';
const now=Date.parse('2026-10-30T12:00:00Z');
const round=(id,offset,source='seriea')=>({id,source,title:id,deadline:new Date(now+offset).toISOString(),matches:[{id:'m'}]});
test('dashboard uses shared places and keeps the fantasy wallet aggregated once across competitions',()=>{
 const l={members:[{uid:'a',points:8,credits:480},{uid:'b',points:8,credits:500},{uid:'c',points:5,credits:480}],fantasyRanking:{bookmakerCompetitions:2,members:[{uid:'a',points:12,credits:410},{uid:'b',points:10,credits:490},{uid:'c',points:12,credits:410}]}};
 assert.deepEqual([dashboardModel(l,'a').pointsRank,dashboardModel(l,'a').creditsRank],[1,2]);
 const f=dashboardModel(l,'a','fantacalcio');assert.deepEqual([f.pointsRank,f.creditsRank,f.credits],[1,2,410]);assert.equal(dashboardModel(l,'absent').pointsRank,null);
 l.fantasyRanking.bookmakerCompetitions=0;assert.equal(dashboardModel(l,'a','fantacalcio').creditsRank,null);
});
test('countdown selects the nearest open deadline for the selected source, never a settled or empty round',()=>{
 const l={members:[],rounds:[round('past',-1),{...round('settled',1000),settled:true},{...round('empty',1000),matches:[]},round('later',86400000),round('next',3600000),round('fanta',1000,'fantacalcio')]};
 assert.equal(dashboardModel(l,'a','seriea',now).round.id,'next');assert.equal(dashboardModel(l,'a','fantacalcio',now).round.id,'fanta');assert.equal(countdownLabel(null,now),'In attesa');assert.equal(countdownLabel(l.rounds[4].deadline,now),'1h 00m');assert.equal(countdownLabel(new Date(now).toISOString(),now),'Tempo scaduto');assert.equal(countdownLabel(new Date(now+90000000).toISOString(),now),'1g 1h 0m');
});
test('Bar home shows saved results in the story, ten segments and the play action',()=>{
 const now=Date.parse('2026-11-20T11:00Z');
 const closed={id:'closed',number:11,title:'Giornata 11',kickoff:'2026-11-08T15:00Z',slip:{picks:{0:'1',1:'2'}},
  matches:Array.from({length:10},(_,i)=>({id:String(i),home:'Casa',away:'Ospiti',status:'FT',score:[1,0],void:i===9}))};
 const next={id:'open',number:12,title:'Giornata 12',kickoff:'2026-11-22T15:00Z',matches:[{id:'f',odds:{1:2,X:3,2:4}}]};
 const history=[{id:'closed',played:true,correct:3,total:10,points:5.76,profit:-20,position:3,positionChange:-2,awards:['king-title']}];
 const league={id:'l',name:'Bar',members:[{uid:'u',points:5.76}],rounds:[closed,next],progression:{seriea:{history}}};
 const render=()=>parseHTML(leagueDashboard(league,{id:'u',name:'Quasi'},'seriea',false,String,String,null,now)).document;
 let document=render();
 assert.equal(document.querySelector('[data-dashboard-slip="closed"] b').textContent,'Giornata 11');
 assert.match(document.querySelector('[data-story-card]').innerHTML,/3\/10 prese/);
 assert.equal(document.querySelectorAll('.bar-home-segments i').length,10);
 for(const type of ['yes','no','pending'])assert.ok(document.querySelector('.bar-home-segments .is-'+type));
 assert.ok(document.querySelector('.story-rewards'));
 assert.match(document.querySelector('.bar-home-cta').textContent,/Schedina · Giornata 12/);
 next.slip={picks:{f:'1'}};document=render();assert.match(document.querySelector('.bar-home-cta').textContent,/Rivedi schedina · Giornata 12/);
});

test('a newly settled Bar round shows the same winning postcards to members who did not play',()=>{
 const members=[{uid:'a',name:'Anna',points:5,credits:500},{uid:'b',name:'Bruno',points:5,credits:500},{uid:'c',name:'Carla',points:0,credits:480}];
 const old={id:'old',title:'Giornata 9',number:9,settled:true,kickoff:'2026-10-15T15:00Z',matches:[{id:'old-m',home:'Casa',away:'Ospiti',status:'FT',score:[1,0]}]};
 const current={...old,id:'new',title:'Giornata 10',number:10,settled:false,kickoff:'2026-10-22T15:00Z',matches:[{...old.matches[0],id:'m'}]};
 const league={id:'l',name:'Bar',members,rounds:[old,current],community:{seriea:{recap:{round:'old',winners:['c'],points:3},history:[]}}};
 const render=uid=>parseHTML(leagueDashboard(league,{id:uid,name:uid},'seriea',false,String,String,null,now)).document.querySelector('template[data-story-kind=winner]');
 assert.match(render('a').innerHTML,/Giornata 9/);
 mergeLiveSnapshot({leagues:[league]},{league:'l',rounds:[{id:'new',closed:true,settled:true,matches:[],publicSlips:members.slice(0,2).map(m=>({uid:m.uid,points:5,pointsSettled:true,stake:10,prize:20,picks:{m:'1'}}))}]});
 const story=render('c');
 assert.equal(story.innerHTML,render('a').innerHTML);
 assert.match(story.innerHTML,/Vincitori di giornata/);
 assert.match(story.innerHTML,/1\/1 prese/);
 assert.deepEqual([...story.content.querySelectorAll('.postcard-winner h3')].map(el=>el.textContent),['Anna','Bruno']);
 assert.equal(story.content.querySelector('[data-verdict-player]'),null);
 current.publicSlips[1].points=3;
 assert.match(render('c').innerHTML,/Vincitore di giornata/);
 assert.doesNotMatch(render('c').innerHTML,/Bruno|Carla|Giornata 9/);
});

test('Bar point and credit rankings use static rows and balances while keeping the metric selector',()=>{
 const league={id:'l',name:'Bar',members:[{uid:'a',name:'Anna',points:2,credits:500},{uid:'b',name:'Bruno',points:5,credits:400,committedCredits:20}]};
 const home=parseHTML(leagueDashboard(league,{id:'a',name:'Anna'},'seriea',false,String,String,null,now)).document;
 assert.equal(home.querySelectorAll('.bar-home-balances > span').length,2);
 assert.equal(home.querySelector('.bar-home-balances button'),null);
 for(const metric of ['points','credits']){
  const doc=parseHTML(playerRanking(league,'seriea',metric,{id:'a'},String,String)).document;
  const rows=[...doc.querySelectorAll('.rankrow')];
  assert.deepEqual(rows.map(row=>row.dataset.rankingUser),metric==='points'?['b','a']:['a','b']);
  assert.ok(rows.every(row=>row.localName==='div'&&!row.querySelector('button,a,summary,[tabindex]')));
  assert.equal(doc.querySelector('[data-ranking-metric="'+metric+'"]').getAttribute('aria-pressed'),'true');
 }
});

test('avatar is a small validated configuration: arbitrary markup, URLs and fields cannot enter its SVG',()=>{
 const malicious={skin:'" onload="alert(1)',hair:'<script>',outfit:'https://other.test',adminOnly:true};
 assert.deepEqual(normalizeAvatar(malicious),DEFAULT_AVATAR);const svg=avatarSvg(malicious);assert.doesNotMatch(svg,/onload|<script|other.test|adminOnly/);assert.ok(Buffer.byteLength(svg)<7000);
 for(const path of svg.matchAll(/<path\b[^>]*>/g))assert.ok((path[0].match(/\bstroke=/g)||[]).length<=1,path[0]);
 assert.deepEqual(normalizeAvatar(null),DEFAULT_AVATAR);
});
test('avatar saves only to the authenticated player, survives a new state read and leaves nickname intact',async()=>{
 const s=emptyState(),a={id:'a',username:'one',name:'One',emailVerified:true},b={id:'b',name:'Two'};s.users.push(a,b);const sid=session(s,a.id),api=createApi({transact:async fn=>fn(s,{query:async()=>({rows:[{attempts:1}]})}),env:{}});
 const response=await api(new Request('https://example.test/api/profile-avatar',{method:'POST',headers:{cookie:'sid='+sid,'Content-Type':'application/json'},body:JSON.stringify({avatar:{character:'female',hair:'curly',outfit:'scarf',beard:'none',color:'#bd514b',injected:'x'},uid:'b'})}));
 assert.equal(response.status,200);assert.equal(a.avatar.hair,'curly');assert.equal(a.name,'One');assert.equal(b.avatar,undefined);assert.equal(stateFor(s,a).user.avatar.color,'#bd514b');assert.equal('injected' in a.avatar,false);
 const anonymous=await api(new Request('https://example.test/api/profile-avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"avatar":{}}'}));assert.equal(anonymous.status,401);
});

test('home keeps the active Serie A round until every final score is available',()=>{
 const active={id:'current',title:'Giornata 10',number:10,source:'seriea',kickoff:new Date(now-3600000).toISOString(),matches:[{id:'a',status:'FT',score:[2,0]},{id:'b',status:'LIVE',liveScore:[0,0]}]},future={...round('future',86400000),number:11,kickoff:new Date(now+86400000).toISOString()};const l={members:[],rounds:[active,future]};
 assert.equal(dashboardModel(l,'u','seriea',now).round.id,'current');assert.equal(dashboardModel(l,'u','seriea',now).active,true);assert.equal(dashboardModel(l,'u','seriea',now).deadline,null);
 active.matches[1].status='FT';assert.equal(dashboardModel(l,'u','seriea',now).round.id,'current');active.matches[1].score=[1,1];assert.equal(dashboardModel(l,'u','seriea',now).round.id,'future');assert.equal(dashboardModel(l,'u','seriea',now).active,false);
});
test('an ongoing Serie A day also prevents the fantasy Home from promoting a future slip',()=>{
 const a={...round('seriea-current',-3600000),number:10,kickoff:new Date(now-3600000).toISOString(),matches:[{id:'m',status:'LIVE',liveScore:[0,0]}]},f={...round('fanta-next',86400000,'fantacalcio'),serieARound:11,kickoff:new Date(now+86400000).toISOString()};const l={members:[],rounds:[a,f]};const model=dashboardModel(l,'u','fantacalcio',now);assert.equal(model.active,true);assert.equal(model.round.id,a.id);
});
