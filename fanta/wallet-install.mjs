import {connection} from '../lib/db.mjs';
import {migrateFantasyWallets} from '../lib/bar-fanta-wallet.mjs';
export async function installLeagueWallets({connect=connection}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const s=(await c.query(`SELECT jsonb_build_object('leagues',payload->'leagues','rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('league',r->'league','competitionKey',r->'competitionKey','nativeFanta',r->'nativeFanta','virtualBookmaker',r->'virtualBookmaker','slips',(SELECT coalesce(jsonb_agg(jsonb_build_object('uid',sl->'uid','stake',sl->'stake','prize',sl->'prize','creditsSettled',sl->'creditsSettled')),'[]') FROM jsonb_array_elements(coalesce(r->'slips','[]')) sl))),'[]') FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'virtualBookmaker'='true')) AS data FROM fanta_state WHERE id=1 FOR UPDATE`)).rows[0]?.data;
  const before=JSON.stringify(s?.leagues||[]),members=s?migrateFantasyWallets(s):0;
  if(s&&JSON.stringify(s.leagues)!==before)await c.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',$1::jsonb) WHERE id=1",[JSON.stringify(s.leagues)]);
  const report={members,leagues:s?.leagues.filter(l=>l.fantasyWalletScopes).length||0,policy:'independent-league-funds-v2',completedAt:new Date().toISOString()};
  await c.query("INSERT INTO fanta.jobs(id,data) VALUES('wallets:league-v2',$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify(report)]);
  await c.query('COMMIT');return report;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
