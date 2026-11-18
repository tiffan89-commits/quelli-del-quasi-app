async function repairLineups(c,league,team,player,now){
 await c.query(`UPDATE fanta.lineups l SET source_data=jsonb_set(source_data,'{needsRepair}','true')
  FROM fanta.rounds r WHERE l.competition_id=r.competition_id AND l.round=r.number
  AND l.league_id=$1 AND l.team_id=$2 AND r.deadline>$4
  AND (l.starters ? $3 OR l.bench ? $3 OR EXISTS (
   SELECT 1 FROM fanta.player_bindings b WHERE b.league_id=$1 AND b.team_id=$2 AND b.player_id=$3
   AND (l.starters ? b.source_key OR l.bench ? b.source_key)
  ))`,[league,team,player,new Date(now).toISOString()]);
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
