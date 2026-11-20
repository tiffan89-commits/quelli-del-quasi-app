import {connection} from './db.mjs';
import {databaseReadCache} from './read-cache.mjs';
import {normalizeTeam} from './calendar.mjs';
import {availabilityLabel,availabilityPriority,isUnavailable,presenceProbability,PRESENCE_MODEL,reportedStatus,statusForFixture} from '../public/src/fanta/presence-probability.mjs';
import {availabilityJobId} from '../fanta/player-availability.mjs';
import {normalizePersonName} from '../fanta/player-identities.mjs';
import {officialLineups} from './official-lineups.mjs';
import {publicLineupAccuracy} from './lineup-accuracy.mjs';
import {normalizePitchLayout} from '../public/src/pitch-layout.mjs';
import {selectEstimatedLineup,ESTIMATED_XI_MODEL} from './estimated-lineup.mjs';
import {storedLineupVotes,attachLineupPerformance} from './lineup-performance.mjs';
import {normalizeProbablePitches} from './probable-pitch-layout.mjs';
import {cleanLineupTeam,forecastJersey,lineupPlayerId,resolveLineupPlayer} from './lineup-quality.mjs';
const revisionCache=new Map();
export async function lineupCatalog({connect=connection,cache=databaseReadCache(),season=2026,now=Date.now()}={}){
 let revision;const hit=connect===connection&&revisionCache.get(season);if(hit&&now-hit.at<5000)revision=hit.value;else{const check=await connect();try{revision=(await check.query("SELECT string_agg(data->>'revision',':' ORDER BY id) AS revision FROM fanta.jobs WHERE id IN ($1,$2,$3)",['presence:current:'+season,availabilityJobId(season),'lineup-quality:numbers:'+season])).rows[0]?.revision||'unbuilt';if(connect===connection)revisionCache.set(season,{at:now,value:revision});}finally{check.release();}}
 const load=async()=>{const c=await connect();try{return (await c.query(`WITH minutes AS (
 SELECT s.player_id,sum((s.data->>'minutes')::numeric) AS played FROM fanta.player_stats s JOIN fanta.fixtures f ON f.id=s.fixture_id JOIN fanta.players p ON p.id=s.player_id WHERE f.season=$1 AND (f.home_id=p.club_id OR f.away_id=p.club_id) AND jsonb_typeof(s.data->'minutes')='number' GROUP BY s.player_id
 ), appearances AS (
 SELECT club_id,count(*) AS played FROM fanta.fixtures f CROSS JOIN LATERAL unnest(ARRAY[f.home_id,f.away_id]) club_id WHERE f.season=$1 AND f.kickoff<$2 AND f.status IN ('1H','HT','2H','ET','P','BT','LIVE','FT','AET','PEN') GROUP BY club_id
 ) SELECT p.id,p.club_id AS "clubId",p.data->'presenceEstimate' AS "presenceEstimate",p.api_id AS "apiId",p.name,p.role,c.name AS club,c.name AS team,p.data->'aliases' AS aliases,p.data->'status' AS status,p.data->'active' AS active,p.data->'seasonStats' AS "seasonStats",p.data->>'surname' AS surname,
 coalesce(nullif(p.data->>'jersey',''),nullif(p.data->>'number','')) AS number,
 CASE WHEN 'af:'||(p.data#>>'{seasonStats,team,id}')=p.club_id THEN p.data#>>'{seasonStats,games,number}' END AS "seasonNumber",
 CASE WHEN p.data#>>'{verifiedJersey,season}'=$1::int::text AND p.data#>>'{verifiedJersey,clubId}'=p.club_id
  THEN p.data#>>'{verifiedJersey,number}' END AS "verifiedNumber",
 jsonb_build_object('minutes',coalesce(nullif(p.data#>'{seasonStats,games,minutes}','null'::jsonb),to_jsonb(minutes.played)),'teamMatches',coalesce(appearances.played,0)) AS stats
 FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id LEFT JOIN minutes ON minutes.player_id=p.id LEFT JOIN appearances ON appearances.club_id=p.club_id`,[season,new Date(now).toISOString()])).rows;}finally{c.release();}};
 return cache?cache.read('lineup-presence-'+PRESENCE_MODEL+':'+season,revision,load,{ttl:3600000}):load();
}
export function enrichPresence(lineups,catalog,{fixtureId,report}={}){
 if(!lineups)return lineups;
 lineups=normalizeProbablePitches(lineups);
 return {...lineups,method:lineups.kind==='official'?'official-api-v1':PRESENCE_MODEL,...(lineups.kind==='probable'?{xiModel:ESTIMATED_XI_MODEL}:{}),teams:lineups.teams.map(t=>{
  const clubCatalog=catalog.filter(x=>normalizeTeam(x.club)===normalizeTeam(t.team));
  const find=p=>resolveLineupPlayer(p,clubCatalog).record;
  const official=lineups.kind==='official',reported=t.reportedUnavailable??t.unavailable??[];
  const reportKey=p=>find(p)?.id||normalizePersonName(p.name);
  const reportedByPlayer=new Map(reported.map(p=>[reportKey(p),reportedStatus(p.status,p.note||'')]));
  const statusOf=(p,record)=>{
   const stored=statusForFixture(record?.status,fixtureId),editorial=reportedByPlayer.get(record?.id||normalizePersonName(p.name));
   return editorial&&availabilityPriority[editorial.type]>availabilityPriority[stored.type]?editorial:stored;
  };
  const enrich=(p,section)=>{
   const {record,reason}=resolveLineupPlayer(p,clubCatalog);
   if(!official&&clubCatalog.length&&(!record||record.active===false)){
    report?.({code:record?'inactive-player':reason,team:t.team,section,players:[{name:p.name,id:lineupPlayerId(p)}]});
    return null;
   }
   const status=statusOf(p,record),play=official?null:presenceProbability({...record,status,play:null});
   const reportedJersey=p.reportedJersey??(['minutes-estimate','unavailable'].includes(p.probabilityKind)?'':p.jersey??'');
   const jersey=official?p.jersey??record?.number??'':forecastJersey({...p,jersey:reportedJersey},record,report);
   return {...p,...(record?{playerId:record.id,apiId:record.apiId,role:record.role,surname:record.surname||p.surname,...(record.active!==undefined?{active:record.active}:{})}:{}),jersey,probability:official?(section==='XI'?100:0):play?.pct??null,probabilityKind:official?'official':play?.source||'minutes-estimate',...(!official?{availability:status.type,reportedJersey,...(record?.verifiedNumber?{numberVerified:true}:{})}:{})};
  };
  const sourcePlayers=lineups.kind==='probable'&&t.forecastBase?t.forecastBase:t.players;
  const original=sourcePlayers.map(p=>enrich(p,'XI')).filter(Boolean);
  const identity=p=>lineupPlayerId(p)||normalizePersonName(p.name);
  const baseIds=new Set(original.map(identity));
  const candidates=(t.bench||[]).map(p=>enrich(p,'bench')).filter(p=>p&&(!t.forecastBase||!baseIds.has(identity(p))));
  const clean=cleanLineupTeam({...t,players:original,bench:candidates},report);
  const positioned=normalizePitchLayout(clean);
  let players=positioned.players,bench=positioned.bench;
  let unavailable=t.unavailable;
  if(lineups.kind==='probable'){
   const seen=new Set(players.map(identity)),available=[];
   const add=p=>{const id=identity(p);if(!id||seen.has(id)||isUnavailable(p.availability)||p.active===false)return;seen.add(id);available.push(p);};
   bench.forEach(add);
   if(t.forecastBase)for(const row of t.players){const p=enrich(row,'XI');if(p)add(p);}
   for(const record of clubCatalog.filter(p=>p.active!==false&&!seen.has(lineupPlayerId(p))))add(enrich({name:record.name,playerId:record.id,role:record.role},'catalog'));
   bench=available.sort((a,b)=>(b.probability??-1)-(a.probability??-1)||String(a.name).localeCompare(String(b.name),'it'));
   const entries=new Map();
   for(const p of [...reported,...clubCatalog.filter(p=>p.active!==false)]){
    const status=statusOf(p,find(p));
    if(!availabilityLabel[status.type])continue;
    entries.set(reportKey(p),{name:p.name,status:availabilityLabel[status.type],...(status.note?{note:status.note}:{}),...(isUnavailable(status.type)?{probability:0}:{})});
   }
   unavailable=[...entries.values()];
  }
  const result=lineups.kind==='probable'?selectEstimatedLineup({...positioned,players,bench,ballots:[],unavailable,reportedUnavailable:reported}):{...positioned,players,bench,ballots:[]};
  return normalizePitchLayout(cleanLineupTeam(result,report));
 })};
}
export async function enrichStoredMatch(match,options={}){
 const raw={teams:match.details?.matchInfo?.teams,lineups:match.details?.sourceLineups},official=officialLineups(raw,match.details?.updatedAt);
 const lineups=official||match.lineups;if(!lineups)return match;
 const fixtureId=match.apiFootballId||match.details?.matchInfo?.fixture?.id;
 const season=Number(match.details?.matchInfo?.league?.season||process.env.FANTA_SEASON||2026),catalog=await lineupCatalog({season,...options}),enriched=enrichPresence(lineups,catalog,{fixtureId});
 if(enriched.kind==='probable')try{const accuracy=await publicLineupAccuracy({season,...options});if(accuracy)enriched.accuracy=accuracy;}catch{/* Optional benchmark must not block the lineup. */}
 const result={...match,lineups:enriched};
 if(fixtureId&&['1H','HT','2H','LIVE','FT','AET','PEN','ET','BT','P'].includes(match.status))return attachLineupPerformance(result,await storedLineupVotes('af:'+fixtureId,options).catch(()=>[]));
 return result;
}
