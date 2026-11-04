// Explicit one-off runner restricted to the isolated local clone, never production.
import fs from 'node:fs/promises';
import {Pool} from 'pg';
import {rebuildVoteModel} from '../fanta/statistical-votes/rebuild.mjs';
import {configuredVotes,currentModelKey} from '../fanta/statistical-votes/repository.mjs';
const url=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/quasi_prova_netlify'||process.env.SELFHOST_TEST_INSTANCE!=='true')throw Error('Only the isolated local database is allowed');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false}),connect=()=>pool.connect();
try{
 const counts=(await pool.query("SELECT count(*)::int AS fixtures,count(*) FILTER(WHERE jsonb_array_length(coalesce(data->'players','[]'))>0)::int AS cached FROM fanta.fixtures WHERE season=2026 AND status IN('FT','AET','PEN')")).rows[0];
 if(process.argv.includes('--inspect')){const progress=(await pool.query('SELECT count(*)::int AS rebuilt FROM fanta.fixtures WHERE vote_rebuild_key=$1',[currentModelKey(configuredVotes())])).rows[0];console.log(JSON.stringify({...counts,...progress}));}
 else{
  const protectedQuery="SELECT md5(payload::text) AS state,(SELECT md5(coalesce(string_agg(md5(l::text),'' ORDER BY competition_id,round,team_id),'')) FROM fanta.lineups l) AS lineups FROM fanta_state WHERE id=1";
  const before=(await pool.query(protectedQuery)).rows[0];
  const result=await rebuildVoteModel({connect,provider:{get:()=>{throw Error('External requests are disabled in this local preview');}},cachedOnly:true,closedOnly:true,limit:150});
  const after=(await pool.query(protectedQuery)).rows[0];
  const report={...counts,status:result.status,cached:!!result.cached,fixturesRebuilt:result.fixtures,players:result.players,revisions:result.revisions,pending:result.pending,unavailable:result.unavailable,rounds:result.rounds,accountsCreditsAndBarUnchanged:before.state===after.state,savedCoachLineupsUnchanged:before.lineups===after.lineups};
  await fs.writeFile(new URL('../docs/LOCAL-NEUTRAL-VOTE-REBUILD.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
}finally{await pool.end();}
