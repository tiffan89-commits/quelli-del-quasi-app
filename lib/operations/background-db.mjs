// Let interactive requests acquire their locks first when a batch is contended.
export async function beginBackgroundWrite(client){
 await client.query('BEGIN');
 if(process.env.SELFHOST_RUNTIME==='true')await client.query(
  "SELECT set_config('lock_timeout','2s',true),set_config('statement_timeout','8s',true),set_config('idle_in_transaction_session_timeout','12s',true)"
 );
}

const transient = new Set(['55P03','57014','53200','53300','40001','40P01','57P01','57P03','25P03','25P04','08000','08001','08003','08006','ECONNRESET','ECONNREFUSED','ETIMEDOUT']);
export const temporaryDatabaseError = error => transient.has(error?.code) ||
 /timeout exceeded when trying to connect|Connection terminated unexpectedly/.test(error?.message||'');
