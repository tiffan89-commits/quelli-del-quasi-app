import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {emptyState} from '../lib/db.mjs';
import {newLeague,stateFor} from '../lib/game.mjs';
import {liveSnapshot} from '../lib/live-snapshot.mjs';
import {lineupReminder} from '../fanta/views.mjs';
import {barReminder,fantaReminder,homeReminderBanner,renderPresidentReminders} from '../public/src/president-reminders.mjs';
import {readAppRoute,isSubmissionRoute} from '../public/src/routes.mjs';
import {mergeLiveSnapshot} from '../public/src/live-channel.mjs';
import {presidentWorkspace,presidentOperationButtons,fantaPresidentTool} from '../public/src/president-workspace.mjs';
import {presidentEntry} from '../public/src/president-panel.mjs';

function share(document){
 const url=new URL(document.querySelector('.reminder-share').getAttribute('href'));
 assert.equal(url.origin,'https://wa.me');
 const [text,link]=url.searchParams.get('text').split('\n\n');
 const route=readAppRoute(new URL(link).hash);
 assert.equal(new URL(link).origin,'https://quellidelquasi.com');
 assert.equal(isSubmissionRoute(route),true);
 return {text,route};
}

test('Bar publishes only Campionato submission status to its president and updates it when someone saves',()=>{
 const s=emptyState();
 const [admin,saved,late]=['admin','saved','late'].map(id=>({id,username:id,name:id==='late'?'Mister <Rossi>':id,emailVerified:true}));
 s.users.push(admin,saved,late);
 const l=newLeague(s,admin,'Il nostro Bar');
 l.members.push({uid:saved.id,points:0,credits:500},{uid:late.id,points:0,credits:500});
 const deadline=new Date(Date.now()+3600000).toISOString();
 const upcoming={id:'campionato+13',league:l.id,number:13,title:'Giornata 13',kickoff:deadline,rules:l.rules,
  matches:[{id:'m',home:'Casa',away:'Ospite',status:'NS',odds:{1:2,X:3,2:4}}],slips:[{uid:saved.id,picks:{m:'1'},stake:5}]};
 s.rounds.push({...upcoming,id:'altra-competizione',source:'fantacalcio',slips:[]},upcoming);
 const model=stateFor(s,admin),bar=model.leagues[0];
 assert.deepEqual(bar.slipReminder.missing,[late.id]);
 assert.equal(bar.rounds.find(r=>r.id===upcoming.id).publicSlips.length,0);
 assert.equal(Object.hasOwn(stateFor(s,late).leagues[0],'slipReminder'),false);
 assert.equal(Object.hasOwn(liveSnapshot(s,late,l.id),'slipReminder'),false);
 assert.equal(barReminder(bar,late.id),null);
 const reminder=barReminder(bar,admin.id),doc=parseHTML(renderPresidentReminders('bar',bar.id,reminder)).document;
 assert.equal(doc.querySelector('.reminder-players li').textContent,late.name);
 assert.match(homeReminderBanner('bar',reminder),/Manca 1 schedina/);
 assert.deepEqual(share(doc),{text:'Manca poco e non hai ancora inserito la tua schedina. Cosa aspetti? Sbrigati!',route:{mode:'bar',page:'schedina',section:null,league:l.id,round:upcoming.id}});
 upcoming.slips.push({uid:late.id,picks:{m:'2'},stake:5});
 mergeLiveSnapshot(model,liveSnapshot(s,admin,l.id));
 assert.equal(barReminder(bar,admin.id),null);
});

test('Fanta excludes computer teams and byes and shares the studio of the pending round and competition',()=>{
 const now=Date.parse('2026-11-19T12:00Z'),league={id:'fanta',adminUid:'u0',role:'admin'},round={number:9,deadline:'2026-11-20T17:00Z'};
 const teams=[
  {id:'t0',userId:'u0',manager:'Presidente'},{id:'t1',userId:'u1',manager:'Mister'},
  {id:'t2',userId:'u2',manager:'Al bancone'},{id:'t3',name:'Computer'},{id:'t4',userId:'u4',manager:'Gia schierato'}
 ];
 const state={league,teams,competition:{id:'coppa fanta',status:'active'},matchups:[
  {round:9,home_id:'t0',away_id:'t1'},{round:9,home_id:'t3',away_id:'t4'},{round:10,home_id:'t2',away_id:'t3'}
 ],lineups:[{team_id:'t4',round:9},{team_id:'t1',round:9,inherited_from:8}]};
 assert.equal(lineupReminder(state,'u1',round,now),null);
 const summary=lineupReminder(state,'u0',round,now);
 assert.deepEqual(summary.missing,[{uid:'u1',name:'Mister'}]);
 assert.equal(lineupReminder(state,'u0',round,Date.parse(round.deadline)),null);
 const reminder=fantaReminder({league,lineupReminder:summary},[{uid:'u1',name:'Nick Bar'}],now);
 assert.deepEqual(reminder.participants,['Nick Bar']);
 const doc=parseHTML(renderPresidentReminders('fanta',league.id,reminder)).document;
 assert.deepEqual(share(doc),{text:'Manca poco e non hai ancora inserito la tua formazione. Cosa aspetti? Sbrigati!',route:{mode:'fanta',page:'squadra',section:'studio',league:league.id,round:'9',competition:'coppa fanta'}});
 state.lineups.push({team_id:'t1',round:9});
 assert.equal(lineupReminder(state,'u0',round,now),null);
});

test('president actions reuse the league tiles and personal settings has a cog',()=>{
 const buttons=presidentOperationButtons({bar:{id:'b',code:'CODE'},fanta:{id:'f',kind:'random'},hasTrades:true});
 const doc=parseHTML(presidentWorkspace({buttons,back:'data-bar-page="barleague"'})).document;
 const tiles=[...doc.querySelectorAll('.lega-hub.president-tiles button.lega-tile')];
 assert.ok(tiles.length>10);
 for(const tile of tiles)assert.ok(tile.querySelector('.lega-tile-icon svg path')&&tile.querySelector('small').textContent);
 assert.ok(doc.querySelector('.lega-tile[data-league-section="scambi"]'));
 assert.ok(doc.querySelector('.lega-tile[data-president-operation="elimina"].league-delete-action'));
 const wizard=parseHTML(presidentWorkspace({tool:'identita',body:'<form></form>',back:'data-president-operation=""'})).document;
 assert.equal(wizard.querySelector('header h1'),null);
 assert.ok(wizard.querySelector('header [data-screen-back][aria-label="Torna al pannello del presidente"] svg'));
 assert.equal(fantaPresidentTool('scambi','scambi'),'scambi');
 assert.match(presidentEntry(),/aria-label="Apri impostazioni".*<svg[^>]+viewBox="0 0 24 24"/);
});
