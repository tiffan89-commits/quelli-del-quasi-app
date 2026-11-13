import {isDeepStrictEqual} from 'node:util';

export async function readCalendarFixtures(client,ids){
 const {rows}=await client.query(`SELECT r.data->'number' AS number,
  jsonb_agg(m.data ORDER BY m.position) AS matches
  FROM fanta.bar_seriea_matches m
  JOIN fanta.bar_seriea_calendar_rounds r ON r.position=m.round_position
  WHERE m.id=ANY($1::text[]) GROUP BY r.position,r.data ORDER BY r.position`,[ids]);
 const {rows:[meta]}=await client.query("SELECT payload#>'{football,calendar,season}' AS season FROM public.fanta_state WHERE id=1");
 if(!meta)throw Error('Sports state unavailable');
 return {season:meta.season,rounds:rows};
}

export async function affectedBarLeagues(client,ids){
 const {rows}=await client.query(`SELECT DISTINCT r.league_id FROM fanta.bar_matchdays r
  JOIN fanta.bar_matchday_matches m ON m.matchday_id=r.id WHERE m.id=ANY($1::text[])
  ORDER BY r.league_id`,[ids]);
 return rows.map(row=>row.league_id);
}

export async function readBarRows(client,{fixtureIds=null,leagueIds=null,light=false,detailFixtureIds=null}={}){
 const {rows:days}=await client.query(`SELECT r.data,r.has_matches,r.has_slips,
  (SELECT COALESCE(jsonb_agg(CASE WHEN $3::boolean OR ($4::text[] IS NOT NULL AND NOT(m.id=ANY($4)))
     THEN m.data-ARRAY['details','lineups','consensus','oddsModel'] ELSE m.data END ORDER BY m.position),'[]'::jsonb)
   FROM fanta.bar_matchday_matches m WHERE m.matchday_id=r.id) AS matches,
  (SELECT COALESCE(jsonb_agg(s.data ORDER BY s.position),'[]'::jsonb)
   FROM fanta.bar_slips s WHERE s.matchday_id=r.id) AS slips
  FROM fanta.bar_matchdays r
  WHERE ($1::text[] IS NULL OR EXISTS(SELECT 1 FROM fanta.bar_matchday_matches m
   WHERE m.matchday_id=r.id AND m.id=ANY($1::text[])))
   AND ($2::text[] IS NULL OR r.league_id=ANY($2::text[]))
  ORDER BY r.position`,[fixtureIds,leagueIds,light,detailFixtureIds]);
 const rounds=days.map(row=>({
  ...row.data,
  ...(row.has_matches?{matches:row.matches}:{}),
  ...(row.has_slips?{slips:row.slips}:{}),
 }));
 const owners=leagueIds??[...new Set(rounds.map(round=>round.league))];
 const {rows:leagues}=await client.query('SELECT data FROM fanta.bar_league_state WHERE id=ANY($1::text[]) ORDER BY position',[owners]);
 return {rounds,leagues:leagues.map(row=>row.data),ledger:[]};
}

// Bound the size of a SQL parameter while batching several rows per round trip.
const WRITE_BATCH_SIZE=32;
async function writeBatches(rows,write){
 for(let i=0;i<rows.length;i+=WRITE_BATCH_SIZE)await write(rows.slice(i,i+WRITE_BATCH_SIZE));
}

export async function writeCalendarFixtures(client,matches,previous){
 const changed=matches.filter(match=>!isDeepStrictEqual(previous.get(match.id),match));
 await writeBatches(changed,async batch=>{
  const {rows}=await client.query(`UPDATE fanta.bar_seriea_matches m SET data=entry.data
   FROM jsonb_array_elements($1::jsonb) entry(data) WHERE m.id=entry.data->>'id' RETURNING m.id`,[JSON.stringify(batch)]);
  if(rows.length!==batch.length)throw Error('Calendar match unavailable in row storage');
 });
 return changed.map(match=>match.id);
}

export async function refreshCachedFootballMatches(client,ids){
 if(!ids.length)return;
 await client.query(`UPDATE fanta.bar_football_round_cache r SET data=jsonb_set(r.data,'{matches}',(
  SELECT jsonb_agg(coalesce(f.data,item.match) ORDER BY item.position)
  FROM jsonb_array_elements(r.data->'matches') WITH ORDINALITY item(match,position)
  LEFT JOIN fanta.bar_seriea_matches f ON f.id=item.match->>'id' AND f.id=ANY($1::text[])
 ))
 WHERE jsonb_typeof(r.data->'matches')='array' AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.data->'matches')='array'
   THEN r.data->'matches' ELSE '[]'::jsonb END) m WHERE m->>'id'=ANY($1::text[]))`,[ids]);
}

async function writeChildren(client,table,key,identity,rounds,oldRounds,field){
 const reset=[],changed=[];
 for(const round of rounds){
  const before=oldRounds.get(round.id)?.[field]||[],after=round[field]||[];
  const sameOrder=isDeepStrictEqual(before.map(row=>row[identity]),after.map(row=>row[identity]));
  if(!sameOrder&&before.length)reset.push(round.id);
  for(const [index,item] of after.entries()){
   if(sameOrder&&isDeepStrictEqual(before[index],item))continue;
   changed.push({matchday_id:round.id,child_id:item[identity],position:index+1,data:item});
  }
 }
 // Delete before inserting so reordered children cannot collide with the unique positions.
 if(reset.length)await client.query(`DELETE FROM fanta.${table} WHERE matchday_id=ANY($1::text[])`,[reset]);
 await writeBatches(changed,batch=>client.query(`INSERT INTO fanta.${table}(matchday_id,${key},position,data)
  SELECT matchday_id,child_id,position,data FROM jsonb_to_recordset($1::jsonb) AS item(matchday_id text,child_id text,position int,data jsonb)
  ON CONFLICT(matchday_id,${key}) DO UPDATE SET data=excluded.data`,[JSON.stringify(batch)]));
}

function splitRound(round){
 const data={...round};
 const hasMatches=Array.isArray(round.matches),hasSlips=Array.isArray(round.slips);
 if(hasMatches)delete data.matches;
 if(hasSlips)delete data.slips;
 return {hasMatches,hasSlips,data};
}

// The caller holds the game advisory lock. All writes share its transaction.
export async function writeBarRows(client,previous,state){
 const oldLeagues=new Map(previous.leagues.map(league=>[league.id,league]));
 for(const league of state.leagues){
  if(isDeepStrictEqual(oldLeagues.get(league.id),league))continue;
  await client.query(`INSERT INTO fanta.bar_league_state(id,position,data)
   SELECT $1,coalesce(max(position),0)+1,$2::jsonb FROM fanta.bar_league_state
   ON CONFLICT(id) DO UPDATE SET data=excluded.data`,[league.id,JSON.stringify(league)]);
 }
 const oldRounds=new Map(previous.rounds.map(round=>[round.id,round]));
 const changedRounds=state.rounds.filter(round=>!isDeepStrictEqual(oldRounds.get(round.id),round));
 for(const round of changedRounds){
  const old=oldRounds.get(round.id);
  const next=splitRound(round);
  if(!old||!isDeepStrictEqual(splitRound(old),next)){
   await client.query(`INSERT INTO fanta.bar_matchdays(id,league_id,position,has_matches,has_slips,data)
    SELECT $1,$2,COALESCE(max(position),0)+1,$3,$4,$5::jsonb FROM fanta.bar_matchdays
    ON CONFLICT(id) DO UPDATE SET league_id=excluded.league_id,has_matches=excluded.has_matches,
     has_slips=excluded.has_slips,data=excluded.data`,[round.id,round.league,next.hasMatches,next.hasSlips,JSON.stringify(next.data)]);
  }
 }
 await writeChildren(client,'bar_matchday_matches','id','id',changedRounds,oldRounds,'matches');
 await writeChildren(client,'bar_slips','user_id','uid',changedRounds,oldRounds,'slips');
 await appendBarLedger(client,state.ledger);
}

export async function appendBarLedger(client,entries){
 await writeBatches(entries,batch=>client.query(`INSERT INTO fanta.bar_credit_ledger(id,position,data)
  SELECT item.data->>'id',last.position+item.ordinality,item.data
  FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY item(data,ordinality)
  CROSS JOIN (SELECT coalesce(max(position),0) AS position FROM fanta.bar_credit_ledger) last`,[JSON.stringify(batch)]));
}

export async function readDerivedRows(client,ids){
 const leagueIds=await affectedBarLeagues(client,ids);
 const state=await readBarRows(client,{leagueIds,light:true});
 const {rows:users}=await client.query(`SELECT u->>'id' AS id,u->>'name' AS name,
  u->>'createdAt' AS "createdAt",u->'adminOnly' AS "adminOnly"
  FROM public.fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE fanta_state.id=1`);
 state.users=users;
 const profileKeys=state.leagues.flatMap(league=>league.members.map(member=>league.id+':'+member.uid));
 // Reward selection considers all owned awards, including those in other leagues.
 for(const [field,table,key] of [
  ['playerRewards','bar_player_rewards','user_id'],['playerProfiles','bar_player_profiles','profile_key'],
  ['analysisTextHashes','bar_analysis_hashes','hash'],
 ]){
  const profiles=field==='playerProfiles';
  const {rows}=await client.query(`SELECT ${key} AS key,data FROM fanta.${table}${profiles?' WHERE profile_key=ANY($1::text[])':''}`,
   profiles?[profileKeys]:[]);
  state[field]=Object.fromEntries(rows.map(row=>[row.key,row.data]));
 }
 return state;
}

export async function writeDerivedRows(client,previous,state){
 for(const [field,table,key] of [
  ['playerRewards','bar_player_rewards','user_id'],['playerProfiles','bar_player_profiles','profile_key'],
  ['analysisTextHashes','bar_analysis_hashes','hash'],
 ]){
  const changes=Object.entries(state[field]).filter(([id,data])=>!isDeepStrictEqual(previous[field][id],data))
   .map(([id,data])=>({id,data}));
  await writeBatches(changes,batch=>client.query(`INSERT INTO fanta.${table}(${key},data)
   SELECT id,data FROM jsonb_to_recordset($1::jsonb) AS item(id text,data jsonb)
   ON CONFLICT(${key}) DO UPDATE SET data=excluded.data`,[JSON.stringify(batch)]));
 }
 const versions=new Map(previous.rounds.map(round=>[round.id,round.rewardVersion]));
 const changed=state.rounds.filter(r=>r.rewardVersion!==undefined&&versions.get(r.id)!==r.rewardVersion);
 await writeBatches(changed,batch=>client.query(`UPDATE fanta.bar_matchdays d SET data=jsonb_set(d.data,'{rewardVersion}',to_jsonb(item.version))
  FROM unnest($1::text[],$2::int[]) AS item(id,version) WHERE d.id=item.id`,
  [batch.map(r=>r.id),batch.map(r=>r.rewardVersion)]));
}
