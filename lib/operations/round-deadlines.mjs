import {readSerieARoundWindows} from '../seriea-round-window.mjs';

const patch=deadline=>`jsonb_build_object('kickoff',${deadline},'deadline',${deadline})`;
const changed=(data,deadline)=>`(${data}->>'kickoff' IS DISTINCT FROM ${deadline} OR ${data}->>'deadline' IS DISTINCT FROM ${deadline})`;
const notArchived=data=>`NOT coalesce((${data}->>'settled')::boolean,false) AND NOT coalesce((${data}->>'archived')::boolean,false)`;
const linkedFanta=data=>`(${data}->>'source'='fantacalcio' AND ${data}?'nativeFanta')`;
const roundNumber=data=>`(CASE WHEN ${linkedFanta(data)} THEN ${data}->>'serieARound' WHEN coalesce(${data}->>'source','seriea')='seriea' THEN ${data}->>'number' END)`;
const affected=result=>result.rowCount??result.affectedRows??0;

// The calendar refresh and the repair both call this inside the sports transaction.
export async function syncConfirmedDeadlines(client,{season,now=Date.now(),sportsStorage='snapshot',rounds=null}={}){
 const windows=await readSerieARoundWindows(client,{season,rounds,sportsStorage});
 const times=Object.fromEntries([...windows].filter(([,w])=>!w.started&&Date.parse(w.deadline)>now).map(([round,w])=>[round,w.deadline]));
 if(!Object.keys(times).length)return {fanta:0,bar:0,fantaMatches:0};
 const args=[JSON.stringify(times),season];
 const hasNative=(await client.query("SELECT to_regclass('fanta.rounds') IS NOT NULL AS present")).rows[0]?.present;
 const fanta=hasNative?affected(await client.query(`UPDATE fanta.rounds r SET deadline=($1::jsonb->>r.seriea_round::text)::timestamptz
 FROM fanta.leagues l WHERE l.id=r.league_id AND l.season=$2 AND l.rules->>'disabledAt' IS NULL
  AND NOT r.official AND NOT (r.data @> '{"archivedWithoutResults":true}') AND $1::jsonb?r.seriea_round::text
  AND r.deadline IS DISTINCT FROM ($1::jsonb->>r.seriea_round::text)::timestamptz`,args)):0;
 if(sportsStorage==='rows'){
  const deadline=`($1::jsonb->>${roundNumber('b.data')})`;
  const eligible=`(b.data->>'season'=$2::int::text OR b.data->>'sourceId' LIKE ('seriea:'||$2::int::text||':%')) AND ${notArchived('b.data')} AND ${deadline} IS NOT NULL`;
  const bar=affected(await client.query(`UPDATE fanta.bar_matchdays b SET data=b.data||${patch(deadline)}
   WHERE ${eligible} AND ${changed('b.data',deadline)}`,args));
  const fantaMatches=affected(await client.query(`UPDATE fanta.bar_matchday_matches m SET data=m.data||jsonb_build_object('kickoff',${deadline})
   FROM fanta.bar_matchdays b WHERE b.id=m.matchday_id AND ${eligible} AND ${linkedFanta('b.data')}
    AND m.data->>'kickoff' IS DISTINCT FROM ${deadline}`,args));
  await client.query(`UPDATE fanta.bar_football_round_cache c SET data=c.data||${patch("($1::jsonb->>(c.data->>'number'))")}
   WHERE c.cache_key LIKE ('seriea:'||$2::int::text||':%') AND $1::jsonb?(c.data->>'number')
    AND ${changed('c.data',"($1::jsonb->>(c.data->>'number'))")}`,args);
  return {fanta,bar,fantaMatches};
 }
 const deadline=`($1::jsonb->>${roundNumber('r')})`;
 const eligible=`(r->>'season'=$2::int::text OR r->>'sourceId' LIKE ('seriea:'||$2::int::text||':%')) AND ${notArchived('r')} AND ${deadline} IS NOT NULL`;
 const matches=`CASE WHEN ${linkedFanta('r')} THEN jsonb_build_object('matches',(
  SELECT coalesce(jsonb_agg(m||jsonb_build_object('kickoff',${deadline}) ORDER BY i),'[]')
  FROM jsonb_array_elements(coalesce(r->'matches','[]')) WITH ORDINALITY items(m,i))) ELSE '{}'::jsonb END`;
 const bar=affected(await client.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{rounds}',(
  SELECT coalesce(jsonb_agg(CASE WHEN ${eligible} THEN r||${patch(deadline)}||${matches} ELSE r END ORDER BY i),'[]')
  FROM jsonb_array_elements(coalesce(payload->'rounds','[]')) WITH ORDINALITY items(r,i)))
 WHERE id=1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(payload->'rounds','[]')) r WHERE ${eligible} AND (${changed('r',deadline)} OR
  ${linkedFanta('r')} AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(r->'matches','[]')) m WHERE m->>'kickoff' IS DISTINCT FROM ${deadline})))`,args));
 return {fanta,bar};
}
