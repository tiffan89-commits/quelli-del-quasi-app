import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {leagueView} from '../fanta/views.mjs';
import {linkedInvite,renderLeagueInvite} from '../public/src/fanta/league-invite.mjs';
test('bots do not occupy human invitation places; only the president sees a working linked-Bar invite',async()=>{
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET max_members=2 WHERE id='fanta-lucas-a'");await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");const store=sqlFantaStore(f);
  const own=await store.league('u1','fanta-lucas-a',s=>leagueView(s,'u1'));
  assert.equal(own.league.humanMembers,1);assert.equal(own.league.availableTeams,1);
  const bars=[{name:'Bar sintetico',code:'CODE-TEST',nativeFantaLink:{leagueId:'fanta-lucas-a'}}],invite=linkedInvite(own.league,bars);
  assert.equal(invite.url,'https://quellidelquasi.com/invito/CODE-TEST');assert.match(renderLeagueInvite(own.league,invite),/Invita nella lega/);assert.match(renderLeagueInvite(own.league,invite),/wa\.me/);
  assert.equal(linkedInvite({...own.league,role:'member'},bars),null);assert.equal(renderLeagueInvite({...own.league,role:'member'},invite),'');
  await f.db.query("UPDATE fanta.teams SET user_id='u2' WHERE id='t2'");const full=await store.league('u1','fanta-lucas-a',s=>leagueView(s,'u1'));assert.equal(full.league.availableTeams,0);assert.equal(linkedInvite(full.league,bars),null);assert.equal(renderLeagueInvite(full.league,invite),'');
 }finally{await f.close();}
});
