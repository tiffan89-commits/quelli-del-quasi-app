import {readyRosters,roundRobin,materializeCalendar} from './competitions.mjs';
import {saveCompetitionSummary} from './summaries.mjs';

// Called in the roster/auction write transaction, never from a page's read path.
export async function activateCompletedLeague(c,s,{now=Date.now()}={}){
 if(!readyRosters(s))return {status:'incomplete'};
 const comp=(await c.query("SELECT * FROM fanta.competitions WHERE id=$1 AND league_id=$2 FOR UPDATE",[s.league.id+':main',s.league.id])).rows[0];
 if(!comp||comp.kind!=='league'||comp.status!=='draft')return {status:'unchanged'};
 const existing=(await c.query('SELECT 1 FROM fanta.rounds WHERE competition_id=$1 LIMIT 1',[comp.id])).rows;
 if(existing.length)return {status:'blocked',reason:'calendar-already-present'};
 const fixtures=(await c.query('SELECT round,min(kickoff) AS first,count(*)::int AS n FROM fanta.fixtures WHERE season=$1 AND kickoff IS NOT NULL GROUP BY round ORDER BY round',[s.league.season])).rows;
 const first=fixtures.find(r=>r.n===10&&Date.parse(r.first)>now);if(!first)return {status:'waiting-calendar'};
 const cycle=roundRobin(s.teams.map(t=>t.id),{twice:true}),data={...comp.data,autoStarted:true,startedAt:new Date(now).toISOString(),plan:Array.from({length:39-first.round},(_,i)=>({number:i+1,matches:cycle[i%cycle.length].map(m=>({...m,stage:'league'}))}))};
 const saved=await c.query("UPDATE fanta.competitions SET status='active',start_round=$2,data=$3 WHERE id=$1 AND status='draft' RETURNING id",[comp.id,first.round,JSON.stringify(data)]);
 if(!saved.rows.length)return {status:'unchanged'};
 const rounds=await materializeCalendar(c,{...comp,status:'active',start_round:first.round,data},s.league.season);
 await saveCompetitionSummary(s,c,{competition:comp.id,empty:true});
 return {status:'active',id:comp.id,startRound:first.round,rounds};
}
