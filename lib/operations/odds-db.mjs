import {isDeepStrictEqual} from 'node:util';
import {connection} from '../db.mjs';import {MARKETS,priceSlip} from '../game.mjs';import {patchQuote} from '../api-football-odds.mjs';
const compact=`jsonb_build_object('id',m->'id','apiFootballId',m->'apiFootballId','kickoff',m->'kickoff','status',m->'status','frozen',coalesce(m->'frozen','{}'),'odds',coalesce(m->'odds','{}'))`;
const ready=ms=>ms.length>0&&ms.every(m=>MARKETS.every(p=>Number.isFinite(m.frozen?.[p]?.value)&&m.frozen[p].value>1));
export async function readOddsSnapshot(ids,{connect=connection}={}){
 const c=await connect();try{return (await c.query(`SELECT (payload#>>'{football,calendar,season}')::int AS season,(SELECT coalesce(jsonb_agg(${compact}),'[]') FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])) AS matches FROM fanta_state WHERE id=1`,[ids])).rows[0]||{season:null,matches:[]};}finally{c.release();}
}
const signature=q=>JSON.stringify({value:q?.value,provider:q?.provider,estimated:q?.estimated,sources:q?.sources?.map(s=>({id:s.id,name:s.name,odd:s.odd})).sort((a,b)=>a.id.localeCompare(b.id))});
export async function persistApiOdds(updates,{connect=connection,now=Date.now()}={}){
 if(!updates.length)return {changed:0,markets:0,conflicts:0};const c=await connect();try{
 await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
 const ids=updates.map(x=>x.id),data=(await c.query(`SELECT jsonb_build_object('matches',(SELECT coalesce(jsonb_agg(${compact}),'[]') FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])),
 'rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->'id','kickoff',r->'kickoff','settled',r->'settled','pointsOnly',r->'pointsOnly','slips',r->'slips','matches',(SELECT jsonb_agg(${compact}||jsonb_build_object('void',m->'void')) FROM jsonb_array_elements(r->'matches') m))),'[]') FROM jsonb_array_elements(payload->'rounds') r WHERE coalesce((r->>'settled')::boolean,false)=false AND r->>'source' IS DISTINCT FROM 'fantacalcio' AND EXISTS(SELECT 1 FROM jsonb_array_elements(r->'matches') m WHERE m->>'id'=ANY($1::text[])))) AS data FROM fanta_state WHERE id=1 FOR UPDATE`,[ids])).rows[0]?.data;
 if(!data)throw Error('Stato quote non disponibile');const matchPatch={},roundPatch={};let markets=0,conflicts=0;
 for(const m of data.matches){const u=updates.find(x=>x.id===m.id);if(!u||Date.parse(m.kickoff)<=now||!Number.isFinite(Date.parse(m.kickoff))||!['NS','TBD',null,undefined].includes(m.status))continue;
  const quotes=Object.fromEntries(Object.entries(u.quotes).filter(([p,q])=>signature(q)!==signature(m.frozen?.[p])));if(!Object.keys(quotes).length)continue;
  const patch=patchQuote(m,quotes,{refresh:u.refresh});if(isDeepStrictEqual(patch.frozen,m.frozen))continue;matchPatch[m.id]=patch;markets+=Object.keys(quotes).length;
 }
 for(const r of data.rounds){if(!Number.isFinite(Date.parse(r.kickoff))||Date.parse(r.kickoff)<=now)continue;
  const slips=structuredClone(r.slips||[]);let conflict=false;
  for(const slip of slips){if(slip.acceptedOdds||slip.odds==null||r.pointsOnly)continue;const accepted=Object.fromEntries(r.matches.filter(m=>!m.void).map(m=>[m.id,m.odds?.[slip.picks?.[m.id]]]));const priced=priceSlip(r,{...slip,acceptedOdds:accepted});if(priced.odds==null||Math.abs(priced.odds-slip.odds)>Math.max(.000001,Math.abs(slip.odds)*1e-9)){conflict=true;break;}slip.acceptedOdds=accepted;}
  if(conflict)throw Error('Quote accettate precedenti non riconciliabili: nessuna modifica eseguita');const matches=r.matches.map(m=>({...m,...matchPatch[m.id]}));if(!r.matches.some(m=>matchPatch[m.id]))continue;
  roundPatch[r.id]={slips,matches:Object.fromEntries(matches.map(m=>[m.id,matchPatch[m.id]]).filter(([,p])=>p)),ready:ready(matches),provider:'API-FOOTBALL'};
 }
 if(Object.keys(matchPatch).length){const patch={matches:matchPatch,rounds:roundPatch};
 await c.query(`UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(payload,
 '{football,calendar,rounds}',(SELECT jsonb_agg(jsonb_set(r,'{matches}',(SELECT jsonb_agg(m||coalesce($1::jsonb->'matches'->(m->>'id'),'{}'::jsonb)) FROM jsonb_array_elements(r->'matches') m))) FROM jsonb_array_elements(payload#>'{football,calendar,rounds}') r)),
 '{football,rounds}',(SELECT coalesce(jsonb_object_agg(k.key,CASE WHEN k.value?'matches' AND EXISTS(SELECT 1 FROM jsonb_array_elements(k.value->'matches') q WHERE $1::jsonb->'matches'?(q->>'id')) THEN jsonb_set(k.value,'{matches}',(SELECT coalesce(jsonb_agg(m||coalesce($1::jsonb->'matches'->(m->>'id'),'{}'::jsonb)),'[]'::jsonb) FROM jsonb_array_elements(k.value->'matches') m))||jsonb_build_object('provider','API-FOOTBALL','ready',(SELECT coalesce(bool_and(((q||coalesce($1::jsonb->'matches'->(q->>'id'),'{}'::jsonb))->'frozen') ?& $2::text[]),false) AND k.value->>'kickoff' IS NOT NULL FROM jsonb_array_elements(k.value->'matches') q)) ELSE k.value END),'{}'::jsonb) FROM jsonb_each(coalesce(payload#>'{football,rounds}','{}'::jsonb)) k)),
 '{rounds}',(SELECT coalesce(jsonb_agg(CASE WHEN $1::jsonb->'rounds'?(r->>'id') THEN r||jsonb_build_object('slips',$1::jsonb->'rounds'->(r->>'id')->'slips','ready',$1::jsonb->'rounds'->(r->>'id')->'ready','provider','API-FOOTBALL','matches',(SELECT jsonb_agg(m||coalesce($1::jsonb->'rounds'->(r->>'id')->'matches'->(m->>'id'),'{}'::jsonb)) FROM jsonb_array_elements(r->'matches') m)) ELSE r END),'[]'::jsonb) FROM jsonb_array_elements(payload->'rounds') r)) WHERE id=1`,[JSON.stringify(patch),MARKETS]);
 }
 await c.query('COMMIT');return {changed:Object.keys(matchPatch).length,markets,conflicts};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
