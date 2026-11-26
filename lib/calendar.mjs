import { migrateFantasyWallets } from "./bar-fanta-wallet.mjs";
import {isMatchEvent} from '../public/match-events.mjs';
import { updatePlayerProfiles } from "./player-analysis.mjs";
import { updateSerieATable } from "./serie-a-table.mjs";
import seed from "../data/serie-a-2026.json" with { type: "json" };
import historySeed from "../data/historical-results-2026.json" with { type: "json" };
import detailsSeed from "../data/match-details-2026.json" with { type: "json" };
import { MARKETS, attachRounds, settle, refreshSlipPrices } from "./game.mjs";
import { migrateScoring,migrateStraightScoring } from "./scoring.mjs";
export function normalizeTeam(value) {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return (
    {
      acmilan: "milan",
      intermilan: "inter",
      internazionale: "inter",
      asroma: "roma",
      ssclazio: "lazio",
      sslazio: "lazio",
      sscnapoli: "napoli",
      torinofc: "torino",
      como1907: "como",
      uslecce: "lecce",
      hellasverona: "verona",
      udinesecalcio: "udinese",
    }[normalized] || normalized
  );
}
export function ensureCalendar(s) {
  const f = s.football;
  f.calendar ??= {};
  if (f.calendar.season !== seed.season) {
    f.calendar = {
      season: seed.season,
      source: seed.source,
      sourcePdf: seed.sourcePdf,
      extractedAt: seed.extractedAt,
      rounds: structuredClone(seed.rounds),
    };
  }
  for (const round of f.calendar.rounds)
    for (const [index, m] of round.matches.entries()) {
      m.id ??= `seriea:${seed.season}:${round.number}:${index + 1}`;
      m.frozen ??= {};
      m.odds ??= {};
      m.score ??= null;
      // The calendar date without a confirmed time is never used as a fictitious kickoff.
      m.kickoff ??= m.officialKickoff || null;
      if (m.details?.events)
        m.details.events = m.details.events.filter(isMatchEvent);
    }
  if (f.historySeedVersion !== historySeed.version) {
    for (const past of historySeed.matches) {
      const m = f.calendar.rounds
        .flatMap((r) => r.matches)
        .find(
          (m) =>
            normalizeTeam(m.home) === normalizeTeam(past.home) &&
            normalizeTeam(m.away) === normalizeTeam(past.away),
        );
      if (m) {
        m.espnId = past.id;
        if (!m.score) {
          m.score = past.score;
          m.status = "FT";
          m.scoreSource = "ESPN";
          m.scoreUpdatedAt = historySeed.version;
        }
        m.kickoff ??= past.kickoff;
      }
    }
    f.historySeedVersion = historySeed.version;
  }
  if (f.detailsSeedVersion !== detailsSeed.version) {
    for (const m of f.calendar.rounds.flatMap((r) => r.matches)) {
      if (m.espnId && detailsSeed.matches[m.espnId] && !m.details?.complete)
        m.details = structuredClone(detailsSeed.matches[m.espnId]);
    }
    f.detailsSeedVersion = detailsSeed.version;
  }
  return f.calendar;
}
export function matchCalendarEvent(s, event) {
  const cal = ensureCalendar(s),
    home = normalizeTeam(event.home_team),
    away = normalizeTeam(event.away_team);
  const found = cal.rounds
    .flatMap((r) => r.matches.map((m) => ({ round: r, match: m })))
    .filter(
      (x) =>
        normalizeTeam(x.match.home) === home &&
        normalizeTeam(x.match.away) === away,
    );
  // Each directed pairing appears once per season. Unknown aliases do not get fuzzy-matched.
  if (found.length !== 1) return null;
  return found[0];
}
export function updateCalendarRounds(s) {
  migrateFantasyWallets(s);
  migrateScoring(s);
  migrateStraightScoring(s);
  const cal = ensureCalendar(s),
    f = s.football;
  f.rounds ??= {};
  for (const round of cal.rounds) {
    const matches = round.matches,
      known = matches.map((m) => m.kickoff).filter(Boolean),
      kickoff =
        known.length === 10
          ? new Date(
              Math.min(...known.map((x) => new Date(x).getTime())),
            ).toISOString()
          : null;
    const ready =
      !!kickoff && matches.every((m) => MARKETS.every((p) => m.frozen[p]));
    const sourceId = `seriea:${cal.season}:${round.number}`;
    f.rounds[sourceId] = {
      id: sourceId,
      title: `Giornata ${round.number}`,
      number: round.number,
      date: round.date,
      kickoff,
      matches: structuredClone(matches),
      ready,
      bookable: round.matches.some((m) =>
        m.kickoff
          ? new Date(m.kickoff) > new Date()
          : new Date(round.date + "T23:59:59Z") > new Date(),
      ),
      created: f.rounds[sourceId]?.created || new Date().toISOString(),
      season: cal.season,
      provider: f.rounds[sourceId]?.provider || "API-FOOTBALL",
      requiresOfficialScores: true,
      calendarSource: cal.source,
    };
  }
  for (const l of s.leagues.filter((x) => !x.demo)) {
    attachRounds(s, l);
    for (const r of s.rounds.filter(
      (x) =>
        x.league === l.id && !x.settled && x.sourceId?.startsWith("seriea:"),
    )) {
      const source = f.rounds[r.sourceId];
      if (!source) continue;
      for (const m of r.matches) {
        const current = source.matches.find((x) => x.id === m.id);
        if (!current) continue;
        m.kickoff = current.kickoff;
        m.score = current.score;
        m.liveScore = current.liveScore;
        m.status = current.status;
        m.clock = current.clock;
        m.clockUpdatedAt = current.clockUpdatedAt;
        m.phase = current.phase;
        m.lineups = current.lineups;
        m.liveSource = current.liveSource;
        m.scoreUpdatedAt = current.scoreUpdatedAt;
        m.officialConfirmed = current.officialConfirmed;
        m.scoreConflict = current.scoreConflict;
        m.details = current.details;
        m.providerId = current.providerId;
        m.odds = structuredClone(current.odds);
        m.frozen = structuredClone(current.frozen);
      }
      const candidate = source.kickoff;
      r.ready = source.ready;
      r.requiresOfficialScores = true;
      // A future deadline follows official/provider corrections. Once reached, it cannot be reopened.
      if (
        candidate &&
        (!r.kickoff || Date.now() < new Date(r.kickoff).getTime())
      )
        r.kickoff = candidate;
      refreshSlipPrices(r);
      settle(s, l, r);
    }
  }
  updateSerieATable(s);
  updatePlayerProfiles(s);
}
export function calendarView(s) {
  const cal = ensureCalendar(s);
  return {
    season: cal.season,
    source: cal.source,
    rounds: cal.rounds.map((r) => ({
      number: r.number,
      date: r.date,
      matches: r.matches.map((m) => ({
        id: m.id,
        home: m.home,
        away: m.away,
        kickoff: m.kickoff,
        officialKickoff: m.officialKickoff ?? null,
        score: m.score,
        liveScore: m.liveScore || null,
        status: m.status || null,
        clock: m.clock || null,
        phase: m.phase || null,
        scoreUpdatedAt: m.scoreUpdatedAt || null,
        clockUpdatedAt: m.clockUpdatedAt || null,
        lineups: m.lineups || null,
        officialConfirmed: !!m.officialConfirmed,
        details: m.details || null,
        hasLineups: m.hasLineups ?? !!m.lineups,
        hasDetails: m.hasDetails ?? !!m.details,
        lineupRevision: m.lineupRevision || m.lineups?.updatedAt || null,
        detailRevision: m.detailRevision || m.details?.updatedAt || m.details?.at || null,
        detailsComplete: m.detailsComplete ?? !!m.details?.complete,
      })),
    })),
  };
}
