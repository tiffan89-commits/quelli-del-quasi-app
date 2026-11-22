import {beginBackgroundWrite} from './background-db.mjs';
import {connection} from '../db.mjs';
import {settle} from '../game.mjs';
import {compensateSettlement} from '../settlement-corrections.mjs';
import {isDeepStrictEqual} from 'node:util';
import {readBarRows,readCalendarFixtures,refreshCachedFootballMatches,writeBarRows,writeCalendarFixtures} from './bar-rows.mjs';

// Calculate from the affected matches and slips, then merge into the locked row.
export async function patchSports(ids,apply,{connect=connection,sportsStorage='snapshot',includeForecastMetadata=false,forecastOnly=false,persistRelated}={}){
 const c=await connect();try{
  await beginBackgroundWrite(c);await c.query('SELECT pg_advisory_xact_lock(826501)');
  const rowStorage=sportsStorage==='rows';
  const s=rowStorage?{
   ...await readBarRows(c,{fixtureIds:ids,detailFixtureIds:ids}),
   football:{calendar:await readCalendarFixtures(c,ids)},
  }:(await c.query(`SELECT jsonb_build_object(
   'football',jsonb_build_object('calendar',jsonb_build_object('season',payload#>'{football,calendar,season}','rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('number',r->'number','matches',(SELECT jsonb_agg(m) FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])))),'[]'::jsonb) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[]))))),
   'rounds',(SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[]))),
   'leagues',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l->'id','members',l->'members','removedMembers',l->'removedMembers')),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l), 'ledger','[]'::jsonb
  ) AS payload FROM fanta_state WHERE id=1`,[ids])).rows[0]?.payload;
  if(!s)throw Error('Sports state unavailable');
  const previous=structuredClone(s);
  const oldMatches=new Map(previous.football.calendar.rounds.flatMap(r=>r.matches).map(m=>[m.id,m]));
  const oldRounds=new Map(previous.rounds.map(r=>[r.id,r]));
  const oldLeagues=new Map(previous.leagues.map(l=>[l.id,l]));
  const result=apply(s);
  if(result?.then)throw Error('Network and asynchronous work forbidden inside sports transaction');
  const matches=s.football.calendar.rounds.flatMap(r=>r.matches),map=new Map(matches.map(m=>[m.id,m]));
  const fields=forecastOnly?['lineups','lineupCheckedAt']:['lineups','kickoff','officialKickoff','status','score','liveScore','clock','phase','clockUpdatedAt','scoreUpdatedAt','officialConfirmed','scoreVerifiedAt','liveSource','details','apiFootballDigest','apiFootballId','apiFootballCheckedAt','apiFootballFinalAt'];
  if(includeForecastMetadata&&!forecastOnly)fields.push('espnId','detailCheckedAt','detailError','lineupCheckedAt','cacheAttemptAt','scoreSource');
  for(const r of s.rounds){for(const m of r.matches){const source=map.get(m.id);if(source&&!(r.settled&&source.storedDataClosure&&!source.officialConfirmed))for(const k of fields)if(source[k]!==undefined)m[k]=source[k];}if(forecastOnly)continue;const l=s.leagues.find(l=>l.id===r.league);if(!l)continue;if(r.settled)compensateSettlement(s,l,r);else settle(s,l,r);}
  // Persist the need for follow-up in the same transaction as credits and scores.
  if(rowStorage&&!forecastOnly)for(const round of s.rounds){
   const before=oldRounds.get(round.id);
   if(!round.settled||!before)continue;
   if(!before.settled||round.settlementBasis!==before.settlementBasis||
     !isDeepStrictEqual(round.slips,before.slips))round.sportsDerivedPending=true;
  }
  const derive=!forecastOnly&&s.rounds.some(r=>r.settled&&(rowStorage?
   r.sportsDerivedPending||r.rewardVersion!==1&&r.matches.some(m=>!m.void):
   !isDeepStrictEqual(oldRounds.get(r.id),r)));
  const changed=!isDeepStrictEqual(previous,s);
  if(changed&&rowStorage){
   const changedIds=await writeCalendarFixtures(c,matches,oldMatches);
   await refreshCachedFootballMatches(c,changedIds);
   await writeBarRows(c,previous,s);
  }else if(changed){
   const roundUpdates=new Map(s.rounds.map(r=>[r.id,r]));
   const leagueUpdates=new Map(s.leagues.filter(l=>!isDeepStrictEqual(oldLeagues.get(l.id),l)).map(l=>[l.id,l]));
   // JSONB updates are merged while holding the existing game advisory lock;
   // concurrent auth and chat fields are never replaced by a stale snapshot.
   // Merge the latest sports sections under the row lock. Multiple nested
   // JSONB updates copy the full snapshot and can exhaust PostgreSQL memory.
   const {rows:[current]}=await c.query('SELECT payload FROM fanta_state WHERE id=1 FOR UPDATE');
   const sections=current?.payload;
   if(!sections)throw Error('Sports state unavailable');
   const replaceMatches=items=>items.map(match=>map.get(match.id)??match);
   for(const round of sections.football.calendar.rounds)round.matches=replaceMatches(round.matches);
   for(const round of Object.values(sections.football.rounds??{})){
    if(Array.isArray(round.matches))round.matches=replaceMatches(round.matches);
   }
   sections.rounds=(sections.rounds??[]).map(round=>roundUpdates.get(round.id)??round);
   sections.leagues??=[];
   for(const league of sections.leagues){
    const changes=leagueUpdates.get(league.id);
    if(changes){league.members=changes.members;league.removedMembers=changes.removedMembers??[];}
   }
   sections.ledger=(sections.ledger??[]).concat(s.ledger);
   await c.query('UPDATE fanta_state SET payload=$1::jsonb WHERE id=1',[JSON.stringify(sections)]);
  }
  const accuracyMatches=matches.filter(m=>{const old=oldMatches.get(m.id);return m.lineups?.kind==='official'&&(!isDeepStrictEqual(m.lineups,old?.lineups)||m.status!==old?.status||m.kickoff!==old?.kickoff);});
  await persistRelated?.(c,result);
  await c.query('COMMIT');return {result,matches,accuracyMatches,changed,derive};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
