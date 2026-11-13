import {connection} from '../lib/db.mjs';
import {chooseAutoLineup,applyMatchDifficulty,applyStoredForecasts} from './auto-coach.mjs';
import {hashInput} from './votes.mjs';
import {DEFAULT_RULES} from './rules.mjs';
import {barCalendarRows,barStorageMode} from '../lib/storage-mode.mjs';
export async function writeAutoLineups(c,{now=Date.now(),leagueIds=null,initial=false,lookaheadHours=24,sportsStorage=barStorageMode()}={}){
 const stamp=new Date(now).toISOString(),leagues=(await c.query(`SELECT * FROM fanta.leagues WHERE rules->>'disabledAt' IS NULL AND (kind='pilot' OR auto_lineups_from IS NOT NULL) AND ($1::text[] IS NULL OR id=ANY($1::text[])) ORDER BY id FOR UPDATE`,[leagueIds])).rows;
 if(!leagues.length)return {saved:0,unchanged:0,manual:0,unavailable:[]};const ids=leagues.map(l=>l.id),teams=(await c.query('SELECT * FROM fanta.teams WHERE league_id=ANY($1::text[]) ORDER BY id',[ids])).rows;
 const rounds=(await c.query(`SELECT * FROM fanta.rounds WHERE league_id=ANY($1::text[]) AND (deadline>$2 AND deadline<=$3 OR $4 AND number=1) ORDER BY league_id,number`,[ids,stamp,new Date(now+lookaheadHours*3600000).toISOString(),initial])).rows;
 if(!rounds.length)return {saved:0,unchanged:0,manual:0,unavailable:[]};
 const calendar=barCalendarRows(sportsStorage,{round:true});
 const coachedIds=leagues.filter(l=>l.rules?.computerCoachMatchDifficulty===true).map(l=>l.id);
 const coachedRounds=rounds.filter(r=>coachedIds.includes(r.league_id)).map(r=>r.seriea_round);
 const rosters=(await c.query(`SELECT r.*,coalesce(e.name,p.name) AS name,coalesce(e.role,p.role) AS role,jsonb_build_object('active',p.data->'active','fm',p.data->'fm','status',p.data->'status','stats',jsonb_build_object('recentFanta',p.data#>'{stats,recentFanta}','avgFanta',p.data#>'{stats,avgFanta}'),'startProbability',p.data->'startProbability','fullName',p.data->'fullName','aliases',coalesce(p.data->'aliases','[]')||jsonb_build_array(p.name)) AS data,cl.name AS club FROM fanta.rosters r JOIN fanta.players p ON p.id=r.player_id LEFT JOIN fanta.clubs cl ON cl.id=p.club_id LEFT JOIN LATERAL (SELECT role,name FROM fanta.roster_entries WHERE r.league_id=ANY($2::text[]) AND league_id=r.league_id AND team_id=r.team_id AND player_id=r.player_id ORDER BY source_id LIMIT 1) e ON true WHERE r.league_id=ANY($1::text[])`,[ids,coachedIds])).rows,lineups=(await c.query('SELECT * FROM fanta.lineups WHERE league_id=ANY($1::text[]) AND (competition_id,round) IN(SELECT * FROM unnest($2::text[],$3::int[]))',[ids,rounds.map(r=>r.competition_id),rounds.map(r=>r.number)])).rows,report={saved:0,unchanged:0,manual:0,unavailable:[]};
 const forecasts=(await c.query(`SELECT (r->>'number')::int AS round,m->'lineups' AS data FROM ${calendar} WHERE (r->>'number')::int=ANY($1::int[]) AND m?'lineups'`,[[...new Set(rounds.map(r=>r.seriea_round))]])).rows;
 const recent=(await c.query("SELECT player_id,avg(fv)::float AS fm FROM (SELECT player_id,(v.data->>'fantavote')::numeric AS fv,row_number() OVER(PARTITION BY player_id ORDER BY f.kickoff DESC,v.id DESC) AS n FROM (SELECT DISTINCT ON(fixture_id,player_id) * FROM fanta.votes WHERE player_id=ANY($1::text[]) AND data->>'status'='voted' AND data->>'fantavote' IS NOT NULL AND model_key=coalesce((SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model'),model_key) ORDER BY fixture_id,player_id,id DESC) v JOIN fanta.fixtures f ON f.id=v.fixture_id) v WHERE n<=4 GROUP BY player_id",[[...new Set(rosters.map(p=>p.player_id))]])).rows;
 const difficultyFixtures=coachedRounds.length?(await c.query(`SELECT (r->>'number')::int AS round,m->>'home' AS home,m->>'away' AS away,m->>'status' AS status,m->'score' AS score,m->'odds' AS odds FROM ${calendar} WHERE (r->>'number')::int BETWEEN $1 AND $2`,[Math.min(...coachedRounds)-5,Math.max(...coachedRounds)])).rows:[];
 for(const r of rounds){const l=leagues.find(l=>l.id===r.league_id);if(l.kind!=='pilot'&&Date.parse(r.deadline)<=Date.parse(l.auto_lineups_from))continue;
  const matchDifficulty=coachedIds.includes(l.id);
  if(matchDifficulty&&(r.official||Date.parse(r.deadline)<=now))continue;
  for(const t of teams.filter(t=>t.league_id===l.id)){
   if(t.user_id&&(matchDifficulty||['pilot','random'].includes(l.kind)&&!initial))continue;
   const old=lineups.find(x=>x.competition_id===r.competition_id&&x.round===r.number&&x.team_id===t.id),manual=old&&!old.source_data?.autoCoach&&old.source_data?.origin!=='leghe-import';if(manual){report.manual++;continue;}
   const roster=rosters.filter(p=>p.team_id===t.id).map(p=>({...p.data,stats:{...p.data.stats,recentFanta:recent.find(v=>v.player_id===p.player_id)?.fm??p.data.stats?.recentFanta},id:p.player_id,name:p.name,role:p.role,club:p.club,price:p.price}));
   const forecast=applyStoredForecasts(roster,forecasts.filter(f=>f.round===r.seriea_round).map(f=>f.data));
   const lineup=chooseAutoLineup(matchDifficulty?applyMatchDifficulty(forecast,difficultyFixtures,r.seriea_round):forecast,{...DEFAULT_RULES,...l.rules});
   if(!lineup){report.unavailable.push({league:l.id,team:t.id,round:r.number});continue;}
   const digest=hashInput(lineup);if(old?.source_data?.autoDigest===digest){report.unchanged++;continue;}
   const source={autoCoach:true,autoDigest:digest,coachVersion:matchDifficulty?'coach-v2':'coach-v1',generatedAt:stamp};
   const saved=await c.query(`INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,saved_at,source_data,competition_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(competition_id,round,team_id) DO UPDATE SET formation=EXCLUDED.formation,starters=EXCLUDED.starters,bench=EXCLUDED.bench,saved_at=EXCLUDED.saved_at,source_data=EXCLUDED.source_data,inherited_from=NULL WHERE fanta.lineups.source_data->>'autoCoach'='true' OR fanta.lineups.source_data->>'origin'='leghe-import'`,[l.id,r.number,t.id,lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench),stamp,JSON.stringify(source),r.competition_id]);report.saved+=saved.rowCount??saved.affectedRows??0;
  }
 }return report;
}
export async function runAutoLineups({connect=connection,...options}={}){const c=await connect();try{await c.query('BEGIN');const report=await writeAutoLineups(c,options);await c.query('COMMIT');return report;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
