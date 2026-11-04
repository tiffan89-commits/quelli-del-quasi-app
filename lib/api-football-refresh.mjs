import {randomUUID} from 'node:crypto';
import {transaction} from './db.mjs';
import {sealSession,openSession} from './sealed-data.mjs';
import {flushExternalActivity} from './platform-admin.mjs';
import {apiFootballEnabled,apiFootballClient,apiFootballSeason,apiFootballMatch,applyApiFootball,API_FOOTBALL_SOURCE} from './api-football.mjs';

export function fullFootballDue(f,env=process.env,now=Date.now()){
  const op=env.API_FOOTBALL_FULL_REFRESH,j=f.apiFootballFull;
  return !!op&&apiFootballEnabled(env)&&(!(j?.operation===op)||j.status!=='complete'&&!(j.lease>now)&&!(j.nextAttempt>now));
}
export function footballRefreshTicket(operation,env=process.env,now=Date.now()){
  return sealSession({operation,at:now},'api-football:refresh',env);
}
export function validFootballRefreshTicket(ticket,env=process.env,now=Date.now()){
  try{const x=openSession(ticket,'api-football:refresh',env);return !!env.API_FOOTBALL_FULL_REFRESH&&x.operation===env.API_FOOTBALL_FULL_REFRESH&&Number.isFinite(x.at)&&x.at<=now+10000&&now-x.at<120000;}catch{return false;}
}
export async function dispatchFootballRefresh(env=process.env,fetcher=fetch){
  const base=new URL(env.DEPLOY_PRIME_URL||env.URL);
  if(base.protocol!=='https:')throw Error('URL del worker non valido');
  const r=await fetcher(new URL('/.netlify/functions/api-football-refresh-background',base),{method:'POST',
    headers:{'X-Quasi-Football':footballRefreshTicket(env.API_FOOTBALL_FULL_REFRESH,env)},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Avvio aggiornamento API-FOOTBALL non riuscito');
}
export async function runFootballFullRefresh({transact=transaction,client=apiFootballClient(),env=process.env,now=()=>Date.now()}={}){
  const operation=env.API_FOOTBALL_FULL_REFRESH,lease=randomUUID();
  const snapshot=await transact(s=>{
    if(!fullFootballDue(s.football,env,now()))return null;
    s.football.apiFootballFull={operation,status:'running',startedAt:new Date(now()).toISOString(),lease:now()+12*60000,leaseId:lease};
    return structuredClone(s.football);
  });
  if(!snapshot)return {cached:true};
  const report={operation,status:'running',season:apiFootballSeason(snapshot),listed:0,matched:0,requested:0,processed:0,updated:0,conflicts:0,unmatched:[],errors:[]};
  try{
    const status=await client.get('status'),sub=status.response?.subscription;
    report.subscription={plan:sub?.plan||null,active:sub?.active??null,dailyLimit:status.response?.requests?.limit_day??null};
    if(sub?.active===false)throw Error('API-FOOTBALL: abbonamento non attivo');
    const data=await client.get(`fixtures?league=135&season=${report.season}`),rows=data.response;
    report.listed=rows.length;
    if(!rows.length)throw Error('API-FOOTBALL: nessun incontro disponibile per la stagione richiesta');
    const matched=rows.filter(e=>apiFootballMatch(snapshot,e));report.matched=matched.length;
    report.unmatched=rows.filter(e=>!apiFootballMatch(snapshot,e)).slice(0,20).map(e=>({id:e.fixture?.id,home:e.teams?.home?.name,away:e.teams?.away?.name,date:e.fixture?.date}));
    if(!matched.length)throw Error('API-FOOTBALL: calendario non corrispondente alla stagione del DB');
    await transact(s=>{
      if(s.football.apiFootballFull?.leaseId!==lease)throw Error('Aggiornamento sostituito');
      for(const e of matched){const m=apiFootballMatch(s.football,e);if(m)m.apiFootballId=e.fixture.id;}
      s.football.apiFootballFull={...s.football.apiFootballFull,...report,quota:{...client.quota}};
    });
    const ids=matched.filter(e=>Date.parse(e.fixture.date)<=now()+3600000&&!['PST','CANC','TBD','ABD','AWD','WO'].includes(e.fixture.status.short)).map(e=>e.fixture.id);
    report.requested=ids.length;
    for(let i=0;i<ids.length;i+=20){
      const batch=await client.get('fixtures?ids='+ids.slice(i,i+20).join('-'));
      const requested=new Set(ids.slice(i,i+20).map(String)),valid=batch.response.filter(e=>requested.has(String(e.fixture?.id)));
      if(valid.length!==requested.size)report.errors.push('Alcuni dettagli richiesti non sono stati restituiti');
      const counts=await transact(s=>{
        if(s.football.apiFootballFull?.leaseId!==lease)throw Error('Aggiornamento sostituito');
        const counts=applyApiFootball(s,valid,new Date(now()).toISOString());
        s.football.apiFootballQuota={...client.quota,at:new Date(now()).toISOString()};
        s.football.apiFootballFull={...s.football.apiFootballFull,processed:report.processed+valid.length,updated:report.updated+counts.updated,quota:{...client.quota}};
        flushExternalActivity(s);return counts;
      });
      report.processed+=valid.length;report.updated+=counts.updated;report.conflicts+=counts.conflicts;
    }
    report.status=report.errors.length?'partial':'complete';
  }catch(e){report.status='failed';report.errors.push(e.message?.startsWith('API-FOOTBALL:')?e.message:'Aggiornamento non completato: ripresa automatica prevista');}
  report.finishedAt=new Date(now()).toISOString();report.quota={...client.quota};
  await transact(s=>{
    if(s.football.apiFootballFull?.leaseId!==lease)return;
    const imported=s.football.calendar.rounds.flatMap(r=>r.matches).filter(m=>m.details?.source===API_FOOTBALL_SOURCE);
    report.saved={matches:imported.length,events:imported.reduce((n,m)=>n+m.details.events.length,0),statistics:imported.filter(m=>m.details.statistics?.some(t=>t.statistics?.some(x=>x.value!=null))).length,players:imported.filter(m=>m.details.players?.some(t=>t.players?.length)).length,complete:imported.filter(m=>m.details.complete).length,penaltyRecords:imported.reduce((n,m)=>n+(m.details.penalties?.length||0),0)};
    s.football.apiFootballFull={...report,lease:0,...(report.status!=='complete'?{nextAttempt:now()+15*60000}:{})};
    s.football.apiFootballQuota={...client.quota,at:report.finishedAt};flushExternalActivity(s);
  });
  return report;
}
