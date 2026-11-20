import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProbablePitches} from '../lib/probable-pitch-layout.mjs';
import {publicLineups,consensusLineups} from '../lib/lineup-consensus.mjs';
import {enrichPresence} from '../lib/lineup-presence.mjs';
import {canonicalPitchRows} from '../public/src/pitch-layout.mjs';
import {emptyState} from '../lib/db.mjs';
import {session} from '../lib/game.mjs';
import {createApi} from '../netlify/functions/api.mjs';

const team={team:'Juventus',formation:'3-4-1-2',players:['Vicario','Kalulu','Bremer','Lucumì','McKennie','Koopmeiners','Douglas Luiz','Cabal','Alajbegovic','Woltemade','Kolo Muani'].map((name,i)=>({name,apiId:i+1,probability:70})),bench:[]};
const legacy=source=>({kind:'probable',source,sourceUrl:'https://private.example/source',sources:[source],teams:[structuredClone(team),{...structuredClone(team),team:'Inter',side:'away'}]});
const flank=t=>canonicalPitchRows(t)[2].map(p=>p.name);
const expected=['Cabal','Douglas Luiz','Koopmeiners','McKennie'];

test('legacy editorial directions survive privacy redaction, for both sides and all cached sources',()=>{
 for(const source of ['Confronto probabili','Sky Sport','SOS Fanta','La Gazzetta dello Sport','Corriere dello Sport']){
  const input=legacy(source),before=structuredClone(input),safe=publicLineups(input);
  assert.equal(safe.source,undefined);assert.equal(safe.sourceUrl,undefined);assert.equal(safe.sources,undefined);
  for(const t of safe.teams){assert.deepEqual(flank(t),expected);assert.equal(t.players.find(p=>p.name==='McKennie').grid,'3:4');assert.equal(t.players.find(p=>p.name==='Cabal').grid,'3:1');assert.ok(t.players.every(p=>p.probability===70));}
  assert.deepEqual(publicLineups(safe),safe);assert.deepEqual(input,before);
  assert.deepEqual(enrichPresence(safe,[]).teams.map(canonicalPitchRows),enrichPresence(input,[]).teams.map(canonicalPitchRows));
 }
});

test('cached sources are canonical before consensus and repeated estimation does not reverse them again',()=>{
 const a=legacy('Sky Sport'),b=legacy('SOS Fanta');
 const out=consensusLineups([a,b]);for(const t of out.teams)assert.deepEqual(flank(t),expected);
 const enriched=enrichPresence(out,[]),again=enrichPresence(publicLineups(enriched),[]);
 assert.deepEqual(enriched.teams,again.teams);assert.deepEqual(flank(again.teams[0]),expected);
 const official={...a,kind:'official'},fantasy={...a,kind:'fantasy'};
 assert.equal(normalizeProbablePitches(official),official);assert.equal(normalizeProbablePitches(fantasy),fantasy);
 const explicit=normalizeProbablePitches(a);explicit.source='other';explicit.teams.forEach(t=>t.players.reverse());
 assert.deepEqual(flank(publicLineups(explicit).teams[0]),expected);
});

test('match API returns canonical probable coordinates even when optional DB enrichment is unavailable',async()=>{
 const state=emptyState();state.users.push({id:'u',emailVerified:true});const token=session(state,'u');
 state.football.calendar={season:2026,rounds:[{number:11,matches:[{id:'fixture',home:'Juventus',away:'Inter',status:'NS',lineups:legacy('Confronto probabili')}]}]};
 const api=createApi({transact:async fn=>fn(state),playerStore:{catalog:async()=>[]}});
 const response=await api(new Request('https://example.test/api/match?id=fixture',{headers:{cookie:'sid='+token}}));
 assert.equal(response.status,200);const data=await response.json();assert.deepEqual(flank(data.lineups.teams[0]),expected);assert.equal(data.lineups.source,undefined);
});
