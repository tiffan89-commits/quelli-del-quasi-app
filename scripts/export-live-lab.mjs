// Read-only export of public sports snapshots. Never exports accounts or fantasy teams.
import fs from 'node:fs/promises';import path from 'node:path';import {parseEnv} from 'node:util';import pg from 'pg';
const env=parseEnv(await fs.readFile('C:/ProgramData/QuelliDelQuasiServer/config/app.env','utf8'));
const client=new pg.Client({connectionString:env.DATABASE_URL,statement_timeout:10000});await client.connect();
try{
 await client.query('BEGIN READ ONLY');
 const sample=(await client.query("SELECT id,data FROM fanta.fixtures WHERE id='af:1550131' OR id IN(SELECT id FROM fanta.fixtures WHERE status='FT' AND jsonb_typeof(data->'players')='array' AND kickoff<now() ORDER BY kickoff DESC LIMIT 2) ORDER BY kickoff")).rows;
 const strip=x=>Array.isArray(x)?x.map(strip):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['photo','logo'].includes(k)).map(([k,v])=>[k,strip(v)])):x;
 const dest=path.resolve('outputs/live-lab');await fs.mkdir(dest,{recursive:true});await fs.writeFile(path.join(dest,'fixtures.json'),JSON.stringify({exportedAt:new Date().toISOString(),source:'API-FOOTBALL, snapshot già archiviati nel DB',fixtures:sample.map(r=>strip(r.data))},null,2));
 const catalog=(await client.query("SELECT p.id,p.name,p.role,c.name AS club,p.data->'stats' AS stats,p.data->'value' AS value,p.data->'fm' AS fm,p.data->'status' AS status,p.data->'recentPerformances' AS \"recentPerformances\" FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id WHERE p.api_id IS NOT NULL AND p.role IN('P','D','C','A') ORDER BY p.id")).rows;
 await fs.writeFile(path.join(dest,'catalog.json'),JSON.stringify(catalog));console.log(JSON.stringify({matches:sample.map(r=>({id:r.id,match:[r.data.teams?.home?.name,r.data.teams?.away?.name],score:r.data.goals})),catalog:catalog.length}));
 await client.query('ROLLBACK');
}finally{await client.end();}
