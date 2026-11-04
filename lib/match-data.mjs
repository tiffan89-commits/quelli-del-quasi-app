import { recordExternal } from "./platform-admin.mjs";
import { parseESPNLineups, loadProbableLineups } from "./lineups.mjs";
import {
  ensureCalendar,
  matchCalendarEvent,
  normalizeTeam,
  updateCalendarRounds,
} from "./calendar.mjs";
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/";
export async function requestMatchData(path) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(8000) });
  recordExternal("ESPN", path, res.status);
  if (!res.ok) throw Error("Fonte risultati temporaneamente non disponibile");
  return res.json();
}
function number(x) {
  const v = Number(typeof x === "object" ? (x?.value ?? x?.displayValue) : x);
  return Number.isInteger(v) && v >= 0 && v <= 40 ? v : null;
}
export function normalizeTimeline(events, competition = {}) {
  const names = Object.fromEntries(
    (competition.competitors || []).map((x) => [
      String(x.id),
      x.team?.displayName || "",
    ]),
  );
  return (events || [])
    .flatMap((e, i) => {
      const type = String(e.type?.type || e.type?.text || "").toLowerCase();
      let kind = null;
      if (
        e.scoringPlay ||
        (type.includes("goal") && !type.includes("disallowed"))
      )
        kind = type.includes("own") || e.ownGoal ? "own-goal" : "goal";
      else if (
        e.redCard ||
        type.includes("red-card") ||
        type.includes("red card") ||
        type.includes("second-yellow")
      )
        kind = "red";
      else if (e.yellowCard || type.includes("yellow")) kind = "yellow";
      if (!kind || e.shootout) return [];
      const players = (e.participants || e.athletesInvolved || [])
        .map((p) => p.athlete?.displayName || p.displayName)
        .filter(Boolean);
      return [
        {
          id: String(
            e.id || `${kind}-${e.clock?.value || 0}-${players.join("-")}-${i}`,
          ),
          kind,
          minute: e.clock?.displayValue || "",
          seconds: Number(e.clock?.value || 0),
          team:
            e.team?.displayName ||
            names[String(e.team?.id)] ||
            names[String(e.participants?.[0]?.team?.id)] ||
            "",
          side:
            e.team?.homeAway ||
            competition.competitors?.find(
              (x) => String(x.id) === String(e.team?.id),
            )?.homeAway ||
            null,
          players:
            kind === "goal" || kind === "own-goal"
              ? players.slice(0, 1)
              : players,
          penalty:
            !!e.penaltyKick || (type.includes("penalty") && kind === "goal"),
        },
      ];
    })
    .sort((a, b) => a.seconds - b.seconds);
}
export function parseScoreEvent(event) {
  const c = event.competitions?.[0];
  if (!c) return null;
  const home = c.competitors?.find((x) => x.homeAway === "home"),
    away = c.competitors?.find((x) => x.homeAway === "away");
  if (!home || !away) return null;
  const status = c.status || event.status || {},
    completed = !!status.type?.completed,
    a = number(home.score),
    b = number(away.score);
  return {
    id: String(event.id),
    home_team: home.team.displayName,
    away_team: away.team.displayName,
    commence_time: event.date || c.date,
    completed,
    score: a !== null && b !== null ? [a, b] : null,
    status: completed ? "FT" : status.type?.state === "in" ? "LIVE" : "NS",
    clock: status.type?.name?.includes("HALFTIME")
      ? "Intervallo"
      : status.displayClock ||
        (/\d+['′]/.test(status.type?.shortDetail || "")
          ? status.type.shortDetail
          : null),
    phase: status.type?.description || null,
    timeline: normalizeTimeline(c.details, c),
    competition: c,
    sourceUrl:
      event.links?.find((x) => x.href?.startsWith("https://www.espn.com/"))
        ?.href || null,
  };
}
export function applyScoreEvents(
  s,
  events,
  { at = new Date().toISOString() } = {},
) {
  ensureCalendar(s);
  let count = 0;
  for (const event of events) {
    const x = parseScoreEvent(event);
    if (
      !x ||
      !x.commence_time ||
      new Date(x.commence_time) < new Date("2026-07-01") ||
      new Date(x.commence_time) >= new Date("2027-07-01")
    )
      continue;
    const mapped = matchCalendarEvent(s, x);
    if (!mapped) continue;
    const m = mapped.match;
    m.espnId = x.id;
    if (['SportAPI.ai','API-FOOTBALL'].includes(m.liveSource)) continue;
    m.kickoff = x.commence_time;
    m.phase = x.phase;
    if (x.status === "LIVE" && x.clock) {
      m.clock = x.clock;
      m.clockSource = "ESPN";
      m.clockUpdatedAt = at;
    }
    // A stale live feed must never erase an archived final score.
    if (
      !m.officialConfirmed &&
      (m.status !== "FT" || x.completed) &&
      !(m.status === "LIVE" && x.status === "NS")
    ) {
      m.status = x.status;
      if (x.clock) m.clock = x.clock;
      if (x.completed && x.score) {
        if (m.score && m.score.join() != x.score.join()) {
          m.scoreConflict = { observed: x.score, source: "ESPN", at };
        } else {
          m.score = x.score;
          m.scoreSource = "ESPN";
        }
      } else if (x.status === "LIVE") m.liveScore = x.score;
    }
    if (x.completed) {
      m.liveScore = null;
      m.clock = null;
    }
    if (x.timeline.length && (!m.details?.complete || m.status === "LIVE"))
      m.details = {
        source: "ESPN",
        sourceUrl: x.sourceUrl,
        updatedAt: at,
        complete: false,
        events: x.timeline,
      };
    m.scoreUpdatedAt = at;
    count++;
  }
  updateCalendarRounds(s);
  return count;
}
export async function collectScores(
  football,
  fetcher = requestMatchData,
  now = new Date(),
) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" })
    .format(now)
    .replaceAll("-", "");
  const board = await fetcher(`scoreboard?dates=${day}`);
  return { events: board.events || [], at: now.toISOString() };
}
export function applyMatchSummary(s, m, data, now = new Date()) {
  const c = data.header?.competitions?.[0];
  if (!c) return false;
  const h = c.competitors?.find((x) => x.homeAway === "home"),
    a = c.competitors?.find((x) => x.homeAway === "away");
  if (
    normalizeTeam(h?.team?.displayName) !== normalizeTeam(m.home) ||
    normalizeTeam(a?.team?.displayName) !== normalizeTeam(m.away)
  )
    throw Error("Dettagli partita non corrispondenti");
  const status = c.status || data.header?.status;
  const providerOwnsResults = ['SportAPI.ai','API-FOOTBALL'].includes(m.liveSource);
  if (!providerOwnsResults && status?.type?.state === "in" && m.status !== "FT") {
    m.status = "LIVE";
    m.clock = status.type.name?.includes("HALFTIME")
      ? "Intervallo"
      : status.displayClock || status.type.shortDetail || null;
    m.clockSource = "ESPN";
    m.clockUpdatedAt = now.toISOString();
    m.phase = status.type.description;
    const x = number(h.score),
      y = number(a.score);
    if (x !== null && y !== null) m.liveScore = [x, y];
  }
  const timelineAvailable =
      Array.isArray(data.keyEvents) || Array.isArray(c.details),
    complete =
      m.status === "FT" &&
      status?.type?.completed === true &&
      timelineAvailable;
  const events = normalizeTimeline(data.keyEvents || c.details || [], c);
  if (!providerOwnsResults && (events.length || !m.details?.events?.length))
    m.details = {
      source: "ESPN",
      sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${m.espnId}`,
      updatedAt: now.toISOString(),
      complete,
      events,
    };
  else if (!providerOwnsResults) m.details = { ...m.details, updatedAt: now.toISOString(), complete };
  const lineup = parseESPNLineups(data);
  if (lineup)
    m.lineups = {
      ...lineup,
      sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${m.espnId}`,
      updatedAt: now.toISOString(),
    };
  m.detailCheckedAt = now.toISOString();
  return true;
}
export async function loadMatchDetails(
  s,
  matchId,
  fetcher = requestMatchData,
  now = new Date(),
  lineupFetcher = fetch,
  cachedOnly = false,
) {
  const cal = ensureCalendar(s),
    m = cal.rounds.flatMap((r) => r.matches).find((m) => m.id === matchId);
  if (!m) return null;
  if (cachedOnly) return { match: m, cached: true };
  const live =
      m.status === "LIVE" || (m.status === "FT" && !m.details?.complete),
    near = m.kickoff && Math.abs(now - new Date(m.kickoff)) < 90 * 60000,
    ttl = live || near ? 60000 : 6 * 3600000;
  if (m.details?.complete && m.status === "FT")
    return { match: m, cached: true };
  if (m.detailCheckedAt && now - new Date(m.detailCheckedAt) < ttl) {
    if (m.status !== "FT" && m.lineups?.kind !== "official") {
      await loadProbableLineups(s, m, lineupFetcher, now);
      updateCalendarRounds(s);
    }
    return { match: m, cached: true };
  }
  m.detailCheckedAt = now.toISOString();
  try {
    if (!m.espnId && m.kickoff) {
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" })
        .format(new Date(m.kickoff))
        .replaceAll("-", "");
      s.football.scoreboardCache ??= {};
      let board = s.football.scoreboardCache[date];
      if (!board || now - new Date(board.at) >= (near ? 60000 : 6 * 3600000)) {
        const data = await fetcher("scoreboard?dates=" + date);
        board = s.football.scoreboardCache[date] = {
          at: now.toISOString(),
          events: data.events || [],
        };
      }
      applyScoreEvents(s, board.events, { at: board.at });
    }
    if (m.espnId) {
      const data = await fetcher(
        "summary?event=" + encodeURIComponent(m.espnId),
      );
      applyMatchSummary(s, m, data, now);
    }
  } catch {
    m.detailError = "Dettagli temporaneamente non disponibili";
  }
  if (!m.details?.complete && (!m.lineups || m.lineups.kind !== "official"))
    await loadProbableLineups(s, m, lineupFetcher, now);
  updateCalendarRounds(s);
  return { match: m, cached: false };
}
export function scoresDue(f, now = new Date()) {
  const matches = f.calendar?.rounds.flatMap((r) => r.matches) || [],
    active = matches.some(
      (m) =>
        m.kickoff &&
        m.status !== "FT" &&
        now - new Date(m.kickoff) >= -5 * 60000 &&
        now - new Date(m.kickoff) < 4 * 3600000,
    ),
    interval = active ? 60000 : 30 * 60000;
  if (
    (f.lastScoresAttempt && now - new Date(f.lastScoresAttempt) < interval) ||
    (f.lastScoresSync && now - new Date(f.lastScoresSync) < interval)
  )
    return false;
  return (
    active ||
    matches.some(
      (m) =>
        m.kickoff &&
        m.status !== "FT" &&
        now >= new Date(m.kickoff) &&
        now - new Date(m.kickoff) < 3 * 86400000,
    )
  );
}
export async function collectLiveDetails(
  f,
  events = [],
  fetcher = requestMatchData,
  now = new Date(),
) {
  const candidates = (
    f.calendar?.rounds.flatMap((r) => r.matches) || []
  ).filter(
    (m) =>
      m.kickoff &&
      (!['SportAPI.ai','API-FOOTBALL'].includes(m.liveSource) || m.lineups?.kind !== 'official') &&
      (m.status !== "FT" || !m.details?.complete) &&
      now - new Date(m.kickoff) >= -60 * 60000 &&
      now - new Date(m.kickoff) < 4 * 3600000 &&
      (!m.detailCheckedAt || now - new Date(m.detailCheckedAt) >= 60000),
  );
  return Promise.all(
    candidates.slice(0, 10).map(async (m) => {
      const event = events.find(
        (e) =>
          normalizeTeam(
            e.competitions?.[0]?.competitors?.find((c) => c.homeAway === "home")
              ?.team?.displayName,
          ) === normalizeTeam(m.home) &&
          normalizeTeam(
            e.competitions?.[0]?.competitors?.find((c) => c.homeAway === "away")
              ?.team?.displayName,
          ) === normalizeTeam(m.away),
      );
      const id = m.espnId || event?.id;
      if (!id) return null;
      try {
        return {
          matchId: m.id,
          espnId: id,
          data: await fetcher("summary?event=" + encodeURIComponent(id)),
          at: now.toISOString(),
        };
      } catch {
        return {
          matchId: m.id,
          espnId: id,
          error: true,
          at: now.toISOString(),
        };
      }
    }),
  );
}
