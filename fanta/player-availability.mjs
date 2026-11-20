import {createHash} from 'node:crypto';
import {connection} from '../lib/db.mjs';
import {beginBackgroundWrite} from '../lib/operations/background-db.mjs';
import {matchPortrait} from '../lib/player-media.mjs';
import {availabilityPriority,reportedStatus} from '../public/src/fanta/presence-probability.mjs';
import {fantaProvider} from './provider.mjs';

const startsLater=new Set(['NS','TBD']);

export function collectAvailability(fixtures,players,injuries,forecasts){
 const byFixture=new Map(fixtures.map(f=>[Number(f.api_id),f]));
 const fixtureByClub=new Map();
 for(const f of fixtures)for(const clubId of [f.home_id,f.away_id])if(!fixtureByClub.has(clubId))fixtureByClub.set(clubId,f);
 const updates=new Map(players.filter(p=>Number(p.api_id)>0&&fixtureByClub.has(p.club_id)).map(p=>[Number(p.api_id),{
  id:p.id,club_id:p.club_id,status:{type:'ok',note:'',fixtureId:fixtureByClub.get(p.club_id).id},
 }]));
 const set=(playerId,fixture,status)=>{
  const player=updates.get(Number(playerId));
  if(!status||!player||player.status.fixtureId!==fixture?.id||availabilityPriority[player.status.type]>=availabilityPriority[status.type])return;
  player.status={...status,fixtureId:fixture.id};
 };
 for(const row of injuries){
  const fixture=byFixture.get(Number(row.fixture?.id));
  const player=updates.get(Number(row.player?.id));
  if(!fixture||!player||row.team?.id&&player.club_id!=='af:'+row.team.id)continue;
  set(row.player?.id,fixture,reportedStatus(row.player?.type,row.player?.reason||''));
 }
 for(const match of forecasts){
  const fixture=byFixture.get(Number(match.apiFootballId||match.details?.matchInfo?.fixture?.id));
  if(!fixture||match.lineups?.kind!=='probable')continue;
  const clubs=players.filter(p=>p.club_id===fixture.home_id||p.club_id===fixture.away_id);
  for(const team of match.lineups.teams){
   for(const row of team.reportedUnavailable??team.unavailable??[]){
    const player=matchPortrait(row,team.team,clubs);
    if(player)set(player.api_id,fixture,reportedStatus(row.status,row.note||''));
   }
  }
 }
 return [...updates.values()];
}

export const availabilityJobId=season=>'availability:current:'+season;
export async function refreshPlayerAvailability(matches,{connect=connection,provider=fantaProvider({maxCalls:1}),season,now=Date.now()}={}){
 const ids=[...new Set(matches.filter(m=>startsLater.has(m.status||'NS')&&Date.parse(m.kickoff)>now)
  .map(m=>Number(m.apiFootballId||m.details?.matchInfo?.fixture?.id)).filter(id=>Number.isSafeInteger(id)&&id>0))];
 if(!ids.length)return {fixtures:0,players:0,changed:0,providerCalls:0};
 const {response,paging}=await provider.get(`injuries?league=135&season=${season}`);
 if(!Array.isArray(response)||Number(paging?.total)>1)throw Error('Dati indisponibilità incompleti');
 const c=await connect();
 try{
  await beginBackgroundWrite(c);
  await c.query('SELECT pg_advisory_xact_lock(826529)');
  const jobId=availabilityJobId(season),stamp=new Date(now).toISOString();
  const prior=(await c.query('SELECT data FROM fanta.jobs WHERE id=$1',[jobId])).rows[0]?.data;
  if(Date.parse(prior?.checkedAt)>now){await c.query('COMMIT');return {superseded:true,providerCalls:1};}
  const fixtures=(await c.query(`SELECT id,api_id,home_id,away_id FROM fanta.fixtures
   WHERE season=$1 AND api_id=ANY($2::int[]) ORDER BY kickoff,id`,[season,ids])).rows;
  if(!fixtures.length){await c.query('COMMIT');return {fixtures:0,players:0,changed:0,providerCalls:1};}
  const clubs=[...new Set(fixtures.flatMap(f=>[f.home_id,f.away_id]))];
  const players=(await c.query(`SELECT p.id,p.api_id,p.club_id,p.name,c.name AS team,p.data->>'jersey' AS number
   FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id
   WHERE p.club_id=ANY($1::text[]) AND coalesce(p.data->>'active','true')<>'false' ORDER BY p.id`,[clubs])).rows;
  const updates=collectAvailability(fixtures,players,response,matches);
  const result=await c.query(`UPDATE fanta.players p SET data=jsonb_set(p.data,'{status}',u.status)
   FROM jsonb_to_recordset($1::jsonb) AS u(id text,club_id text,status jsonb)
   WHERE p.id=u.id AND p.club_id=u.club_id AND p.data->'status' IS DISTINCT FROM u.status`,[JSON.stringify(updates)]);
  const revision=createHash('sha256').update(JSON.stringify(updates)).digest('hex');
  const metrics={fixtures:fixtures.length,players:updates.length,changed:result.rowCount??result.affectedRows??0,providerCalls:1};
  await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',
   [jobId,JSON.stringify({...metrics,revision,checkedAt:stamp})]);
  await c.query('COMMIT');
  return metrics;
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}
 finally{c.release();}
}
