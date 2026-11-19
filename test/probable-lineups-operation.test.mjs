import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {runProbableLineups} from '../lib/operations/probable-lineups.mjs';

const now=Date.parse('2026-11-19T08:00:00Z'),kickoff='2026-11-21T14:00:00.000Z';
const lineupRow=(side)=>`<tr data-panel-${side}="true">${Array.from({length:11},(_,i)=>
 `<span class="ftbl__match-formation-player--jerseyNum">${i+1}</span><a class="ftbl__match-formation-player--name" href="/">Giocatore ${i+1}</a>`).join('')}</tr>`;
const skyPage=`<title>Probabili formazioni</title><span class="ftbl__team__name">Como</span><span class="ftbl__team__name">Cagliari</span>
 <span class="ftbl__team-formation-number">4-4-2</span><span class="ftbl__team-formation-number">4-4-2</span>
 <h2>Titolari</h2>${lineupRow('left')}${lineupRow('right')}`;

test('forecast batch saves both XIs and keeps lost races and betting state intact',async()=>{
 const db=new PGlite();
 const connect=async()=>({query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args),release(){}});
 const match={id:'fixture',home:'Como',away:'Cagliari',kickoff,status:'NS',odds:{1:2.15,X:3.2,2:4.1}};
 const league={id:'l',members:[{uid:'coach',credits:50}]};
 const slip={uid:'coach',stake:5,picks:{fixture:'1'}};
 const round={id:'round',league:'l',deadline:kickoff,matches:[match],slips:[slip]};
 const snapshot={football:{calendar:{season:2026,rounds:[{number:12,matches:[match]}]}},rounds:[round],leagues:[league],ledger:[]};
 const state=async()=>(await db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
 const fetcher=async url=>new URL(url).hostname==='sport.sky.it'?new Response(skyPage):new Response(null,{status:404});
 const options={connect,now:()=>now,sportsStorage:'snapshot',fetcher};
 try{
  await db.exec('CREATE TABLE fanta_state(id int,payload jsonb)');
  await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(snapshot)]);
  const result=await runProbableLineups({fixtureIds:[match.id]},options);
  assert.deepEqual(result.metrics,{scope:'editorial-lineups-only',attempted:1,available:1,saved:1,missing:0});
  let saved=await state(),lineups=saved.football.calendar.rounds[0].matches[0].lineups;
  assert.equal(lineups.kind,'probable');
  assert.deepEqual(lineups.teams.map(t=>t.players.length),[11,11]);
  assert.deepEqual(saved.rounds[0].matches[0].lineups,lineups);
  assert.deepEqual(saved.rounds[0].slips,[slip]);
  assert.deepEqual(saved.rounds[0].matches[0].odds,match.odds);
  assert.deepEqual(saved.leagues,[league]);
  assert.deepEqual(saved.ledger,[]);
  assert.equal((await runProbableLineups({fixtureIds:[match.id]},options)).metrics.attempted,0);
  const official={kind:'official',updatedAt:new Date(now+90*60000).toISOString(),teams:lineups.teams};
  const racingFetch=async url=>{
   if(new URL(url).hostname==='sport.sky.it')await db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{football,calendar,rounds,0,matches,0,lineups}',$1)",[JSON.stringify(official)]);
   return fetcher(url);
  };
  const race=await runProbableLineups({fixtureIds:[match.id]},{...options,now:()=>now+90*60000,fetcher:racingFetch});
  assert.equal(race.metrics.saved,0);
  saved=await state();
  assert.deepEqual(saved.football.calendar.rounds[0].matches[0].lineups,official);
 }finally{await db.close();}
});
