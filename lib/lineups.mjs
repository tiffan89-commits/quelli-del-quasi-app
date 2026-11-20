import {enrichStoredMatch} from './lineup-presence.mjs';
import { recordExternal } from "./platform-admin.mjs";
import { normalizeTeam } from "./calendar.mjs";
import {editorialFor} from './editorial-lineups.mjs';
import {additionalForecasts} from './forecast-sources.mjs';
import {consensusLineups} from './lineup-consensus.mjs';
const clean = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) =>
      String.fromCodePoint(
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n),
      ),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
export function parseESPNLineups(data) {
  const teams = (data.rosters || []).map((r) => ({
    side: r.homeAway,
    team: r.team?.displayName,
    formation:
      r.formation ||
      data.header?.competitions?.[0]?.competitors?.find(
        (c) => c.homeAway === r.homeAway,
      )?.formation ||
      null,
    players: (r.roster || [])
      .filter((p) => p.starter === true)
      .map((p) => ({
        name: p.athlete?.displayName || p.athlete?.fullName || "",
        jersey: p.jersey || "",
        position: p.position?.abbreviation || "",
        ...(p.athlete?.id?{athleteId:String(p.athlete.id)}:{}),
      }))
      .filter((p) => p.name),
  }));
  return teams.length === 2 && teams.every((t) => t.players.length === 11)
    ? { kind: "official", source: "ESPN", teams }
    : null;
}
export function parseSkyLineups(html, match) {
  if (typeof html !== "string" || html.length > 1500000) return null;
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if (!title) return null;
  const names = [
    ...html.matchAll(
      /<span[^>]*class="[^"]*ftbl__team__name[^"\n]*"[^>]*>([^<]+)<\/span>/g,
    ),
  ].map((x) => clean(x[1]));
  if (
    !names.some((n) => normalizeTeam(n) === normalizeTeam(match.home)) ||
    !names.some((n) => normalizeTeam(n) === normalizeTeam(match.away))
  )
    return null;
  const section = html.slice(html.indexOf(">Titolari<"));
  if (!section.startsWith(">Titolari<")) return null;
  const starters = section,
    formations = [
      ...html.matchAll(/ftbl__team-formation-number"[^>]*>([^<]*)</g),
    ].map((x) => clean(x[1]));
  const teams = ["left", "right"].map((side, i) => {
    const row =
      starters.match(
        new RegExp(
          "<tr[^>]*data-panel-" + side + '="true"[^>]*>([\\s\\S]*?)</tr>',
        ),
      )?.[1] || "";
    const players = [
      ...row.matchAll(
        /ftbl__match-formation-player--jerseyNum"[^>]*>([^<]*)<\/span>\s*<a[^>]*ftbl__match-formation-player--name"[^>]*>([\s\S]*?)<\/a>/g,
      ),
    ]
      .map((x) => ({ jersey: clean(x[1]), name: clean(x[2]) }))
      .filter((p) => p.name && p.name.length <= 100);
    return {
      side: i ? "away" : "home",
      pitchOrder:'right-to-left',
      team: i ? match.away : match.home,
      formation: formations[i] || clean(html.match(new RegExp('class="[^"\\n]*ftbl__formation-'+(i?'away':'home')+'[^"\\n]*"[^>]*>([^<]+)<'))?.[1]) || null,
      players,
    };
  });
  if (!teams.every((t) => t.players.length === 11)) return null;
  return {
    kind: /formazioni ufficiali/i.test(title) ? "official" : "probable",
    source: "Sky Sport",
    teams,
  };
}
export function lineupUrl(match, calendar) {
  const round = calendar.rounds.find((r) =>
    r.matches.some((m) => m.id === match.id),
  );
  if (!round) return null;
  const slug = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `https://sport.sky.it/calcio/serie-a/partite/${calendar.season}/giornata-${round.number}/${slug(match.home)}-${slug(match.away)}/formazioni`;
}
export async function loadProbableLineups(
  s,
  m,
  fetcher = fetch,
  now = new Date(),
  options,
) {
  if (!probableLineupsDue(m, now, options)) return;
  m.lineupCheckedAt = now.toISOString();
  const url = lineupUrl(m, s.football.calendar);
  if (!url || m.status === "FT") return;
  let sky=null,editorial=null;
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(6000) });
    recordExternal("Sky Sport", new URL(url).pathname, res.status);
    if (res.ok)sky=parseSkyLineups(await res.text(), m);
  } catch {
    /* Keep the last valid lineup; no invented starters. */
  }
  try{editorial=await editorialFor(s,m,fetcher,now);}catch{/* The prior valid lineup remains usable. */}
  const additional=await additionalForecasts(s,m,fetcher,now);
  const lineup=consensusLineups([editorial,sky,...additional]);
  if(lineup){m.lineups={...lineup,enrichmentVersion:6,updatedAt:now.toISOString()};if(options?.enrich!==false&&(process.env.DATABASE_URL||process.env.NETLIFY_DB_URL||process.env.FANTA_ENABLED==='true'||process.env.SELFHOST_RUNTIME==='true'))try{m.lineups=(await enrichStoredMatch(m,{season:Number(s.football.calendar.season),now:+now})).lineups;}catch{/* Keep base forecast when the catalog is unavailable. */}}
}
export function probableLineupsDue(m, now = new Date(), {maxDays=7,scheduledAt}={}) {
  if (m.status === "FT" || m.lineups?.kind === "official" || !m.kickoff)
    return false;
  const until = Date.parse(m.kickoff) - now;
  if (!Number.isFinite(until) || until > maxDays * 86400000 || until < -15 * 60000)
    return false;
  // Re-read forecasts every hour until an official lineup replaces them.
  if(m.lineups&&(!m.lineups.enrichmentVersion||m.lineups.enrichmentVersion<6))return true;
  if(Number.isFinite(scheduledAt))return !m.lineupCheckedAt||Date.parse(m.lineupCheckedAt)<scheduledAt;
  const interval = 3600000;
  if (m.lineupCheckedAt && now - new Date(m.lineupCheckedAt) < interval)
    return false;
  return true;
}
