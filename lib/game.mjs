import {eventLocked,noOpenEvents,stakeLocked,playableEventRound,slipCreditReserve,slipStakeLimit} from '../public/slip-events.mjs';
import { ensureFantasyWallet,migrateFantasyWallets,fantasyWalletKey } from "./bar-fanta-wallet.mjs";
import { normalizeAvatar } from '../public/src/avatar.mjs';
import {ownedRewardIds} from './progression.mjs';
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { pointTerms, pointOffers, QUOTA_SCORING, roundPointRules, slipPointTerms } from "./scoring.mjs";
export const MARKETS = [
  "1",
  "X",
  "2",
  "1X",
  "12",
  "X2",
  "Goal",
  "No Goal",
  "Under 2.5",
  "Over 2.5",
];
export const DEFAULT_RULES = {
  initial: 500,
  maxStake: 20,
  correct: 1,
  wrong: -1,
  mode: "weighted",
  scoring: "difficulty-v2",
  marketPoints: {
    1: 1,
    X: 1,
    2: 1,
    "1X": 0.25,
    12: 0.25,
    X2: 0.25,
    Goal: 0.5,
    "No Goal": 0.5,
    "Under 2.5": 0.5,
    "Over 2.5": 0.5,
  },
  winners: ["points", "credits"],
};
export const id = () => randomBytes(12).toString("hex");
export const sha = (s) => createHash("sha256").update(s).digest("hex");
export function fail(t, status = 400) {
  throw Object.assign(new Error(t), { status });
}
export function hash(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}
export function checkPassword(user, password) {
  if (!user?.password || user.demo) return false;
  if(typeof user.salt!=='string'||typeof user.password!=='string')return false;
  let v = Buffer.from(hash(password, user.salt), "hex"),
    b = Buffer.from(user.password, "hex");
  return v.length === b.length && timingSafeEqual(v, b);
}
export function session(s, uid) {
  const token = randomBytes(32).toString("base64url");
  s.sessions = s.sessions.filter((x) => x.expires > Date.now());
  s.sessions.push({
    token: sha(token),
    uid,
    expires: Date.now() + 7 * 86400000,
  });
  return token;
}
export function userFor(s, token) {
  const a = s.sessions.find(
    (x) => x.token === sha(token || "") && x.expires > Date.now(),
  );
  const u = a && s.users.find((x) => x.id === a.uid);
  if(u?.adminOnly && (!a.admin || !a.mfaAt))return null;
  return u;
}
export function newLeague(s, u, name, demo = false) {
  if(u.adminOnly)fail('Account riservato all’amministrazione',403);
  const leagueName=String(name||'Quelli del quasi').trim().replace(/\s+/g,' ').slice(0,80);
  if(!leagueName)fail('Nome lega non valido');
  // A retried submit must not found the same club twice.
  const existing=!demo&&s.leagues.find(l=>!l.demo&&l.admin===u.id&&l.name.trim().replace(/\s+/g,' ').toLocaleLowerCase('it')===leagueName.toLocaleLowerCase('it'));
  if(existing)return existing;
  const l = {
    id: id(),
    name: leagueName,
    createdAt:new Date().toISOString(),
    code: randomBytes(4).toString("hex").toUpperCase(),
    admin: u.id,
    rules: structuredClone(DEFAULT_RULES),
    members: [{ uid: u.id, credits: 500, initial: 500, points: 0, joinedAt:new Date().toISOString() }],
    demo,
  };
  s.leagues.push(l);
  if (!demo) attachRounds(s, l);
  return l;
}
export function attachRounds(s, l) {
  for (const source of Object.values(s.football.rounds || {})) {
    if (source.kickoff && new Date(source.kickoff) <= new Date()) continue;
    if (s.rounds.some((r) => r.league === l.id && r.sourceId === source.id))
      continue;
    if (!source.bookable && !source.ready) continue;
    s.rounds.push({
      ...structuredClone(source),
      id: id(),
      sourceId: source.id,
      league: l.id,
      rules: structuredClone(l.rules),
      slips: [],
      settled: false,
    });
  }
}
export function roundClosed(r) {
  return !!(
    r.settled ||
    r.sourceConflict ||
    ((r.pointsOnly || r.source === "fantacalcio") &&
      (!r.kickoff || r.calculated)) ||
    ((r.deadline || r.kickoff) &&
      Date.now() >= new Date(r.deadline || r.kickoff).getTime())
  );
}
export function priceSlip(r, slip) {
  if (r.pointsOnly) {
    slip.pendingOdds = [];
    slip.odds = null;
    return slip;
  }
  let product = 1,
    missing = [];
  for (const m of r.matches) {
    if (m.void || !Object.hasOwn(slip.picks,m.id)) continue;
    const odd = slip.acceptedOdds?.[m.id] ?? m.odds?.[slip.picks[m.id]];
    if (!Number.isFinite(odd) || odd <= 1) missing.push(m.id);
    else product *= odd;
  }
  slip.pendingOdds = missing;
  slip.odds = missing.length ? null : product;
  return slip;
}
export function refreshSlipPrices(r) {
  for (const slip of r.slips || [])
    if (!slip.creditsSettled) priceSlip(r, slip);
}
export function creditAccount(l, r, uid) {
  const member =
    l.members.find((m) => m.uid === uid) ||
    l.removedMembers?.find((m) => m.uid === uid);
  if (!member) fail("Membro non trovato", 404);
  if (!r.virtualBookmaker) return member;
  return ensureFantasyWallet(l, member,fantasyWalletKey(r,l));
}
export function placeSlip(s,l,r,u,p,{now=Date.now()}={}){
  migrateFantasyWallets(s,l.id);
  if (!l.members.some(m=>m.uid===u.id))fail('Non partecipi più a questa lega',403);
  if(noOpenEvents(r,now))fail('Giornata chiusa: il pallone ha già preso decisioni per te.');
  if(!p.picks||typeof p.picks!=='object'||Array.isArray(p.picks))fail('Schedina non valida');
  const entries=Object.entries(p.picks),matches=new Map(r.matches.map(m=>[m.id,m]));
  const old=r.slips.find(x=>x.uid===u.id);
  if('baseSavedAt' in p&&(old?.savedAt||null)!==p.baseSavedAt)fail('La schedina è cambiata su un altro dispositivo. Ricarica la versione salvata prima di confermare.',409);
  if(!entries.length)fail('Scegli almeno un pronostico');
  const markets=r.pointsOnly?['1','X','2']:MARKETS;
  if(entries.some(([id,pick])=>!matches.has(id)||!markets.includes(pick)))fail('Esito non valido');
  for(const m of r.matches){
    if(eventLocked(r,m,now)&&p.picks[m.id]!==old?.picks?.[m.id])fail('Il pronostico di '+m.home+' – '+m.away+' è chiuso.');
  }
  const member=creditAccount(l,r,u.id),stake=r.pointsOnly?0:Number(p.stake);
  if(!Number.isFinite(stake)||stake!==Math.round(stake*100)/100||stake<(r.pointsOnly?0:1))fail('Puntata non valida');
  if(stakeLocked(r,old?.picks,now)&&stake!==old.stake)fail('La puntata è bloccata dalla prima partita giocata.');
  const delta=stake-(old?.stake||0);
  if(member.credits<delta)fail('Crediti insufficienti');
  const reserve=slipCreditReserve(r,s.rounds||[],l,u.id);
  if(!r.pointsOnly&&stake>slipStakeLimit(member.credits,old?.stake,reserve))fail('Tieni da parte un credito per ogni giornata rimanente.');
  const accepted=(id,pick)=>old?.picks?.[id]===pick?old.acceptedOdds?.[id]??matches.get(id).odds?.[pick]:matches.get(id).odds?.[pick];
  if(r.virtualBookmaker&&entries.some(([id,pick])=>!eventLocked(r,matches.get(id),now)&&!(accepted(id,pick)>1)))fail('Quote virtuali in preparazione. Aggiorna prima di confermare.');
  const rules=roundPointRules(r);
  const pointTermsByMatch=Object.fromEntries(entries.map(([id,pick])=>[id,rules.scoring===QUOTA_SCORING?pointTerms(matches.get(id),pick,rules,accepted(id,pick)):(old?.picks?.[id]===pick?old.pointTerms?.[id]:null)||pointTerms(matches.get(id),pick,rules)]));
  member.credits=Math.round((member.credits-delta)*100)/100;
  const slip=priceSlip(r,{
    uid:u.id,picks:Object.fromEntries(entries),pointTerms:pointTermsByMatch,stake,
    ...(!r.pointsOnly?{acceptedOdds:Object.fromEntries(entries.map(([id,pick])=>[id,accepted(id,pick)]))}:{}),
    settled:false,eventBetting:true,savedAt:new Date(Math.max(now,Date.parse(old?.savedAt||'')+1||0)).toISOString(),
  });
  if (old) r.slips[r.slips.indexOf(old)] = slip;
  else r.slips.push(slip);
  if (delta)
    s.ledger.push({
      id: id(),
      league: l.id,
      ...(r.source === "fantacalcio"
        ? { competitionKey: r.competitionKey }
        : {}),
      uid: u.id,
      amount: -delta,
      reason: "Schedina confermata / modificata",
      created: new Date().toISOString(),
    });
}
export function hit(p, score) {
  const [a, b] = score;
  return {
    1: a > b,
    X: a === b,
    2: a < b,
    "1X": a >= b,
    12: a !== b,
    X2: a <= b,
    Goal: a > 0 && b > 0,
    "No Goal": a === 0 || b === 0,
    "Under 2.5": a + b < 2.5,
    "Over 2.5": a + b > 2.5,
  }[p];
}
export function settle(s, l, r) {
  migrateFantasyWallets(s,l.id);
  if (
    r.settled ||
    !roundClosed(r) ||
    (r.requiresOfficialScores &&
      r.matches.some((m) => !m.void && !m.officialConfirmed)) ||
    r.matches.some(
      (m) =>
        !m.void &&
        (!m.score || m.scoreConflict || (m.status && m.status !== "FT")),
    )
  )
    return false;
  refreshSlipPrices(r);
  const quotaScoring=roundPointRules(r)?.scoring===QUOTA_SCORING;
  if(quotaScoring)r.pointScoring=QUOTA_SCORING;
  for (const slip of r.slips) {
    if (slip.settled) continue;
    let points = 0,
      perfect = true,
      awaitingPoints=false;
    const quotaTerms=quotaScoring?{}:null;
    for (const m of r.matches) {
      if (m.void || !Object.hasOwn(slip.picks,m.id)) continue;
      const p = slip.picks[m.id],
        good = hit(p, m.score);
      perfect &&= good;
      const terms=slipPointTerms(r,m,slip);
      if(quotaTerms)quotaTerms[m.id]=terms;
      if(good&&terms.correct===null)awaitingPoints=true;
      else points+=good?terms.correct:terms.wrong;
    }
    if(quotaScoring)points=Math.round(points*100)/100;
    const member =
      l.members.find((m) => m.uid === slip.uid) ||
      l.removedMembers?.find((m) => m.uid === slip.uid);
    if (!slip.pointsSettled&&!awaitingPoints) {
      if(quotaTerms)slip.pointTerms={...slip.pointTerms,...quotaTerms};
      if (r.pointsOnly || r.source === "fantacalcio") {
        member.competitionPoints ??= {};
        member.competitionPoints[r.competitionKey] =
          Math.round(
            ((member.competitionPoints[r.competitionKey] || 0) + points) * 100,
          ) / 100;
      } else member.points = Math.round((member.points + points) * 100) / 100;
      slip.points = points;
      slip.pointsSettled = true;
      s.ledger.push({
        id: id(),
        league: l.id,
        ...(r.source === "fantacalcio"
          ? { competitionKey: r.competitionKey }
          : {}),
        uid: slip.uid,
        amount: 0,
        reason: `Giornata: ${points >= 0 ? "+" : ""}${points} punti`,
        created: new Date().toISOString(),
      });
    }
    const allVoid = r.matches.every(m=>m.void||!Object.hasOwn(slip.picks,m.id));
    if (perfect && !allVoid && slip.odds === null && !r.pointsOnly) {
      slip.payoutStatus = "in attesa delle quote";
      continue;
    }
    const prize = r.pointsOnly
      ? 0
      : allVoid
        ? slip.stake
        : perfect
          ? Math.round(slip.stake * slip.odds * 100) / 100
          : 0;
    if (!slip.creditsSettled) {
      const account = creditAccount(l, r, slip.uid);
      account.credits = Math.round((account.credits + prize) * 100) / 100;
      slip.creditsSettled = true;
      slip.prize = prize;
      s.ledger.push({
        id: id(),
        league: l.id,
        ...(r.source === "fantacalcio"
          ? { competitionKey: r.competitionKey }
          : {}),
        uid: slip.uid,
        amount: prize,
        reason: allVoid
          ? "Giornata annullata: rimborso"
          : "Liquidazione crediti",
        created: new Date().toISOString(),
      });
    }
    slip.settled = !awaitingPoints;
    slip.payoutStatus = awaitingPoints?"in attesa delle quote":"liquidata";
  }
  r.settled = r.slips.every((x) => x.settled);
  return r.settled;
}
function publicMatch(m, admin) {
  const oddsEstimated = Object.fromEntries(
    Object.entries(m.frozen || {})
      .filter(([p, a]) => a.estimated)
      .map(([p]) => [p, true]),
  );
  if (admin) return { ...m, oddsEstimated };
  const {
    frozen,
    lastOddsCheck,
    providerId,
    calendarId,
    scoreConflict,
    ...safe
  } = m;
  return { ...safe, oddsEstimated };
}
export function stateFor(s, u) {
  if (!u) return { user: null, leagues: [] };
  if (!u.demo && u.emailVerified !== true)
    return {
      user: {
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: normalizeAvatar(u.avatar,ownedRewardIds(s,u.id)),
        rewards: s.playerRewards?.[u.id]||[],
        email: u.email || null,
        pendingEmail: u.pendingEmail || null,
        emailVerified: false,
        demo: false,
      },
      leagues: [],
    };
  const isAdmin = s.leagues.some((l) => l.admin === u.id);
  return {
    user: {
      id: u.id,
      username: u.username,
      name: u.name,
      nicknameSuggested:u.nicknameSuggested===true,
      avatar: normalizeAvatar(u.avatar,ownedRewardIds(s,u.id)),
      rewards: s.playerRewards?.[u.id]||[],
      remindersEnabled:u.remindersEnabled!==false,
      emailRemindersEnabled:u.emailRemindersEnabled===true,
      fantacalcioWaitlistSeason:u.fantacalcioWaitlistSeason||null,
      email: u.email || null,
      emailVerified: !!u.emailVerified,
      hasLocalPassword: !u.demo && !u.adminOnly && (u.hasLocalPassword ?? !!u.password),
      pendingEmail: u.pendingEmail || null,
      demo: !!u.demo,
    },
    ...(isAdmin
      ? {
          provider: {
            name: s.football.provider || "The Odds API",
            quota: s.football.quota,
            budget: s.football.budget,
            lastSync: s.football.lastSync,
            lastScoresSync: s.football.lastScoresSync,
            lastLiveSync: s.football.lastLiveSync,
            liveSource: s.football.liveSource,
            lastLiveError: s.football.lastLiveError,
            lastError: s.football.lastError,
            season: s.football.season,
            mailQueue: {
              pending: (s.mailOutbox || []).filter(
                (j) => j.attempts < 8 && (!j.expires || j.expires > Date.now()),
              ).length,
              failed: (s.mailOutbox || []).filter((j) => j.attempts >= 8)
                .length,
            },
          },
        }
      : {}),
    leagues: s.leagues
      .filter(
        (l) =>
          (u.demo || u.emailVerified === true) &&
          l.members.some((m) => m.uid === u.id),
      )
      .map((l) => ({
        ...l,
        // stateFor already filters to current members: everyone may invite friends.
        code: l.code,
        removedMembers:
          l.admin === u.id
            ? (l.removedMembers || []).map((m) => ({
                uid: m.uid,
                name:
                  s.users.find((u) => u.id === m.uid)?.name || "Partecipante",
                removedAt: m.removedAt,
              }))
            : undefined,
        members: l.members.map((m) => {
          const user = s.users.find((x) => x.id === m.uid);
          return { ...m, name: user.name, username: user.username,avatar:normalizeAvatar(user.avatar,ownedRewardIds(s,user.id)) };
        }),
        rounds: s.rounds
          .filter((r) => r.league === l.id && (r.source!=='fantacalcio'||r.nativeFanta&&l.fantaSlipsEnabled!==false&&l.nativeFantaLink?.coachIds?.includes(u.id)))
          .sort(
            (a, b) =>
              (a.number || 0) - (b.number || 0) ||
              new Date(a.kickoff) - new Date(b.kickoff),
          )
          .map((r) => {
            const { slips, dayObjectives, objectiveVersion, ...safe } = r;
            const rules=roundPointRules(r);
            return {
              ...safe,
              rules,
              matches: r.matches.map((m) => ({
                ...publicMatch(m, l.admin === u.id),
                pointOffers: pointOffers(m,rules),
              })),
              slip: slips.find((x) => x.uid === u.id) || null,
              archived:r.source==='fantacalcio'&&!r.nativeFanta,
              eventBetting:playableEventRound(r),
              closed: roundClosed(r)||r.source==='fantacalcio'&&!r.nativeFanta,
              publicSlips: roundClosed(r) ? slips.map((x) => ({ ...x })) : [],
            };
          }),
        ledger: s.ledger
          .filter((x) => x.league === l.id && x.uid === u.id)
          .reverse(),
      })),
  };
}
export function validateRules(input) {
  const r = structuredClone(DEFAULT_RULES);
  for (const k of ["initial", "maxStake", "correct", "wrong"]) {
    if (!Number.isFinite(Number(input[k])))
      fail("Parametri numerici non validi");
    r[k] = Number(input[k]);
  }
  if (
    r.initial < 0 ||
    r.initial > 100000 ||
    r.maxStake < 1 ||
    r.maxStake > 500 ||
    r.correct < 0 ||
    r.correct > 100 ||
    r.wrong > 0 ||
    r.wrong < -100
  )
    fail("Parametri fuori limite");
  if (!["classic", "weighted"].includes(input.mode))
    fail("Modalità non valida");
  r.mode = input.mode;
  r.winners = (input.winners || [])
    .map((x) => String(x).trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 20);
  if (!r.winners.length) fail("Seleziona almeno un vincitore");
  for (const p of MARKETS) {
    const v = Number(input.marketPoints?.[p] ?? r.marketPoints[p]);
    if (!Number.isFinite(v) || v < 0 || v > 100)
      fail("Punti mercato non validi");
    r.marketPoints[p] = v;
  }
  return r;
}
