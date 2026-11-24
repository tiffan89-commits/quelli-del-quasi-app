import {createHash} from 'node:crypto';
import {connection} from '../lib/db.mjs';
import {beginBackgroundWrite} from '../lib/operations/background-db.mjs';
import {lineupPlayerId,resolveLineupPlayer} from '../lib/lineup-quality.mjs';
import {normalizeTeam} from '../lib/calendar.mjs';
import {availabilityPriority,reportedStatus} from '../public/src/fanta/presence-probability.mjs';
import {fantaProvider} from './provider.mjs';
import {availabilityFromCards} from './availability-discipline.mjs';
import {availabilityFromNews,readAvailabilityNews} from './availability-news.mjs';

const startsLater=new Set(['NS','TBD']);
const finished=new Set(['FT','AET','PEN']);
const INJURY_LOOKBACK_MS=8*86400000;
const medicalReason=/injur|infortun|lesion|fracture|frattura|sprain|distors|concuss|hamstring|muscle|muscolar|tendon/iu;

export function collectAvailability(fixtures,players,injuries,forecasts,{cards=[],news=[],preservePrior=false,recentFixtures=[]}={}){
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
 const lastByClub=new Map();
 for(const fixture of recentFixtures)for(const club of [fixture.home_id,fixture.away_id]){
  if(!lastByClub.has(club))lastByClub.set(club,fixture);
 }
 const officialSelections=new Set(forecasts.flatMap(match=>{
  const id=Number(match.apiFootballId||match.details?.matchInfo?.fixture?.id);
  return match.lineups?.kind==='official'?match.lineups.teams.flatMap(team=>
   [...(team.players||[]),...(team.bench||[])].map(p=>'af:'+id+':'+lineupPlayerId(p))):[];
 }));
 const carrying=[];
 for(const row of injuries){
  const fixture=byFixture.get(Number(row.fixture?.id));
  const player=updates.get(Number(row.player?.id));
  if(!player||row.team?.id&&player.club_id!=='af:'+row.team.id)continue;
  const status=reportedStatus(row.player?.type,row.player?.reason||'');
  if(fixture)set(row.player?.id,fixture,status);
  else if(status?.type==='injured'&&medicalReason.test(row.player?.type+' '+row.player?.reason)&&
   Number(lastByClub.get(player.club_id)?.api_id)===Number(row.fixture?.id))
   carrying.push({id:Number(row.player.id),sourceFixtureId:lastByClub.get(player.club_id).id});
 }
 for(const {playerId,clubId,...report} of [...cards,...news]){
  const player=updates.get(Number(playerId));
  if(player&&(!clubId||player.club_id===clubId))set(playerId,fixtureByClub.get(player.club_id),report);
 }
 for(const match of forecasts){
  const fixture=byFixture.get(Number(match.apiFootballId||match.details?.matchInfo?.fixture?.id));
  if(!fixture||match.lineups?.kind!=='probable')continue;
  const clubs=players.filter(p=>p.club_id===fixture.home_id||p.club_id===fixture.away_id);
  for(const team of match.lineups.teams){
   const roster=clubs.filter(p=>normalizeTeam(p.team)===normalizeTeam(team.team));
   for(const row of team.reportedUnavailable??team.unavailable??[]){
    const {record:player}=resolveLineupPlayer(row,roster);
    if(player)set(player.api_id,fixture,reportedStatus(row.status,row.note||''));
   }
  }
 }
 for(const player of players){
  const update=updates.get(Number(player.api_id)),prior=player.status;
  if(!update||prior?.fixtureId!==update.status.fixtureId)continue;
  if(prior.source==='cards'&&availabilityPriority[prior.type]>availabilityPriority[update.status.type]||
   update.status.type==='ok'&&(preservePrior||prior.source==='news')&&prior.type!=='ok'&&
    !officialSelections.has(update.status.fixtureId+':'+player.api_id))update.status=prior;
 }
 for(const {id,sourceFixtureId} of carrying){
  const player=updates.get(id);
  if(player.status.type!=='ok'||officialSelections.has(player.status.fixtureId+':'+id))continue;
  player.status={...player.status,type:'doubtful',source:'recent-fixture',sourceFixtureId,
   note:'Infortunio segnalato nell’ultima partita. Rientro da confermare.'};
 }
 return [...updates.values()];
}

export const availabilityJobId=season=>'availability:current:'+season;
export async function refreshPlayerAvailability(matches,{connect=connection,provider=fantaProvider({maxCalls:1}),season,now=Date.now(),previousRound,recentFixtures=[],fetcher=fetch}={}){
 const ids=[...new Set(matches.filter(m=>startsLater.has(m.status||'NS')&&Date.parse(m.kickoff)>now)
  .map(m=>Number(m.apiFootballId||m.details?.matchInfo?.fixture?.id)).filter(id=>Number.isSafeInteger(id)&&id>0))];
 if(!ids.length)return {fixtures:0,players:0,changed:0,providerCalls:0};
 const older=[...new Set(recentFixtures.filter(f=>finished.has(f.status)&&Date.parse(f.kickoff)>=now-INJURY_LOOKBACK_MS&&Date.parse(f.kickoff)<now)
  .sort((a,b)=>Date.parse(b.kickoff)-Date.parse(a.kickoff)).map(f=>Number(f.apiId))
  .filter(id=>Number.isSafeInteger(id)&&id>0&&!ids.includes(id)))].slice(0,Math.max(0,20-ids.length));
 const requested=[...ids,...older];
 let injuries=[],apiError=null;
 try{
  const {response,paging}=await provider.get(requested.length===1?'injuries?fixture='+requested[0]:'injuries?ids='+requested.join('-'));
  if(!Array.isArray(response)||Number(paging?.total)>1)throw Error('Dati indisponibilità incompleti');
  injuries=response.filter(item=>(!item.league?.id||Number(item.league.id)===135)&&(!item.league?.season||Number(item.league.season)===season));
 }catch(error){if(!previousRound)throw error;apiError=error.code||error.name;}
 const editorial=previousRound?await readAvailabilityNews({fetcher,now}):{articles:[],providers:[]};
 const c=await connect();
 try{
  await beginBackgroundWrite(c);
  await c.query('SELECT pg_advisory_xact_lock(826529)');
  const jobId=availabilityJobId(season),stamp=new Date(now).toISOString();
  const prior=(await c.query('SELECT data FROM fanta.jobs WHERE id=$1',[jobId])).rows[0]?.data;
  if(Date.parse(prior?.checkedAt)>now){await c.query('COMMIT');return {superseded:true,providerCalls:1};}
  const knownFixtures=(await c.query(`SELECT id,api_id,home_id,away_id FROM fanta.fixtures
   WHERE season=$1 AND api_id=ANY($2::int[]) ORDER BY kickoff DESC,id`,[season,requested])).rows;
  const fixtures=knownFixtures.filter(f=>ids.includes(Number(f.api_id))).reverse();
  if(!fixtures.length){await c.query('COMMIT');return {fixtures:0,players:0,changed:0,providerCalls:1};}
  const clubs=[...new Set(fixtures.flatMap(f=>[f.home_id,f.away_id]))];
  const players=(await c.query(`SELECT p.id,p.api_id,p.club_id,p.name,c.name AS team,p.data->>'jersey' AS number,
   p.data->>'displayName' AS display_name,p.data->>'surname' AS surname,p.data->'status' AS status
   FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id
   WHERE p.club_id=ANY($1::text[]) AND coalesce(p.data->>'active','true')<>'false' ORDER BY p.id`,[clubs])).rows;
  const history=previousRound?(await c.query(`SELECT id,round,kickoff,status,home_id,away_id,data->'events' AS events,
   data->'statistics' AS statistics FROM fanta.fixtures WHERE season=$1 AND round<=$2 AND kickoff<$3`,[season,previousRound,stamp])).rows:[];
  const discipline=previousRound?availabilityFromCards(history,previousRound):{reports:[],completeCards:false};
  const roundStart=Math.min(now,...history.filter(f=>f.round===previousRound).map(f=>Date.parse(f.kickoff)).filter(Number.isFinite));
  const apiCovered=new Set(previousRound?collectAvailability(fixtures,players,injuries,[])
   .filter(r=>['injured','suspended','unavailable'].includes(r.status.type)).map(r=>r.id):[]);
  const news=availabilityFromNews(players,editorial.articles,{notBefore:history.length?roundStart:undefined})
   .filter(r=>!apiCovered.has('af:'+r.playerId));
  const updates=collectAvailability(fixtures,players,injuries,matches,{cards:discipline.reports,news,preservePrior:!!apiError,
   recentFixtures:knownFixtures.filter(f=>older.includes(Number(f.api_id)))});
  const result=await c.query(`UPDATE fanta.players p SET data=jsonb_set(p.data,'{status}',u.status)
   FROM jsonb_to_recordset($1::jsonb) AS u(id text,club_id text,status jsonb)
   WHERE p.id=u.id AND p.club_id=u.club_id AND p.data->'status' IS DISTINCT FROM u.status`,[JSON.stringify(updates)]);
  const revision=createHash('sha256').update(JSON.stringify(updates)).digest('hex');
  const metrics={fixtures:fixtures.length,players:updates.length,changed:result.rowCount??result.affectedRows??0,providerCalls:1,
   ...(previousRound?{apiReports:injuries.length,apiError,cardReports:discipline.reports.length,completeCards:discipline.completeCards,
    editorialReports:news.length,newsProviders:editorial.providers}:{})};
  await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',
   [jobId,JSON.stringify({...metrics,revision,checkedAt:stamp})]);
  await c.query('COMMIT');
  return metrics;
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}
 finally{c.release();}
}
