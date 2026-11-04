import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';import {queueFantaNotifications} from '../fanta/notifications.mjs';import {writeAutoLineups} from '../fanta/auto-lineups.mjs';import {computeRounds} from '../fanta/ingest.mjs';
test('Lucas deactivation removes only its Bar from active data, preserves native history, denies all access and stops background work',async()=>{
 const f=await fixtureDb();try{
 await f.db.exec(await fs.readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8'));
 const bar='08094400244a08070612e18a',keep={id:'keep',name:'Quelli del quasi',members:[{uid:'u1',credits:500}]},lucas={id:bar,name:'LucAs Bar',members:[{uid:'u1',credits:400}]},round={id:'old-round',league:bar,slips:[{uid:'u1',stake:10}]},other={id:'keep-round',league:'keep',slips:[]};
 await f.db.query(`UPDATE fanta_state SET payload=payload||$1::jsonb`,[JSON.stringify({leagues:[lucas,keep],rounds:[round,other],ledger:[{league:bar,amount:-10},{league:'keep',amount:4}]})]);
 await f.db.query("UPDATE fanta.leagues SET source_key='lucas-bar:548867',auto_lineups_from=now()");
 await f.db.query(`INSERT INTO fanta.notifications(id,user_id,kind,data,expires_at) VALUES('queued-lucas','u1','results','{"league":"fanta-lucas-a"}',now()+interval '1 day')`);
 const before={};for(const table of ['teams','rosters','rounds','matchups','results','lineups','sales'])before[table]=(await f.db.query('SELECT * FROM fanta.'+table)).rows;
 const sql=await fs.readFile(new URL('../netlify/database/migrations/015_disable_lucas.sql',import.meta.url),'utf8');await f.db.exec(sql);
 const state=(await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;assert.deepEqual(state.leagues,[keep]);assert.deepEqual(state.rounds,[other]);assert.deepEqual(state.ledger,[{league:'keep',amount:4}]);assert.equal(state.lucasDeactivationReceipt.nativeDisabled,true);
 const archive=(await f.db.query("SELECT data FROM fanta.cutover_archive WHERE id='disable-lucas-a-v1'")).rows[0].data;assert.deepEqual(archive.leagues,[lucas]);assert.deepEqual(archive.rounds,[round]);
 for(const table of Object.keys(before))assert.deepEqual((await f.db.query('SELECT * FROM fanta.'+table)).rows,before[table],table);
 const store=sqlFantaStore(f),api=createFantaApi({store}),call=(path,body)=>api(new Request('https://example.test/fanta-api/'+path,{method:body?'POST':'GET',headers:{cookie:'sid=token1'},...(body?{body:JSON.stringify({league:'fanta-lucas-a',...body})}:{})}));
 assert.deepEqual(await store.leagues('u1'),[]);for(const [path,body]of [['league?league=fanta-lucas-a'],['auction?league=fanta-lucas-a'],['auction/start-now',{mode:'manual'}],['auction/tick',{}],['lineup',{round:1}]])assert.equal((await call(path,body)).status,403,path);
 assert.equal(await computeRounds({connect:f.connect,recalculate:true}),0);await queueFantaNotifications({connect:f.connect});const c=await f.connect();try{assert.equal((await writeAutoLineups(c,{initial:true})).saved,0);}finally{c.release();}
 assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.notifications')).rows[0].n,1);
 await f.db.exec(sql);assert.deepEqual((await f.db.query("SELECT data FROM fanta.cutover_archive WHERE id='disable-lucas-a-v1'")).rows[0].data,archive,'archive is never overwritten on retry');
 }finally{await f.close();}
});
