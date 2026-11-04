import { ensureCalendar, matchCalendarEvent, updateCalendarRounds } from './calendar.mjs';
import { recordExternal } from './platform-admin.mjs';

export const SPORTAPI_SOURCE = 'SportAPI.ai';
const MINUTE = 60000, HOUR = 60 * MINUTE;
export const sportApiEnabled = (env = process.env) => !!env.SPORTAPI_KEY?.trim();

export async function requestSportApi(path, {env = process.env, fetcher = fetch} = {}) {
  if (!sportApiEnabled(env)) throw Error('SportAPI.ai: chiave server non configurata');
  if (!/^fixtures\/(?:date\/\d{4}-\d{2}-\d{2}|\d+)$/.test(path)) throw Error('SportAPI.ai: endpoint non consentito');
  let response;
  try {
    response = await fetcher('https://sportapi.ai/api/' + path, {
      headers: {'X-Api-Key': env.SPORTAPI_KEY.trim()}, signal: AbortSignal.timeout(10000), redirect: 'error',
    });
  } catch { throw Error('SportAPI.ai: servizio temporaneamente non raggiungibile'); }
  recordExternal(SPORTAPI_SOURCE, path, response.status);
  // Never include remote error bodies or headers: they may contain credentials.
  if (!response.ok) throw Error(`SportAPI.ai: HTTP ${response.status}`);
  let data;
  try { data = await response.json(); } catch { throw Error('SportAPI.ai: risposta non valida'); }
  if (data?.success !== true) throw Error('SportAPI.ai: risposta non valida');
  return data;
}

export function sportApiCandidates(f, now = new Date()) {
  return (f.calendar?.rounds.flatMap(r => r.matches) || []).filter(m => {
    const elapsed = now - new Date(m.kickoff);
    if (!m.kickoff || !Number.isFinite(elapsed)) return false;
    if (m.status === 'FT') {
      // Recheck the final sheet while the provider finishes publishing cards, then archive it.
      return m.liveSource === SPORTAPI_SOURCE && !m.details?.complete && elapsed <= 8 * HOUR &&
        (!m.sportApiCheckedAt || now - new Date(m.sportApiCheckedAt) >= 15 * MINUTE);
    }
    return !m.officialConfirmed && elapsed >= -5 * MINUTE && elapsed <= 4 * HOUR;
  });
}
export function sportApiDue(f, now = new Date()) {
  // Cron delivery has millisecond jitter: once per UTC minute avoids skipping alternate ticks.
  return (!f.lastLiveAttempt || Math.floor(+now / MINUTE) > Math.floor(Date.parse(f.lastLiveAttempt) / MINUTE)) && sportApiCandidates(f, now).length > 0;
}
function isSerieA(e) {
  return Number(e?.league_id) === 3 && e.league_geo === 'IT';
}
function validPair(f, m, e) {
  if (!isSerieA(e) || !/^\d+$/.test(String(e.id)) || !Number.isFinite(Date.parse(e.kickoff_utc))) return false;
  if (Math.abs(Date.parse(m.kickoff) - Date.parse(e.kickoff_utc)) > 36 * HOUR) return false;
  const mapped = matchCalendarEvent({football:f}, e);
  return mapped?.match.id === m.id;
}

export async function collectSportApi(f, fetcher = requestSportApi, now = new Date()) {
  if (!sportApiDue(f, now)) return null;
  const candidates = sportApiCandidates(f, now), dates = new Map(), errors = [], matches = [];
  let requests = 0;
  // Once the ID is known, one detail request per match supplies score, clock and events together.
  for (const m of candidates.filter(m => !m.sportApiId)) {
    const date = m.kickoff.slice(0, 10);
    if (dates.has(date)) continue;
    try {
      requests++;
      const data = await fetcher('fixtures/date/' + date);
      if (!Array.isArray(data.data)) throw Error();
      dates.set(date, data.data.filter(isSerieA));
    } catch { dates.set(date, []); errors.push('SportAPI.ai: calendario temporaneamente non disponibile'); }
  }
  await Promise.all(candidates.map(async m => {
    const listing = dates.get(m.kickoff.slice(0, 10))?.find(e => validPair(f, m, e));
    const id = m.sportApiId || listing?.id;
    if (!id) return;
    try {
      requests++;
      const data = await fetcher('fixtures/' + encodeURIComponent(id));
      if (!validPair(f, m, data.fixture) || String(data.fixture.id) !== String(id)) throw Error();
      matches.push({matchId:m.id, fixture:data.fixture});
    } catch {
      // A failed event request must not discard a valid score from discovery.
      if (listing) matches.push({matchId:m.id, fixture:listing});
      errors.push('SportAPI.ai: dettaglio temporaneamente non disponibile');
    }
  }));
  return {matches, requests, errors:[...new Set(errors)], at:now.toISOString()};
}

const score = x => x !== null && x !== undefined && x !== '' && Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) <= 40 ? Number(x) : null;
export function sportApiTimeline(fixture) {
  const seen = new Set();
  return (fixture.events || []).flatMap(e => {
    const type = String(e.event_type || '').toLowerCase(), info = String(e.extra_info || '').toLowerCase();
    if (/disallowed|cancelled|missed|shootout/.test(type + ' ' + info)) return [];
    const kind = /own.?goal/.test(type + ' ' + info) ? 'own-goal' :
      type === 'goal' || type === 'penalty_goal' ? 'goal' :
      /red|second.?yellow/.test(type) ? 'red' : /yellow/.test(type) ? 'yellow' : null;
    if (!kind || !['home','away'].includes(e.team_side)) return [];
    const minute = String(e.minute || '').replace(/[′’]/g, "'"), parts = minute.match(/^(\d{1,3})(?:\+(\d{1,2}))?[' ]?$/);
    const id = String(e.id || `${kind}:${e.team_side}:${minute}:${e.player_name || ''}`);
    if (seen.has(id)) return []; seen.add(id);
    return [{id,kind,side:e.team_side,team:e.team_side === 'home' ? fixture.home_team : fixture.away_team,
      minute,seconds:parts ? (Number(parts[1])+Number(parts[2]||0))*60 : 0,
      players:e.player_name ? [String(e.player_name)] : [],penalty:kind === 'goal' && /penalty/.test(type + ' ' + info)}];
  }).sort((a,b) => a.seconds-b.seconds);
}
export function applySportApi(s, batch) {
  if (!batch) return 0;
  const f = s.football; ensureCalendar(s);
  let updated = 0;
  for (const item of batch.matches) {
    const m = f.calendar.rounds.flatMap(r => r.matches).find(m => m.id === item.matchId), e = item.fixture;
    if (!m || !validPair(f,m,e) || (m.status === 'FT' && m.liveSource !== SPORTAPI_SOURCE)) continue;
    if (m.details?.complete && m.status === 'FT') continue;
    if (m.sportApiUpdatedAt && e.updated_at && Date.parse(e.updated_at) < Date.parse(m.sportApiUpdatedAt)) continue;
    const a = score(e.home_score), b = score(e.away_score), status = e.status;
    if (!['Scheduled','LIVE','FT'].includes(status)) continue;
    if ((status === 'Scheduled' && m.status !== 'NS' && m.status) || (m.status === 'FT' && status !== 'FT')) continue;
    if (status !== 'Scheduled' && (a === null || b === null)) continue;
    // Never change an already settled final score while completing the events archive.
    if (m.status === 'FT' && m.score && m.score.join() !== [a,b].join()) continue;
    m.sportApiId = e.id;
    m.sportApiCheckedAt = batch.at;
    m.sportApiUpdatedAt = e.updated_at || batch.at;
    m.liveSource = SPORTAPI_SOURCE;
    m.scoreSource = SPORTAPI_SOURCE;
    m.scoreUpdatedAt = batch.at;
    m.status = status === 'Scheduled' ? 'NS' : status;
    if (status === 'LIVE') {
      m.liveScore = [a,b]; m.score = null;
      const minute = String(e.minute ?? '');
      m.clock = minute === 'HT' ? 'Intervallo' : /^\d{1,3}(?:\+\d{1,2})?['′]?$/.test(minute) ? minute.replace(/['′]$/, '') + "'" : null;
      m.clockSource = SPORTAPI_SOURCE; m.clockUpdatedAt = batch.at;
      m.phase = minute === 'HT' ? 'Half Time' : 'In corso';
    } else if (status === 'FT') {
      m.score = [a,b]; m.liveScore = null; m.clock = null; m.phase = 'Finale';
      m.officialConfirmed = true; m.scoreVerifiedAt = batch.at;
      m.sportApiFinalAt ||= batch.at;
    }
    if (Array.isArray(e.events)) {
      const events = sportApiTimeline(e), goals = events.filter(e => e.kind === 'goal' || e.kind === 'own-goal');
      const complete = status === 'FT' && goals.length === a+b && Date.parse(batch.at)-Date.parse(m.sportApiFinalAt) >= HOUR;
      m.details = {source:SPORTAPI_SOURCE,updatedAt:batch.at,events,complete};
    }
    updated++;
  }
  if (updated) f.lastLiveSync = batch.at;
  f.lastLiveAttempt = batch.at; f.liveSource = SPORTAPI_SOURCE;
  f.lastLiveError = batch.errors?.join(' · ') || null;
  updateCalendarRounds(s);
  return updated;
}
