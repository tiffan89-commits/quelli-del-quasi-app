import {connection} from '../../lib/db.mjs';
import {runRandomCreation} from '../../fanta/random-leagues.mjs';
import {schedulesEnabled} from '../../lib/release-env.mjs';
import {fantaEnabled,validJobTicket,runFantaJob} from '../../fanta/jobs.mjs';
export default async request=>{if(!schedulesEnabled()||request.method!=='POST')return;const kind=validJobTicket(request.headers.get('X-Quasi-Fanta')||'');if(!kind||!fantaEnabled()&&!kind.startsWith('league-access-notify:'))return;try{if(kind.startsWith('random:'))await runRandomCreation(kind.slice(7));else console.info('FANTA_JOB',JSON.stringify(await runFantaJob(kind)));}catch{if(kind.startsWith('random:')){const c=await connection();try{await c.query("UPDATE fanta.creation_jobs SET status='failed',error='Creazione non completata. Verifica il listone e riprova.',updated_at=now() WHERE id=$1 AND status<>'ready'",[kind.slice(7)]);}finally{c.release();}}console.error('FANTA_JOB_STORAGE_RETRY');}};
