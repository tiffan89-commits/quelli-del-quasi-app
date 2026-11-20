import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {connection} from '../db.mjs';
import {barStorageMode} from '../storage-mode.mjs';
import {cleanLineupTeam,lineupPlayerId,validJersey} from '../lineup-quality.mjs';
import {normalizeTeam} from '../calendar.mjs';
import {enrichPresence,lineupCatalog} from '../lineup-presence.mjs';
import {patchSports} from './sports-db.mjs';
import {beginBackgroundWrite} from './background-db.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const openStatuses=new Set(['NS','TBD']);
const forecastSources=new Set(['Confronto probabili','Sky Sport','SOS Fanta','La Gazzetta dello Sport','Corriere dello Sport']);
const retired=l=>[l.source,...(l.sources||[])].some(s=>s&&!forecastSources.has(s));

export async function recordLineupIssues(issues,{connect=connection,now=Date.now()}={}){
 if(!issues.length)return 0;
 const stamp=new Date(now).toISOString(),records=new Map();
 for(const issue of issues){
  const players=[...(issue.players||[])].sort((a,b)=>String(a.id||a.name).localeCompare(String(b.id||b.name)));
  const id='lineup-quality:issue:'+hash([issue.fixture,issue.team,issue.source,issue.code,issue.section,issue.number,issue.numbers,players]);
  records.set(id,{id,data:{...issue,players,firstSeen:stamp,lastSeen:stamp,count:1}});
 }
 const c=await connect();
 try{
  await c.query(`INSERT INTO fanta.jobs(id,data) SELECT id,data FROM jsonb_to_recordset($1::jsonb) AS r(id text,data jsonb)
   ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data||jsonb_build_object(
    'firstSeen',least(fanta.jobs.data->>'firstSeen',EXCLUDED.data->>'firstSeen'),
    'lastSeen',greatest(fanta.jobs.data->>'lastSeen',EXCLUDED.data->>'lastSeen'),
    'count',coalesce((fanta.jobs.data->>'count')::int,0)+1)`,[JSON.stringify([...records.values()])]);
  return records.size;
 }finally{c.release();}
}

export async function pinSeasonJerseys(catalog,{connect=connection,season,now=Date.now(),official=[]}={}){
 const shirts=new Map();
 for(const match of official)for(const raw of match.lineups.teams){
  const team=cleanLineupTeam(raw);
  for(const p of [...team.players,...team.bench]){
   const number=validJersey(p.jersey),id=lineupPlayerId(p);
   if(!number||!id)continue;
   const key=normalizeTeam(team.team)+':'+id;
   if(!shirts.has(key))shirts.set(key,[]);
   shirts.get(key).push(number);
  }
 }
 const candidates=[];
 for(const p of catalog.filter(p=>p.active!==false)){
  const roster=validJersey(p.number),stats=validJersey(p.seasonNumber),observed=shirts.get(normalizeTeam(p.club)+':'+lineupPlayerId(p))||[];
  const official=observed[0],consistent=observed.every(n=>n===official);
  const number=official&&consistent&&(observed.length>=2||[roster,stats].includes(official))?official
   :roster===stats&&(!official||consistent&&official===roster)?roster:'';
  if(number)candidates.push({...p,number});
 }
 const owners=new Map();
 for(const p of [...catalog.filter(p=>validJersey(p.verifiedNumber)),...candidates]){
  const key=p.clubId+':'+(p.verifiedNumber||p.number);
  if(!owners.has(key))owners.set(key,new Set());
  owners.get(key).add(p.id);
 }
 const rows=candidates.filter(p=>!p.verifiedNumber&&owners.get(p.clubId+':'+p.number)?.size===1)
  .map(p=>({id:p.id,club_id:p.clubId,number:validJersey(p.number)}));
 if(!rows.length)return 0;
 const c=await connect();
 try{
  await beginBackgroundWrite(c);
  await c.query('SELECT pg_advisory_xact_lock(826530)');
  const {rows:changed}=await c.query(`UPDATE fanta.players p SET data=jsonb_set(p.data,'{verifiedJersey}',
   jsonb_build_object('season',$2::int,'clubId',v.club_id,'number',v.number))
   FROM jsonb_to_recordset($1::jsonb) AS v(id text,club_id text,number text)
   WHERE p.id=v.id AND p.club_id=v.club_id
   AND (p.data#>>'{verifiedJersey,season}' IS DISTINCT FROM $2::text OR p.data#>>'{verifiedJersey,clubId}' IS DISTINCT FROM v.club_id)
   RETURNING p.id`,[JSON.stringify(rows),season]);
  if(changed.length)await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',
   ['lineup-quality:numbers:'+season,JSON.stringify({revision:hash([now,changed]),at:new Date(now).toISOString()})]);
  await c.query('COMMIT');
  return changed.length;
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}
 finally{c.release();}
}

export async function auditStoredLineups({connect=connection,sportsStorage=barStorageMode(),season=Number(process.env.FANTA_SEASON||2026),now=Date.now(),repair=true}={}){
 let catalog=await lineupCatalog({connect,cache:null,season,now});
 const c=await connect();
 let fixtures;
 try{
  const sql=sportsStorage==='rows'?`SELECT round.data->>'number' AS round,m.data AS match
   FROM fanta.bar_seriea_matches m JOIN fanta.bar_seriea_calendar_rounds round ON round.position=m.round_position
   WHERE jsonb_typeof(m.data->'lineups')='object'`
   :`SELECT r->>'number' AS round,m AS match FROM public.fanta_state
    CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r
    CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m
    WHERE id=1 AND jsonb_typeof(m->'lineups')='object'`;
  fixtures=(await c.query(sql)).rows;
  if(repair)await c.query(`UPDATE public.fanta_state SET payload=payload #- '{football,editorialLineupCache}'
   WHERE id=1 AND payload#>'{football,editorialLineupCache}' IS NOT NULL`);
 }finally{c.release();}
 const official=fixtures.filter(f=>f.match.lineups.kind==='official').map(f=>f.match);
 const pinned=repair?await pinSeasonJerseys(catalog,{connect,season,now,official}):0;
 if(pinned)catalog=await lineupCatalog({connect,cache:null,season,now});
 const issues=[],updates=new Map();
 for(const {round,match} of fixtures){
  const l=match.lineups,context={season,round:Number(round),fixture:match.id,fixtureApiId:match.apiFootballId??null};
  const report=issue=>issues.push({...context,source:l.kind==='official'?'API-Football /fixtures/lineups':'Catalogo e probabili',...issue});
  const upcoming=l.kind==='probable'&&openStatuses.has(match.status||'NS')&&Date.parse(match.kickoff)>now;
  let next=l;
  for(const team of l.teams||[])cleanLineupTeam(team,report);
  if(l.kind==='probable'&&retired(l)){
   report({code:'retired-forecast-source',source:'Fonte ritirata'});
   next=null;
  }else if(upcoming)next=enrichPresence(l,catalog,{fixtureId:match.apiFootballId,report});
  if(l.kind==='probable'&&!isDeepStrictEqual(l,next))updates.set(match.id,{previous:l,lineups:next});
 }
 const count=repair?await recordLineupIssues(issues,{connect,now}):0;
 let changed=0;
 if(repair)for(const [id,update] of updates){
  const {result}=await patchSports([id],state=>{
   const target=state.football.calendar.rounds.flatMap(r=>r.matches).find(m=>m.id===id);
   if(!target||!isDeepStrictEqual(target.lineups,update.previous))return 0;
   target.lineups=update.lineups;
   return 1;
  },{connect,sportsStorage,forecastOnly:true});
  changed+=result;
 }
 return {fixtures:fixtures.length,official:fixtures.filter(f=>f.match.lineups.kind==='official').length,probable:fixtures.filter(f=>f.match.lineups.kind==='probable').length,pinned,changed,issues:issues.length,recorded:count,
  byCode:Object.fromEntries([...new Set(issues.map(i=>i.code))].sort().map(code=>[code,issues.filter(i=>i.code===code).length]))};
}
