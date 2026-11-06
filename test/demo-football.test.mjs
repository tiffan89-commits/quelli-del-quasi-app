import test from 'node:test';import assert from 'node:assert/strict';
import {DEMO_FOOTBALL} from '../public/src/fanta/demo-football-data.mjs';
import {demoMarketPlayers,demoMatchData,demoLineups} from '../public/src/fanta/demo-football.mjs';
import {rosterOf,matchupFor} from '../public/src/fanta/dati-finti-giornata.mjs';
import {TEAMS} from '../public/src/fanta/squadre-finte.mjs';
import {getDemoSession,resetDemoSession} from '../public/src/demo-session.mjs';
import {staticEncoding} from '../runtime/server.mjs';
test('demo snapshot has 240 unique real identities, correct roles, numbers and unchanged archived votes',async()=>{
 const identities=new Map(DEMO_FOOTBALL.players.map(p=>[p.apiId,p]));assert.equal(identities.size,240);
 const roster=Object.keys(TEAMS).flatMap(rosterOf);assert.equal(roster.length,200);assert.equal(new Set([...roster,...demoMarketPlayers()].map(p=>p.apiId)).size,240);
 for(const p of roster){const real=identities.get(p.apiId);assert.equal(p.name,real.name);assert.equal(p.club,real.club);assert.equal(p.role,real.role);assert.equal(p.jersey,real.jersey);}
 const sheet=matchupFor(DEMO_FOOTBALL.meta.round,null,'calcolata');for(const side of [sheet.home,sheet.away])for(const p of [...side.starters,...side.bench]){const archived=identities.get(p.apiId).performance;assert.equal(p.vote,archived?.vote??null);assert.equal(p.fantavote,archived?.fantavote??null);}
 assert.doesNotMatch(JSON.stringify(DEMO_FOOTBALL),/https?:|photoUrl|password|email|token|media\.api-sports/);
});
test('both demo apps use the static final results and official shirts without any API or database reads',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{assert.fail('Unexpected demo network request');};
 try{resetDemoSession();const s=getDemoSession();await s.ready;const past=s.bar.state.leagues[0].rounds.find(r=>r.source==='seriea'&&r.number===DEMO_FOOTBALL.meta.round);assert.equal(past.matches.length,10);for(const f of DEMO_FOOTBALL.fixtures.filter(f=>f.round===DEMO_FOOTBALL.meta.round)){const m=past.matches.find(m=>m.home===f.teams.home.name&&m.away===f.teams.away.name);assert.deepEqual(m.score,[f.goals.home,f.goals.away]);assert.equal(demoMatchData(f).lineups.kind,'official');}await s.fanta.team('lega-quasi');await s.fanta.home('lega-quasi');}finally{globalThis.fetch=previous;resetDemoSession();}
});
test('precompressed static files honor q=0 and negotiate Brotli and gzip without changing API responses',()=>{assert.equal(staticEncoding('gzip, br'),'br');assert.equal(staticEncoding('br;q=0, gzip'),'gzip');assert.equal(staticEncoding('br;q=0,gzip;q=0'),null);assert.equal(staticEncoding(''),null);});
test('final demo pitches keep official coordinates and show actual archived grades and substitutions',()=>{
 let grades=0,substitutes=0;for(const f of DEMO_FOOTBALL.fixtures.filter(f=>f.round===DEMO_FOOTBALL.meta.round)){const lineup=demoLineups(f);assert.equal(lineup.started,true);for(const t of lineup.teams)for(const p of [...t.players,...t.bench]){if(Number.isFinite(p.grade)){grades++;assert.equal(p.grade,DEMO_FOOTBALL.players.find(real=>real.apiId===p.id).performance.vote);}if(p.substitution?.in)substitutes++;}for(let i=0;i<2;i++)for(const p of lineup.teams[i].players)assert.equal(p.grid,f.lineups[i].startXI.find(x=>x.player.id===p.id).player.grid);}assert.ok(grades>100);assert.ok(substitutes>10);
});
