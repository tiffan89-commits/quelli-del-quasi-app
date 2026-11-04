import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../lib/db.mjs';
import {ensureCalendar} from '../lib/calendar.mjs';
import {loadMatchDetails,applyMatchSummary,collectLiveDetails} from '../lib/match-data.mjs';
function fixture(){const s=emptyState(),m=ensureCalendar(s).rounds[0].matches[0];m.status='FT';m.espnId='123';return {s,m};}
function summary(m,completed=true){return {header:{competitions:[{competitors:[{homeAway:'home',team:{displayName:m.home}},{homeAway:'away',team:{displayName:m.away}}],status:{type:{completed}}}]},keyEvents:[{scoringPlay:true,clock:{displayValue:"12'",value:720},team:{displayName:m.home,homeAway:'home'},participants:[{athlete:{displayName:'Marcatore'}}]},{yellowCard:true,clock:{displayValue:"30'",value:1800},team:{displayName:m.away,homeAway:'away'},participants:[{athlete:{displayName:'Ammonito'}}]},{redCard:true,clock:{displayValue:"70'",value:4200},team:{displayName:m.away,homeAway:'away'},participants:[{athlete:{displayName:'Espulso'}}]}]};}
test('final complete ESPN details persist scorers and cards and repeated reads make zero external requests',async()=>{
 const {s,m}=fixture();let calls=0,lineups=0;const fetcher=async()=>{calls++;return summary(m);},lineupFetcher=async()=>{lineups++;throw Error('No extra call');};
 await loadMatchDetails(s,m.id,fetcher,new Date(),lineupFetcher);assert.equal(calls,1);assert.equal(lineups,0);assert.equal(m.details.complete,true);assert.deepEqual(m.details.events.map(e=>e.kind),['goal','yellow','red']);
 const restored=structuredClone(s);for(let i=0;i<4;i++){const result=await loadMatchDetails(restored,m.id,()=>{throw Error('Must use DB');},new Date(Date.now()+(i+1)*86400000),()=>{throw Error('Must use DB');});assert.equal(result.cached,true);}
 const cache=restored.football.calendar.rounds.flatMap(r=>r.matches).find(x=>x.id===m.id);assert.equal(cache.details.events[0].players[0],'Marcatore');
 await collectLiveDetails(restored.football,[],()=>{throw Error('Final match must be excluded');},new Date(m.kickoff));
});
test('missing final confirmation or missing event data cannot freeze an incomplete tabellino',()=>{
 const {s,m}=fixture();applyMatchSummary(s,m,summary(m,false));assert.equal(m.details.complete,false);const noEvents=summary(m,true);delete noEvents.keyEvents;applyMatchSummary(s,m,noEvents);assert.equal(m.details.complete,false);
 const zeroEvents=summary(m,true);zeroEvents.keyEvents=[];m.details=null;applyMatchSummary(s,m,zeroEvents);assert.equal(m.details.complete,true);assert.deepEqual(m.details.events,[]);
});

test('calendar detail reads use only cached data even for a live or unarchived match',async()=>{const s=emptyState();ensureCalendar(s);const match=s.football.calendar.rounds[0].matches[0];match.status='LIVE';let calls=0;const result=await loadMatchDetails(s,match.id,async()=>{calls++;throw Error('must not fetch');},new Date(),async()=>{calls++;throw Error('must not fetch');},true);assert.equal(result.cached,true);assert.equal(calls,0);});
