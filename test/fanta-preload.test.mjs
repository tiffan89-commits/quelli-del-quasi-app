import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';
import {refreshReferences,comparisonView} from '../docs/history/legacy-data-tools/comparison.mjs';
test('Fanta: remote preload copies only the selected league evidence, excludes secrets and does not rewrite unchanged snapshots or the Bar',async()=>{
 const f=await fixtureDb();try{const payload=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;
 payload.fantasyConnections=[{alias:'lucas-bar',competitionId:548867,owner:'u1',season:2026,competitionName:'Lega sintetica',session:{cookies:'never-copy'},credentialsCipher:'never-copy',teamIdentities:{A:1,B:2},rounds:[{number:1,matches:[{home:'A',away:'B',score:[2,1]}]}]},{alias:'another',competitionId:548867,owner:'u1',rounds:[]}];
 await f.db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(payload)]);
 const sql=await fs.readFile(new URL('../docs/history/legacy-data-tools/preload.sql',import.meta.url),'utf8');await f.db.exec(sql);const row=(await f.db.query('SELECT * FROM fanta.import_sources')).rows[0];assert.equal(row.data.rounds.length,1);assert.equal(JSON.stringify(row).includes('never-copy'),false);
 await f.db.exec(sql);assert.deepEqual((await f.db.query('SELECT * FROM fanta.import_sources')).rows[0],row);assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload,payload);
 }finally{await f.close();}
});

test('Fanta: published external scores remain separate from our calculation, update only on changes, and expose honest deltas',async()=>{
 const f=await fixtureDb();try{
  const payload=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;payload.fantasyConnections=[{alias:'lucas-bar',competitionId:548867,owner:'u1',rounds:[{number:1,calculated:true,matches:[{home:'Squadra 1',away:'Squadra 2',score:[1,2],fantasyPoints:[70,72.5]}]}]}];await f.db.query('UPDATE fanta_state SET payload=$1',[JSON.stringify(payload)]);await f.db.query("UPDATE fanta.leagues SET source_key='lucas-bar:548867'");
  await f.db.query("INSERT INTO fanta.results(matchup_id,data) VALUES('m1',$1)",[JSON.stringify({home:{points:74},away:{points:69}})]);
  assert.equal(await refreshReferences({connect:f.connect}),1);assert.equal(await refreshReferences({connect:f.connect}),0);
  const reference=(await f.db.query("SELECT data FROM fanta.reference_results WHERE matchup_id='m1'")).rows[0].data,ours=(await f.db.query("SELECT data FROM fanta.results WHERE matchup_id='m1'")).rows[0].data;assert.equal(ours.home.points,74);
  const comparison=comparisonView(reference,{total:74},{total:69});assert.equal(comparison.home.delta,4);assert.equal(comparison.away.delta,-3.5);assert.equal(comparisonView(reference,{total:70},{total:72.5},{historical:true}).home.ours,null);
 }finally{await f.close();}
});
