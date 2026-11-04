import fs from 'node:fs/promises';
import {connection,closeDatabase} from '../lib/db.mjs';
const c=await connection();try{
 await c.query('BEGIN READ ONLY');
 const report={server:(await c.query('SHOW server_version')).rows[0].server_version,tables:{},state:(await c.query("SELECT md5(payload::text) AS digest,jsonb_array_length(coalesce(payload->'users','[]')) AS users,jsonb_array_length(coalesce(payload->'leagues','[]')) AS leagues,jsonb_array_length(coalesce(payload->'rounds','[]')) AS rounds FROM public.fanta_state WHERE id=1")).rows[0]};
 const tables=(await c.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_schema='fanta' OR table_schema='public' AND table_name IN('fanta_state','fanta_login_limits','football_player_catalog','football_player_images')) ORDER BY table_schema,table_name")).rows;
 for(const {table_schema:s,table_name:t} of tables){const quote=x=>'"'+x.replaceAll('"','""')+'"';report.tables[s+'.'+t]=Number((await c.query('SELECT count(*) AS count FROM '+quote(s)+'.'+quote(t))).rows[0].count);}
 await c.query('COMMIT');if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({schemaTables:tables.length,users:report.state?.users,leagues:report.state?.leagues,rounds:report.state?.rounds,stateDigest:report.state?.digest}));
}catch(e){await c.query('ROLLBACK').catch(()=>{});console.error(e.code||e.name);process.exitCode=1;}finally{c.release();await closeDatabase();}
