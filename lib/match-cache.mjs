import { randomUUID } from "node:crypto";
import { transaction } from "./db.mjs";
import {recordLineupAccuracy} from './lineup-accuracy.mjs';
import { loadMatchDetails, requestMatchData } from "./match-data.mjs";
import { loadProbableLineups, probableLineupsDue } from "./lineups.mjs";
import { ensureCalendar, updateCalendarRounds } from "./calendar.mjs";
import { sealSession, openSession } from "./sealed-data.mjs";
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
// Network is outside transactions. Each result is merged into the current DB
// under a lease; a final tabellino already completed by live sync always wins.
export async function runMatchCache({
  transact = transaction,
  fetcher = requestMatchData,
  lineupFetcher = fetch,
  now = () => new Date(),
  maxTasks = 20,
  budgetMs = 8 * 60000,
  recordAccuracy=transact===transaction?recordLineupAccuracy:null,
} = {}) {
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
    for (const job of planMatchCache(snapshot, now()).slice(0, maxTasks)) {
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
          if (!target || (target.status === "FT" && target.details?.complete))
            return;
          target.cacheAttemptAt = at.toISOString();
          // The source summary cannot roll a completed score or official lineup back.
          for (const key of [
            "espnId",
            "detailCheckedAt",
            "detailError",
            "lineupCheckedAt",
          ])
            if (m[key] !== undefined) target[key] = structuredClone(m[key]);
          if (
            !['SportAPI.ai','API-FOOTBALL'].includes(target.liveSource) && m.details &&
            (!target.details ||
              Date.parse(m.details.updatedAt) >=
                Date.parse(target.details.updatedAt || 0))
          )
            target.details = structuredClone(m.details);
          if (
            m.lineups &&
            (target.lineups?.kind !== "official" ||
              m.lineups.kind === "official")
          )
            target.lineups = structuredClone(m.lineups);
          if (!['SportAPI.ai','API-FOOTBALL'].includes(target.liveSource) && m.status === "FT" && m.score && target.status !== "FT") {
            for (const key of [
              "status",
              "score",
              "scoreSource",
              "scoreUpdatedAt",
            ])
              if (m[key] !== undefined) target[key] = structuredClone(m[key]);
          }
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
