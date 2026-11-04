import test from 'node:test';import assert from 'node:assert/strict';
import {identityKey,normalizePersonName,VERIFIED_IDENTITIES,selectIdentityEntry} from '../fanta/player-identities.mjs';
import {inspectPlayerIdentities} from '../fanta/identity-maintenance.mjs';
import {fixtureDb} from './fanta/helpers.mjs';
test('identity normalization handles accents, punctuation, Scandinavian and Turkish letters without changing display names',()=>{
 for(const [a,b]of [['Éderson D.S.',' ederson d s '],['Kenan Yıldız','Kenan Yildiz'],['Leo Østigård','Leo Ostigard'],['Christ Inao Oulaï','Christ Inao Oulai'],['Gonçalves','Goncalves'],['Guðmundsson','Gudmundsson']])assert.equal(identityKey(a),identityKey(b));
 assert.equal(normalizePersonName('  Éderson   D.S. '),'ederson d s');assert.equal(VERIFIED_IDENTITIES.length,11);assert.equal(new Set(VERIFIED_IDENTITIES.map(p=>p.apiId)).size,11);
 const spec=VERIFIED_IDENTITIES.find(p=>p.name==='Vitinha O.'),entries=[{team:'SamBuca Juniors',name:'Vitinha O.',data:{}},{team:'Un altro bar',name:'Vitinha O.',data:{}}];assert.equal(selectIdentityEntry(spec,entries).length,1);
});
test('all eleven verified identities persist, Yildiz gets Juventus, repeat/import preserve mappings and historical records',async()=>{
 const {repairPlayerIdentities}=await import('../fanta/identity-maintenance.mjs'),{importRosters}=await import('../docs/history/legacy-data-tools/rosters.mjs'),{resolveLeagueBindings}=await import('../fanta/player-identities.mjs');
 const f=await fixtureDb();try{
  await f.db.query("UPDATE fanta.leagues SET source_key='lucas-bar:548867'");const names=[...new Set(VERIFIED_IDENTITIES.map(p=>p.team))];for(const[i,name]of names.entries()){if(i<2)await f.db.query('UPDATE fanta.teams SET name=$2 WHERE id=$1',['t'+(i+1),name]);else await f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES($1,'fanta-lucas-a',$2,'')",['t'+(i+1),name]);}
  for(const spec of VERIFIED_IDENTITIES)await f.db.query("INSERT INTO fanta.roster_entries VALUES('fanta-lucas-a',$1,$2,$3,'A',9,NULL,$4)",['t'+(names.indexOf(spec.team)+1),'source-'+spec.apiId,spec.name,JSON.stringify({originalName:spec.name,club:'Club 1',aliases:['legacy-'+spec.apiId]})]);
  await f.db.query("UPDATE fanta.rounds SET deadline='2000-01-01'");await f.db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,source_data) VALUES('fanta-lucas-a',1,'t3','4-4-2','[\"legacy-339883\"]','[]',$1)",[JSON.stringify({players:[{id:'legacy-339883',name:'Yildiz'}]})]);const before=(await f.db.query('SELECT * FROM fanta.lineups')).rows;
  const provider={calls:0,get:async path=>{provider.calls++;const team=Number(path.split('=')[1]);return {response:[{team:{id:team,name:team===496?'Juventus':'Lazio'},players:[{id:team===496?339883:2799,name:'Verified'}]}]};}};
  const report=await repairPlayerIdentities({connect:f.connect,provider});assert.equal(report.linked,11);assert.equal(report.conflicts.length,0);assert.equal(report.protectedUnchanged,true);
  assert.equal((await f.db.query('SELECT club_id FROM fanta.players WHERE api_id=339883')).rows[0].club_id,'af:496');assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups')).rows,before);
  const state=resolveLeagueBindings({players:[{id:'af:339883',clubId:'af:496'}],lineups:structuredClone(before),bindings:(await f.db.query('SELECT * FROM fanta.player_bindings')).rows});assert.equal(state.lineups[0].starters[0],'af:339883');assert.equal(before[0].starters[0],'legacy-339883');
  await repairPlayerIdentities({connect:f.connect,provider});assert.equal((await f.db.query('SELECT count(*)::int AS n FROM fanta.player_bindings')).rows[0].n,11);
  const parsed={digest:'identity-repeat',teams:names.map(name=>({name,total:VERIFIED_IDENTITIES.filter(s=>s.team===name).length*9,players:VERIFIED_IDENTITIES.filter(s=>s.team===name).map(s=>({name:s.name,role:'A',price:9}))}))};await importRosters(parsed,{connect:f.connect});const rows=(await f.db.query('SELECT name,player_id,price FROM fanta.roster_entries')).rows;assert.equal(rows.length,11);for(const s of VERIFIED_IDENTITIES)assert.equal(rows.find(r=>r.name===s.name)?.player_id,'af:'+s.apiId);assert.ok(rows.every(r=>r.price===9));assert.deepEqual((await f.db.query('SELECT * FROM fanta.lineups')).rows,before);assert.equal((await importRosters(parsed,{connect:f.connect})).cached,true);
  await f.db.query("UPDATE fanta.roster_entries SET player_id='p1-0' WHERE name='Oulai'");const conflict=await repairPlayerIdentities({connect:f.connect,provider});assert.equal(conflict.conflicts.find(x=>x.name==='Oulai').reason,'different-persistent-association-preserved');assert.equal((await f.db.query("SELECT player_id FROM fanta.roster_entries WHERE name='Oulai'")).rows[0].player_id,'p1-0');
 }finally{await f.close();}
});
test('targeted identity audit is read-only and does not perform remote requests unless requested',async()=>{
 const f=await fixtureDb();try{await f.db.query("UPDATE fanta.leagues SET source_key='lucas-bar:548867' WHERE id='fanta-lucas-a'");await f.db.query("UPDATE fanta.teams SET name='Hellas Madonna' WHERE id='t1'");await f.db.query(`INSERT INTO fanta.roster_entries VALUES('fanta-lucas-a','t1','source-yildiz','Yildiz','A',9,NULL,'{"club":"","originalName":"Yildiz"}')`);
  const before=await f.db.query('SELECT * FROM fanta.roster_entries');let remote=0,writes=0;const connect=async()=>{const c=await f.connect();return {query:(sql,...args)=>{if(/^(UPDATE|INSERT|DELETE)/.test(sql))writes++;return c.query(sql,...args);},release:()=>c.release()};};
  const report=await inspectPlayerIdentities({connect,provider:{get:()=>{remote++;throw Error('No request');}}});assert.equal(report.targets.length,11);assert.equal(report.targets.find(p=>p.spec.apiId===339883).entries[0].source_id,'source-yildiz');assert.equal(remote,0);assert.equal(writes,0);assert.deepEqual((await f.db.query('SELECT * FROM fanta.roster_entries')).rows,before.rows);
 }finally{await f.close();}
});
