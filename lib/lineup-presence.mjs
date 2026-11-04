import {connection} from './db.mjs';
import {databaseReadCache} from './read-cache.mjs';
import {matchPortrait} from './player-media.mjs';
import {normalizeTeam} from './calendar.mjs';
import {presenceProbability,PRESENCE_MODEL} from '../public/src/fanta/presence-probability.mjs';
import {normalizePersonName} from '../fanta/player-identities.mjs';
import {officialLineups} from './official-lineups.mjs';
import {publicLineupAccuracy} from './lineup-accuracy.mjs';
const identity=p=>String(p?.apiId||p?.api_id||p?.playerId||p?.id||'').replace(/^(?:af:|apifootball:|api-football:)/,'');
const revisionCache=new Map();
export async function lineupCatalog({connect=connection,cache=databaseReadCache(),season=2026,now=Date.now()}={}){
 let revision;const hit=connect===connection&&revisionCache.get(season);if(hit&&now-hit.at<5000)revision=hit.value;else{const check=await connect();try{revision=(await check.query("SELECT coalesce((SELECT data->>'revision' FROM fanta.jobs WHERE id=$1),'unbuilt') AS revision",['presence:current:'+season])).rows[0]?.revision||'unbuilt';if(connect===connection)revisionCache.set(season,{at:now,value:revision});}finally{check.release();}}
 const load=async()=>{const c=await connect();try{return (await c.query(`WITH minutes AS (
 SELECT s.player_id,sum((s.data->>'minutes')::numeric) AS played FROM fanta.player_stats s JOIN fanta.fixtures f ON f.id=s.fixture_id JOIN fanta.players p ON p.id=s.player_id WHERE f.season=$1 AND (f.home_id=p.club_id OR f.away_id=p.club_id) AND jsonb_typeof(s.data->'minutes')='number' GROUP BY s.player_id
 ), appearances AS (
 SELECT club_id,count(*) AS played FROM fanta.fixtures f CROSS JOIN LATERAL unnest(ARRAY[f.home_id,f.away_id]) club_id WHERE f.season=$1 AND f.kickoff<$2 AND f.status IN ('1H','HT','2H','ET','P','BT','LIVE','FT','AET','PEN') GROUP BY club_id
 ) SELECT p.id,p.club_id AS "clubId",p.data->'presenceEstimate' AS "presenceEstimate",p.api_id AS "apiId",p.name,p.role,c.name AS club,c.name AS team,p.data->'aliases' AS aliases,p.data->'status' AS status,p.data->'active' AS active,p.data->'seasonStats' AS "seasonStats",p.data->>'surname' AS surname,
 coalesce(nullif(p.data->>'jersey',''),nullif(p.data->>'number',''),p.data#>>'{seasonStats,games,number}') AS number,
 jsonb_build_object('minutes',coalesce(nullif(p.data#>'{seasonStats,games,minutes}','null'::jsonb),to_jsonb(minutes.played)),'teamMatches',coalesce(appearances.played,0)) AS stats
 FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id LEFT JOIN minutes ON minutes.player_id=p.id LEFT JOIN appearances ON appearances.club_id=p.club_id`,[season,new Date(now).toISOString()])).rows;}finally{c.release();}};
 return cache?cache.read('lineup-presence-'+PRESENCE_MODEL+':'+season,revision,load,{ttl:3600000}):load();
}
export function enrichPresence(lineups,catalog){
 if(!lineups)return lineups;
 return {...lineups,method:lineups.kind==='official'?'official-api-v1':PRESENCE_MODEL,teams:lineups.teams.map(t=>{
  const find=p=>{const id=identity(p);const hits=id?catalog.filter(x=>identity(x)===id&&normalizeTeam(x.club)===normalizeTeam(t.team)):[];if(hits.length===1)return hits[0];const names=x=>[x.name,...(x.aliases||[])].map(n=>normalizePersonName(String(n||'').replace(/^(?:\p{Lu}\.\s*)+/u,'').replace(/\s+(?:\p{Lu}\.)+$/u,'')).replace(/ /g,''));const candidates=catalog.filter(x=>normalizeTeam(x.club)===normalizeTeam(t.team)&&names(x).some(n=>names(p).includes(n)));return candidates.length===1?candidates[0]:matchPortrait(p,t.team,catalog);};
  const enrich=p=>{const record=find(p),official=lineups.kind==='official',play=official?null:record&&presenceProbability({...record,play:null});return {...p,...(record?{playerId:record.id,apiId:record.apiId,role:record.role,jersey:p.jersey||record.number||'',surname:record.surname||p.surname}:{}),probability:official?(t.players.includes(p)?100:0):play?.pct??null,probabilityKind:official?'official':'minutes-estimate',...(record?.status?{availability:record.status.type}:{})};};
  let players=t.players.map(enrich),bench=(t.bench||[]).map(enrich);
  const absent=p=>/injured|suspended|unavailable|infortun|squalific|indispon/i.test(p.availability||'');
  if(lineups.kind!=='official')for(let i=0;i<players.length;i++)if(absent(players[i])){const alternatives=bench.filter(p=>!absent(p)&&p.role&&p.role===players[i].role).sort((a,b)=>(b.probability??-1)-(a.probability??-1));const replacement=alternatives[0];if(replacement){const old=players[i];players[i]=replacement;bench=bench.filter(p=>p!==replacement).concat(old);}else{bench.push(players[i]);players.splice(i--,1);}}
  if(lineups.kind==='probable'){
   const key=p=>identity(p)||normalizePersonName(p.name),seen=new Set(players.map(key)),available=[];
   const add=p=>{const id=key(p),record=find(p);if(!id||seen.has(id)||absent(p)||record?.active===false)return;seen.add(id);available.push(p);};
   bench.forEach(add);
   for(const record of catalog.filter(p=>normalizeTeam(p.club)===normalizeTeam(t.team)&&p.active!==false))add(enrich({name:record.name,playerId:record.id,role:record.role,jersey:record.number||''}));
   bench=available.sort((a,b)=>(b.probability??-1)-(a.probability??-1)||String(a.name).localeCompare(String(b.name),'it'));
  }
  return {...t,players,bench,ballots:[]};
 })};
}
export async function enrichStoredMatch(match,options={}){
 const raw={teams:match.details?.matchInfo?.teams,lineups:match.details?.sourceLineups},official=officialLineups(raw,match.details?.updatedAt);
 const lineups=official||match.lineups;if(!lineups)return match;
 const season=Number(match.details?.matchInfo?.league?.season||process.env.FANTA_SEASON||2026),catalog=await lineupCatalog({season,...options}),enriched=enrichPresence(lineups,catalog);
 if(enriched.kind==='probable')try{const accuracy=await publicLineupAccuracy({season,...options});if(accuracy)enriched.accuracy=accuracy;}catch{/* Optional benchmark must not block the lineup. */}
 return {...match,lineups:enriched};
}
