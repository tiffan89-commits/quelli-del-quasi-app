import test from 'node:test';import assert from 'node:assert/strict';
import {describePerformance,NARRATIVE_VERSION} from '../fanta/statistical-votes/narrative.mjs';
import {refreshVoteNarratives} from '../fanta/statistical-votes/refresh-narratives.mjs';
import {fixtureDb,apiFixture} from './fanta/helpers.mjs';
import {ingestFixture} from '../fanta/ingest.mjs';
import {currentModelKey} from '../fanta/statistical-votes/repository.mjs';
test('high grades lead with concrete impact and keep weaknesses as a secondary final observation',()=>{
 const input={id:'af:335056',fixtureId:'af:1550177',name:'Diego Moreira',onField:true,final:true,club:'AC Milan',opponent:'Inter',events:{goals:1,assists:2},metrics:{duelsTotal:12,duelsWon:3},fixture:{teamSide:'home',teams:{home:{name:'AC Milan'},away:{name:'Inter'}},score:{home:3,away:1}}};
 const data={vote:7.5,individual:{blocks:[{key:'duels',observed:true,delta:-.8},{key:'creation',observed:true,delta:.2}]},context:{marquee:{delta:.72,youngDebut:true}},goalSupport:{count:1,anchor:{types:[]}}};
 const why=describePerformance(input,data);assert.match(why,/Un gol e 2 assist/);assert.match(why,/partita di cartello/);assert.match(why,/prova buona/);assert.ok(why.split(/\s+/).length<75);assert.ok(why.indexOf('assist')<0||!why.includes('duelli')||why.indexOf('assist')<why.indexOf('duelli'));assert.doesNotMatch(why,/0\.72|Fatica a imporsi|voto tecnico/);assert.equal(why,describePerformance(input,data));
});
test('editorial refresh changes only text fields, is bounded and idempotent, and retains historical revisions',async()=>{
 const f=await fixtureDb();try{
 await ingestFixture(apiFixture(),{connect:f.connect,now:()=>Date.parse('2026-11-02T18:00Z')});
 await f.db.query(`UPDATE fanta.votes SET data=(data-'narrativeVersion')||'{"why":"old comment"}'::jsonb`);
 const before=(await f.db.query('SELECT * FROM fanta.votes ORDER BY id')).rows;
 const r=await refreshVoteNarratives(f.db,{key:currentModelKey(),limit:1});assert.equal(r.updated,1);assert.ok(r.pending>0);
 await refreshVoteNarratives(f.db,{key:currentModelKey()});const after=(await f.db.query('SELECT * FROM fanta.votes ORDER BY id')).rows;
 for(let i=0;i<before.length;i++){const a=structuredClone(before[i]),b=structuredClone(after[i]);if(a.data.vote!=null){assert.notEqual(b.data.why,'old comment');assert.equal(b.data.narrativeVersion,NARRATIVE_VERSION);delete a.data.why;delete b.data.why;delete b.data.narrativeVersion;}assert.deepEqual(b,a);}
 assert.equal((await refreshVoteNarratives(f.db,{key:currentModelKey()})).updated,0);
 }finally{await f.close();}
});
