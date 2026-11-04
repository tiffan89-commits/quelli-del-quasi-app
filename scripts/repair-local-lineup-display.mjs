import {isDeepStrictEqual} from 'node:util';
// Local-only data repair: no provider requests, vote engine or settlement code.
import fs from 'node:fs/promises';
import {Pool} from 'pg';
import {lineupCatalog,enrichPresence} from '../lib/lineup-presence.mjs';
import {officialLineups} from '../lib/official-lineups.mjs';
import {normalizeTeam} from '../lib/calendar.mjs';
const url=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/quasi_prova_netlify'||process.env.SELFHOST_TEST_INSTANCE!=='true')throw Error('Only the isolated local database is allowed');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false}),connect=()=>pool.connect();
const catalog=await lineupCatalog({connect,cache:null,season:Number(process.env.FANTA_SEASON||2026)}),c=await connect();
const protectedSql=`SELECT md5(jsonb_build_object('rest',payload-ARRAY['football','rounds']::text[],'rounds',(SELECT jsonb_agg(jsonb_set(r,'{matches}',(SELECT jsonb_agg(m-'lineups') FROM jsonb_array_elements(r->'matches') m))) FROM jsonb_array_elements(payload->'rounds') r),'votes',(SELECT md5(coalesce(string_agg(md5(v::text),'' ORDER BY id),'')) FROM fanta.votes v),'results',(SELECT md5(coalesce(string_agg(md5(v::text),'' ORDER BY matchup_id),'')) FROM fanta.results v),'lineups',(SELECT md5(coalesce(string_agg(md5(v::text),'' ORDER BY competition_id,round,team_id),'')) FROM fanta.lineups v))::text) AS hash FROM fanta_state WHERE id=1`;
try{
 await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');await c.query('SELECT id FROM fanta_state WHERE id=1 FOR UPDATE');
 const before=(await c.query(protectedSql)).rows[0].hash;
 const matches=(await c.query("SELECT m FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m")).rows.map(r=>r.m);
 const raw=(await c.query("SELECT data FROM fanta.fixtures WHERE jsonb_array_length(coalesce(data->'lineups','[]'))=2")).rows.map(r=>r.data),patch={},report={officialRepaired:0,probableUpdated:0,jerseys:0,unknownPercentages:0,protectedDataUnchanged:false};
 for(const m of matches){
  const fixture=raw.find(r=>Number(r.fixture?.id)===Number(m.apiFootballId))||raw.find(r=>normalizeTeam(r.teams?.home?.name)===normalizeTeam(m.home)&&normalizeTeam(r.teams?.away?.name)===normalizeTeam(m.away)&&Math.abs(Date.parse(r.fixture.date)-Date.parse(m.kickoff))<86400000);
  const official=officialLineups(fixture||{teams:m.details?.matchInfo?.teams,lineups:m.details?.sourceLineups},fixture?.fixture?.date||m.details?.updatedAt);
  if(!official&&!m.lineups)continue;
  const lineups=enrichPresence(official||m.lineups,catalog);
  // Retain stable timestamps when an identical repair is executed again.
  if(m.lineups?.method===lineups.method&&isDeepStrictEqual(JSON.parse(JSON.stringify({...m.lineups,updatedAt:null})),JSON.parse(JSON.stringify({...lineups,updatedAt:null}))))continue;
  if(official)report.officialRepaired++;else report.probableUpdated++;
  for(const t of lineups.teams)for(const p of [...t.players,...(t.bench||[])]){if(p.jersey!==''&&p.jersey!=null)report.jerseys++;if(p.probability==null)report.unknownPercentages++;}
  patch[m.id]=lineups;
 }
 if(Object.keys(patch).length){
  const arg=[JSON.stringify(patch)];
  const transform="(SELECT coalesce(jsonb_agg(CASE WHEN $1::jsonb ? (m->>'id') THEN jsonb_set(m,'{lineups}',$1::jsonb->(m->>'id')) ELSE m END),'[]'::jsonb) FROM jsonb_array_elements(r->'matches') m)";
  await c.query(`UPDATE fanta_state SET payload=jsonb_set(jsonb_set(payload,'{football,calendar,rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',${transform})) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r)),'{rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',${transform})) FROM jsonb_array_elements(payload->'rounds') r)) WHERE id=1`,arg);
  await c.query(`UPDATE fanta_state SET payload=jsonb_set(payload,'{football,rounds}',(SELECT jsonb_object_agg(k.key,CASE WHEN k.value ? 'matches' THEN jsonb_set(k.value,'{matches}',(SELECT jsonb_agg(CASE WHEN $1::jsonb ? (m->>'id') THEN jsonb_set(m,'{lineups}',$1::jsonb->(m->>'id')) ELSE m END) FROM jsonb_array_elements(k.value->'matches') m)) ELSE k.value END) FROM jsonb_each(payload#>'{football,rounds}') k)) WHERE id=1 AND jsonb_typeof(payload#>'{football,rounds}')='object'`,arg);
 }
 if((await c.query(protectedSql)).rows[0].hash!==before)throw Error('Protected game/account data changed: rollback');
 report.protectedDataUnchanged=true;report.changed=Object.keys(patch).length;await c.query('COMMIT');
 console.log(JSON.stringify(report));await fs.writeFile('docs/LOCAL-LINEUP-REPAIR.json',JSON.stringify(report,null,2));
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
