import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb,apiFixture} from './fanta/helpers.mjs';
import {ingestFixture} from '../fanta/ingest.mjs';
import {voteConfig} from '../fanta/statistical-votes/config.mjs';
import {currentModelKey} from '../fanta/statistical-votes/repository.mjs';
import {rebuildVoteModel} from '../fanta/statistical-votes/rebuild.mjs';
import {completeWork} from '../lib/operations/calendar.mjs';
import {mergeInstallations} from '../lib/operations/store.mjs';
const now=()=>Date.parse('2026-11-02T18:00:00Z');
test('career input revision recomputes frozen fixtures while reusing role baselines and retaining prior vote audit',async()=>{
 const f=await fixtureDb();try{const raw=apiFixture(),prior=voteConfig({contextDataVersion:'before-careers'});for(const t of raw.players)for(const p of t.players)p.statistics[0].games.rating='6.5';
 await ingestFixture(raw,{connect:f.connect,config:prior,now,finalVerification:true});const oldKey=currentModelKey(prior),count=(await f.db.query('SELECT count(*)::int n FROM fanta.baselines')).rows[0].n;
 await f.db.query(`UPDATE fanta.players SET data=data||$1::jsonb WHERE api_id=3`,[JSON.stringify({careerContext:{birthDate:'2004-01-01',firstItalySeason:2026,verified:true}})]);
 const result=await ingestFixture(raw,{connect:f.connect,now,force:true,finalVerification:true});assert.ok(result.revisions>0);assert.notEqual(currentModelKey(voteConfig()),oldKey);assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.baselines')).rows[0].n,count);
 const votes=(await f.db.query('SELECT model_key,input FROM fanta.votes WHERE player_id=$1 ORDER BY id',['af:3'])).rows;assert.equal(votes[0].model_key,oldKey);assert.equal(votes.at(-1).input.context.marqueeEvidence.firstItalySeason,2026);
 const r=await rebuildVoteModel({connect:f.connect,provider:{get(){throw Error('Unexpected provider call');}},now,closedOnly:true,cachedOnly:true,auditPlayers:['af:3']});assert.equal(r.status,'complete');assert.equal(r.voteAudit[0].playerId,'af:3');assert.equal(r.voteAudit[0].contextEvidence.age,22);
 }finally{await f.close();}
});
test('cache-only rebuild reports incomplete input without provider calls or replacement of existing votes',async()=>{
 const f=await fixtureDb();try{const raw=apiFixture();await ingestFixture(raw,{connect:f.connect,now});const count=(await f.db.query('SELECT count(*)::int n FROM fanta.votes')).rows[0].n;await f.db.query("UPDATE fanta.fixtures SET data=data-'players',vote_model_key='old'");const r=await rebuildVoteModel({connect:f.connect,provider:{get(){throw Error('Unexpected provider call');}},now,closedOnly:true,cachedOnly:true});assert.deepEqual(r.unavailable,[777]);assert.equal(r.pending,1);assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.votes')).rows[0].n,count);
 }finally{await f.close();}
});
test('new revision cancels only queued obsolete rebuilds and continuation preserves safe scope and audit',()=>{
 const p={fixtures:[],jobs:[{id:'install:quasi-statistical-old',kind:'maintenance',operation:'rebuild-votes',status:'queued'},{id:'unrelated',status:'queued'}]};mergeInstallations(p,{jobs:[{id:'install:quasi-statistical-new',operation:'rebuild-votes',status:'queued'}]});assert.equal(p.jobs[0].status,'cancelled');assert.equal(p.jobs[1].status,'queued');
 const job={id:'manual-rebuild',kind:'maintenance',operation:'rebuild-votes',status:'running',nonce:'n',closedOnly:true,cachedOnly:true,batchSize:24,auditPlayers:['af:3']};const done=completeWork({fixtures:[],jobs:[job]},job,{ok:true,pending:12},{now:now()});const next=done.jobs.find(j=>j.id==='manual-rebuild:12');for(const k of ['closedOnly','cachedOnly','batchSize','auditPlayers'])assert.deepEqual(next[k],job[k]);
});
