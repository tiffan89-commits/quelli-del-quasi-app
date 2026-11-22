import {barCalendarRows,barStorageMode} from './storage-mode.mjs';

const inactive="('PST','CANC','ABD','AWD','WO')";
const finished="('FT','AET','PEN','PST','CANC','ABD','AWD','WO')";
export async function readSerieARoundWindows(client,{season,rounds=null,sportsStorage=barStorageMode()}={}){
 const {rows}=await client.query(`WITH matches AS (
  SELECT (r->>'number')::int AS round,coalesce(m->>'status','NS') AS status,
   nullif(m->>'officialKickoff','')::timestamptz AS kickoff
  FROM ${barCalendarRows(sportsStorage,{round:true})}
  WHERE m->>'id' LIKE ('seriea:'||$1::int::text||':%')
   AND ($2::int[] IS NULL OR (r->>'number')::int=ANY($2))
 ) SELECT round,
  CASE WHEN count(*)=10 AND bool_and(kickoff IS NOT NULL OR status IN ${inactive})
   THEN min(kickoff) FILTER(WHERE status NOT IN ${inactive}) END AS deadline,
  count(*)=10 AND bool_and(status IN ${finished}) AS complete,
  bool_or(status NOT IN ('NS','TBD','SCHEDULED','PST','CANC','ABD','AWD','WO')) AS started
 FROM matches GROUP BY round ORDER BY round`,[season,rounds]);
 return new Map(rows.map(({round,deadline,complete,started})=>[round,{deadline:deadline?new Date(deadline).toISOString():null,complete,started}]));
}

export function serieASubmissionWindow(windows,round,storedDeadline,now){
 const actual=windows.get(round),previous=windows.get(round-1);
 const deadline=actual?actual.deadline:storedDeadline;
 const cutoff=Date.parse(deadline),started=!!actual?.started||Number.isFinite(cutoff)&&cutoff<=now;
 const waitingForPrevious=!!previous&&!previous.complete;
 return {deadline,started,waitingForPrevious,open:Number.isFinite(cutoff)&&!started&&!waitingForPrevious};
}

export async function readSlipSubmissionWindow(client,round,{season=round.season,sportsStorage,now=Date.now()}={}){
 const number=Number(round.source==='fantacalcio'?round.serieARound:round.number);
 if(!Number.isInteger(number)||number<1||!Number.isInteger(Number(season))||Number(season)<2000)return null;
 const windows=await readSerieARoundWindows(client,{season,rounds:[number-1,number],sportsStorage});
 if(!windows.has(number))return null;
 return serieASubmissionWindow(windows,number,round.deadline||round.kickoff,now);
}
