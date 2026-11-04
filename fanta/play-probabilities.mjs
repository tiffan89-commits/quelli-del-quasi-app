import {normalizeTeam} from '../lib/calendar.mjs';
import {normalizePersonName} from './player-identities.mjs';
import {PRESENCE_MODEL} from '../public/src/fanta/presence-probability.mjs';

// Reuse only explicit percentages already stored by the Bar. Never infer a
// percentage from starter/bench flags or associate an ambiguous namesake.
export function probabilityFor(player,rounds,current){
 const unavailable=/injur|suspend|unavailable|infortun|squalific|indispon/i.test(player.status?.type||'');
 for(const number of [current]){
  const candidates=(rounds||[]).filter(r=>Number(r.number)===number).flatMap(r=>r.players||[]);
  const id=String(player.apiId||player.api_id||player.id||'').replace(/^(?:af:|api-football:|apifootball:)/,'');
  let found=candidates.filter(p=>p.id&&String(p.id).replace(/^(?:af:|api-football:|apifootball:)/,'')===id);
  if(!found.length){const names=[player.name,player.fullName,...(player.aliases||[])].map(normalizePersonName).filter(Boolean);found=candidates.filter(p=>normalizeTeam(p.club)===normalizeTeam(player.club)&&names.includes(normalizePersonName(p.name)));}
  const stored=found.filter(p=>p.kind==='official'||p.method==='minutes-presence-v1'||p.method===PRESENCE_MODEL),confirmed=stored.filter(p=>p.kind==='official');
  const explicit=(confirmed.length?confirmed:stored).filter(p=>typeof p.pct==='number'&&Number.isFinite(p.pct)&&p.pct>=0&&p.pct<=100);
  const values=[...new Set(explicit.map(p=>p.pct))];
  if(values.length===1&&(!unavailable||explicit[0].kind==='official'))return {pct:values[0],source:explicit[0].kind==='official'?'official':'minutes-estimate'};
 }
 return null;
}

export async function readPlayProbabilities(c,round,season){
 if(!Number.isInteger(round))return [];
 const result=await c.query(`WITH rounds AS (
  SELECT r FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.payload#>'{football,calendar,rounds}','[]')) r
   WHERE coalesce(s.payload#>>'{football,calendar,season}',$2::text)=$2::text
  UNION ALL
  SELECT r FROM fanta_state s CROSS JOIN LATERAL jsonb_each(coalesce(s.payload#>'{football,rounds}','{}')) pair CROSS JOIN LATERAL (SELECT pair.value||jsonb_build_object('number',coalesce(pair.value->'number',CASE WHEN pair.key ~ '^[0-9]+$' THEN to_jsonb(pair.key::int) ELSE 'null'::jsonb END)) AS r) item
   WHERE coalesce(s.payload#>>'{football,calendar,season}',$2::text)=$2::text
 ), players AS (
  SELECT (r->>'number')::int AS number,t->>'team' AS club,p->>'name' AS name,coalesce(p->>'apiId',p->>'playerId',p->>'id') AS id,p->'probability' AS pct,m#>>'{lineups,kind}' AS kind,m#>>'{lineups,method}' AS method
  FROM rounds CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'matches','[]')) m CROSS JOIN LATERAL jsonb_array_elements(coalesce(m#>'{lineups,teams}','[]')) t CROSS JOIN LATERAL jsonb_array_elements(coalesce(t->'players','[]')||coalesce(t->'bench','[]')) p
  WHERE r->>'number' IN ($1::text,($1::int-1)::text)
 ) SELECT number,jsonb_agg(jsonb_build_object('club',club,'name',name,'id',id,'pct',pct,'kind',kind,'method',method)) AS players FROM players GROUP BY number`,[round,season]);
 return result.rows;
}

// A small, shared, hourly cache is enough for the minutes-based fallback. No provider
// call, background task or game-data write is introduced by opening the editor.
export async function readPresenceMinutes(c,players,season,{cache,now=Date.now()}={}){
 const missing=players.filter(p=>p.clubId&&!(p.presenceEstimate?.model===PRESENCE_MODEL&&p.presenceEstimate.clubId===p.clubId)&&!Number.isFinite(p.seasonStats?.games?.minutes));
 if(!missing.length)return {};
 const ids=[...new Set(missing.map(p=>p.id))].sort(),key=JSON.stringify(['presence-minutes-v1',season,missing.map(p=>[p.id,p.clubId]).sort()]);
 const load=async()=>{
  const rows=(await c.query(`SELECT p.id,
   sum(CASE WHEN jsonb_typeof(s.data->'minutes')='number' THEN (s.data->>'minutes')::numeric END)::float AS minutes,
   count(DISTINCT f.id)::int AS matches
   FROM fanta.players p JOIN fanta.fixtures f ON (f.home_id=p.club_id OR f.away_id=p.club_id)
   LEFT JOIN fanta.player_stats s ON s.fixture_id=f.id AND s.player_id=p.id
   WHERE p.id=ANY($1::text[]) AND f.season=$2 AND f.kickoff<$3 AND f.status IN ('1H','HT','2H','ET','P','BT','LIVE','FT','AET','PEN')
   GROUP BY p.id`,[ids,season,new Date(now).toISOString()])).rows;
  return Object.fromEntries(rows.filter(r=>r.minutes!==null&&r.matches>0).map(r=>[r.id,{minutes:Number(r.minutes),teamMatches:Number(r.matches)}]));
 };
 return cache?cache.read(key,Math.floor(now/3600000),load,{ttl:3600000}):load();
}
