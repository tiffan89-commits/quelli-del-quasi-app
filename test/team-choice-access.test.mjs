import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';import {teamChoices} from '../fanta/team-choices.mjs';import {claimRandom} from '../fanta/random-leagues.mjs';
test('a verified Bar member without a team gets the linked native choices and can claim exactly one, preserving roster and history',async()=>{
 const f=await fixtureDb();try{
 await f.db.exec(await fs.readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8'));
 await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");
 await f.db.query('UPDATE fanta_state SET payload=payload||$1::jsonb',[JSON.stringify({leagues:[{id:'bar-native',name:'Bar di prova',admin:'u1',members:[{uid:'u1',credits:123,points:4},{uid:'u2',credits:456,points:7}],nativeFantaLink:{leagueId:'fanta-lucas-a',coachIds:['u1']}}],ledger:[{id:'keep',amount:3}]})]);
 await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES('bar-native','fanta-lucas-a','fanta-lucas-a:main','native:test')");
 const saved=f.lineup('t2');await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench) VALUES('fanta-lucas-a',1,'t2',$1,$2,$3)",[saved.formation,JSON.stringify(saved.starters),JSON.stringify(saved.bench)]);
 const before={rosters:(await f.db.query('SELECT * FROM fanta.rosters ORDER BY player_id')).rows,lineups:(await f.db.query('SELECT * FROM fanta.lineups')).rows};
 const api=createFantaApi({store:sqlFantaStore({connect:f.connect}),env:{}}),call=(path,body)=>api(new Request('https://example.test/fanta-api/'+path,{method:body?'POST':'GET',headers:{cookie:'sid=token2'},...(body?{body:JSON.stringify(body)}:{})}));
 const boot=await call('bootstrap?league=fanta-lucas-a'),b=await boot.json();assert.equal(boot.status,200);assert.equal(b.leagues.length,0);assert.equal(b.choiceLeagueId,'fanta-lucas-a');assert.equal(b.home,undefined);assert.equal(b.teamChoices[0].teams.find(t=>t.id==='t2').available,true);
 assert.equal((await call('team?league=fanta-lucas-a')).status,403);assert.deepEqual(await teamChoices('outsider',{connect:f.connect}),[]);await assert.rejects(()=>claimRandom({id:'outsider'},'fanta-lucas-a',{connect:f.connect,teamId:'t2'}),/Bar/);
 const bad=await call('team/claim',{league:'fanta-lucas-a',team:'t1'});assert.equal(bad.status,409);
 const claimed=await call('team/claim',{league:'fanta-lucas-a',team:'t2'});assert.equal(claimed.status,200,await claimed.clone().text());assert.equal((await claimed.json()).team.id,'t2');
 assert.equal((await (await call('team/claim',{league:'fanta-lucas-a',team:'t2'})).json()).reused,true);
 const after=await(await call('bootstrap?league=fanta-lucas-a')).json();assert.equal(after.teamChoices.length,0);assert.equal(after.leagues[0].teamId,'t2');assert.ok(after.home);assert.deepEqual((await f.db.query('SELECT * FROM fanta.rosters ORDER BY player_id')).rows,before.rosters);assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups')).rows,before.lineups);
 const state=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.deepEqual(state.leagues[0].members.map(m=>[m.credits,m.points]),[[123,4],[456,7]]);assert.deepEqual(state.ledger,[{id:'keep',amount:3}]);assert.ok(state.leagues[0].nativeFantaLink.coachIds.includes('u2'));
 await f.db.query("UPDATE fanta.leagues SET source_key='external:restricted'");assert.deepEqual(await teamChoices('outsider',{connect:f.connect}),[]);await assert.rejects(()=>claimRandom({id:'u2'},'fanta-lucas-a',{connect:f.connect,teamId:'t2'}),/non disponibile/);
 }finally{await f.close();}
});
test('claiming the same last free team concurrently has one winner and no lost or duplicate team ownership',async()=>{
 const f=await fixtureDb();try{
 await f.db.exec(await fs.readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8'));await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");
 await f.db.query('UPDATE fanta_state SET payload=payload||$1::jsonb',[JSON.stringify({leagues:[{id:'b',members:[{uid:'u1'},{uid:'u2'},{uid:'u3'}]}]})]);await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES('b','fanta-lucas-a','fanta-lucas-a:main','native:test')");
 const claims=await Promise.allSettled(['u2','u3'].map(id=>claimRandom({id,name:id},'fanta-lucas-a',{connect:f.connect,teamId:'t2'})));assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);assert.equal(claims.find(r=>r.status==='rejected').reason.status,409);
 assert.equal((await teamChoices(claims[0].status==='fulfilled'?'u3':'u2',{connect:f.connect}))[0].teams.filter(t=>t.available).length,0);
 }finally{await f.close();}
});
