import {visibleBarRounds} from './bar-fanta-access.mjs';
import {roundClosed, fail} from './game.mjs';
import {accountTotals} from './community.mjs';
import {fantasyRanking} from './bar-fanta-rankings.mjs';
import {progressionFor} from './progression.mjs';

export const LIVE_MATCH_KEYS = ['id','kickoff','status','score','liveScore','clock','phase','officialConfirmed','void','clockUpdatedAt','scoreUpdatedAt','fantasyPoints'];
const result = m => ({...Object.fromEntries(LIVE_MATCH_KEYS.map(k => [k,m[k] ?? null])),detailRevision:m.details?.at||m.detailRevision||null,
  ...(m.status==='LIVE'||m.scoreUpdatedAt?.slice(0,10)===new Date().toISOString().slice(0,10)?Object.fromEntries(['statistics','penalties','playerStats'].filter(k=>m.details?.[k]!==undefined).map(k=>[k,m.details[k]])):{}),
  ...(m.status === 'LIVE' || m.status === 'FT' ? {events: m.details?.events || [], eventsAt: m.details?.updatedAt || null} : {})});

export function liveSnapshot(state, user, leagueId) {
  if (!user || (!user.demo && !user.emailVerified) || user.adminOnly) fail('Accedi con il tuo account di gioco',401);
  const league = state.leagues.find(l => l.id === leagueId && l.members.some(m => m.uid === user.id));
  if (!league) fail('Lega non accessibile',403);
  if(state.fantaAccessPolicy)state={...state,rounds:visibleBarRounds(state,league,user)};
  const progression = progressionFor(state,league,user.id);
  delete progression.objectives;
  return {
    league: league.id,
    members: league.members.map(m => ({uid:m.uid,points:m.points,credits:m.credits,...accountTotals(state,league,m)})),
    fantasyRanking: fantasyRanking(state,league),
    progression,
    rounds: state.rounds.filter(r => r.league === league.id).map(r => ({id:r.id,settled:!!r.settled,closed:roundClosed(r),slip:(()=>{const x=r.slips?.find(x=>x.uid===user.id);return x?{points:x.points,prize:x.prize,settled:x.settled,pointsSettled:x.pointsSettled,creditsSettled:x.creditsSettled}:null;})(),...(roundClosed(r)?{publicSlips:(r.slips||[]).map(({uid,picks,stake,points,prize,odds,pointsSettled,creditsSettled,settled})=>({uid,picks,stake,points,prize,odds,pointsSettled,creditsSettled,settled}))}:{}),matches:r.matches.map(result)})),
    calendar: (state.football.calendar?.rounds || []).flatMap(r => r.matches.map(result)),
    standings: state.football.standings || null,
  };
}

// Whitelist the DB fields: no portraits, formations, HTML, odds models or source sessions.
const matchKeys = LIVE_MATCH_KEYS.map(k => `'${k}',m->'${k}'`).join(',')+",'detailRevision',coalesce(m#>'{details,at}',m->'detailRevision')";
const matchDetails = `'events',m#>'{details,events}','updatedAt',m#>'{details,updatedAt}','statistics',CASE WHEN m->>'status'='LIVE' OR left(m->>'scoreUpdatedAt',10)=to_char(now() at time zone 'UTC','YYYY-MM-DD') THEN m#>'{details,statistics}' END,'penalties',CASE WHEN m->>'status'='LIVE' OR left(m->>'scoreUpdatedAt',10)=to_char(now() at time zone 'UTC','YYYY-MM-DD') THEN m#>'{details,penalties}' END,'playerStats',CASE WHEN m->>'status'='LIVE' OR left(m->>'scoreUpdatedAt',10)=to_char(now() at time zone 'UTC','YYYY-MM-DD') THEN m#>'{details,playerStats}' END`;
const matches = `SELECT coalesce(jsonb_agg(jsonb_build_object(${matchKeys},'details',jsonb_strip_nulls(jsonb_build_object(${matchDetails})))),'[]'::jsonb) FROM jsonb_array_elements(coalesce(r->'matches','[]'::jsonb)) m`;
const roundKeys = ['id','league','number','title','source','competitionKey','competitionName','kickoff','deadline','settled','pointsOnly','virtualBookmaker','calculated','sourceConflict','nativeFanta'].map(k=>`'${k}',r->'${k}'`).join(',');
export const LIVE_SNAPSHOT_SQL = `SELECT jsonb_build_object(
 'users',payload->'users','sessions',payload->'sessions','fantaAccessPolicy',payload->'fantaAccessPolicy',
 'leagues',(SELECT coalesce(jsonb_agg(l),'[]'::jsonb) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=$1),
 'rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object(${roundKeys},'matches',(${matches}),'slips',r->'slips')),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league'=$1),
 'football',jsonb_build_object('standings',payload#>'{football,standings}','calendar',jsonb_build_object('season',payload#>'{football,calendar,season}','rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('matches',(${matches}))),'[]'::jsonb) FROM jsonb_array_elements(coalesce(payload#>'{football,calendar,rounds}','[]'::jsonb)) r))),
 'playerRewards',coalesce((SELECT jsonb_object_agg(a.key,a.value) FROM jsonb_each(coalesce(payload->'playerRewards','{}'::jsonb)) a WHERE a.key IN (SELECT m->>'uid' FROM jsonb_array_elements(payload->'leagues') l CROSS JOIN LATERAL jsonb_array_elements(l->'members') m WHERE l->>'id'=$1)),'{}'::jsonb)
) AS payload FROM fanta_state WHERE id=1`;
