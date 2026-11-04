import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {createApi} from '../netlify/functions/api.mjs';import {membershipTransaction} from '../lib/db.mjs';import{claimRandom,ensurePilotBars}from'../fanta/random-leagues.mjs';import{repairRemovedCoaches}from'../fanta/linked-membership.mjs';import{sqlFantaStore}from'../fanta/store.mjs';import{homeView,teamView}from'../fanta/views.mjs';
test('Bar removal atomically detaches only the linked Fanta coach, cannot be revived, and repair removes old testuser2 ownership without deleting history',async()=>{
 const f=await fixtureDb();try{
 await f.db.exec(await fs.readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8'));
 const bar={id:'bar',name:'Il Bar',admin:'u1',code:'CODE',rules:{initial:500},members:[{uid:'u1',credits:51,points:5},{uid:'u2',credits:37,points:9}],nativeFantaLink:{leagueId:'fanta-lucas-a',coachIds:['u1','u2']}};
 await f.db.query('UPDATE fanta_state SET payload=payload||$1::jsonb',[JSON.stringify({leagues:[bar],ledger:[{id:'historic',amount:3}],football:{calendar:{archived:'untouched'}}})]);await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES('bar','fanta-lucas-a','fanta-lucas-a:main','native:league')");
 await f.db.query("INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules) VALUES('other','Altra lega',2026,'u2','OTHER','{}')");await f.db.query("INSERT INTO fanta.teams(id,league_id,user_id,name,manager) VALUES('other-team','other','u2','Altra squadra','Amico')");
 const lineup=f.lineup('t2');await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES('fanta-lucas-a',1,'t2',$1,$2,$3)",[lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench)]);
 await f.db.query("INSERT INTO fanta.pilot_claims(user_id,league_id,team_id) VALUES('u2','fanta-lucas-a','t2')");
 const before={rosters:(await f.db.query('SELECT * FROM fanta.rosters ORDER BY player_id')).rows,lineups:(await f.db.query('SELECT * FROM fanta.lineups')).rows};let heavy=0;
 await f.db.query("UPDATE fanta.leagues SET admin_uid='u2' WHERE id='fanta-lucas-a'");
 const api=createApi({transact:()=>{heavy++;throw Error('Full game transaction forbidden');},membershipTransact:fn=>membershipTransaction(fn,{connect:f.connect})});
 const response=await api(new Request('https://example.test/api/member-remove',{method:'POST',headers:{cookie:'sid=token1'},body:JSON.stringify({league:'bar',uid:'u2'})}));assert.equal(response.status,200,await response.clone().text());assert.equal(heavy,0);assert.equal((await f.db.query("SELECT admin_uid FROM fanta.leagues WHERE id='fanta-lucas-a'")).rows[0].admin_uid,'u1');assert.equal((await f.db.query("SELECT count(*)::int AS n FROM fanta.pilot_claims WHERE user_id='u2'")).rows[0].n,0);
 let state=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(state.leagues[0].members.length,1);assert.equal(state.leagues[0].removedMembers[0].uid,'u2');assert.deepEqual(state.leagues[0].nativeFantaLink.coachIds,['u1']);assert.deepEqual(state.football,{calendar:{archived:'untouched'}});assert.deepEqual(state.ledger,[{id:'historic',amount:3}]);assert.equal((await f.db.query("SELECT user_id FROM fanta.teams WHERE id='t2'")).rows[0].user_id,null);assert.equal((await f.db.query("SELECT user_id FROM fanta.teams WHERE id='other-team'")).rows[0].user_id,'u2');
 await assert.rejects(()=>claimRandom({id:'u2'},'fanta-lucas-a',{connect:f.connect}),/Bar/);
 // Reproduce the pre-fix zombie in the isolated fixture, then repair it twice.
 await f.db.query("UPDATE fanta.teams SET user_id='u2' WHERE id='t2'");await f.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{users,1,username}','\"TestUser2\"')");
 await f.db.query("UPDATE fanta.leagues SET kind='random' WHERE id='fanta-lucas-a'");await ensurePilotBars({connect:f.connect});state=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.ok(!state.leagues[0].members.some(m=>m.uid==='u2'),'maintenance must not reinsert a removed Bar member');
 await f.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues,0,members}',payload#>'{leagues,0,members}'||'[{\"uid\":\"u2\",\"credits\":500}]'::jsonb)");await assert.rejects(()=>claimRandom({id:'u2'},'fanta-lucas-a',{connect:f.connect}),/Bar/);
 const repair=await repairRemovedCoaches({connect:f.connect});assert.equal(repair.detached,1);assert.equal(repair.resurrectedMembersRemoved,1);assert.equal(repair.remainingRemovedAssignments,0);assert.equal(repair.testuser2Remaining,0);assert.equal((await repairRemovedCoaches({connect:f.connect})).detached,0);
 assert.deepEqual((await f.db.query('SELECT * FROM fanta.rosters ORDER BY player_id')).rows,before.rosters);assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups')).rows,before.lineups);assert.equal((await f.db.query("SELECT user_id FROM fanta.teams WHERE id='other-team'")).rows[0].user_id,'u2');
 }finally{await f.close();}
});
test('normal Fanta reads omit the unrelated player catalogue while preserving home/team DTOs and historical lineup players',async()=>{
 const f=await fixtureDb();try{
 for(let i=0;i<120;i++)await f.db.query('INSERT INTO fanta.players(id,api_id,club_id,name,role,data) VALUES($1,$2,$3,$4,$5,$6)',['unused'+i,80000+i,'c1','Non in questa lega '+i,'C',JSON.stringify({seasonStats:{notes:'x'.repeat(4000)}})]);
 const store=sqlFantaStore({connect:f.connect}),now=Date.parse('2026-11-03');let allSize,thinSize;
 const full=await store.league('u1','fanta-lucas-a',s=>{allSize=JSON.stringify(s).length;return{home:homeView(s,'u1',now),team:teamView(s,'u1',now)};},{catalog:true});
 const thin=await store.league('u1','fanta-lucas-a',s=>{thinSize=JSON.stringify(s).length;assert.ok(!s.players.some(p=>p.id.startsWith('unused')));return{home:homeView(s,'u1',now),team:teamView(s,'u1',now)};},{catalog:false});assert.deepEqual(thin,full);assert.ok(thinSize<allSize/4);
 const old=f.lineup('t1');await f.db.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES($1,1,$2,$3,$4,$5)',['fanta-lucas-a','t1',old.formation,JSON.stringify([...old.starters,'unused0']),JSON.stringify(old.bench)]);await store.league('u1','fanta-lucas-a',s=>assert.ok(s.players.some(p=>p.id==='unused0')),{catalog:false});
 }finally{await f.close();}
});

test('summary reads retain exact votes, goals and substitutions while full match detail keeps its explanation',async()=>{
 const f=await fixtureDb();try{
 await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES('vfixture',88888,2026,1,'2026-11-01','FT','c1','c2','{}')");
 const data={status:'voted',vote:7,fantavote:10,events:{goals:1},needsReview:false,why:'Una buona prova',breakdown:{evidence:'x'.repeat(40000)}};
 await f.db.query("INSERT INTO fanta.votes(fixture_id,player_id,version,input_hash,input,data) VALUES('vfixture','p1-0','test','h','{}',$1)",[JSON.stringify(data)]);
 const store=sqlFantaStore({connect:f.connect}),full=await store.league('u1','fanta-lucas-a',s=>s.votes[0].data,{detailedVotes:true,catalog:false}),thin=await store.league('u1','fanta-lucas-a',s=>s.votes[0].data,{detailedVotes:false,catalog:false});
 assert.equal(full.breakdown.evidence.length,40000);assert.equal(thin.breakdown,undefined);for(const key of ['status','vote','fantavote','events','needsReview'])assert.deepEqual(thin[key],full[key]);assert.deepEqual((await f.db.query('SELECT data FROM fanta.votes')).rows[0].data,data);
 await store.league('u1','fanta-lucas-a',s=>{const h=homeView(s,'u1',Date.parse('2026-11-03'));assert.ok(h.auction.teams.every(t=>t.team.roster===undefined));assert.ok(h.auction.credits>=0);},{catalog:false,detailedVotes:false});
 }finally{await f.close();}
});
