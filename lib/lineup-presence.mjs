import {connection} from './db.mjs';
import {databaseReadCache} from './read-cache.mjs';
import {matchPortrait} from './player-media.mjs';
import {normalizeTeam} from './calendar.mjs';
import {presenceProbability} from '../public/src/fanta/presence-probability.mjs';
import {normalizePersonName} from '../fanta/player-identities.mjs';
import {officialLineups} from './official-lineups.mjs';
const identity=p=>String(p?.apiId||p?.api_id||p?.playerId||p?.id||'').replace(/^(?:af:|apifootball:|api-football:)/,'');
export async function lineupCatalog({connect=connection,cache=databaseReadCache(),season=2026,now=Date.now()}={}){
 const load=async()=>{const c=await connect();try{return (await c.query(`WITH minutes AS (
 SELECT s.player_id,sum((s.data->>'minutes')::numeric) AS played FROM fanta.player_stats s JOIN fanta.fixtures f ON f.id=s.fixture_id JOIN fanta.players p ON p.id=s.player_id WHERE f.season=$1 AND (f.home_id=p.club_id OR f.away_id=p.club_id) AND jsonb_typeof(s.data->'minutes')='number' GROUP BY s.player_id
 ), appearances AS (
 SELECT club_id,count(*) AS played FROM fanta.fixtures f CROSS JOIN LATERAL unnest(ARRAY[f.home_id,f.away_id]) club_id WHERE f.season=$1 AND f.kickoff<$2 AND f.status IN ('1H','HT','2H','ET','P','BT','LIVE','FT','AET','PEN') GROUP BY club_id
 ) SELECT p.id,p.api_id AS "apiId",p.name,p.role,c.name AS club,c.name AS team,p.data->'aliases' AS aliases,p.data->'status' AS status,p.data->'seasonStats' AS "seasonStats",p.data->>'surname' AS surname,
 coalesce(nullif(p.data->>'jersey',''),nullif(p.data->>'number',''),p.data#>>'{seasonStats,games,number}') AS number,
 jsonb_build_object('minutes',coalesce(nullif(p.data#>'{seasonStats,games,minutes}','null'::jsonb),to_jsonb(minutes.played)),'teamMatches',coalesce(appearances.played,0)) AS stats
 FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id LEFT JOIN minutes ON minutes.player_id=p.id LEFT JOIN appearances ON appearances.club_id=p.club_id`,[season,new Date(now).toISOString()])).rows;}finally{c.release();}};
 return cache?cache.read('lineup-presence-v1:'+season,Math.floor(now/3600000),load,{ttl:3600000}):load();
}
export function enrichPresence(lineups,catalog){
 if(!lineups)return lineups;
 return {...lineups,method:lineups.kind==='official'?'official-api-v1':'minutes-presence-v1',teams:lineups.teams.map(t=>{
  const find=p=>{const id=identity(p);const hits=id?catalog.filter(x=>identity(x)===id&&normalizeTeam(x.club)===normalizeTeam(t.team)):[];if(hits.length===1)return hits[0];const names=x=>[x.name,...(x.aliases||[])].map(n=>normalizePersonName(String(n||'').replace(/^(?:\p{Lu}\.\s*)+/u,'').replace(/\s+(?:\p{Lu}\.)+$/u,'')).replace(/ /g,''));const candidates=catalog.filter(x=>normalizeTeam(x.club)===normalizeTeam(t.team)&&names(x).some(n=>names(p).includes(n)));return candidates.length===1?candidates[0]:matchPortrait(p,t.team,catalog);};
  const enrich=p=>{const record=find(p),official=lineups.kind==='official',play=official?null:record&&presenceProbability({...record,play:null});return {...p,...(record?{playerId:record.id,apiId:record.apiId,role:record.role,jersey:p.jersey||record.number||'',surname:record.surname||p.surname}:{}),probability:official?(t.players.includes(p)?100:0):play?.pct??null,probabilityKind:official?'official':'minutes-estimate',...(record?.status?{availability:record.status.type}:{})};};
  let players=t.players.map(enrich),bench=(t.bench||[]).map(enrich);
  const absent=p=>/injured|suspended|unavailable|infortun|squalific|indispon/i.test(p.availability||'');
  if(lineups.kind!=='official')for(let i=0;i<players.length;i++)if(absent(players[i])){const alternatives=bench.filter(p=>!absent(p)&&p.role&&p.role===players[i].role).sort((a,b)=>(b.probability??-1)-(a.probability??-1));const replacement=alternatives[0];if(replacement){const old=players[i];players[i]=replacement;bench=bench.filter(p=>p!==replacement).concat(old);}else{bench.push(players[i]);players.splice(i--,1);}}
  const all=[...players,...bench];const ballots=lineups.kind==='official'?[]:(t.ballots||[]).map(b=>({...b,kind:'minutes-presence',players:b.players.map(p=>{const found=all.find(x=>identity(p)&&identity(x)===identity(p))||all.find(x=>x.name===p.name)||enrich(p);return {...p,probability:absent(found)?0:found.probability,probabilityKind:'minutes-estimate'};}),otherProbability:null})).filter(b=>b.players.some(p=>Number.isFinite(p.probability)&&p.probability>0));
  return {...t,players,bench,ballots};
 })};
}
export async function enrichStoredMatch(match,options={}){
 const raw={teams:match.details?.matchInfo?.teams,lineups:match.details?.sourceLineups},official=officialLineups(raw,match.details?.updatedAt);
 const lineups=official||match.lineups;if(!lineups)return match;
 const catalog=await lineupCatalog({season:Number(match.details?.matchInfo?.league?.season||process.env.FANTA_SEASON||2026),...options});return {...match,lineups:enrichPresence(lineups,catalog)};
}
