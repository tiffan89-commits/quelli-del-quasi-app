import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';
const migration=n=>fs.readFile(new URL('../netlify/database/migrations/'+n,import.meta.url),'utf8');
test('existing championship is merged into the original Bar without recreating squads, slips or lineups; repeat is harmless',async()=>{
 const f=await fixtureDb();try{
 await f.db.exec(await migration('012_random_leagues.sql'));
 const target='6696ed2e771c593d37c402ef',origin='bar:pilot:2026:1',native='pilot:2026:1';
 await f.db.query(`INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,kind,max_members) SELECT $1,'Il campionato dei Quasi',2026,'u1','PILOT-TEST',rules,'pilot',10 FROM fanta.leagues LIMIT 1`,[native]);
 await f.db.query(`INSERT INTO fanta.competitions(id,league_id,name,status) VALUES($1,$2,'Campionato','active')`,[native+':main',native]);
 for(const [id,uid]of [['n1','u1'],['n2','test1'],['n3','test2']])await f.db.query(`INSERT INTO fanta.teams(id,league_id,user_id,name,manager,coach_name) VALUES($1,$2,$3,$1,$3,'Mister originale')`,[id,native,uid]);
 await f.db.query(`INSERT INTO fanta.rosters VALUES($1,'n1','p1-0',17)`,[native]);
 await f.db.query(`INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline) VALUES($1,1,10,'2099-01-01')`,[native]);
 await f.db.query(`INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES($1,1,'n1','4-4-2','["p1-0"]','[]')`,[native]);
 await f.db.query(`INSERT INTO fanta.bar_links VALUES($1,$2,$3,$4,true,now())`,[origin,native,native+':main','native:'+native]);
 const saved={id:'saved',league:target,slips:[{uid:'u1',stake:20,picks:{m:'1'},points:5}],matches:[]},fantasy={id:'fantasy',league:origin,slips:[{uid:'u1',stake:12,picks:{n:'X'}}],matches:[{id:'n',odds:{X:3.2}}]};
 const bars=[{id:target,name:'Quelli del quasi',admin:'u1',code:'KEEP',members:[{uid:'u1',credits:480,points:5,fantasyWallets:{other:{initial:500,credits:400}}}]},{id:origin,name:'Il campionato dei Quasi',admin:'u1',members:[{uid:'u1',credits:500,points:0,fantasyWallets:{[native]:{initial:500,credits:488}}},{uid:'test1'},{uid:'test2'}]}];
 await f.db.query(`UPDATE fanta_state SET payload=payload||$1::jsonb`,[JSON.stringify({leagues:bars,rounds:[saved,fantasy],ledger:[{id:'ledger1',league:origin,amount:-12}],users:[{id:'u1',username:'frankwood'},{id:'test1',username:'testuser'},{id:'test2',username:'testuser2'}]})]);
 const before=(await f.db.query('SELECT * FROM fanta.rosters WHERE league_id=$1',[native])).rows,lineups=(await f.db.query('SELECT * FROM fanta.lineups WHERE league_id=$1',[native])).rows;
 await f.db.exec(await migration('013_merge_quelli.sql'));await f.db.exec(await migration('013_merge_quelli.sql'));
 const s=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;
 assert.equal(s.leagues.length,1);const b=s.leagues[0];assert.equal(b.id,target);assert.equal(b.code,'KEEP');assert.equal(b.nativeFantaLink.leagueId,native);assert.deepEqual(b.nativeFantaLink.coachIds,['u1']);assert.equal(b.members.length,1);assert.equal(b.members[0].credits,480);assert.equal(b.members[0].fantasyWallets[native].credits,488);assert.deepEqual(s.rounds[0],saved);assert.deepEqual(s.rounds[1].slips,fantasy.slips);assert.equal(s.rounds[1].league,target);assert.equal(s.ledger[0].league,target);assert.equal(s.users.length,3);
 assert.deepEqual((await f.db.query('SELECT * FROM fanta.rosters WHERE league_id=$1',[native])).rows,before);assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups WHERE league_id=$1',[native])).rows,lineups);
 assert.equal((await f.db.query('SELECT name FROM fanta.leagues WHERE id=$1',[native])).rows[0].name,'Quelli del quasi');assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.teams WHERE league_id=$1 AND user_id IS NULL',[native])).rows[0].n,2);assert.equal((await f.db.query('SELECT bar_league_id FROM fanta.bar_links WHERE fanta_league_id=$1',[native])).rows[0].bar_league_id,target);
 }finally{await f.close();}
});
