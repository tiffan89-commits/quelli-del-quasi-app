import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {calendarMatchTab,serieACalendar} from '../public/src/bar-calendar.mjs';
import {tabForPage} from '../public/src/v2/tabs.mjs';

const kickoff='2026-11-22T11:30:00Z',now=Date.parse('2026-11-22T12:10:00Z');
const match=(id,status,extra={})=>({id,status,home:'Juventus',away:'Venezia',kickoff,...extra});

test('Serie A calendar opens the current round, shows live scores and minutes, and keeps unfinished results distinct',()=>{
 const matches=[match('live','2H',{liveScore:[2,1],score:[8,8],clock:"54'"}),match('final','FT',{score:[0,0]}),
  match('future','NS',{score:[9,9],liveScore:[3,2]}),match('postponed','PST')];
 const calendar={season:2026,rounds:[{number:13,date:'2026-11-29',matches:[]},{number:12,date:'2026-11-22',matches}]};
 const parse=(options={})=>parseHTML(serieACalendar(calendar,{now,...options})).document;
 const document=parse();
 const row=id=>document.querySelector('[data-bar-calendar-match="'+id+'"]');
 assert.deepEqual([...document.querySelectorAll('[data-bar-calendar-round]')].map(el=>el.dataset.barCalendarRound),['12','13']);
 assert.equal(document.querySelector('.fanta-cal-round.is-current .fanta-cal-head').getAttribute('aria-expanded'),'true');
 assert.equal(row('live').querySelector('.inline-live').textContent,'LIVE');
 assert.equal(row('live').querySelector('.inline-score').textContent,'2 – 1');
 assert.equal(row('live').querySelector('.fanta-cal-score small').textContent,"54'");
 assert.equal(row('final').querySelector('.fanta-cal-score strong').textContent,'0–0');
 assert.equal(row('future').querySelector('.fanta-cal-score strong'),null);
 assert.equal(row('postponed').querySelector('.fanta-cal-score').textContent,'Rinviata');
 assert.equal(row('live').querySelectorAll('.club-kit').length,2);
 assert.equal(row('live').querySelector('.fanta-fit-team').getAttribute('title'),'Juventus');
 assert.equal(parse({openRound:-1}).querySelectorAll('[data-bar-calendar-match]').length,0);
 assert.equal(parse({openRound:13}).querySelector('[aria-expanded=true]').dataset.barCalendarRound,'13');
 assert.equal(tabForPage('calendario'),'classifica');
 assert.equal(calendarMatchTab(matches[0]),'cronaca');
 assert.equal(calendarMatchTab(matches[1]),'formazioni');
 assert.equal(calendarMatchTab(matches[2]),'formazioni');
});

test('Serie A calendar groups fixtures by Rome date and gives unscheduled matches one round reference date',()=>{
 const matches=[
  match('later','NS',{kickoff:'2026-11-28T14:00:00Z'}),
  match('friday','NS',{kickoff:'2026-11-27T19:45:00Z'}),
  match('after-midnight','NS',{kickoff:'2026-11-27T23:15:00Z'}),
  match('unknown','NS',{kickoff:null}),
  match('official-only','NS',{kickoff:null,officialKickoff:'2026-11-28T17:00:00Z'}),
  match('postponed','PST',{kickoff:null})
 ];
 const calendar={season:2026,rounds:[{number:13,date:'2026-11-29',matches}]};
 const document=parseHTML(serieACalendar(calendar,{now,openRound:13})).document;
 const list=[...document.querySelectorAll('.fanta-cal-round li')];
 assert.deepEqual(list.map(li=>(li.querySelector('.fanta-cal-score')??li).textContent.trim()),[
  'ven 27 nov 2026','20:45','sab 28 nov 2026','00:15','15:00','18:00','Data del turno · dom 29 nov 2026','','Rinviata'
 ]);
 assert.deepEqual([...document.querySelectorAll('.ticket-day time')].map(el=>el.getAttribute('datetime')),[
  '2026-11-27','2026-11-28','2026-11-29'
 ]);
 assert.equal(document.querySelector('[data-bar-calendar-match="friday"] time').getAttribute('datetime'),'2026-11-27T19:45:00Z');
 assert.equal(serieACalendar(calendar,{now,openRound:13}).includes('Da definire'),false);
});
