import {connection} from '../lib/db.mjs';
import {settle} from '../lib/game.mjs';

// One owner-approved cutover operation. Never selected by age or by a client.
export async function refundRetiredSlips({connect=connection,now=Date.now()}={}){
 const c=await connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const job=(await c.query("SELECT data FROM fanta.jobs WHERE id='native-cutover:approved-refunds' FOR UPDATE")).rows[0]?.data;
  if(!job||job.completedAt){await c.query('COMMIT');return {refunded:0,credits:0};}
  const ids=job.roundIds||[],state=(await c.query("SELECT jsonb_build_object('rounds',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'id'=ANY($1::text[])),'leagues',payload->'leagues','ledger','[]'::jsonb) AS data FROM fanta_state WHERE id=1 FOR UPDATE",[ids])).rows[0]?.data;
  const report={refunded:0,credits:0},changed=[];
  for(const round of state?.rounds||[]){
   if(round.settled)continue;
   if(round.source!=='fantacalcio'||round.nativeFanta||round.matches.some(m=>m.score||m.liveScore||m.status&&m.status!=='NS'))throw Error('La schedina da rimborsare è cambiata: serve una nuova verifica');
   const league=state.leagues.find(l=>l.id===round.league);if(!league)throw Error('Lega della schedina non disponibile');
   if((round.slips||[]).some(s=>s.pointsSettled||s.creditsSettled))throw Error('Schedina parzialmente liquidata: riconciliazione richiesta');
   report.refunded+=round.slips.length;report.credits+=round.slips.reduce((n,s)=>n+(round.pointsOnly?0:s.stake),0);
   for(const m of round.matches)m.void=true;
   Object.assign(round,{sourceConflict:true,archived:true,cancelledAt:new Date(now).toISOString(),cancellationReason:job.reason});
   if(!settle(state,league,round))throw Error('Rimborso non completato');changed.push(league.id);
  }
  if(changed.length)await c.query("UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(payload,'{leagues}',(SELECT coalesce(jsonb_agg(coalesce((SELECT n FROM jsonb_array_elements($1::jsonb) n WHERE n->>'id'=l->>'id'),l)),'[]') FROM jsonb_array_elements(payload->'leagues') l)),'{rounds}',(SELECT coalesce(jsonb_agg(coalesce((SELECT n FROM jsonb_array_elements($2::jsonb) n WHERE n->>'id'=r->>'id'),r)),'[]') FROM jsonb_array_elements(payload->'rounds') r)),'{ledger}',coalesce(payload->'ledger','[]')||$3::jsonb) WHERE id=1",[JSON.stringify(state.leagues.filter(l=>changed.includes(l.id))),JSON.stringify(state.rounds),JSON.stringify(state.ledger)]);
  await c.query("UPDATE fanta.jobs SET data=data||$1::jsonb WHERE id='native-cutover:approved-refunds'",[JSON.stringify({...report,completedAt:new Date(now).toISOString()})]);
  await c.query('COMMIT');return report;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
