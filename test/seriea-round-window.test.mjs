import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {homeView,teamView} from '../fanta/views.mjs';
import {renderSquadra} from '../public/src/fanta/squadra.mjs';
import {syncConfirmedDeadlines} from '../lib/operations/round-deadlines.mjs';
import {calendarView} from '../lib/calendar.mjs';
import {saveBarSlip} from '../lib/bar-slip-save.mjs';
import {attentionOf,fantaHomeStatus} from '../public/src/v2/league-switcher.mjs';
import {alignSlipSchedule,defaultSlipRound,roundAvailability,slipSummary,slipWaitingForPrevious} from '../public/src/slip-state.mjs';
import {mergeLiveSnapshot} from '../public/src/live-channel.mjs';
import {eventLocked} from '../public/slip-events.mjs';

const friday='2026-11-27T20:45:00+01:00',sunday='2026-11-29T18:30:00+01:00',duringPrevious=Date.parse('2026-11-23T21:30:00+01:00');
const match=(number,i,kickoff,status)=>({id:`seriea:2026:${number}:${i+1}`,officialKickoff:kickoff,kickoff,status,odds:{1:2,X:3,2:4}});
const current=Array.from({length:10},(_,i)=>match(1,i,'2026-11-23T20:45:00+01:00',i===9?'LIVE':'FT'));
const upcoming=Array.from({length:10},(_,i)=>match(2,i,i===7?friday:sunday,'NS'));

test('the login calendar opens the priced Bar slip before Socket.IO and keeps unconfirmed fixtures locked',()=>{
 const source={season:2026,rounds:[
  {number:1,matches:current.map(m=>({...m,status:'FT'}))},
  {number:2,matches:upcoming.map((m,i)=>i===0?{...m,officialKickoff:null}:m)},
 ]};
 const calendar=calendarView({football:{calendar:structuredClone(source)}});
 const round={id:'next',number:2,deadline:friday,eventBetting:true,matches:structuredClone(upcoming)};
 alignSlipSchedule(round,calendar);
 round.waitingForOpen=slipWaitingForPrevious(round,calendar.rounds,duringPrevious);
 assert.equal(defaultSlipRound([round],duringPrevious,calendar),round);
 assert.equal(roundAvailability(round,duringPrevious),'aperta');
 assert.equal(slipSummary(round,{[upcoming[7].id]:'1'},5,500,duringPrevious).canSave,true);
 assert.equal(eventLocked(round,round.matches[0],duringPrevious),true);
 assert.equal(eventLocked(round,round.matches[7],Date.parse(friday)),true);
 const league={id:'l',rounds:[round],members:[]};
 const changed={id:upcoming[7].id,kickoff:friday,officialKickoff:null};
 mergeLiveSnapshot({calendar,leagues:[league]},{league:league.id,calendar:[changed]});
 assert.equal(round.matches[7].kickoff,null);
 assert.equal(eventLocked(round,round.matches[7],duringPrevious),true);
});

test('authoritative dates repair stale views before opening and Fanta closes at the first kickoff',()=>{
 const previous={number:1,matches:current.map(m=>({...m,status:'FT'}))};
 const calendar={rounds:[previous,{number:2,matches:upcoming}]};
 const old='2026-11-20T20:45:00+01:00';
 const bar={number:2,deadline:old,matches:upcoming.map(m=>({...m,kickoff:old,officialKickoff:null}))};
 const fanta={number:1,serieARound:2,source:'fantacalcio',nativeFanta:{},deadline:sunday,matches:[{id:'virtual',kickoff:sunday}]};
 for(const round of [bar,fanta]){
  alignSlipSchedule(round,calendar);
  assert.equal(round.deadline,new Date(friday).toISOString());
  assert.equal(slipWaitingForPrevious(round,calendar.rounds,duringPrevious),false);
  assert.equal(slipWaitingForPrevious(round,[{...previous,matches:previous.matches.slice(0,9)}],duringPrevious),true);
 }
 assert.equal(eventLocked(fanta,fanta.matches[0],Date.parse(friday)),true);
 assert.equal(eventLocked(bar,bar.matches[0],Date.parse(friday)),false);
});

test('a saved Bar slip has no badge while the next round waits for the previous final whistle',()=>{
 const first={number:1,eventBetting:true,kickoff:current[0].kickoff,slip:{picks:{}},matches:current};
 const next={number:2,eventBetting:true,kickoff:friday,matches:upcoming};
 assert.equal(slipWaitingForPrevious(next,[first,next],duringPrevious),true);
 assert.equal(attentionOf({rounds:[first,next]},'u1',duringPrevious).level,'ok');
 const completed={...first,matches:first.matches.map(m=>({...m,status:'FT'}))};
 assert.equal(slipWaitingForPrevious(next,[completed,next],duringPrevious),false);
 assert.equal(attentionOf({rounds:[completed,next]},'u1',duringPrevious).level,'todo');
});

test('the official first kickoff controls the Fanta deadline and a running previous round hides the badge and rejects submissions',async()=>{
 const fixture=await fixtureDb(),store=sqlFantaStore({connect:fixture.connect});
 try{
  await fixture.db.exec(await readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8'));
  const calendar=[{number:1,matches:current},{number:2,matches:upcoming}];
  const updateCalendar=()=>fixture.db.query("UPDATE fanta_state SET payload=payload||jsonb_build_object('football',jsonb_build_object('calendar',jsonb_build_object('season',2026,'rounds',$1::jsonb))) WHERE id=1",[JSON.stringify(calendar)]);
  await updateCalendar();
  await fixture.db.query("UPDATE fanta.rounds SET deadline=$1 WHERE number=1",[current[0].kickoff]);
  await fixture.db.query("INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline) VALUES('fanta-lucas-a',2,2,$1)",[sunday]);
  const competition='fanta-lucas-a:main';
  const previous=fixture.lineup('t1'),released=previous.bench[1];
  await fixture.db.query(`INSERT INTO fanta.lineups(league_id,competition_id,round,team_id,formation,starters,bench,saved_at)
   VALUES('fanta-lucas-a',$1,1,'t1',$2,$3,$4,'2026-11-22')`,[competition,previous.formation,JSON.stringify(previous.starters),JSON.stringify(previous.bench)]);
  await fixture.db.query('DELETE FROM fanta.rosters WHERE team_id=$1 AND player_id=$2',['t1',released]);
  const bar={id:'bar-gravidi-test',members:[{uid:'u1',credits:500,points:0}]};
  const slipRound={id:'virtual-round',league:bar.id,season:2026,number:2,serieARound:2,source:'fantacalcio',nativeFanta:{leagueId:'fanta-lucas-a',competitionId:competition},kickoff:sunday,virtualBookmaker:true,competitionKey:'fanta',rules:{mode:'classic',correct:1,wrong:-1},matches:[{id:'virtual-match',kickoff:null,status:'NS',odds:{1:2,X:3,2:4}}],slips:[]};
  await fixture.db.query("UPDATE fanta_state SET payload=payload||jsonb_build_object('leagues',$1::jsonb,'rounds',$2::jsonb) WHERE id=1",[JSON.stringify([bar]),JSON.stringify([slipRound])]);
  await fixture.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{sessions,0,expires}',to_jsonb($1::bigint)) WHERE id=1",[Date.parse(sunday)]);
  await fixture.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES($1,'fanta-lucas-a',$2,'fanta')",[bar.id,competition]);
  const bet={league:bar.id,round:slipRound.id,stake:5,picks:{'virtual-match':'1'}};
  const submitSlip=(instant,input=bet)=>saveBarSlip('token1',input,{connect:fixture.connect,now:()=>instant,sportsStorage:'snapshot'});
  const open=now=>store.league('u1','fanta-lucas-a',state=>homeView(state,'u1',now),{submissionWindows:true});
  const squad=now=>store.league('u1','fanta-lucas-a',state=>teamView(state,'u1',now),{submissionWindows:true,catalog:false});
  const render=data=>renderSquadra({data,sub:'formazione'},duringPrevious);
  const input={...previous,bench:previous.bench.filter(id=>id!==released),round:2};
  const pending=await open(duringPrevious);
  assert.deepEqual(pending.nextLineup,{round:2,deadline:new Date(friday).toISOString(),open:false,formation:null,savedAt:null});
  assert.equal(fantaHomeStatus(pending,duringPrevious).lineupPending,false);
  const previousTeam=await squad(duringPrevious);
  assert.equal(previousTeam.round.number,1);
  assert.equal(previousTeam.round.locked,true);
  assert.equal(previousTeam.round.started,true);
  assert.deepEqual(previousTeam.lineup.starters,previous.starters);
  assert.deepEqual(previousTeam.lineup.bench,previous.bench);
  assert.equal(previousTeam.roster.some(p=>p.id===released),false);
  assert.equal(previousTeam.lineupPlayers[0].id,released);
  const previousPitch=render(previousTeam);
  assert.match(previousPitch,/Giornata 1 in corso/);
  assert.match(previousPitch,/Formazione schierata/);
  assert.match(previousPitch,/4 giocatori/);
  assert.doesNotMatch(previousPitch,/data-studio="open"|posto vuoto|Giornata 2|0 fantapunti/);
  const watch=()=>store.teamLineupWatch('fanta-lucas-a',competition,duringPrevious);
  assert.equal((await watch()).lineupRound.number,1);
  await assert.rejects(store.saveLineup('u1','fanta-lucas-a',input,{now:duringPrevious}),/non sono ancora aperte/);
  await assert.rejects(submitSlip(duringPrevious),/non è ancora aperta/);
  calendar[0]={number:1,matches:current.map(match=>({...match,status:'FT'}))};
  await updateCalendar();
  assert.equal(fantaHomeStatus(await open(duringPrevious),duringPrevious).lineupPending,true);
  const nextTeam=await squad(duringPrevious);
  assert.equal(nextTeam.round.number,2);
  assert.equal(nextTeam.round.locked,false);
  assert.equal(nextTeam.lineup,null);
  assert.deepEqual(nextTeam.previous.starters,previous.starters);
  assert.match(render(nextTeam),/data-studio="open"/);
  assert.equal((await watch()).lineupRound.open,true);
  assert.equal((await watch()).lineupRound.number,2);
  const saved=await store.saveLineup('u1','fanta-lucas-a',input,{now:Date.parse(friday)-1});
  assert.equal((await submitSlip(Date.parse(friday)-1)).receipt.slip.stake,5);
  const edited={...input,starters:input.starters.map((p,i)=>i===0?input.bench[0]:p),bench:input.bench.map((p,i)=>i===0?input.starters[0]:p)};
  await assert.rejects(store.saveLineup('u1','fanta-lucas-a',edited,{now:Date.parse(friday)}),/scaduto/);
  await assert.rejects(submitSlip(Date.parse(friday),{...bet,stake:6}),/già iniziata/);
  assert.deepEqual(await store.saveLineup('u1','fanta-lucas-a',input,{now:Date.parse(friday)}),saved);
  const report=await syncConfirmedDeadlines(fixture.db,{season:2026,now:duringPrevious});
  assert.equal(report.fanta,1);
  const {rows:[updated]}=await fixture.db.query('SELECT deadline FROM fanta.rounds WHERE number=2');
  assert.equal(new Date(updated.deadline).toISOString(),new Date(friday).toISOString());
 }finally{await fixture.close();}
});
