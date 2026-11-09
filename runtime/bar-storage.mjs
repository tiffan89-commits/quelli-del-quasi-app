import {pathToFileURL} from 'node:url';
import {connection,closeDatabase} from '../lib/db.mjs';

export async function changeBarStorage(mode,{connect=connection}={}){
 if(!['enable','disable','status'].includes(mode))throw Error('Usare enable, disable oppure status');
 const c=await connect();
 try{
  await c.query('BEGIN');
  await c.query("SET LOCAL statement_timeout='120s'");
  if(mode!=='status'){
   await c.query('SELECT pg_advisory_xact_lock(826501)');
   await c.query('SELECT id FROM public.fanta_state WHERE id=1 FOR UPDATE');
  }
  const status=async()=>(await c.query(`SELECT storage_shape IS NOT NULL AS active,
   pg_column_size(payload) AS root_bytes FROM public.fanta_state WHERE id=1`)).rows[0];
  const before=await status();
  if(!before)throw Error('Stato Bar non inizializzato');
  if(mode==='enable'&&!before.active){
   await c.query('SELECT fanta.bar_write_document(NULL,payload) FROM public.fanta_state WHERE id=1');
   const {rows:[check]}=await c.query(`SELECT payload=fanta.bar_restore_document(
    fanta.bar_document_root(payload),fanta.bar_document_shape(payload)) AS equal
    FROM public.fanta_state WHERE id=1`);
   if(!check.equal)throw Error('La ricostruzione normalizzata differisce dallo stato originale');
   await c.query(`UPDATE public.fanta_state SET payload=fanta.bar_document_root(payload),
    storage_shape=fanta.bar_document_shape(payload) WHERE id=1`);
  }
  if(mode==='disable'&&before.active)await c.query(`UPDATE public.fanta_state
   SET payload=fanta.bar_restore_document(payload,storage_shape),storage_shape=NULL WHERE id=1`);
  const after=await status();
  await c.query('COMMIT');
  return {before,after};
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}
 finally{c.release();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const url=new URL(process.env.DATABASE_URL);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.pathname!=='/'+process.argv[3])
   throw Error('Indicare il nome esatto del database locale');
  console.log(JSON.stringify(await changeBarStorage(process.argv[2])));
 }catch(error){console.error(error.message);process.exitCode=1;}
 finally{await closeDatabase();}
}
