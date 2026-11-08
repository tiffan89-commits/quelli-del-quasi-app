import {isDeepStrictEqual} from 'node:util';

export async function readCalendarFixtures(client,ids){
 const {rows}=await client.query(`SELECT r.data->'number' AS number,
  jsonb_agg(m.data ORDER BY m.position) AS matches
  FROM fanta.bar_seriea_matches m
  JOIN fanta.bar_seriea_calendar_rounds r ON r.position=m.round_position
  WHERE m.id=ANY($1::text[]) GROUP BY r.position,r.data ORDER BY r.position`,[ids]);
 const {rows:[meta]}=await client.query("SELECT payload#>'{football,calendar,season}' AS season FROM fanta_state WHERE id=1");
 if(!meta)throw Error('Sports state unavailable');
 return {season:meta.season,rounds:rows};
}

export async function affectedBarLeagues(client,ids){
 const {rows}=await client.query(`SELECT DISTINCT r.league_id FROM fanta.bar_matchdays r
  JOIN fanta.bar_matchday_matches m ON m.matchday_id=r.id WHERE m.id=ANY($1::text[])
  ORDER BY r.league_id`,[ids]);
 return rows.map(row=>row.league_id);
}

export async function readBarRows(client,{fixtureIds=null,leagueIds=null,light=false}={}){
 const {rows:days}=await client.query(`SELECT r.data,r.has_matches,r.has_slips,
  (SELECT COALESCE(jsonb_agg(CASE WHEN $3::boolean
     THEN m.data-ARRAY['details','lineups','consensus','oddsModel'] ELSE m.data END ORDER BY m.position),'[]'::jsonb)
   FROM fanta.bar_matchday_matches m WHERE m.matchday_id=r.id) AS matches,
  (SELECT COALESCE(jsonb_agg(s.data ORDER BY s.position),'[]'::jsonb)
   FROM fanta.bar_slips s WHERE s.matchday_id=r.id) AS slips
  FROM fanta.bar_matchdays r
  WHERE ($1::text[] IS NULL OR EXISTS(SELECT 1 FROM fanta.bar_matchday_matches m
   WHERE m.matchday_id=r.id AND m.id=ANY($1::text[])))
   AND ($2::text[] IS NULL OR r.league_id=ANY($2::text[]))
  ORDER BY r.position`,[fixtureIds,leagueIds,light]);
 const rounds=days.map(row=>({
  ...row.data,
  ...(row.has_matches?{matches:row.matches}:{}),
  ...(row.has_slips?{slips:row.slips}:{}),
 }));
 const owners=leagueIds??[...new Set(rounds.map(round=>round.league))];
 const {rows:leagues}=await client.query('SELECT data FROM fanta.bar_league_state WHERE id=ANY($1::text[]) ORDER BY id',[owners]);
 return {rounds,leagues:leagues.map(row=>row.data),ledger:[]};
}

export async function writeCalendarFixtures(client,matches,previous){
 for(const match of matches){
  if(isDeepStrictEqual(previous.get(match.id),match))continue;
  const {rows}=await client.query('UPDATE fanta.bar_seriea_matches SET data=$2::jsonb WHERE id=$1 RETURNING id',[match.id,JSON.stringify(match)]);
  if(rows.length!==1)throw Error('Calendar match unavailable in row storage');
 }
}

async function writeChildren(client,table,key,dayId,previous,items){
 const before=Array.isArray(previous)?previous:[];
 const after=Array.isArray(items)?items:[];
 const identity=table==='bar_slips'?'uid':'id';
 // Clear this day's children before a reorder so the unique positions cannot collide.
 const sameOrder=isDeepStrictEqual(before.map(row=>row[identity]),after.map(row=>row[identity]));
 if(!sameOrder&&before.length)await client.query(`DELETE FROM fanta.${table} WHERE matchday_id=$1`,[dayId]);
 for(const [index,item] of after.entries()){
  if(sameOrder&&isDeepStrictEqual(before[index],item))continue;
  await client.query(`INSERT INTO fanta.${table}(matchday_id,${key},position,data) VALUES($1,$2,$3,$4::jsonb)
   ON CONFLICT(matchday_id,${key}) DO UPDATE SET data=excluded.data`,[dayId,item[identity],index+1,JSON.stringify(item)]);
 }
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
  await client.query('UPDATE fanta.bar_league_state SET data=$2::jsonb WHERE id=$1',[league.id,JSON.stringify(league)]);
 }
 const oldRounds=new Map(previous.rounds.map(round=>[round.id,round]));
 for(const round of state.rounds){
  const old=oldRounds.get(round.id);
  if(isDeepStrictEqual(old,round))continue;
  const next=splitRound(round);
  if(!old||!isDeepStrictEqual(splitRound(old),next)){
   await client.query(`INSERT INTO fanta.bar_matchdays(id,league_id,position,has_matches,has_slips,data)
    SELECT $1,$2,COALESCE(max(position),0)+1,$3,$4,$5::jsonb FROM fanta.bar_matchdays
    ON CONFLICT(id) DO UPDATE SET league_id=excluded.league_id,has_matches=excluded.has_matches,
     has_slips=excluded.has_slips,data=excluded.data`,[round.id,round.league,next.hasMatches,next.hasSlips,JSON.stringify(next.data)]);
  }
  await writeChildren(client,'bar_matchday_matches','id',round.id,old?.matches,round.matches);
  await writeChildren(client,'bar_slips','user_id',round.id,old?.slips,round.slips);
 }
 for(const entry of state.ledger){
  await client.query(`INSERT INTO fanta.bar_credit_ledger(id,position,data)
   SELECT $1,COALESCE(max(position),0)+1,$2::jsonb FROM fanta.bar_credit_ledger`,[entry.id,JSON.stringify(entry)]);
 }
}

export async function readDerivedRows(client,ids){
 const leagueIds=await affectedBarLeagues(client,ids);
 const state=await readBarRows(client,{leagueIds,light:true});
 const {rows:users}=await client.query(`SELECT u->>'id' AS id,u->>'name' AS name,
  u->>'createdAt' AS "createdAt",u->'adminOnly' AS "adminOnly"
  FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u WHERE fanta_state.id=1`);
 state.users=users;
 // Reward selection considers all owned awards, including those in other leagues.
 for(const [field,table,key] of [
  ['playerRewards','bar_player_rewards','user_id'],['playerProfiles','bar_player_profiles','profile_key'],
  ['analysisTextHashes','bar_analysis_hashes','hash'],
 ]){
  const {rows}=await client.query(`SELECT ${key} AS key,data FROM fanta.${table}`);
  state[field]=Object.fromEntries(rows.map(row=>[row.key,row.data]));
 }
 return state;
}

export async function writeDerivedRows(client,previous,state){
 for(const [field,table,key] of [
  ['playerRewards','bar_player_rewards','user_id'],['playerProfiles','bar_player_profiles','profile_key'],
  ['analysisTextHashes','bar_analysis_hashes','hash'],
 ]){
  for(const [id,data] of Object.entries(state[field])){
   if(isDeepStrictEqual(previous[field][id],data))continue;
   await client.query(`INSERT INTO fanta.${table}(${key},data) VALUES($1,$2::jsonb)
    ON CONFLICT(${key}) DO UPDATE SET data=excluded.data`,[id,JSON.stringify(data)]);
  }
 }
 const versions=new Map(previous.rounds.map(round=>[round.id,round.rewardVersion]));
 for(const round of state.rounds){
  if(round.rewardVersion===undefined||versions.get(round.id)===round.rewardVersion)continue;
  await client.query(`UPDATE fanta.bar_matchdays SET data=jsonb_set(data,'{rewardVersion}',to_jsonb($2::int)) WHERE id=$1`,
   [round.id,round.rewardVersion]);
 }
}
