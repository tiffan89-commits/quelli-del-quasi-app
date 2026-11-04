import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb} from './fanta/helpers.mjs';
import {careerImportSQL} from '../scripts/build-career-import.mjs';
test('career staging and metadata import is idempotent and preserves squads, votes and manual identities',async()=>{
 const f=await fixtureDb();try{
 const p={apiId:100,profile:{name:'Different provider spelling',birth:{date:'2004-01-01'},position:'Defender'},careerContext:{birthDate:'2004-01-01',firstItalySeason:2026,verified:true},seasonStatistics:[],careerTeams:[],currentTeam:{id:489,name:'AC Milan'}};
 // Fixture catalog player p1-0 has provider ID 100 and position P, which must survive.
 const before=(await f.db.query("SELECT * FROM fanta.players WHERE api_id=100")).rows[0];const rosters=(await f.db.query('SELECT * FROM fanta.rosters ORDER BY player_id')).rows;
 const sql=careerImportSQL({source:'API-FOOTBALL',season:2026,acquiredAt:'2026-11-02T12:00:00Z',players:[p]});await f.db.exec(sql);await f.db.exec(sql);
 const after=(await f.db.query('SELECT * FROM fanta.players WHERE api_id=100')).rows[0];assert.equal(after.id,before.id);assert.equal(after.name,before.name);assert.equal(after.role,before.role);assert.equal(after.club_id,before.club_id);assert.equal(after.data.careerContext.firstItalySeason,2026);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.player_career_imports')).rows[0].n,1);assert.deepEqual((await f.db.query('SELECT * FROM fanta.rosters ORDER BY player_id')).rows,rosters);
 assert.equal((await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload.careerImportReceipt.players,1);
 }finally{await f.close();}
});
