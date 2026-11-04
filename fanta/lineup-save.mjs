import {DEFAULT_RULES,fail,validateLineup} from './rules.mjs';

// The league lock is shared with roster/auction mutations. Saving a lineup does
// not need other teams, the full player catalogue, fixtures or historical votes.
export async function saveLineup(c,uid,id,input,{competition,now=Date.now,username}={}){
 await c.query('BEGIN');
 try{
  await c.query("SELECT set_config('lock_timeout','4s',true),set_config('statement_timeout','8s',true),set_config('idle_in_transaction_session_timeout','12s',true)");
  const data=(await c.query(`WITH locked AS(SELECT l.id,l.rules,l.source_key FROM fanta.leagues l WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=l.id AND t.user_id=$2) FOR UPDATE),
   selected AS(SELECT c.id FROM fanta.competitions c JOIN locked l ON l.id=c.league_id WHERE ($3::text IS NULL OR c.id=$3) ORDER BY CASE WHEN c.id=$1||':main' THEN 0 ELSE 1 END,c.created_at,c.id LIMIT 1)
   SELECT t.id AS team_id,l.rules,l.source_key,selected.id AS competition_id,
   (SELECT row_to_json(r) FROM fanta.rounds r WHERE r.competition_id=selected.id AND r.number=$4) AS round,
   (SELECT row_to_json(saved) FROM fanta.lineups saved WHERE saved.competition_id=selected.id AND saved.round=$4 AND saved.team_id=t.id) AS saved,
   (SELECT coalesce(jsonb_agg(p),'[]') FROM (
     SELECT r.player_id AS id,p.role FROM fanta.rosters r JOIN fanta.players p ON p.id=r.player_id WHERE r.team_id=t.id AND NOT EXISTS(SELECT 1 FROM fanta.roster_entries e WHERE e.team_id=t.id AND e.player_id=r.player_id)
     UNION ALL SELECT coalesce(e.player_id,e.source_id) AS id,e.role FROM fanta.roster_entries e WHERE e.team_id=t.id
   ) p) AS roster FROM locked l LEFT JOIN selected ON true JOIN fanta.teams t ON t.league_id=l.id AND t.user_id=$2`,[id,uid,competition||null,input.round])).rows[0];
  if(!data)fail('Lega non accessibile',403);if(username!==undefined&&data.source_key&&username.toLowerCase()!=='frankwood')fail('Lega non accessibile',403);
  if(!data.competition_id)fail('Competizione non accessibile',403);
  if(!data?.round)fail('Giornata non trovata',404);
  const instant=typeof now==='function'?now():now;
  const lineup=validateLineup(input,data.roster,{...DEFAULT_RULES,...data.rules}),old=data.saved;
  const same=old&&!old.inherited_from&&!old.source_data?.autoCoach&&old.formation===lineup.formation&&JSON.stringify(old.starters)===JSON.stringify(lineup.starters)&&JSON.stringify(old.bench)===JSON.stringify(lineup.bench);
  if(!same&&(data.round.official||Date.parse(data.round.deadline)<=instant))fail('Il termine per schierare la formazione è scaduto',409);
  const savedAt=same?new Date(old.saved_at).toISOString():new Date(instant).toISOString();
  if(!same)await c.query(`INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,saved_at,competition_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition_id,round,team_id) DO UPDATE SET formation=EXCLUDED.formation,starters=EXCLUDED.starters,bench=EXCLUDED.bench,saved_at=EXCLUDED.saved_at,inherited_from=NULL,source_data=jsonb_build_object()`,[id,input.round,data.team_id,lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench),savedAt,data.competition_id]);
  await c.query('COMMIT');return {...lineup,savedAt};
 }catch(e){await c.query('ROLLBACK');if(['55P03','57014'].includes(e.code))throw Object.assign(Error('Salvataggio momentaneamente occupato. Riprova: la formazione non verrà duplicata.'),{status:503});throw e;}
}
