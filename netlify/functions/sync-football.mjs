import {schedulesEnabled} from '../../lib/release-env.mjs';
import { flushExternalActivity } from "../../lib/platform-admin.mjs";
import { runConfiguredRecovery } from "../../lib/configured-recovery.mjs";
import { updateCalendarRounds } from "../../lib/calendar.mjs";
import { collectLive, applyLive, liveDue } from "../../lib/live-scores.mjs";
import { sportApiEnabled, sportApiDue, collectSportApi, applySportApi } from '../../lib/sportapi-live.mjs';
import {apiFootballEnabled,apiFootballDue,collectApiFootball,applyApiFootball} from '../../lib/api-football.mjs';
import {fullFootballDue,dispatchFootballRefresh} from '../../lib/api-football-refresh.mjs';
import { transaction } from "../../lib/db.mjs";
import {
  collectScores,
  applyScoreEvents,
  scoresDue,
  collectLiveDetails,
  applyMatchSummary,
} from "../../lib/match-data.mjs";
export default async () => new Response('Use authorized operational jobs',{status:410});
export async function runFootballSync({transact = transaction, collectProvider = collectSportApi, collectApiProvider = collectApiFootball, dispatchFull = dispatchFootballRefresh, env = process.env} = {}) {
  if(!schedulesEnabled(env))return new Response("Non-production schedules disabled");
  await runConfiguredRecovery(env);
  let lock;
  try {
    lock = await transact((s) => {
      if (s.football.lease > Date.now()) return null;
      s.football.lease = Date.now() + 240000;
      return structuredClone(s.football);
    });
    if (!lock) return new Response("Already running");
    let fullDispatchError;
    if(fullFootballDue(lock,env))try{await dispatchFull(env);}catch{fullDispatchError='Avvio aggiornamento completo API-FOOTBALL rinviato';}
    let scoreBatch,
      liveBatch,
      liveAttempt,
      liveError,
      scoreAttempt,
      details = [];
    const errors = [],
      tasks = [];
    if(fullDispatchError)errors.push(fullDispatchError);
    const useApiFootball = apiFootballEnabled(env),useSportApi = !useApiFootball&&sportApiEnabled(env);
    if (useApiFootball ? apiFootballDue(lock) : useSportApi ? sportApiDue(lock) : liveDue(lock)) {
      liveAttempt = new Date().toISOString();
      tasks.push(
        (useApiFootball ? collectApiProvider(lock) : useSportApi ? collectProvider(lock) : collectLive(lock))
          .then((x) => (liveBatch = x))
          .catch((e) => {
            liveError = e.message;
            errors.push(e.message);
          }),
      );
    }
    // SportAPI owns scores/events; the old services keep providing formations.
    if (!useApiFootball && !useSportApi && (scoresDue(lock) || !lock.lastScoresSync)) {
      scoreAttempt = new Date().toISOString();
      tasks.push(
        collectScores(lock)
          .then((x) => (scoreBatch = x))
          .catch((e) => errors.push(e.message)),
      );
    }
    await Promise.all(tasks);
    await Promise.all([
      collectLiveDetails(lock, scoreBatch?.events || [])
        .then((x) => (details = x))
        .catch((e) => errors.push(e.message)),
    ]);
    await transact((s) => {
      if (liveAttempt) {
        s.football.lastLiveAttempt = liveAttempt;
        s.football.lastLiveError = liveError || null;
      }
      if (liveBatch) {
        if(useApiFootball){
          const report=applyApiFootball(s,liveBatch.matches,liveBatch.at);
          s.football.apiFootballQuota={...liveBatch.quota,at:liveBatch.at};
          s.football.lastLiveAttempt=liveBatch.at;s.football.lastLiveError=liveBatch.errors?.join(' · ')||null;
          errors.push(...(liveBatch.errors||[]));
          console.info('API_FOOTBALL_LIVE',JSON.stringify({...report,requests:liveBatch.quota?.calls||0,errors:liveBatch.errors?.length||0,at:liveBatch.at}));
        } else if (useSportApi) {
          applySportApi(s, liveBatch);
          errors.push(...(liveBatch.errors || []));
        } else applyLive(s, liveBatch);
      }
      if (scoreAttempt) s.football.lastScoresAttempt = scoreAttempt;
      if (scoreBatch) {
        applyScoreEvents(s, scoreBatch.events, { at: scoreBatch.at });
        s.football.lastScoresSync = scoreBatch.at;
      }
      for (const item of details.filter(Boolean)) {
        const m = s.football.calendar.rounds
          .flatMap((r) => r.matches)
          .find((m) => m.id === item.matchId);
        if (!m) continue;
        m.espnId = item.espnId;
        m.detailCheckedAt = item.at;
        if (!item.error) {
          try {
            applyMatchSummary(s, m, item.data, new Date(item.at));
          } catch {
            m.detailError = "Dettagli non corrispondenti alla partita";
          }
        }
      }
      s.football.lastError =
        [
          ...errors,
          ...(s.football.finalScoreWarning
            ? [s.football.finalScoreWarning]
            : []),
        ].join(" · ") || null;
      updateCalendarRounds(s);
      flushExternalActivity(s);
      s.football.lease = 0;
    });
    return new Response(
      errors.length ? "Partial synchronization" : "Synchronized",
      { status: errors.length ? 207 : 200 },
    );
  } catch (e) {
    await transact((s) => {
      s.football.lastError = String(e.message).slice(0, 240);
      s.football.lease = 0;
    }).catch(() => {});
    return new Response("Synchronization failed", { status: 500 });
  }
}
