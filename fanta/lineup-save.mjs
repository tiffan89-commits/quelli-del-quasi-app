import {DEFAULT_RULES,fail,validateLineup} from './rules.mjs';

// The league lock is shared with roster/auction mutations. Saving a lineup does
// not need other teams, the full player catalogue, fixtures or historical votes.
export async function saveLineup(c,uid,id,input,{competition,now=Date.now}={}){
 await c.query('BEGIN');
 try{
  const league=(await c.query(`SELECT l.rules FROM fanta.leagues l WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2) FOR UPDATE`,[id,uid])).rows[0];
  if(!league)fail('Lega non accessibile',403);
  const selected=(await c.query(`SELECT c.id FROM fanta.competitions c WHERE c.league_id=$1 AND ($2::text IS NULL OR c.id=$2) ORDER BY CASE WHEN c.id=$1||':main' THEN 0 ELSE 1 END,c.created_at,c.id LIMIT 1`,[id,competition||null])).rows[0];
  if(!selected)fail('Competizione non accessibile',403);
  const data=(await c.query(`SELECT t.id AS team_id,
   (SELECT row_to_json(r) FROM fanta.rounds r WHERE r.competition_id=$3 AND r.number=$4) AS round,
   (SELECT row_to_json(l) FROM fanta.lineups l WHERE l.competition_id=$3 AND l.round=$4 AND l.team_id=t.id) AS saved,
   (SELECT coalesce(jsonb_agg(p),'[]') FROM (
     SELECT r.player_id AS id,p.role FROM fanta.rosters r JOIN fanta.players p ON p.id=r.player_id WHERE r.team_id=t.id AND NOT EXISTS(SELECT 1 FROM fanta.roster_entries e WHERE e.team_id=t.id AND e.player_id=r.player_id)
     UNION ALL SELECT coalesce(e.player_id,e.source_id) AS id,e.role FROM fanta.roster_entries e WHERE e.team_id=t.id
   ) p) AS roster FROM fanta.teams t WHERE t.league_id=$1 AND t.user_id=$2`,[id,uid,selected.id,input.round])).rows[0];
  if(!data?.round)fail('Giornata non trovata',404);
  const instant=typeof now==='function'?now():now;
  if(data.round.official||Date.parse(data.round.deadline)<=instant)fail('Il termine per schierare la formazione è scaduto',409);
  const lineup=validateLineup(input,data.roster,{...DEFAULT_RULES,...league.rules}),old=data.saved;
  const same=old&&!old.inherited_from&&!old.source_data?.autoCoach&&old.formation===lineup.formation&&JSON.stringify(old.starters)===JSON.stringify(lineup.starters)&&JSON.stringify(old.bench)===JSON.stringify(lineup.bench);
  const savedAt=same?new Date(old.saved_at).toISOString():new Date(instant).toISOString();
  if(!same)await c.query(`INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,saved_at,competition_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition_id,round,team_id) DO UPDATE SET formation=EXCLUDED.formation,starters=EXCLUDED.starters,bench=EXCLUDED.bench,saved_at=EXCLUDED.saved_at,inherited_from=NULL,source_data=jsonb_build_object()`,[id,input.round,data.team_id,lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench),savedAt,selected.id]);
  await c.query('COMMIT');return {...lineup,savedAt};
 }catch(e){await c.query('ROLLBACK');throw e;}
}
