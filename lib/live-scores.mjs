import { recordExternal } from "./platform-admin.mjs";
import {
  ensureCalendar,
  matchCalendarEvent,
  updateCalendarRounds,
} from "./calendar.mjs";
export const LIVE_INTERVAL = 60000;
const BASE = "https://sportscore.com/api/v1/fixtures/";
const day = (date) => date.toISOString().slice(0, 10);
// Windows follow confirmed kickoffs, not the arrival of users on the site.
export function liveDates(f, now = new Date()) {
  const dates = new Set();
  for (const m of f.calendar?.rounds.flatMap((r) => r.matches) || []) {
    if (!m.kickoff || m.officialConfirmed || m.status === "FT") continue;
    const kickoff = new Date(m.kickoff),
      elapsed = now - kickoff;
    if (elapsed >= -5 * 60000 && elapsed <= 4 * 3600000)
      dates.add(day(kickoff));
  }
  return [...dates].sort();
}
export function liveDue(f, now = new Date()) {
  const last = f.lastLiveAttempt || f.lastLiveSync;
  return (
    (!last || now - new Date(last) >= LIVE_INTERVAL) &&
    liveDates(f, now).length > 0
  );
}
export async function requestLive(date) {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries({
    sport: "football",
    date,
    competition: "italian-serie-a",
    limit: 20,
  }))
    url.searchParams.set(k, v);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  recordExternal("SportScore", url.pathname, response.status);
  if (!response.ok) throw Error(`SportScore: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.matches))
    throw Error("SportScore: formato risultati inatteso");
  return data;
}
export async function collectLive(f, fetcher = requestLive, now = new Date()) {
  if (!liveDue(f, now)) return null;
  const dates = liveDates(f, now),
    matches = [];
  for (const date of dates) {
    const data = await fetcher(date);
    if (!Array.isArray(data.matches))
      throw Error("SportScore: formato risultati inatteso");
    matches.push(...data.matches);
  }
  return { matches, at: now.toISOString(), requests: dates.length };
}
function score(x) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isInteger(n) && n >= 0 && n <= 40 ? n : null;
}
export function applyLive(s, batch) {
  if (!batch) return 0;
  ensureCalendar(s);
  let updated = 0;
  for (const e of batch.matches) {
    if (
      e.competition !== "Italian Serie A" ||
      !e.time ||
      !Number.isFinite(Date.parse(e.time))
    )
      continue;
    if (
      new Date(e.time) < new Date("2026-07-01") ||
      new Date(e.time) >= new Date("2027-07-01")
    )
      continue;
    const mapped = matchCalendarEvent(s, {
      home_team: e.home,
      away_team: e.away,
    });
    if (!mapped) continue;
    const m = mapped.match;
    if (m.officialConfirmed || m.status === "FT") continue;
    // Exact directed pairing and date prevent another competition/season from overwriting a match.
    if (
      m.kickoff &&
      Math.abs(new Date(m.kickoff) - new Date(e.time)) > 36 * 3600000
    )
      continue;
    const a = score(e.home_score),
      b = score(e.away_score),
      status = String(e.status).toLowerCase();
    if (
      ![
        "live",
        "in_progress",
        "inprogress",
        "halftime",
        "half_time",
        "finished",
        "upcoming",
      ].includes(status)
    )
      continue;
    m.kickoff = e.time;
    if (status === "upcoming") {
      if (m.status === "LIVE") continue;
      m.status = "NS";
    } else if (a !== null && b !== null) {
      if (status === "finished") {
        m.score = [a, b];
        m.status = "FT";
        m.liveScore = null;
        m.clock = null;
        m.scoreSource = "SportScore";
      } else {
        m.status = "LIVE";
        m.liveScore = [a, b];
        if (/half.?time/.test(status)) {
          m.clock = "Intervallo";
          m.phase = "Half Time";
        } else if (
          !m.clockUpdatedAt ||
          new Date(batch.at) - new Date(m.clockUpdatedAt) > 120000
        ) {
          const minute = e.minute ?? e.clock ?? e.status_text;
          m.clock =
            minute != null &&
            /^\d{1,3}(?:\+\d{1,2})?['′]?$/.test(String(minute))
              ? String(minute).replace(/['′]$/, "") + "'"
              : null;
          m.phase = String(e.status_text || "").slice(0, 60);
        }
      }
    } else continue;
    m.liveSource = "SportScore";
    m.scoreUpdatedAt = batch.at;
    updated++;
  }
  s.football.lastLiveSync = batch.at;
  s.football.lastLiveAttempt = batch.at;
  s.football.liveSource = "SportScore";
  s.football.lastLiveError = null;
  updateCalendarRounds(s);
  return updated;
}
