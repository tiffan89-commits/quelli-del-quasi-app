async function repairLineups(c,league,team,player,now){
 await c.query(`UPDATE fanta.lineups l SET source_data=jsonb_set(source_data,'{needsRepair}','true')
  FROM fanta.rounds r WHERE l.competition_id=r.competition_id AND l.round=r.number
  AND l.league_id=$1 AND l.team_id=$2 AND r.deadline>$4
  AND (l.starters ? $3 OR l.bench ? $3 OR EXISTS (
   SELECT 1 FROM fanta.player_bindings b WHERE b.league_id=$1 AND b.team_id=$2 AND b.player_id=$3
   AND (l.starters ? b.source_key OR l.bench ? b.source_key)
  ))`,[league,team,player,new Date(now).toISOString()]);
}

export async function persistRosterBatch(c,league,actor,input,audit,now){
 const rows=audit.map(change=>({team_id:change.teamId,player_id:change.playerId,kind:change.kind,
  mapped:!change.before?.unmapped,price:change.after?.price,name:change.after?.name,role:change.after?.role,club:change.after?.club||''}));
 const changes=`jsonb_to_recordset($2::jsonb) AS x(team_id text,player_id text,kind text,mapped boolean,price integer,name text,role text,club text)`;
 const entry=`e.league_id=$1 AND e.team_id=x.team_id AND ((x.mapped AND e.player_id=x.player_id) OR (NOT x.mapped AND e.player_id IS NULL AND e.source_id=x.player_id))`;
 const roster=`r.league_id=$1 AND r.team_id=x.team_id AND x.mapped AND r.player_id=x.player_id`;
 const params=[league,JSON.stringify(rows)];
 await c.query(`UPDATE fanta.sales SET released=true WHERE league_id=$1 AND NOT undone AND NOT released
  AND player_id IN (SELECT x.player_id FROM ${changes} WHERE x.mapped)`,params);
 if(rows.some(x=>x.kind==='remove')){
  await c.query(`DELETE FROM fanta.roster_entries e USING ${changes} WHERE ${entry} AND x.kind='remove'`,params);
  await c.query(`DELETE FROM fanta.rosters r USING ${changes} WHERE ${roster} AND x.kind='remove'`,params);
  await c.query(`UPDATE fanta.lineups l SET source_data=jsonb_set(source_data,'{needsRepair}','true')
   FROM fanta.rounds r WHERE l.competition_id=r.competition_id AND l.round=r.number AND l.league_id=$1 AND r.deadline>$3
   AND EXISTS(SELECT 1 FROM ${changes} WHERE x.kind='remove' AND x.team_id=l.team_id AND
    (l.starters ? x.player_id OR l.bench ? x.player_id OR (x.mapped AND EXISTS(
     SELECT 1 FROM fanta.player_bindings b WHERE b.league_id=$1 AND b.team_id=x.team_id AND b.player_id=x.player_id
      AND (l.starters ? b.source_key OR l.bench ? b.source_key)))))`,[...params,new Date(now).toISOString()]);
 }
 if(rows.some(x=>x.kind==='price')){
  await c.query(`UPDATE fanta.rosters r SET price=x.price FROM ${changes} WHERE ${roster} AND x.kind='price'`,params);
  await c.query(`UPDATE fanta.roster_entries e SET price=x.price FROM ${changes} WHERE ${entry} AND x.kind='price'`,params);
 }
 if(rows.some(x=>x.kind==='add')){
  await c.query(`INSERT INTO fanta.rosters(league_id,team_id,player_id,price)
   SELECT $1,x.team_id,x.player_id,x.price FROM ${changes} WHERE x.kind='add'`,params);
  await c.query(`INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price,player_id,data)
   SELECT $1,x.team_id,'native:'||x.player_id,x.name,x.role,x.price,x.player_id,
    jsonb_build_object('club',x.club,'originalName',x.name,'aliases','[]'::jsonb) FROM ${changes} WHERE x.kind='add'`,params);
 }
 const player=p=>p?{id:p.id,name:p.name,price:p.price,role:p.role}:null;
 await c.query(`INSERT INTO fanta.roster_changes(league_id,actor,kind,data) VALUES($1,$2,'batch',$3)`,[league,actor,JSON.stringify({input,changes:audit.map(change=>({teamId:change.teamId,kind:change.kind,before:player(change.before),after:player(change.after)}))})]);
}

async function moveTradePlayers(c,league,moves,now){
 const audit=[];
 for(const {id,from,to} of moves){
  const {rows:entries}=await c.query(`DELETE FROM fanta.roster_entries WHERE league_id=$1 AND team_id=$2
   AND (player_id=$3 OR (player_id IS NULL AND source_id=$3)) RETURNING *`,[league,from,id]);
  await c.query('UPDATE fanta.rosters SET team_id=$4 WHERE league_id=$1 AND team_id=$2 AND player_id=$3',[league,from,id,to]);
  await c.query('UPDATE fanta.sales SET released=true WHERE league_id=$1 AND team_id=$2 AND player_id=$3 AND NOT undone AND NOT released',[league,from,id]);
  await repairLineups(c,league,from,id,now);
  audit.push({id,from,to,entries});
 }
 // Remove all the outgoing entries before assigning them to their new owners.
 for(const {to,entries} of audit)for(const e of entries){
  await c.query(`INSERT INTO fanta.roster_entries (league_id,team_id,source_id,name,role,price,player_id,data)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[league,to,e.source_id,e.name,e.role,e.price,e.player_id,JSON.stringify(e.data)]);
 }
 return audit;
}

export async function persistRosterChanges(c,before,after,{actor,kind,input,now=Date.now()}={}){
 const league=before.league.id;
 const audit=kind==='trade'?await moveTradePlayers(c,league,input.moves,now):await persistMarketMoves(c,before,after,now);
 for(const t of after.teams)if((t.creditAdjustment||0)!==(before.teams.find(p=>p.id===t.id)?.creditAdjustment||0))await c.query('UPDATE fanta.teams SET credit_adjustment=$2 WHERE id=$1',[t.id,t.creditAdjustment||0]);
 if(audit.length||['release','release-undo'].includes(kind))await c.query('INSERT INTO fanta.roster_changes(league_id,actor,kind,data) VALUES($1,$2,$3,$4)',[league,actor,kind,JSON.stringify({input,changes:audit})]);
 return audit;
}

async function persistMarketMoves(c,before,after,now){
 const league=before.league.id,previous=new Map(before.teams.flatMap(t=>t.roster.map(p=>[p.id,{...p,team:t.id}]))),next=new Map(after.teams.flatMap(t=>t.roster.map(p=>[p.id,{...p,team:t.id}]))),audit=[];
 for(const [id,p]of previous){const n=next.get(id);if(n&&n.team===p.team&&n.price===p.price)continue;
  const entries=(await c.query('SELECT * FROM fanta.roster_entries WHERE league_id=$1 AND player_id=$2',[league,id])).rows;audit.push({before:p,after:n||null,entries});
  await c.query('UPDATE fanta.sales SET released=true WHERE league_id=$1 AND player_id=$2 AND NOT undone AND NOT released',[league,id]);
  if(!n||n.team!==p.team){await c.query('DELETE FROM fanta.roster_entries WHERE league_id=$1 AND player_id=$2',[league,id]);await c.query('DELETE FROM fanta.rosters WHERE league_id=$1 AND player_id=$2',[league,id]);
   await repairLineups(c,league,p.team,id,now);
  }else{await c.query('UPDATE fanta.rosters SET price=$3 WHERE league_id=$1 AND player_id=$2',[league,id,n.price]);await c.query('UPDATE fanta.roster_entries SET price=$3 WHERE league_id=$1 AND player_id=$2',[league,id,n.price]);}
 }
 for(const [id,p]of next){const old=previous.get(id);if(old?.team===p.team)continue;
  await c.query('INSERT INTO fanta.rosters(league_id,team_id,player_id,price) VALUES($1,$2,$3,$4)',[league,p.team,id,p.price]);
  await c.query('INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price,player_id,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[league,p.team,'native:'+id,p.name,p.role,p.price,id,JSON.stringify({club:p.club||'',originalName:p.name,aliases:[]})]);if(!old)audit.push({before:null,after:p});
 }
 return audit;
}
