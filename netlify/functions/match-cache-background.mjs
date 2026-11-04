import {schedulesEnabled} from '../../lib/release-env.mjs';
import { transaction } from "../../lib/db.mjs";
import {seedPlayerMedia} from '../../lib/player-seed.mjs';
import {runPlayerMediaBatch} from '../../lib/player-media.mjs';
import { flushExternalActivity } from "../../lib/platform-admin.mjs";
import {
  runMatchCache,
  validMatchCacheTicket,
} from "../../lib/match-cache.mjs";
export default async (request) => {
  if(!schedulesEnabled())return;
  if (
    request.method !== "POST" ||
    !validMatchCacheTicket(request.headers.get("X-Quasi-Cache") || "")
  ) {
    console.warn("MATCH_CACHE_UNAUTHORIZED");
    return;
  }
  try{await seedPlayerMedia();}catch{console.warn('PLAYER_MEDIA_SEED_RETRY');}
  let report;try{report=await runMatchCache();}catch{console.error('MATCH_CACHE_FAILED_MANUAL_RETRY_REQUIRED');return;}
  let portraits;try{portraits=await runPlayerMediaBatch();}catch{portraits={error:'Aggiornamento immagini rinviato'};}

  console.info("MATCH_CACHE_COMPLETE", JSON.stringify(report));
  console.info('PLAYER_MEDIA_COMPLETE',JSON.stringify(portraits));
};
