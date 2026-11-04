import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';import {roundRobin,planCompetition,knockoutStage,advanceCup} from '../fanta/competitions.mjs';
test('ten teams have fair round-robin fixtures, group byes and a complete knockout bracket',()=>{
 const ids=Array.from({length:10},(_,i)=>'t'+i),rr=roundRobin(ids,{twice:true});assert.equal(rr.length,18);assert.equal(rr.flat().length,90);
 for(const round of rr)assert.equal(new Set(round.flatMap(m=>[m.home,m.away])).size,10);
 const groups=planCompetition(ids,'groups',{groups:2,qualify:2});assert.equal(groups.plan.length,5);assert.equal(groups.plan.flatMap(r=>r.matches).length,20);
 for(const r of groups.plan)assert.equal(new Set(r.matches.flatMap(m=>[m.home,m.away])).size,r.matches.length*2);
 const knockout=knockoutStage(ids);assert.equal(knockout.matches.length,2);assert.equal(knockout.byes.length,6);assert.equal(new Set([...knockout.matches.flatMap(m=>[m.home,m.away]),...knockout.byes.map(b=>b.team)]).size,10);
});
test('competitions share rosters but isolate fixtures/results, lock capacity on start, and advance cups only after official results',async()=>{
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET max_members=4");for(let i=3;i<=4;i++)await f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES($1,'fanta-lucas-a',$2,'Mister')",['t'+i,'Squadra '+i]);await f.db.query('DELETE FROM fanta.rosters');
  const roles=[...Array(3).fill('P'),...Array(8).fill('D'),...Array(8).fill('C'),...Array(6).fill('A')];for(let i=1;i<=4;i++)for(const [j,role]of roles.entries())await f.db.query("INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price) VALUES('fanta-lucas-a',$1,$2,$3,$4,1)",['t'+i,'s'+i+'-'+j,'Calciatore '+i+' '+j,role]);
  for(const round of [11,12])for(let i=0;i<10;i++)await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id) VALUES($1,$2,2026,$3,$4,'NS','c1','c2')",['future-'+round+'-'+i,round*100+i,round,'2099-01-'+(round===11?'10':'17')+'T15:00Z']);
  const store=sqlFantaStore(f),api=createFantaApi({store,env:{FANTA_BETA_USERS:'frankwood'}}),call=(path,body,cookie='token1')=>api(new Request('https://example.test/fanta-api/'+path,{method:body?'POST':'GET',headers:{cookie:'sid='+cookie},body:body?JSON.stringify({league:'fanta-lucas-a',...body}):undefined}));
  const created=await(await call('competition/create',{name:'Coppa sintetica',kind:'groups'})).json();assert.ok(created.id);
  const start=await call('competition/start',{competition:created.id,startRound:11,groups:2,qualify:1});assert.equal(start.status,200);assert.equal((await call('league/configure',{size:6})).status,409);
  await assert.rejects(f.db.query('UPDATE fanta.leagues SET max_members=6'),/taglia/);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.rounds WHERE number=1')).rows[0].n,2);
  const cup=await(await call('league?league=fanta-lucas-a&competition='+created.id)).json();assert.equal(cup.members.length,4);assert.equal(cup.league.maxMembers,4);assert.equal(cup.groups.length,2);
  await store.league('u1','fanta-lucas-a',async(s,c)=>{assert.equal(await advanceCup(s,c),false);for(const m of s.matchups){const a=s.teams.find(t=>t.id===m.home_id),b=s.teams.find(t=>t.id===m.away_id),data={home:{team:a,goals:2,points:72},away:{team:b,goals:1,points:68}};await c.query('INSERT INTO fanta.results(matchup_id,official,data) VALUES($1,true,$2)',[m.id,JSON.stringify(data)]);}await c.query('UPDATE fanta.rounds SET official=true WHERE competition_id=$1',[created.id]);},{write:true,competition:created.id});
  await store.league('u1','fanta-lucas-a',(s,c)=>advanceCup(s,c),{write:true,competition:created.id});
  const rounds=(await f.db.query('SELECT * FROM fanta.rounds WHERE competition_id=$1 ORDER BY number',[created.id])).rows;assert.equal(rounds.length,2);assert.equal(rounds[1].data.label,'Finale');
  await store.league('u1','fanta-lucas-a',async(s,c)=>{const m=s.matchups.find(m=>m.round===2);await c.query('INSERT INTO fanta.results(matchup_id,official,data) VALUES($1,true,$2)',[m.id,JSON.stringify({home:{team:s.teams.find(t=>t.id===m.home_id),goals:1,points:70},away:{team:s.teams.find(t=>t.id===m.away_id),goals:1,points:68}})]);await c.query('UPDATE fanta.rounds SET official=true WHERE competition_id=$1 AND number=2',[created.id]);},{write:true,competition:created.id});
  await store.league('u1','fanta-lucas-a',(s,c)=>advanceCup(s,c),{write:true,competition:created.id});const finished=(await f.db.query('SELECT status,data FROM fanta.competitions WHERE id=$1',[created.id])).rows[0];assert.equal(finished.status,'finished');assert.ok(finished.data.winner);assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.rounds WHERE competition_id=$1',[created.id])).rows[0].n,2);
  const main=await(await call('league?league=fanta-lucas-a')).json();assert.equal(main.calendar.rounds.length,1);assert.ok(main.standings.every(r=>r.played===0));
  assert.equal((await call('team?league=fanta-lucas-a&team=t2','', 'token2')).status,200);
 }finally{await f.close();}
});
