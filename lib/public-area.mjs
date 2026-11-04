import {createHash} from 'node:crypto';
import {connection} from './db.mjs';

// User-triggered public preview: no account details, addresses, rosters or balances.
export async function inviteInfo(code,{connect=connection,ip='unknown'}={}){
 code=String(code||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,40}$/.test(code))return {status:404,data:{error:'Invito non trovato'}};
 const c=await connect();try{
  const key='invite-info:'+createHash('sha256').update(ip).digest('hex');
  const rate=await c.query("INSERT INTO fanta_login_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN fanta_login_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE fanta_login_limits.attempts+1 END,window_start=CASE WHEN fanta_login_limits.window_start<now()-interval '15 minutes' THEN now() ELSE fanta_login_limits.window_start END RETURNING attempts",[key]);
  if(rate.rows[0].attempts>30)return {status:429,data:{error:'Troppi tentativi. Riprova più tardi.'}};
  const {rows}=await c.query(`SELECT l->>'name' AS league,(SELECT u->>'name' FROM jsonb_array_elements(payload->'users') u WHERE u->>'id'=l->>'admin') AS inviter,jsonb_array_length(l->'members') AS members FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'leagues') l WHERE l->>'code'=$1 AND coalesce(l->>'demo','false')<>'true' LIMIT 1`,[code]);
  return rows.length?{status:200,data:{code,league:rows[0].league,inviter:rows[0].inviter||'Un amico',members:rows[0].members,maxMembers:null}}:{status:404,data:{error:'Invito non trovato'}};
 }finally{c.release();}
}
