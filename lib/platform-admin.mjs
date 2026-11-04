import { fail } from "./game.mjs";
import {isSystemAdmin} from './system-admin-auth.mjs';
export function platformOwner(s) {
  return s.systemAdminId;
}
export const isPlatformOwner = (s, u) =>
  isSystemAdmin(u) && platformOwner(s) === u.id;
const secret =
  /password|passphrase|salt|token|secret|credentials|cookie|authorization|jwt|cipher|privatekey|publickey|apikey|encryptionkey|challenge|digest|^session$|^hash$/i;
export function safeDatabaseValue(value, depth = 0) {
  if (depth > 15) return "[profondità massima]";
  if (Array.isArray(value))
    return value.map((v) => safeDatabaseValue(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        secret.test(k) || (k==='body'&&value.iv&&value.tag)
          ? "[riservato]"
          : k === "data" && typeof v === "string" && v.length > 1000
            ? "[contenuto binario, " + v.length + " caratteri]"
            : safeDatabaseValue(v, depth + 1),
      ]),
    );
  return value;
}
export function recordApiActivity(
  s,
  { route, uid, status = 200, at = Date.now(), duration = 0 },
) {
  if (
    !/^[a-z0-9][a-z0-9-]{0,60}$/.test(route) ||
    ["constructor", "prototype"].includes(route)
  )
    route = "unknown";
  s.platformStats ??= { startedAt: new Date(at).toISOString(), days: {} };
  const day = new Date(at).toISOString().slice(0, 10),
    bucket = (s.platformStats.days[day] ??= {
      requests: 0,
      errors: 0,
      routes: {},
      users: {},
    });
  bucket.requests++;
  bucket.errors += status >= 400 ? 1 : 0;
  const entry = (bucket.routes[route] ??= {
    calls: 0,
    errors: 0,
    milliseconds: 0,
  });
  entry.calls++;
  entry.errors += status >= 400 ? 1 : 0;
  entry.milliseconds += Math.max(0, duration);
  if (uid) {
    bucket.users[uid] = (bucket.users[uid] || 0) + 1;
    const user = s.users.find((u) => u.id === uid);
    if (user) user.lastSeenAt = new Date(at).toISOString();
  }
  for (const key of Object.keys(s.platformStats.days).sort().slice(0, -90))
    delete s.platformStats.days[key];
}
export function recordLogin(s, u) {
  u.lastLoginAt = new Date().toISOString();
  s.accessEvents ??= [];
  s.accessEvents.push({ uid: u.id, at: u.lastLoginAt, event: "login" });
  s.accessEvents = s.accessEvents.slice(-2000);
}
const externalBuffer = [];
const fastReads=[];
export function clearPendingActivity(uid){for(let i=fastReads.length-1;i>=0;i--)if(!uid||fastReads[i].uid===uid)fastReads.splice(i,1);if(!uid)externalBuffer.length=0;}
export function recordFastActivity(entry){if(fastReads.length<2000)fastReads.push(entry);}
export function recordExternal(service, path, status) {
  externalBuffer.push({
    service,
    path: String(path).split("?")[0].slice(0, 160),
    status,
    at: Date.now(),
  });
}
export function flushExternalActivity(s) {
  for(const entry of fastReads.splice(0))recordApiActivity(s,entry);
  if (!externalBuffer.length) return;
  s.externalStats ??= {};
  for (const entry of externalBuffer.splice(0)) {
    const day = new Date(entry.at).toISOString().slice(0, 10),
      bucket = (s.externalStats[day] ??= {});
    const item = (bucket[entry.service] ??= {
      calls: 0,
      errors: 0,
      lastAt: null,
      paths: {},
    });
    item.calls++;
    item.errors += entry.status >= 400 ? 1 : 0;
    item.lastAt = new Date(entry.at).toISOString();
    item.paths[entry.path] = (item.paths[entry.path] || 0) + 1;
  }
  for (const day of Object.keys(s.externalStats).sort().slice(0, -90))
    delete s.externalStats[day];
}
export function platformData(s, u, params) {
  if (!isPlatformOwner(s, u))
    fail("Accesso riservato all’amministratore di sistema", 403);
  const entity = params.get("entity"),
    page = Math.max(0, Math.min(10000, Number(params.get("page")) || 0));
  const entities = Object.keys(s).filter((key) => !secret.test(key));
  if (entity) {
    if (!entities.includes(entity)) fail("Sezione non disponibile", 404);
    const value = s[entity],
      rows = Array.isArray(value)
        ? value
        : value && typeof value === "object"
          ? Object.entries(value).map(([key, value]) => ({ key, value }))
          : [{ value }];
    const q = String(params.get("q") || "")
      .toLocaleLowerCase("it-IT")
      .slice(0, 100);
    const selected = q
      ? rows.filter((row) =>
          JSON.stringify(safeDatabaseValue(row))
            .toLocaleLowerCase("it-IT")
            .includes(q),
        )
      : rows;
    return {
      entity,
      page,
      total: selected.length,
      rows: safeDatabaseValue(selected.slice(page * 25, (page + 1) * 25)),
    };
  }
  const matches = s.football.calendar?.rounds.flatMap((r) => r.matches) || [];
  return {
    entities,
    stats: s.platformStats || { days: {} },
    external: s.externalStats || {},
    summary: {
      users: s.users.length,
      verified: s.users.filter((u) => u.emailVerified).length,
      leagues: s.leagues.length,
      memberships: s.leagues.reduce((n, l) => n + l.members.length, 0),
      rounds: s.rounds.length,
      slips: s.rounds.reduce((n, r) => n + r.slips.length, 0),
      sessions: s.sessions.filter((x) => x.expires > Date.now()).length,
      chatMessages: Object.values(s.leagueChats || {}).reduce(
        (n, r) => n + r.messages.length,
        0,
      ),
      connections: 0,
      finalMatches: matches.filter((m) => m.status === "FT").length,
      archivedDetails: matches.filter((m) => m.details?.complete).length,
    },
    workers: {
      reminders:{devicePending:s.reminderOutbox?.length||0,emailPending:(s.mailOutbox||[]).filter(j=>j.reminder).length,emailOptIn:s.users.filter(u=>u.emailRemindersEnabled).length},
      football: {
        lastSync: s.football.lastSync,
        lastError: s.football.lastError,
        quota:s.football.quota,
        budget:s.football.budget,
        lastLiveSync:s.football.lastLiveSync,
        lastLiveError:s.football.lastLiveError,
        apiFootball:s.football.apiFootballFull||null,
        apiFootballQuota:s.football.apiFootballQuota||null,
      },
      matchCache: s.football.matchCacheReport,
      playerMedia:s.football.playerMediaReport||{configured:!!process.env.API_FOOTBALL_KEY},

    },
    access: safeDatabaseValue((s.accessEvents || []).slice(-100).reverse()),
    leagues: s.leagues.map(l=>({id:l.id,name:l.name,members:l.members.length})),
    users: s.users.filter(u=>!u.adminOnly).map(u=>({id:u.id,username:u.username,name:u.name})),
  };
}
