import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {connection,closeDatabase,emptyState} from '../lib/db.mjs';
export const signatureSQL=`SELECT table_schema||'.'||table_name||'.'||column_name||':'||udt_name||':'||is_nullable AS item FROM information_schema.columns WHERE table_schema='fanta' OR table_schema='public' AND table_name IN('fanta_state','fanta_login_limits','football_player_catalog','football_player_images') ORDER BY item`;
export async function migrate({connect=connection,adopt=false}={}){
 const dir=new URL('../netlify/database/migrations/',import.meta.url),files=(await fs.readdir(dir)).filter(p=>/^\d+_[a-z0-9_]+\.sql$/.test(p)).sort(),c=await connect(),applied=[];
 try{
  await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('quasi:migrations:v1'))");
  const exists=(await c.query("SELECT to_regclass('public.quasi_schema_migrations') AS tracking,to_regclass('public.fanta_state') AS game")).rows[0];
  if(exists.game&&!exists.tracking&&!adopt)throw Error('DB esistente: usare migrate --adopt-existing dopo ripristino completo; le migrazioni storiche non vanno rieseguite');
  if(adopt){
   if(!exists.game)throw Error('Nessun database ripristinato da adottare');
   const expected=JSON.parse(await fs.readFile(new URL('./schema-signature.json',import.meta.url))),found=new Set((await c.query(signatureSQL)).rows.map(x=>x.item));
   if(expected.some(item=>!found.has(item)))throw Error('Schema ripristinato incompleto: fermarsi senza rieseguire le migrazioni');
  }
  await c.query('CREATE TABLE IF NOT EXISTS public.quasi_schema_migrations(name text PRIMARY KEY,digest text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of files){
   const sql=await fs.readFile(new URL(name,dir),'utf8'),digest=createHash('sha256').update(sql).digest('hex'),prior=(await c.query('SELECT digest FROM public.quasi_schema_migrations WHERE name=$1',[name])).rows[0];
   if(prior){if(prior.digest!==digest)throw Error('Checksum migrazione differente: '+name);continue;}
   if(!adopt)await c.query(sql);
   await c.query('INSERT INTO public.quasi_schema_migrations(name,digest) VALUES($1,$2)',[name,digest]);applied.push(name);
  }
  if(!adopt)await c.query('INSERT INTO public.fanta_state(id,payload) VALUES(1,$1) ON CONFLICT DO NOTHING',[JSON.stringify(emptyState())]);
  await c.query('COMMIT');return {mode:adopt?'adopted-without-replay':'migrated',files:applied};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await migrate({adopt:process.argv.includes('--adopt-existing')})));}catch(e){console.error(e.message);process.exitCode=1;}finally{await closeDatabase();}}
