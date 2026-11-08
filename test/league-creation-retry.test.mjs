import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixtureDb} from './fanta/helpers.mjs';import {membershipTransaction} from '../lib/db.mjs';import {createApi} from '../netlify/functions/api.mjs';
test('repeated paired creation reuses both leagues without changing existing members or imports',async()=>{
 const f=await fixtureDb();try{for(const file of ['012_random_leagues','016_league_creation_mode'])await f.db.exec(await fs.readFile(new URL('../netlify/database/migrations/'+file+'.sql',import.meta.url),'utf8'));
 const api=createApi({membershipTransact:fn=>membershipTransaction(fn,{connect:f.connect}),env:{}}),call=name=>api(new Request('https://example.test/api/create',{method:'POST',headers:{cookie:'sid=token1'},body:JSON.stringify({name,size:4,rosterMode:'empty'})}));
 const first=await call('DigiLega');assert.equal(first.status,200,await first.clone().text());const created=await first.json();
 await f.db.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',(SELECT jsonb_agg(l||'{"fantasyConnections":[{"competitionKey":"fantasy"}]}'::jsonb) FROM jsonb_array_elements(payload->'leagues') l))`);
 const retry=await call(' digilega '),again=await retry.json();assert.equal(retry.status,200);assert.equal(again.league,created.league);assert.equal(again.fantaLeague,created.fantaLeague);assert.equal(again.reused,true);
 const s=(await f.db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.equal(s.leagues.length,1);const chat=s.leagueChats[created.league];assert.equal(chat.sequence,1);assert.equal(chat.messages.length,1);assert.equal(chat.messages[0].system,true);assert.match(chat.messages[0].text,/Benvenuti/);assert.equal(s.leagues[0].fantasyConnections.length,1);assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.teams WHERE league_id=$1',[created.fantaLeague])).rows[0].n,4);
 }finally{await f.close();}
});
