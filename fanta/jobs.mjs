import {randomUUID} from 'node:crypto';
import {connection} from '../lib/db.mjs';
import {sealSession,openSession} from '../lib/sealed-data.mjs';
import {fantaProvider} from './provider.mjs';
import {ingestFixture,dailyCatalog,computeRounds} from './ingest.mjs';
import {syncStoredFootball,seedStoredFixtures} from './stored-football.mjs';
import {seedStoredCatalog} from './catalog.mjs';
import {rebuildVoteModel} from './statistical-votes/rebuild.mjs';
import {extendCalendars} from './competitions.mjs';
import {deliverFantaNotifications,queueFantaNotifications} from './notifications.mjs';
export const fantaEnabled=(env=process.env)=>env.FANTA_ENABLED==='true'&&!!env.FANTA_BETA_USERS;
export const jobTicket=(kind,env=process.env,now=Date.now())=>sealSession({kind,at:now},'fanta:native-job',env);
export function validJobTicket(ticket,env=process.env,now=Date.now()){try{const x=openSession(ticket,'fanta:native-job',env);return (['live','daily','probe','ai','rebuild'].includes(x.kind)||/^random:[a-f0-9-]{36}$/.test(x.kind)||/^(?:auction|league-access)-notify:[a-f0-9]{64}$/.test(x.kind))&&x.at<=now+10000&&now-x.at<120000?x.kind:null;}catch{return null;}}
export async function dispatchFanta(kind,env=process.env,fetcher=fetch){const base=new URL(env.DEPLOY_PRIME_URL||env.URL);if(base.protocol!=='https:')throw Error('URL Fanta non valido');const response=await fetcher(new URL('/.netlify/functions/fanta-worker-background',base),{method:'POST',headers:{'X-Quasi-Fanta':jobTicket(kind,env)},signal:AbortSignal.timeout(8000),redirect:'error'});if(!response.ok)throw Error('Avvio del lavoro Fanta rinviato');}
export async function runFantaJob(kind,{connect=connection,provider=fantaProvider(),env=process.env,now=Date.now,ai,sleep=ms=>new Promise(r=>setTimeout(r,ms)),...options}={}){
 if(!fantaEnabled(env)&&!kind.startsWith('league-access-notify:'))return {disabled:true};const lease=randomUUID(),key='job:'+kind,c=await connect();
 try{await c.query('BEGIN');await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,'{}']);const prior=(await c.query('SELECT lease_until FROM fanta.jobs WHERE id=$1 FOR UPDATE',[key])).rows[0];if(prior.lease_until&&Date.parse(prior.lease_until)>now()){await c.query('COMMIT');return {busy:true};}await c.query('UPDATE fanta.jobs SET lease_until=$2,data=$3 WHERE id=$1',[key,new Date(now()+12*60000).toISOString(),JSON.stringify({lease,status:'running'})]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 const report={kind,status:'complete',fixtures:0,players:0,official:0,needsReview:0};
 try{
  if(kind.startsWith('auction-notify:')||kind.startsWith('league-access-notify:')){report.notifications=0;for(let i=0;i<8;i++){const sent=await deliverFantaNotifications({connect,env,now,...options});report.notifications+=sent;if(sent<5)break;}}
  else if(kind==='rebuild'){report.rebuild=await rebuildVoteModel({connect,provider,env,now});}
  else if(kind==='daily'){report.catalog=await dailyCatalog({connect,provider,env,now});}
  else if(kind==='live'){
   const init=await connect();let initialized;try{initialized=(await init.query("SELECT 1 FROM fanta.jobs WHERE id='init:stored-live-v1'")).rows.length>0;}finally{init.release();}
   if(!initialized){report.initialization={catalog:await seedStoredCatalog({connect,env}),calendar:await seedStoredFixtures({connect,env})};const end=await connect();try{await end.query("INSERT INTO fanta.jobs(id,data) VALUES('init:stored-live-v1',$1) ON CONFLICT DO NOTHING",[JSON.stringify(report.initialization)]);}finally{end.release();}}
   report.stored=await syncStoredFootball({connect,env,now});report.fixtures+=report.stored.fixtures;report.players+=report.stored.players;
   const c=await connect();let planned;try{planned=(await c.query(`SELECT api_id,status,checked_at FROM fanta.fixtures f WHERE frozen_at IS NULL AND season=$1 AND kickoff<=$2 AND EXISTS(SELECT 1 FROM fanta.rounds r JOIN fanta.leagues l ON l.id=r.league_id WHERE l.rules->>'disabledAt' IS NULL AND NOT r.official AND l.season=f.season AND r.seriea_round=f.round) AND (status NOT IN ('FT','AET','PEN') OR checked_at IS NULL OR checked_at<$3) ORDER BY kickoff`,[Number(env.FANTA_SEASON||2026),new Date(now()+45*60000).toISOString(),new Date(now()-20*60000).toISOString()])).rows;}finally{c.release();}
   planned=planned.filter(p=>!report.stored.available.includes(p.api_id));
   if(planned.length){try{const live=await provider.get('fixtures?live=all'),ids=[...new Set([...planned.map(p=>p.api_id),...live.response.filter(x=>x.league.id===135&&x.league.season===Number(env.FANTA_SEASON||2026)).map(x=>x.fixture.id)])];
    for(let i=0;i<ids.length;i+=20){const batch=await provider.get('fixtures?ids='+ids.slice(i,i+20).join('-'));for(const raw of batch.response){const x=await ingestFixture(raw,{connect,env,now,ai,deferAi:true});report.fixtures++;report.players+=x.players||0;report.official+=x.official?1:0;report.needsReview+=x.needsReview?.length||0;}}
   }catch{report.externalPending=true;}}
   report.calendars=await extendCalendars({connect});report.rounds=await computeRounds({connect,now});
   await queueFantaNotifications({connect,now});report.notifications=await deliverFantaNotifications({connect,env,now,...options});
  }else if(kind==='ai'){report.disabled=true;report.reason='Deterministic statistical model; AI never changes votes';
  }else if(kind==='probe'){
   report.probe=await probeLive({connect,provider,env,now});
   if(report.probe.live){await sleep(30000);report.probe=await probeLive({connect,provider,env,now});}
  }
 }catch{report.status='retry';report.error='Lavoro non completato: verificare le configurazioni o i dati sorgente. I dati precedenti restano disponibili.';}
 report.calls=provider.calls;report.at=new Date(now()).toISOString();const end=await connect();try{await end.query('UPDATE fanta.jobs SET data=$2,lease_until=NULL WHERE id=$1 AND data->>\'lease\'=$3',[key,JSON.stringify(report),lease]);}finally{end.release();}return report;
}
export async function probeLive({connect,provider,env,now}){
 const id=Number(env.FANTA_PROBE_FIXTURE_ID);if(!Number.isSafeInteger(id)||id<=0)return {disabled:true};
 const c=await connect();let old;try{old=(await c.query('SELECT data FROM fanta.jobs WHERE id=$1',['probe:'+id])).rows[0]?.data||{calls:0,samples:[]};}finally{c.release();}
 if(old.calls>=300||old.finished)return {complete:true,calls:old.calls};
 if(old.finalAt&&now()-old.finalAt<old.finalReads*20*60000)return {waiting:true};
 const planned=await connect();let fixture;try{fixture=(await planned.query('SELECT kickoff FROM fanta.fixtures WHERE api_id=$1',[id])).rows[0];}finally{planned.release();}
 if(fixture?.kickoff&&Date.parse(fixture.kickoff)>now())return {waiting:true};
 const raw=(await provider.get('fixtures?ids='+id)).response[0];if(!raw)return {missing:true};
 const final=['FT','AET','PEN'].includes(raw.fixture.status.short),stamp=now();
 if(final&&old.finalAt&&stamp-old.finalAt<old.finalReads*20*60000)return {waiting:true};
 const {hashInput}=await import('./votes.mjs');old.samples.push({at:new Date(stamp).toISOString(),status:raw.fixture.status.short,minute:raw.fixture.status.elapsed,score:raw.goals,playersHash:hashInput(raw.players||[]),eventsHash:hashInput(raw.events||[])});old.calls++;
 if(final){old.finalAt||=stamp;old.finalReads=(old.finalReads||0)+1;if(old.finalReads>=3)old.finished=true;}
 const end=await connect();try{await end.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',['probe:'+id,JSON.stringify(old)]);}finally{end.release();}return {calls:old.calls,finished:!!old.finished,live:['1H','2H','HT','ET','P','LIVE'].includes(raw.fixture.status.short)};
}
