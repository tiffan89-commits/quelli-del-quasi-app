import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {parseHTML} from 'linkedom';
import {roundAvailability,currentSlipRound,selectableSlipRounds,slipSummary} from '../public/src/slip-state.mjs';
import {saveOnce,savePending} from '../public/src/save-guard.mjs';
import {appRoute,readAppRoute} from '../public/src/routes.mjs';
import {draftFrom,bestLineup,lineupOf,byExpected,assign} from '../public/src/fanta/squadra.mjs';
import {studioTap,playBadge} from '../public/src/fanta/formazione-studio.mjs';
import {effectiveVoteCount,withHomeVotes} from '../public/src/fanta/home-votes.mjs';
import {renderHome} from '../public/src/fanta/home.mjs';import {homeFor} from '../public/src/fanta/dati-finti.mjs';
import {createFantaApi} from '../public/src/fanta/api.mjs';import {demoSlipServices} from '../public/src/fanta/demo-slips.mjs';
import {createFantaSlips} from '../public/src/fanta/schedine.mjs';import handler from './fixtures/preview-api.mjs';
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const time=Date.parse('2026-11-03T14:00Z'),round=(n,extra={})=>({id:'r'+n,number:n,kickoff:new Date(time+n*864e5).toISOString(),matches:[{id:'m',odds:{1:2,X:3,2:4}}],...extra});

test('A1 three distinct states, numeric order and first open round; unpriced future never closes falsely',()=>{
 const rounds=[round(13,{closed:true,matches:[{id:'m'}]}),round(11),round(12)];assert.equal(currentSlipRound(rounds,time).number,11);assert.deepEqual(selectableSlipRounds(rounds,time).map(r=>r.number),[11]);assert.equal(roundAvailability(rounds[0],time),'non ancora aperta');assert.equal(roundAvailability(round(10,{kickoff:new Date(time-1).toISOString()}),time),'chiusa');assert.equal(roundAvailability(round(14,{closed:true}),time),'chiusa');assert.equal(slipSummary(rounds[0],{m:'1'},10,500,time).canSave,false);
});
test('A1 keeps the current matchday while its games are still in progress',()=>{
 const today=round(11,{kickoff:new Date(time-3600000).toISOString(),matches:[{id:'m',kickoff:new Date(time-3600000).toISOString(),status:'LIVE'}]});assert.equal(currentSlipRound([round(12),today],time).id,today.id);
});
test('save guard coalesces concurrent clicks, releases errors and isolates different forms',async()=>{
 const d=defer();let calls=0;const a=saveOnce('a',()=>{calls++;return d.promise;}),b=saveOnce('a',()=>{calls++;});assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);assert.equal(savePending('a'),true);await saveOnce('b',()=>42);d.resolve(1);await a;await Promise.resolve();await Promise.resolve();assert.equal(savePending('a'),false);await assert.rejects(saveOnce('failure',()=>Promise.reject(Error('offline'))));await Promise.resolve();await Promise.resolve();assert.equal(await saveOnce('failure',()=>2),2);
});
test('real Fanta API shares concurrent lineup writes, invalidates cached reads, never downloads the full bootstrap',async()=>{
 const original=globalThis.fetch,gate=defer();const calls=[];globalThis.fetch=async(url,init)=>{calls.push([url,init?.method||'GET']);if(init?.method==='POST')await gate.promise;return Response.json(url.includes('/me')?{access:'full'}:url.endsWith('/leagues')?[{id:'one'}]:{ok:true});};try{const a=createFantaApi();await Promise.all([a.team('one'),a.team('one')]);assert.equal(calls.length,1);const p=a.saveLineup('one',11,{starters:['a']}),p2=a.saveLineup('one',11,{starters:['b']});await Promise.resolve();assert.equal(calls.filter(c=>c[1]==='POST').length,1);gate.resolve();await Promise.all([p,p2]);await a.team('one');assert.equal(calls.filter(c=>c[0].includes('/team?')).length,2);await a.bootstrap('one');assert.equal(calls.filter(c=>c[0].includes('/bootstrap?lite=1')).length,1);assert.ok(!calls.some(c=>c[0].includes('/bootstrap?')&&!c[0].includes('lite=1')));}finally{globalThis.fetch=original;}
});
test('weighted lineup respects probability, injury and unique roles; old bench caps cannot discard owned players',()=>{
 const roster='PDCA'.split('').flatMap(role=>Array.from({length:9},(_,i)=>({id:role+i,role,name:role+i,club:'Inter',stats:{avgFanta:i===0?10:6},play:{pct:i===0?25:90},status:i===1?{type:'injured'}:{type:'ok'}})));
 const draft=draftFrom(null,roster),best=bestLineup(draft,roster,7),ids=lineupOf(best);assert.equal(ids.starters.length,11);assert.equal(ids.bench.length,roster.length-11);assert.equal(new Set([...ids.starters,...ids.bench]).size,roster.length);assert.ok(!ids.starters.some(id=>id.endsWith('0')||id.endsWith('1')));assert.ok(byExpected({stats:{avgFanta:6}},{stats:{avgFanta:5},play:{pct:100}})>0);
 const first=best.slots.D0,second=best.slots.D1,next=studioTap(best,roster,second,'D0',7);assert.equal(next.slots.D0,second);assert.equal(next.slots.D1,first);assert.equal(studioTap(best,roster,'A8','D0',7),best);assert.match(playBadge({status:{type:'injured'}}),/Infortunato/);
});
test('A2 actual ratings count replacements once; complete Serie A removes LIVE and the direct CTA',()=>{
 const side={starters:[{id:'1',vote:6},{id:'2',vote:null,replacedBy:'Sub'},{id:'3',vote:6.5}],bench:[{id:'4',vote:7,enteredFor:'Two'},{id:'5',vote:8}]};assert.equal(effectiveVoteCount(side),3);
 const h=homeFor('lega-quasi','in-corso');h.round.matchesDone=10;h.match.live.home.played=0;const next=withHomeVotes(h,{home:{...side,team:h.match.home},away:{starters:[],team:h.match.away}});assert.equal(next.match.live.home.withVote,3);const html=renderHome(next);assert.match(html,/>Live</);assert.ok(html.includes('3/11 a voto'));assert.ok(!html.includes('Segui in diretta'));assert.ok(!html.includes('Voti provvisori'));
});
test('hash routes preserve league, screen, subsection and round through encoding',()=>{
 const route={mode:'fanta',page:'classifica',section:'calendario',league:'lega a/1',round:11};assert.deepEqual(readAppRoute(appRoute(route)),{...route,round:'11'});assert.equal(readAppRoute('#registrati'),null);assert.throws(()=>appRoute({mode:'other',page:'x'}));
});
test('A4 demo slips exist in both demo leagues and do not mix their balances',async()=>{
 const s=demoSlipServices();assert.equal(s.snapshot().leagues.length,2);const [a,b]=s.snapshot().leagues;await s.save({league:a.id,round:a.rounds[0].id,picks:Object.fromEntries(a.rounds[0].matches.map(m=>[m.id,'1'])),stake:10});assert.equal(a.members[0].fantasyWallets['lega-quasi'].credits,490);assert.equal(b.members[0].fantasyWallets['fanta-ufficio'].credits,500);
});
test('Fanta slip save remains guarded across DOM redraws and releases the draft on failure',async()=>{
 const {document}=parseHTML('<html><body><div id="root"></div></body></html>'),root=document.getElementById('root'),service=demoSlipServices(),gate=defer();let calls=0;const services={...service,save:async()=>{calls++;return gate.promise;}};const context={leagueId:'lega-quasi',competitionId:'demo-main'},slips=createFantaSlips({services,storage:storage(),redraw});function redraw(){root.innerHTML=slips.render(context);slips.bind(root,context);}redraw();for(const m of service.snapshot().leagues[0].rounds[0].matches){root.querySelector('[data-pick="'+m.id+'"][data-value="1"]').onclick();}
 const save=root.querySelector('#save-slip'),p=save.onclick();const newSave=root.querySelector('#save-slip');assert.equal(newSave.disabled,true);assert.equal(newSave.getAttribute('aria-busy'),'true');await newSave.onclick();assert.equal(calls,1);gate.reject(Error('Connessione assente'));await p;assert.match(root.textContent,/Connessione assente/);assert.equal(root.querySelector('#save-slip').disabled,false);
});
test('preview endpoints use only synthetic roles/data and never send signup mail',async()=>{
 const anonymous=await handler(new Request('https://preview.test/api/state'));assert.equal((await anonymous.json()).user,null);for(const role of ['member','admin']){const response=await handler(new Request('https://preview.test/fanta-api/league?league=lega-quasi',{headers:{cookie:'preview-role='+role}}));assert.equal((await response.json()).isAdmin,role==='admin');}const mail=await handler(new Request('https://preview.test/api/register',{method:'POST',body:'{}'}));assert.match((await mail.json()).message,/simulato/);
});
test('build keeps landing styles bounded with a tiny install card and excludes lazy demo fixtures',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.equal((html.match(/rel="stylesheet"/g)||[]).length,3);assert.match(html,/pwa-install\.css/);assert.ok(fs.statSync(new URL('../public/pwa-install.css',import.meta.url)).size<2500);assert.ok(!html.includes('/__preview/'));const meta=JSON.parse(fs.readFileSync(new URL('../docs/BUILD-METAFILE.json',import.meta.url),'utf8')),seen=new Set();function visit(name){if(seen.has(name))return;seen.add(name);const out=meta.outputs[name];assert.ok(out,name);assert.ok(!Object.keys(out.inputs).some(n=>/dati-finti|demo-api|demo-slips|bar-demo/.test(n)),name);for(const entry of out.imports)if(entry.kind!=='dynamic-import'&&!entry.external)visit(entry.path);}visit('dist/build/app.mjs');assert.ok(Object.keys(meta.outputs).length<30);
});

test('preview team endpoint supplies the own roster when no explicit team parameter is present',async()=>{const result=await handler(new Request('https://preview.test/fanta-api/team?league=lega-quasi',{headers:{cookie:'preview-role=member'}}));assert.equal(result.status,200);const team=await result.json();assert.equal(team.roster.length,25);assert.equal(team.canManageRoster,false);});
import {renderLega,renderFantaPresident} from '../public/src/fanta/lega.mjs';import {createDemoFantaApi} from '../public/src/fanta/demo-api.mjs';import {renderSlipV2} from '../public/src/v2/slip-v2.mjs';
test('competition tools belong to the Fanta league, while auction management stays in the president panel',async()=>{
 const data=await createDemoFantaApi({delay:0}).league('lega-quasi');data.isAdmin=true;data.league.kind='native';
 const panel=renderFantaPresident(data);assert.match(panel,/data-auction-manage/);
 assert.match(panel,/class="secondary president-action"[^>]+data-president-group="persone"/);
 assert.match(panel,/data-president-section="persone"[\s\S]*data-team-roster/);
 assert.doesNotMatch(panel,/data-president-section="competizioni"|data-competition-create-form|data-fanta-slips-form/);
 assert.match(renderLega(data,{group:'lega'}),/data-competition-create-form/);
 data.isAdmin=false;assert.doesNotMatch(renderLega(data,{group:'lega'}),/data-competition-create-form|data-team-link-form/);
});
test('unpriced future slip has disabled choices and no confirmation button',()=>{const r=round(13,{closed:true,kickoff:new Date(Date.now()+864e5).toISOString(),matches:[{id:'m',home:'Casa',away:'Ospiti',odds:{}}]});const html=renderSlipV2({round:r,esc:String,fmt:String,date:String});assert.match(html,/data-pick="m" data-value="1" disabled/);assert.ok(!html.includes('id="save-slip"'));});
import vm from 'node:vm';import {createBarDemo} from '../public/src/bar-demo.mjs';
import {settingsFooter,presidentPanel,presidentTodos,barPresidentTasks} from '../public/src/president-panel.mjs';
import {LEAGUE_COLORS} from '../public/src/league-theme.mjs';
import {isLeagueAdmin} from '../public/src/v2/league-switcher.mjs';
test('the Bar president panel keeps league rules separate from participants and the personal settings',()=>{
 const text=fs.readFileSync(new URL('../public/src/app.mjs',import.meta.url),'utf8'),body=text.slice(text.indexOf('let presidentGroup='),text.indexOf('function calendarStatus('));
 const {state}=createBarDemo({admin:true}),context={state,esc:String,LEAGUE_COLORS,presidentPanel,barPresidentTasks,isLeagueAdmin,brandingForm:()=>'',adminBudget:()=>'',leagueMembers:()=>'<p>Allenatore di prova</p>',whatsappInvite:()=>'',barLeagueInfo:()=>'<p>Lega</p>'};
 vm.createContext(context);vm.runInContext(body+'\nresult=leagueAdmin(state.leagues[0]);',context);
 assert.match(context.result,/Salva regole/);assert.match(context.result,/data-president-section="persone"[\s\S]*Allenatore di prova/);assert.doesNotMatch(context.result,/data-president-section="account"|profile-name/);
 state.user.id='other';vm.runInContext('barLeagueInfo=()=>"<p>Lega</p>";result=leagueAdmin(state.leagues[0]);',context);assert.equal(context.result,'<p>Lega</p>');
});
