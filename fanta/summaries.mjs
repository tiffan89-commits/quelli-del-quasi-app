import {standings} from './rules.mjs';
import {cupTables} from './competitions.mjs';
import {tableResults} from './calculated-results.mjs';
export async function saveCompetitionSummary(s,c,{competition=s.competition.id,empty=false}={}){
 const results=empty?[]:(await c.query('SELECT matchup_id,official,historical,data FROM fanta.results WHERE matchup_id IN (SELECT id FROM fanta.matchups WHERE competition_id=$1)',[competition])).rows;
 const latest=(await c.query('SELECT * FROM fanta.competitions WHERE id=$1',[competition])).rows[0];
 const state={...s,competition:latest||s.competition,results};
 const data={standings:standings(s.teams.map(t=>({id:t.id,name:t.name,manager:t.manager,color:t.color,branding:t.branding||{}})),tableResults(results)),provisional:results.some(r=>!r.official&&r.data?.calculation?.complete),groups:empty?[]:cupTables(state)};
 await c.query("UPDATE fanta.competitions SET data=jsonb_set(data,'{summary}',$2::jsonb,true) WHERE id=$1 AND data->'summary' IS DISTINCT FROM $2::jsonb",[competition,JSON.stringify(data)]);
 return data;
}
