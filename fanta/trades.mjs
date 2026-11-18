import {teamBudget} from './auction.mjs';
import {DEFAULT_RULES,fail} from './rules.mjs';

const auctionBusy=state=>['running','scheduled'].includes(state.auction.status);
const uuid=/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const slots=Object.entries(DEFAULT_RULES.roster);
const size=slots.reduce((sum,[,count])=>sum+count,0);
const playersFor=(team,ids)=>ids.map(id=>team.roster.find(p=>p.id===id));
const labelPlayer=({id,name,role})=>({id,name,role});
const labelTeam=({id,name,manager})=>({id,name,manager});

function playerIds(ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>size||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length){
  fail('Scegli almeno un giocatore per squadra, una sola volta per giocatore.');
 }
 return ids;
}

export function settleTrade(state,sender,recipient,{offer,want,credits}){
 const given=playersFor(sender,playerIds(offer)),received=playersFor(recipient,playerIds(want));
 if(given.includes(undefined)||received.includes(undefined))fail('Una delle rose è cambiata. Rivedi i giocatori dello scambio.',409);
 if(!Number.isSafeInteger(credits)||Math.abs(credits)>2147483647)fail('Inserisci un numero intero di crediti valido.');
 const sendBalance=teamBudget(sender,state.rules).credits;
 const receiveBalance=teamBudget(recipient,state.rules).credits;
 if(sendBalance-credits<0||receiveBalance+credits<0)fail('Una delle squadre non ha abbastanza crediti per questo scambio.',409);

 const transfer=(team,outgoing,incoming,payment)=>{
  const roster=[...team.roster.filter(p=>!outgoing.includes(p)),...incoming];
  if(roster.length!==size||new Set(roster.map(p=>p.id)).size!==size||slots.some(([role,count])=>roster.filter(p=>p.role===role).length!==count)){
   fail('Entrambe le rose devono avere 3 portieri, 8 difensori, 8 centrocampisti e 6 attaccanti.',409);
  }
  // Keep the players’ purchase prices and move only the credits negotiated by the two teams.
  const cost=players=>players.reduce((sum,p)=>sum+p.price,0);
  const creditAdjustment=(team.creditAdjustment||0)+cost(incoming)-cost(outgoing)-payment;
  if(creditAdjustment < -2147483648||creditAdjustment > 2147483647)fail('Saldo crediti fuori limite.',409);
  return {...team,roster,creditAdjustment};
 };
 const teams=new Map([[sender.id,transfer(sender,given,received,credits)],[recipient.id,transfer(recipient,received,given,-credits)]]);
 return {
  terms:{offer:given.map(labelPlayer),want:received.map(labelPlayer),credits,sender:labelTeam(sender),recipient:labelTeam(recipient)},
  teams:state.teams.map(t=>teams.get(t.id)||t),
 };
}

const pendingCountSQL=`SELECT count(*)::int
 FROM fanta.trades x
 JOIN fanta.teams sender ON sender.league_id=x.league_id AND sender.id=x.sender_team_id AND sender.user_id=x.sender_uid
 WHERE x.league_id=l.id AND x.recipient_team_id=t.id AND x.recipient_uid=t.user_id AND x.status='pending'`;

export async function readTradeStatus(c,id,uid){
 const row=(await c.query(`SELECT coalesce(l.rules->>'tradesOpen'='true',false) AS open, (${pendingCountSQL}) AS pending,
  (SELECT max(x.updated_at) FROM fanta.trades x WHERE x.league_id=l.id AND x.status='accepted'
   AND ((x.sender_team_id=t.id AND x.sender_uid=t.user_id) OR (x.recipient_team_id=t.id AND x.recipient_uid=t.user_id))) AS "latestAccepted"
  FROM fanta.leagues l JOIN fanta.teams t ON t.league_id=l.id
  WHERE l.id=$1 AND t.user_id=$2 AND l.rules->>'disabledAt' IS NULL`,[id,uid])).rows[0];
 if(!row)fail('Lega non accessibile',403);
 return row;
}

export async function tradeView(c,state,uid){
 const mine=state.teams.find(t=>t.userId===uid), open=state.rules.tradesOpen===true;
 if(!mine)fail('Lega non accessibile',403);
 const {rows}=await c.query(`SELECT id,status,revision,terms,updated_at,sender_uid,recipient_uid,sender_team_id,recipient_team_id
  FROM fanta.trades WHERE league_id=$1
  AND ((sender_team_id=$2 AND sender_uid=$3) OR (recipient_team_id=$2 AND recipient_uid=$3))
  ORDER BY (status='pending') DESC,updated_at DESC LIMIT 100`,[state.league.id,mine.id,uid]);
 const owners=new Map(state.teams.map(t=>[t.id,t.userId]));
 return {open,isAdmin:state.league.adminUid===uid,canOpen:!auctionBusy(state),teamId:mine.id,
  teams:open?state.teams.filter(t=>t.userId).map(t=>({...labelTeam(t),credits:teamBudget(t,state.rules).credits,roster:t.roster.map(labelPlayer)})):[],
  requests:rows.map(x=>({
   ...x.terms,id:x.id,revision:x.revision,updatedAt:x.updated_at,incoming:x.recipient_uid===uid,
   status:x.status==='pending'&&(owners.get(x.sender_team_id)!==x.sender_uid||owners.get(x.recipient_team_id)!==x.recipient_uid)?'expired':x.status,
  })),
 };
}

const samePlayers=(a,b)=>a.length===b.length&&a.every(p=>b.some(q=>p.id===q.id));

export async function tradeAction(c,state,uid,kind,input,{persistRoster,now}){
 const id=state.league.id,mine=state.teams.find(t=>t.userId===uid);
 if(!mine)fail('Lega non accessibile',403);
 if(kind==='window'){
  if(state.league.adminUid!==uid)fail('Solo il presidente può aprire o chiudere gli scambi.',403);
  if(typeof input.open!=='boolean')fail('Scegli se aprire o chiudere gli scambi.');
  if(input.open&&auctionBusy(state))fail('Chiudi l’asta prima di aprire gli scambi.',409);
  if((state.rules.tradesOpen===true)===input.open)return {open:input.open};
  await c.query("UPDATE fanta.leagues SET rules=jsonb_set(rules,'{tradesOpen}',to_jsonb($2::boolean)) WHERE id=$1",[id,input.open]);
  if(!input.open)await c.query("UPDATE fanta.trades SET status='expired',updated_at=now() WHERE league_id=$1 AND status='pending'",[id]);
  return {open:input.open};
 }
 if(!['propose','accept','reject','counter'].includes(kind))fail('Operazione non disponibile',404);
 if(state.rules.tradesOpen!==true||auctionBusy(state))fail('Gli scambi sono chiusi.',409);
 if(typeof input.id!=='string'||!uuid.test(input.id))fail('Richiesta di scambio non valida.');
 if(kind==='propose'){
  const recipient=state.teams.find(t=>t.id===input.recipient&&t.userId&&t.id!==mine.id);
  if(!recipient)fail('Scegli un’altra squadra con un allenatore.');
  const existing=(await c.query('SELECT sender_uid FROM fanta.trades WHERE id=$1 AND league_id=$2',[input.id,id])).rows[0];
  if(existing?.sender_uid===uid)return {id:input.id};
  const {terms}=settleTrade(state,mine,recipient,input);
  const created=await c.query(`INSERT INTO fanta.trades (id,league_id,sender_team_id,recipient_team_id,sender_uid,recipient_uid,terms)
   VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING RETURNING id`,[input.id,id,mine.id,recipient.id,uid,recipient.userId,JSON.stringify(terms)]);
  if(!created.rows.length)fail('Identificativo della richiesta già utilizzato.',409);
  return {id:input.id};
 }

 const row=(await c.query('SELECT * FROM fanta.trades WHERE id=$1 AND league_id=$2 AND recipient_team_id=$3 AND recipient_uid=$4',[input.id,id,mine.id,uid])).rows[0];
 if(!row)fail('Richiesta di scambio non trovata.',404);
 if(row.status!=='pending'||row.revision!==input.revision)fail('Questa richiesta è già stata aggiornata.',409);
 const sender=state.teams.find(t=>t.id===row.sender_team_id&&t.userId===row.sender_uid);
 if(!sender)fail('L’allenatore della squadra è cambiato.',409);
 if(kind==='reject'){
  await c.query("UPDATE fanta.trades SET status='rejected',updated_at=now() WHERE id=$1",[row.id]);
 }else if(kind==='counter'){
  const {terms}=settleTrade(state,mine,sender,input);
  if(terms.credits===-row.terms.credits&&samePlayers(terms.offer,row.terms.want)&&samePlayers(terms.want,row.terms.offer)){
   fail('Modifica i giocatori o i crediti per inviare una controproposta.');
  }
  await c.query(`UPDATE fanta.trades SET sender_team_id=recipient_team_id,recipient_team_id=sender_team_id,
   sender_uid=recipient_uid,recipient_uid=sender_uid,revision=revision+1,terms=$2,updated_at=now() WHERE id=$1`,[row.id,JSON.stringify(terms)]);
 }else{
  const {offer,want,credits}=row.terms;
  const {teams}=settleTrade(state,sender,mine,{offer:offer.map(p=>p.id),want:want.map(p=>p.id),credits});
  const moves=[...offer.map(p=>({id:p.id,from:sender.id,to:mine.id})),...want.map(p=>({id:p.id,from:mine.id,to:sender.id}))];
  const auction=structuredClone(state.auction);
  const affected=new Set(moves.map(p=>p.id));
  for(const sale of auction.log)if(affected.has(sale.player.id)&&!sale.undone)sale.released=true;
  auction.version++;
  await persistRoster(c,state,{...state,teams,auction},{actor:uid,kind:'trade',input:{id:row.id,credits,moves},now});
  await c.query("UPDATE fanta.trades SET status='accepted',updated_at=now() WHERE id=$1",[row.id]);
  await c.query(`UPDATE fanta.trades t SET status='expired',updated_at=now()
   WHERE league_id=$1 AND status='pending' AND EXISTS (
    SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS moved(id text,"from" text)
    WHERE (moved."from"=t.sender_team_id AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.terms->'offer') p WHERE p->>'id'=moved.id))
       OR (moved."from"=t.recipient_team_id AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.terms->'want') p WHERE p->>'id'=moved.id))
   )`,[id,JSON.stringify(moves)]);
 }
 return {id:row.id};
}
