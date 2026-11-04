import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';
import {renderGiornata} from '../public/src/fanta/giornata.mjs';
test('Fanta: archived round eight populates native lineups without prices or fake provider IDs; repeats preserve edits',async()=>{
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET source_key='lucas-bar:548867'");
  await f.db.query("INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline,official) VALUES('fanta-lucas-a',8,10,'2099-01-01',false)");
  await f.db.query("INSERT INTO fanta.matchups(id,league_id,round,home_id,away_id) VALUES('m8','fanta-lucas-a',8,'t1','t2')");
  await f.db.query('DELETE FROM fanta.rosters');
  const roles=['P',...Array(4).fill('D'),...Array(4).fill('C'),'A','A','P'];
  const teams=[1,2].map(n=>({name:'Squadra '+n,formation:'4-4-2',players:roles.map((role,i)=>({id:String(n*100+i),name:'Importato '+n+' '+i,role,club:'Club '+n,starter:i<11,grade:null,fantagrade:null,events:{}}))}));
  await f.db.query("INSERT INTO fanta.import_sources VALUES('lucas-bar:548867','u1',$1,'test')",[JSON.stringify({rounds:[{number:8,matches:[{details:{teams}}]}]})]);
  const migration=(await fs.readFile(new URL('../netlify/database/migrations/004_imported_lineups.sql',import.meta.url),'utf8')).replace('ON CONFLICT(league_id,round,team_id)','ON CONFLICT(competition_id,round,team_id)');await f.db.exec(migration);
  const first=(await f.db.query('SELECT * FROM fanta.lineups ORDER BY team_id')).rows;assert.equal(first.length,2);assert.equal(first[0].starters.length,11);assert.equal(first[0].bench.length,1);
  await f.db.exec(migration);assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups ORDER BY team_id')).rows,first);
  await f.db.query("UPDATE fanta.rounds SET official=true WHERE number=1");
  const api=createFantaApi({store:sqlFantaStore(f),env:{FANTA_BETA_USERS:'frankwood'}}),call=path=>api(new Request('https://example.test/fanta-api/'+path,{headers:{cookie:'sid=token1'}}));
  const initial=await(await call('bootstrap')).json();assert.equal(initial.home.round.number,8);assert.equal(initial.home.lineup.status,'saved');assert.equal(initial.team.lineup.starters.length,11);assert.equal(initial.team.roster.length,12);assert.equal(initial.team.round.locked,true);
  const m=await(await call('matchup?league=fanta-lucas-a&number=8&id=m8')).json();assert.equal(m.home.starters.length,11);assert.equal(m.home.starters[0].vote,null);assert.equal(m.home.starters[0].club,'Club 1');assert.ok(renderGiornata({round:initial.round,matchup:m,side:'home',view:'campo'}).includes('Importato'));
  await f.db.query("UPDATE fanta.lineups SET source_data='{}',formation='3-4-3' WHERE team_id='t1'");await f.db.exec(migration);assert.equal((await f.db.query("SELECT formation FROM fanta.lineups WHERE team_id='t1'")).rows[0].formation,'3-4-3');
  const count=(await f.db.query('SELECT count(*)::int AS n FROM fanta.players')).rows[0].n;assert.equal(count,31);
 }finally{await f.close();}
});
test('Fanta: a read uses one consistent SQL statement and bootstrap is restricted to the beta',async()=>{
 const f=await fixtureDb();try{let reads=0;const connect=async()=>{const c=await f.connect();return {...c,query:(...args)=>{reads++;return c.query(...args);}};};
 const store=sqlFantaStore({connect});await store.league('u1','fanta-lucas-a',s=>assert.equal(s.teams.length,2));assert.equal(reads,1);
 const api=createFantaApi({store,env:{FANTA_BETA_USERS:'frankwood'}});assert.equal((await api(new Request('https://example.test/fanta-api/bootstrap'))).status,403);
 }finally{await f.close();}
});
