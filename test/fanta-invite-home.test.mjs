import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {leagueView} from '../fanta/views.mjs';
import {linkedInvite,renderLeagueInvite} from '../public/src/fanta/league-invite.mjs';
import {joinLinkedTeam} from '../fanta/league-creation.mjs';
test('bots do not occupy human invitation places; every member sees a working linked-Bar invite',async()=>{
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET max_members=2 WHERE id='fanta-lucas-a'");await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");const store=sqlFantaStore(f);
  const own=await store.league('u1','fanta-lucas-a',s=>leagueView(s,'u1'));
  assert.equal(own.league.humanMembers,1);assert.equal(own.league.availableTeams,1);
  const bars=[{name:'Bar sintetico',code:'CODE-TEST',nativeFantaLink:{leagueId:'fanta-lucas-a'}}],invite=linkedInvite(own.league,bars);
  assert.equal(invite.url,'https://quellidelquasi.com/invito/CODE-TEST');assert.match(renderLeagueInvite(own.league,invite),/Invita con WhatsApp/);assert.match(renderLeagueInvite(own.league,invite),/wa\.me/);
  assert.equal(linkedInvite({...own.league,role:'member'},bars).code,'CODE-TEST');assert.match(renderLeagueInvite({...own.league,role:'member'},invite),/Invita con WhatsApp/);
  assert.equal(renderLeagueInvite(own.league,{...invite,members:[{uid:'u1'},{uid:'u2'}]}),'');
  await f.db.query("UPDATE fanta.teams SET user_id='u2' WHERE id='t2'");const full=await store.league('u1','fanta-lucas-a',s=>leagueView(s,'u1'));assert.equal(full.league.availableTeams,0);assert.equal(linkedInvite(full.league,bars).code,'CODE-TEST');assert.equal(renderLeagueInvite(full.league,invite),'');assert.match(renderLeagueInvite(full.league,invite,{always:true}),/La lega è al completo/);assert.equal(linkedInvite(own.league,[]),null);
 }finally{await f.close();}
});

test('a linked invitation assigns a free team once and rejects a join after the last place',async()=>{
 const f=await fixtureDb();
 try{
  await f.db.query("UPDATE fanta.leagues SET max_members=2 WHERE id='fanta-lucas-a'");
  await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");
  await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key,active) VALUES('bar-join','fanta-lucas-a','fanta-lucas-a:main','bar-join',true)");
  const bar={id:'bar-join',members:[{uid:'u1'}]},user={id:'u2',name:'Secondo mister'},c=await f.connect();
  try{
   assert.equal(await joinLinkedTeam(c,bar,user),'t2');
   bar.members.push({uid:'u2'});
   assert.equal(await joinLinkedTeam(c,bar,user),'t2');
   await assert.rejects(joinLinkedTeam(c,bar,{id:'u3',name:'Ospite'}),error=>error.status===409&&/completo/.test(error.message));
   assert.deepEqual((await c.query("SELECT user_id,manager FROM fanta.teams WHERE id='t2'")).rows,[{user_id:'u2',manager:'Secondo mister'}]);
   assert.equal(bar.nativeFantaLink.maxMembers,2);
  }finally{c.release();}
 }finally{await f.close();}
});
