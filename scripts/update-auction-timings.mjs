import fs from 'node:fs/promises';import path from 'node:path';
import {configure} from '../runtime/config.mjs';configure();
const {connection,closeDatabase}=await import('../lib/db.mjs');
const timing={callSeconds:60,openSeconds:60,raiseSeconds:30,finalSeconds:3,finalStretch:3},apply=process.argv.includes('--apply'),c=await connection();
try{
 await c.query('BEGIN');
 const leagues=(await c.query("SELECT id,name,rules FROM fanta.leagues WHERE rules->>'disabledAt' IS NULL ORDER BY id FOR UPDATE")).rows.filter(l=>Object.entries(timing).some(([k,v])=>l.rules[k]!==v));
 const auctions=(await c.query('SELECT * FROM fanta.auctions WHERE league_id=ANY($1::text[]) FOR UPDATE',[leagues.map(l=>l.id)])).rows;
 if(apply&&leagues.length){
  const backup=path.join(process.env.SELFHOST_INSTALL_ROOT||process.cwd(),'backups','auction-timings-'+new Date().toISOString().replaceAll(':','-')+'.json');await fs.mkdir(path.dirname(backup),{recursive:true});await fs.writeFile(backup,JSON.stringify({leagues,auctions},null,2));
  const stamp=Date.now();
  for(const l of leagues)await c.query('UPDATE fanta.leagues SET rules=rules||$2::jsonb WHERE id=$1',[l.id,JSON.stringify(timing)]);
  for(const row of auctions){const a=row.data;a.version=Number(a.version||row.version||1)+1;
   if(a.status==='running'&&a.mode==='live'&&a.phase!=='releases'){
    if(a.lot&&!a.lot.closing){const seconds=a.lot.history?.some(h=>!h.call&&!h.pass)?30:60;a.lot.endsAt=new Date(stamp+seconds*1000).toISOString();a.lot.timerSeconds=seconds;}
    else if(a.callDeadline)a.callDeadline=new Date(stamp+60000).toISOString();
   }
   await c.query('UPDATE fanta.auctions SET version=$2,data=$3 WHERE id=$1',[row.id,a.version,JSON.stringify(a)]);await c.query("SELECT pg_notify('quasi_auction',$1)",[JSON.stringify({league:row.league_id,version:a.version})]);
  }
  await c.query('COMMIT');console.log(JSON.stringify({applied:true,leagues:leagues.map(l=>l.name),auctions:auctions.length,timing,backup}));
 }else{await c.query('ROLLBACK');console.log(JSON.stringify({applied:false,pending:leagues.map(l=>l.name),timing}));}
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await closeDatabase();}
