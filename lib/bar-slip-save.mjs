import {describeSavedSlip} from './player-analysis.mjs';
import {connection} from './db.mjs';
import {sha,fail,placeSlip} from './game.mjs';
import {syncDayObjectives,objectiveReceipt} from './day-objectives.mjs';
import {accountTotals} from './community.mjs';
import {fantasyRanking} from './bar-fanta-rankings.mjs';
const compactSlip=`jsonb_build_object('uid',x->'uid','stake',x->'stake','creditsSettled',x->'creditsSettled','prize',x->'prize','points',x->'points')`;
// Lock once, project only the authenticated player and requested league/round.
// Match IDs, accepted quotes and scoring terms come from the server, never the client.
export const SLIP_SNAPSHOT_SQL=`WITH base AS(SELECT payload FROM fanta_state WHERE id=1 FOR UPDATE), actor AS(
 SELECT u FROM base CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'sessions','[]')) a
 JOIN LATERAL jsonb_array_elements(coalesce(payload->'users','[]')) u ON u->>'id'=a->>'uid'
 WHERE a->>'token'=$1 AND (a->>'expires')::numeric>$4 LIMIT 1
), chosen_league AS(SELECT l,(ordinality-1)::text AS idx FROM base CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'leagues','[]')) WITH ORDINALITY item(l,ordinality) WHERE l->>'id'=$2),
 chosen_round AS(SELECT r,(ordinality-1)::text AS idx FROM base CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'rounds','[]')) WITH ORDINALITY item(r,ordinality) WHERE r->>'id'=$3 AND r->>'league'=$2)
 SELECT (SELECT u FROM actor) AS actor,(SELECT l FROM chosen_league) AS league,(SELECT idx FROM chosen_league) AS league_index,(SELECT idx FROM chosen_round) AS round_index,
 (SELECT (r-'matches'-'slips')||jsonb_build_object('matches',(SELECT coalesce(jsonb_agg(m-ARRAY['details','lineups','oddsModel','homeLogo','awayLogo','events','statistics','playerStats']::text[]),'[]') FROM jsonb_array_elements(coalesce(r->'matches','[]')) m),
  'slips',(SELECT coalesce(jsonb_agg(CASE WHEN x->>'uid'=(SELECT u->>'id' FROM actor) THEN x ELSE ${compactSlip} END),'[]') FROM jsonb_array_elements(coalesce(r->'slips','[]')) x)) FROM chosen_round) AS round,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->'id','league',r->'league','title',r->'title','number',r->'number','source',r->'source','season',r->'season','kickoff',r->'kickoff','competitionKey',r->'competitionKey','competitionName',r->'competitionName','fantasyLeagueName',r->'fantasyLeagueName','nativeFanta',r->'nativeFanta','virtualBookmaker',r->'virtualBookmaker','pointsOnly',r->'pointsOnly','settled',true,'matches','[]'::jsonb,'slips',(SELECT coalesce(jsonb_agg(${compactSlip}),'[]') FROM jsonb_array_elements(coalesce(r->'slips','[]')) x))),'[]')
  FROM jsonb_array_elements(coalesce(payload->'rounds','[]')) r WHERE r->>'league'=$2 AND r->>'id'<>$3) AS history,
 coalesce(payload->'playerRewards'->(SELECT u->>'id' FROM actor),'[]') AS rewards,payload#>'{football,calendar,season}' AS season FROM base`;
const samePicks=(a,b)=>Object.keys(a||{}).length===Object.keys(b||{}).length&&Object.entries(a||{}).every(([k,v])=>b?.[k]===v);
export async function saveBarSlip(token,input,{connect=connection,now=Date.now}={}){
 if(!token)fail('Accedi prima',401);
 if(typeof input.league!=='string'||input.league.length>160||typeof input.round!=='string'||input.round.length>160||!input.picks||typeof input.picks!=='object'||Array.isArray(input.picks)||Object.keys(input.picks).length>50)fail('Schedina non valida');
 if(input.requestId!==undefined&&(typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(input.requestId)))fail('Identificativo invio non valido');
 const started=now(),c=await connect();try{
  await c.query('BEGIN');await c.query("SELECT set_config('lock_timeout','4s',true),set_config('statement_timeout','8s',true),set_config('idle_in_transaction_session_timeout','12s',true)");
  const row=(await c.query(SLIP_SNAPSHOT_SQL,[sha(token),input.league,input.round,now()])).rows[0],u=row?.actor,l=row?.league,r=row?.round;
  if(!u)fail('Accedi prima',401);if(u.adminOnly)fail('Questo account può accedere soltanto all’amministrazione',403);if(!u.demo&&u.emailVerified!==true)fail('Conferma prima la tua email',403);
  if(!l||!l.members?.some(m=>m.uid===u.id))fail('Non partecipi a questa lega',403);if(!r)fail('Giornata non disponibile',404);
  if(r.source==='fantacalcio'){
   if(!r.nativeFanta||l.fantaSlipsEnabled===false)fail('Questa schedina Fanta non è abilitata.',403);
   if((await c.query(`SELECT 1 FROM fanta.leagues fl JOIN fanta.bar_links b ON b.fanta_league_id=fl.id WHERE fl.id=$1 AND b.bar_league_id=$2 AND b.active AND fl.source_key IS NULL AND fl.slips_enabled AND EXISTS(SELECT 1 FROM fanta.teams t WHERE t.league_id=fl.id AND t.user_id=$3)`,[r.nativeFanta.leagueId,l.id,u.id])).rows.length!==1)fail('Devi allenare una squadra di questa lega Fanta',403);
  }
  const member=l.members.find(m=>m.uid===u.id),old=r.slips.find(x=>x.uid===u.id),stake=r.pointsOnly?0:Number(input.stake),identical=old&&old.stake===stake&&samePicks(old.picks,input.picks);
  if(old?.requestId&&old.requestId===input.requestId&&!identical)fail('Identificativo invio già usato per un’altra schedina',409);
  const s={users:[u],leagues:[l],rounds:[r,...row.history],ledger:[],playerRewards:{[u.id]:row.rewards},football:{calendar:{season:row.season}}};
  const beforeRewards=JSON.stringify(row.rewards);let replayed=false;
  if(identical)replayed=true;
  if(!identical||r.source!=='fantacalcio'&&!old?.portrait){
   if(!identical){
   const ownLeague={...l,members:[member],removedMembers:[]};
   placeSlip({...s,leagues:[ownLeague]},ownLeague,r,u,input);l.fantasyWalletScopes=ownLeague.fantasyWalletScopes;
   const slip=r.slips.find(x=>x.uid===u.id);if(input.requestId)slip.requestId=input.requestId;
   syncDayObjectives({...s,leagues:[ownLeague]},now());
   }
   const slip=r.slips.find(x=>x.uid===u.id);if(r.source!=='fantacalcio')slip.portrait=describeSavedSlip(r,slip,{name:u.name,now:now(),previous:old?.portrait});
   const rewardsChanged=JSON.stringify(s.playerRewards[u.id])!==beforeRewards;
   const updated=await c.query(`UPDATE fanta_state SET payload=
    jsonb_set(jsonb_set(payload,ARRAY['leagues',$1,'members',$2],$3::jsonb),ARRAY['rounds',$4],
     (payload#>ARRAY['rounds',$4])||$5::jsonb||jsonb_build_object('slips',(SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(coalesce(payload#>ARRAY['rounds',$4,'slips'],'[]')) x WHERE x->>'uid'<>$6)||jsonb_build_array($7::jsonb)))
    ||jsonb_build_object('ledger',coalesce(payload->'ledger','[]')||$8::jsonb)
    ||CASE WHEN $9::boolean THEN jsonb_build_object('playerRewards',coalesce(payload->'playerRewards','{}')||jsonb_build_object($6::text,$10::jsonb)) ELSE '{}'::jsonb END
    WHERE id=1 RETURNING id`,[row.league_index,String(l.members.findIndex(m=>m.uid===u.id)),JSON.stringify(member),row.round_index,JSON.stringify(r.dayObjectives?{dayObjectives:r.dayObjectives,objectiveVersion:r.objectiveVersion}:{}),u.id,JSON.stringify(slip),JSON.stringify(s.ledger),rewardsChanged,JSON.stringify(s.playerRewards[u.id])]);
   if(updated.rows.length!==1)throw Error('Salvataggio non confermato');
   if(l.fantasyWalletScopes)await c.query("UPDATE fanta_state SET payload=jsonb_set(payload,ARRAY['leagues',$1,'fantasyWalletScopes'],$2::jsonb) WHERE id=1 AND payload#>ARRAY['leagues',$1,'fantasyWalletScopes'] IS DISTINCT FROM $2::jsonb",[row.league_index,JSON.stringify(l.fantasyWalletScopes)]);
  }
  const receipt={uid:u.id,league:l.id,round:r.id,slip:r.slips.find(x=>x.uid===u.id),member:{...accountTotals(s,l,member),credits:member.credits,initial:member.initial,points:member.points,...(member.fantasyWallets?{fantasyWallets:member.fantasyWallets}:{}),...(member.fantasyWallet?{fantasyWallet:member.fantasyWallet}:{})},ledger:s.ledger};
  if(JSON.stringify(s.playerRewards[u.id])!==beforeRewards)receipt.user={rewards:s.playerRewards[u.id]};
  Object.assign(receipt,objectiveReceipt(s,l,r,u.id));
  if(r.source==='fantacalcio')receipt.fantasyRanking=fantasyRanking(s,l);
  await c.query('COMMIT');console.info('QUASI_SLIP_SAVE',JSON.stringify({durationMs:now()-started,matches:r.matches.length,replayed,receiptBytes:Buffer.byteLength(JSON.stringify(receipt))}));
  return {ok:true,replayed,receipt};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});if(['55P03','57014'].includes(e.code))throw Object.assign(Error('Salvataggio momentaneamente occupato. Riprova: la schedina non verrà duplicata.'),{status:503});throw e;}finally{c.release();}
}
