import { randomUUID } from "node:crypto";
import { transaction,connection } from "./db.mjs";
import {recordLineupAccuracy} from './lineup-accuracy.mjs';
import { loadMatchDetails, requestMatchData } from "./match-data.mjs";
import { loadProbableLineups, probableLineupsDue } from "./lineups.mjs";
import { ensureCalendar, updateCalendarRounds } from "./calendar.mjs";
import { sealSession, openSession } from "./sealed-data.mjs";
import {barStorageMode} from './storage-mode.mjs';
import {patchSports} from './operations/sports-db.mjs';
import {readCalendarFixtures} from './operations/bar-rows.mjs';
import {beginBackgroundWrite} from './operations/background-db.mjs';
import {updateDerived} from './operations/derived-db.mjs';
import initialCache from "../data/match-cache-final.json" with { type: "json" };
const MIN = 60000,
  HOUR = 60 * MIN;
export function primeMatchCache(s) {
  const cal = ensureCalendar(s);
  if (
    cal.season !== initialCache.season ||
    s.football.initialMatchCache === initialCache.version
  )
    return;
  for (const source of initialCache.matches) {
    const m = cal.rounds
      .flatMap((r) => r.matches)
      .find(
        (m) =>
          m.id === source.id &&
          m.home === source.home &&
          m.away === source.away,
      );
    if (
      !m ||
      (m.espnId && m.espnId !== source.espnId) ||
      (m.score && m.score.join(":") !== source.score.join(":"))
    )
      continue;
    if (!m.details?.complete) {
      m.details = structuredClone(source.details);
      m.espnId = source.espnId;
    }
    if (!m.score) {
      m.score = [...source.score];
      m.status = "FT";
      m.scoreSource = "ESPN";
      m.scoreUpdatedAt = source.details.updatedAt;
    }
    if (!m.lineups && source.lineups)
      m.lineups = structuredClone(source.lineups);
  }
  s.football.initialMatchCache = initialCache.version;
  updateCalendarRounds(s);
}
export function planMatchCache(s, now = new Date()) {
  return ensureCalendar(s)
    .rounds.flatMap((r) => r.matches)
    .flatMap((m) => {
      if (m.storedDataClosure) return [];
      if (m.status === "FT" && m.details?.complete) return [];
      if (m.liveSource === 'API-FOOTBALL' && m.status === 'FT') return [];
      const until = Date.parse(m.kickoff) - now,
        last = Date.parse(m.cacheAttemptAt || 0),
        elapsed = now - last;
      if (m.status === "FT" || until < -4 * HOUR) {
        return !Number.isFinite(last) || elapsed >= 6 * HOUR
          ? [{ id: m.id, kind: "archive", priority: 2, kickoff: m.kickoff }]
          : [];
      }
      if (
        until <= 30 * MIN &&
        until >= -15 * MIN &&
        m.lineups?.kind !== "official" &&
        (!Number.isFinite(last) || elapsed >= 5 * MIN)
      )
        return [
          { id: m.id, kind: "official", priority: 0, kickoff: m.kickoff },
        ];
      return probableLineupsDue(m, now)
        ? [{ id: m.id, kind: "probable", priority: 1, kickoff: m.kickoff }]
        : [];
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.kind === "archive"
          ? Date.parse(b.kickoff) - Date.parse(a.kickoff)
          : Date.parse(a.kickoff) - Date.parse(b.kickoff)),
    );
}

function mergeCachedMatch(target, source, at, {protectNewerLineups=false}={}) {
  if (!target || target.storedDataClosure || (target.status === "FT" && target.details?.complete)) return false;
  target.cacheAttemptAt = at.toISOString();
  for (const key of ["espnId","detailCheckedAt","detailError","lineupCheckedAt"])
    if (source[key] !== undefined) target[key] = source[key];
  const liveOwned = ['SportAPI.ai','API-FOOTBALL'].includes(target.liveSource);
  if (!liveOwned && source.details && (!target.details ||
      Date.parse(source.details.updatedAt) >= Date.parse(target.details.updatedAt || 0)))
    target.details = source.details;
  if (source.lineups && (target.lineups?.kind !== "official" || source.lineups.kind === "official") &&
      (!protectNewerLineups || !(Date.parse(target.lineups?.updatedAt)>Date.parse(source.lineups.updatedAt||0))))
    target.lineups = source.lineups;
  if (!liveOwned && source.status === "FT" && source.score && target.status !== "FT")
    for (const key of ["status","score","scoreSource","scoreUpdatedAt"])
      if (source[key] !== undefined) target[key] = source[key];
  return true;
}

async function matchCacheLease(connect, lease, now, report=null, caches={}){
  const c=await connect();
  try {
    await beginBackgroundWrite(c);
    const patch=report?{...caches,matchCacheReport:{...report,at:now.toISOString()}}:
      {matchCacheLease:{id:lease,until:+now+10*MIN}};
    const guard=report?"payload#>>'{football,matchCacheLease,id}'=$2":
      "coalesce((payload#>>'{football,matchCacheLease,until}')::numeric,0)<=$2::numeric";
    const result=await c.query(`UPDATE public.fanta_state SET payload=jsonb_set(payload,'{football}',
      ((payload->'football') - 'matchCacheLease')||$1::jsonb)
      WHERE id=1 AND ${guard}
      RETURNING ${report?"1":"(payload->'football') - ARRAY['calendar','rounds','fixtures']"} AS football`,
      [JSON.stringify(patch),report?lease:+now]);
    await c.query('COMMIT');
    return result.rows[0]?.football;
  }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
}

async function runRowMatchCache({connect,fetcher,lineupFetcher,now,maxTasks,budgetMs,recordAccuracy,includeProbables}){
  const start=+now(),lease=randomUUID(),root=await matchCacheLease(connect,lease,new Date(start));
  const report={processed:0,complete:0,lineups:0,failed:0};
  if(!root)return {...report,busy:true};
  const caches=Object.fromEntries(['scoreboardCache','editorialLineupCache','forecastSourceCache'].filter(k=>root[k]).map(k=>[k,root[k]]));
  try {
    const c=await connect();
    let summary;
    try{
      summary=(await c.query(`SELECT id,data->>'kickoff' AS kickoff,data->>'status' AS status,
        data->>'liveSource' AS "liveSource",data->>'cacheAttemptAt' AS "cacheAttemptAt",data->>'lineupCheckedAt' AS "lineupCheckedAt",
        data->>'storedDataClosure' AS "storedDataClosure",
        jsonb_build_object('complete',data#>'{details,complete}') AS details,
        CASE WHEN jsonb_typeof(data->'lineups')='object' THEN jsonb_build_object('kind',data#>'{lineups,kind}',
          'enrichmentVersion',data#>'{lineups,enrichmentVersion}') END AS lineups
        FROM fanta.bar_seriea_matches ORDER BY round_position,position`)).rows;
    }finally{c.release();}
    const jobs=planMatchCache({football:{calendar:{season:initialCache.season,rounds:[{matches:summary}]}}},now()).filter(j=>includeProbables||j.kind!=='probable').slice(0,maxTasks);
    for(const job of jobs){
      const at=now();
      if(+at-start>=budgetMs)break;
      const c=await connect();let calendar;
      try{calendar=await readCalendarFixtures(c,[job.id]);}finally{c.release();}
      const source=calendar.rounds[0]?.matches[0];
      if(!source||source.storedDataClosure)continue;
      const snapshot={football:{...caches,calendar,historySeedVersion:root.historySeedVersion,
        detailsSeedVersion:root.detailsSeedVersion},leagues:[],rounds:[],users:[]};
      try{
        if(job.kind==='probable')await loadProbableLineups(snapshot,source,lineupFetcher,at);
        else await loadMatchDetails(snapshot,source.id,fetcher,at,lineupFetcher);
      }catch{
        source.detailError='Dettagli temporaneamente non disponibili';
      }
      const saved=await patchSports([source.id],s=>{
        const target=s.football.calendar.rounds[0]?.matches[0];
        return mergeCachedMatch(target,source,at,{protectNewerLineups:true});
      },{connect,sportsStorage:'rows',includeForecastMetadata:true});
      if(saved.derive)await updateDerived([source.id],{connect,sportsStorage:'rows'});
      for(const key of ['scoreboardCache','editorialLineupCache','forecastSourceCache'])
        if(snapshot.football[key])caches[key]=snapshot.football[key];
      if(recordAccuracy&&saved.accuracyMatches.length)try{
        await recordAccuracy(saved.accuracyMatches,{now:+at,season:Number(calendar.season)});
      }catch{report.accuracyErrors=(report.accuracyErrors||0)+1;}
      report.processed++;
      if(source.details?.complete)report.complete++;
      if(source.lineups)report.lineups++;
      if(source.detailError)report.failed++;
      const summaryMatch=summary.find(m=>m.id===source.id);
      if(saved.result&&summaryMatch){
        const current=saved.matches[0];
        summaryMatch.status=current.status;
        summaryMatch.details={complete:current.details?.complete};
      }
    }
    const finished=summary.filter(m=>m.status==='FT');
    report.archivedFinal=finished.filter(m=>m.details?.complete).length;
    report.missingFinal=finished.length-report.archivedFinal;
    return report;
  }finally{
    if(caches.scoreboardCache)caches.scoreboardCache=Object.fromEntries(Object.entries(caches.scoreboardCache)
      .sort(([,a],[,b])=>Date.parse(b.at)-Date.parse(a.at)).slice(0,14));
    await matchCacheLease(connect,lease,now(),report,caches);
  }
}
// Network is outside transactions. Each result is merged into the current DB
// under a lease; a final tabellino already completed by live sync always wins.
export async function runMatchCache({
  transact = transaction,
  connect = connection,
  sportsStorage = barStorageMode(),
  fetcher = requestMatchData,
  lineupFetcher = fetch,
  now = () => new Date(),
  maxTasks = 20,
  budgetMs = 8 * 60000,
  includeProbables = true,
  recordAccuracy=transact===transaction?recordLineupAccuracy:null,
} = {}) {
  if(transact===transaction&&sportsStorage==='rows')
    return runRowMatchCache({connect,fetcher,lineupFetcher,now,maxTasks:Math.min(maxTasks,10),budgetMs:Math.min(budgetMs,2*MIN),recordAccuracy,includeProbables});
  const start = +now(),
    lease = randomUUID();
  const snapshot = await transact((s) => {
    ensureCalendar(s);
    if (s.football.matchCacheLease?.until > +now()) return null;
    primeMatchCache(s);
    s.football.matchCacheLease = { id: lease, until: +now() + 10 * 60000 };
    return structuredClone(s);
  });
  const report = { processed: 0, complete: 0, lineups: 0, failed: 0 };
  if (!snapshot) return { ...report, busy: true };
  try {
    for (const job of planMatchCache(snapshot, now()).filter(j=>includeProbables||j.kind!=='probable').slice(0, maxTasks)) {
      if (+now() - start >= budgetMs) break;
      const m = snapshot.football.calendar.rounds
          .flatMap((r) => r.matches)
          .find((m) => m.id === job.id),
        at = now();
      m.cacheAttemptAt = at.toISOString();
      try {
        if (job.kind === "probable")
          await loadProbableLineups(snapshot, m, lineupFetcher, at);
        else await loadMatchDetails(snapshot, m.id, fetcher, at, lineupFetcher);
        const accuracyMatch=await transact((s) => {
          if (s.football.matchCacheLease?.id !== lease) return;
          const target = ensureCalendar(s)
            .rounds.flatMap((r) => r.matches)
            .find((x) => x.id === job.id);
          if(!mergeCachedMatch(target,m,at))return;
          s.football.scoreboardCache = {
            ...s.football.scoreboardCache,
            ...snapshot.football.scoreboardCache,
          };
          if(snapshot.football.editorialLineupCache)s.football.editorialLineupCache=structuredClone(snapshot.football.editorialLineupCache);
          if(snapshot.football.forecastSourceCache)s.football.forecastSourceCache=structuredClone(snapshot.football.forecastSourceCache);
          updateCalendarRounds(s);
          return {id:target.id,home:target.home,away:target.away,kickoff:target.kickoff,status:target.status,lineups:target.lineups};
        });
        if(accuracyMatch&&recordAccuracy)try{await recordAccuracy([accuracyMatch],{now:+now(),season:Number(snapshot.football.calendar.season)});}catch{report.accuracyErrors=(report.accuracyErrors||0)+1;}
        report.processed++;
        if (m.details?.complete) report.complete++;
        if (m.lineups) report.lineups++;
        if (m.detailError) report.failed++;
      } catch {
        report.failed++;
        await transact((s) => {
          const target = s.football.calendar.rounds
            .flatMap((r) => r.matches)
            .find((m) => m.id === job.id);
          if (target) target.cacheAttemptAt = at.toISOString();
        });
      }
    }
  } finally {
    await transact((s) => {
      if (s.football.matchCacheLease?.id === lease) {
        delete s.football.matchCacheLease;
        const finished = s.football.calendar.rounds
          .flatMap((r) => r.matches)
          .filter((m) => m.status === "FT");
        report.archivedFinal = finished.filter(
          (m) => m.details?.complete,
        ).length;
        report.missingFinal = finished.length - report.archivedFinal;
        s.football.matchCacheReport = { ...report, at: now().toISOString() };
      }
    });
  }
  return report;
}
export function matchCacheTicket(env = process.env, now = Date.now()) {
  return sealSession({ at: now }, "match-cache:dispatch", env);
}
export function validMatchCacheTicket(
  ticket,
  env = process.env,
  now = Date.now(),
) {
  try {
    const data = openSession(ticket, "match-cache:dispatch", env);
    return (
      Number.isFinite(data.at) &&
      data.at <= now + 10000 &&
      now - data.at < 120000
    );
  } catch {
    return false;
  }
}
