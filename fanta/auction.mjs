import {randomUUID,randomInt} from 'node:crypto';
import {DEFAULT_RULES,fail} from './rules.mjs';
export const AUCTION_TYPES={iniziale:'Asta iniziale',riparazione:'Asta di riparazione',lampo:'Asta lampo'};
export const duration=(seconds,rules=DEFAULT_RULES)=>(seconds-rules.finalSeconds+rules.finalStretch)*1000;
export function teamBudget(team,rules){const spent=team.roster.reduce((sum,p)=>sum+p.price,0),roles=Object.fromEntries(Object.entries(rules.roster).map(([r,max])=>[r,{have:team.roster.filter(p=>p.role===r).length,max}])),slotsLeft=Object.values(roles).reduce((n,x)=>n+Math.max(0,x.max-x.have),0),credits=rules.budget-spent+(team.creditAdjustment||0);return {spent:rules.budget-credits,rosterCost:spent,unrefunded:Math.max(0,-(team.creditAdjustment||0)),credits,slotsLeft,maxBid:slotsLeft?Math.max(0,credits-(slotsLeft-1)):0,roles};}
const eligible=(s,t,p,amount)=>{const b=teamBudget(t,s.rules);return b.roles[p.role].have>=b.roles[p.role].max?'role':b.maxBid<amount?'credits':null;};
function nextCaller(s,now){const a=s.auction,ids=a.order.filter(id=>teamBudget(s.teams.find(t=>t.id===id),s.rules).slotsLeft>0);if(!ids.length){a.status='ended';a.caller=null;a.callDeadline=null;return;}const current=a.order.indexOf(a.caller);a.caller=Array.from({length:a.order.length},(_,i)=>a.order[(current+i+1)%a.order.length]).find(id=>ids.includes(id));a.callDeadline=new Date(now+s.rules.callSeconds*1000).toISOString();a.lot=null;}
function sell(s,teamId,player,price,now,id){const team=s.teams.find(t=>t.id===teamId);if(!team||!player||!Number.isInteger(price)||price<1||eligible(s,team,player,price))fail('Prezzo, crediti o posti del ruolo non validi');if(s.teams.some(t=>t.roster.some(p=>p.id===player.id)))fail('Il giocatore è già stato aggiudicato',409);team.roster.push({...player,price});const sale={id:id(),player:{...player},team:team.id,price,at:new Date(now).toISOString(),undone:false};s.auction.log.push(sale);s.auction.lastSale=sale;return sale;}
function start(s,now,rng){const a=s.auction;a.singlePlayer=a.mode==='live'&&s.teams.filter(t=>t.userId).length===1&&s.teams.some(t=>!t.userId);a.status='running';a.phase=a.type==='riparazione'?'releases':'bidding';if(a.phase==='releases')a.releaseBatchId=a.version+':'+now;a.order=s.teams.map(t=>t.id);for(let i=a.order.length-1;i>0;i--){const j=rng(i+1);[a.order[i],a.order[j]]=[a.order[j],a.order[i]];}a.caller=null;if(a.mode==='manual'||a.phase==='releases')a.callDeadline=null;else nextCaller(s,now);a.pausedUntil=null;}
export function auctionTickDue(a,now=Date.now()){
 if(a.status==='scheduled')return Date.parse(a.startsAt)<=now;
 if(a.status!=='running'||a.mode==='manual'||a.phase==='releases')return false;
 if(a.pausedUntil)return Date.parse(a.pausedUntil)<=now;
 return a.lot?Date.parse(a.lot.endsAt)<=now:!!a.callDeadline&&Date.parse(a.callDeadline)<=now;
}
export function advanceAuction(s,now=Date.now(),{id=randomUUID,rng=randomInt}={}){
 const a=s.auction;if(a.status==='scheduled'&&Date.parse(a.startsAt)<=now){start(s,now,rng);a.version++;}
 if(a.status!=='running'||a.mode==='manual'||a.phase==='releases')return;
 if(a.pausedUntil){if(Date.parse(a.pausedUntil)>now)return;a.pausedUntil=null;nextCaller(s,now);a.version++;}
 if(a.lot&&Date.parse(a.lot.endsAt)<=now){sell(s,a.lot.leader,a.lot.player,a.lot.bid,now,id);a.lot=null;a.pausedUntil=new Date(now+2500).toISOString();a.version++;return;}
 if(!a.lot&&a.callDeadline&&Date.parse(a.callDeadline)<=now){a.skipped={team:a.caller};a.callDeadline=null;a.pausedUntil=new Date(now+2500).toISOString();a.version++;}
}
export function auctionAction(state,kind,input,actor,{admin=false,now=Date.now(),id=randomUUID,rng=randomInt,computerTeam=null}={}){
 const s=structuredClone(state),a=s.auction;
 const adminActions=['schedule','start','start-now','close','cancel-lot','mode','table','assign','undo','release','release-undo','releases-done'];if(adminActions.includes(kind)&&!admin)fail('Solo il presidente può gestire l’asta',403);
 // Closing/cancelling must never implicitly sell an expired lot before handling the command.
 if(!['close','cancel-lot'].includes(kind))advanceAuction(s,now,{id,rng});
 const clearLot=reason=>{const lot=a.lot,p=lot?.player||a.table;if(p)a.cancellations=[...(a.cancellations||[]),{playerId:p.id,lotId:lot?.id||null,at:new Date(now).toISOString(),actor,reason,history:lot?.history||[]}].slice(-1000);a.lot=null;a.table=null;a.pausedUntil=null;a.skipped=null;};
 const t=computerTeam?s.teams.find(t=>t.id===computerTeam&&!t.userId):s.teams.find(t=>t.userId===actor),player=s.players.find(p=>p.id===input.playerId);
 const free=p=>p&&p.active!==false&&!s.teams.some(t=>t.roster.some(x=>x.id===p.id));
 if(kind==='read')return s;
 if(kind==='schedule'){
  if(a.status==='running')fail('Chiudi prima l’asta in corso',409);if(!AUCTION_TYPES[input.type]||!['live','manual'].includes(input.mode)||!Number.isFinite(Date.parse(input.startsAt))||Date.parse(input.startsAt)<now)fail('Controlla tipo, modalità e orario dell’asta');
  Object.assign(a,{status:'scheduled',type:input.type,mode:input.mode,startsAt:input.startsAt,lot:null,table:null,caller:null,callDeadline:null,pausedUntil:null});
 }else if(kind==='start-now'){
  if(a.status==='running')return s;
  const initialType=s.rules.rosterMode==='empty'&&s.teams.every(t=>t.roster.length===0)?'iniziale':'riparazione';
  if(!AUCTION_TYPES[input.type||initialType]||!['manual','live'].includes(input.mode||'manual'))fail('Modalità asta non valida');
  Object.assign(a,{status:'scheduled',type:input.type||initialType,mode:input.mode||'manual',startsAt:new Date(now).toISOString(),lot:null,table:null,pausedUntil:null});start(s,now,rng);
 }else if(kind==='start'){if(a.status!=='scheduled')fail('Programma prima un’asta');start(s,now,rng);
 }else if(kind==='close'){if(a.status==='ended'&&!a.lot&&!a.table)return s;clearLot('auction-closed');a.status='ended';a.caller=null;a.callDeadline=null;
 }else{
  if(a.status!=='running')fail('L’asta non è aperta',409);
  if(kind==='release'||kind==='release-undo'||kind==='releases-done'){
   if(a.phase!=='releases')fail('La fase svincoli è chiusa',409);
   if(kind==='releases-done'){a.phase='bidding';a.table=null;if(a.mode==='live')nextCaller(s,now);}
   else if(kind==='release'){
    const owner=s.teams.find(t=>t.roster.some(p=>p.id===input.playerId)),p=owner?.roster.find(p=>p.id===input.playerId),refund=input.refund;if(!p)fail('Il giocatore è già libero',409);
    if(!Number.isInteger(refund)||refund<0||refund>p.price)fail('Il rimborso deve essere tra zero e il prezzo pagato');
    owner.roster=owner.roster.filter(x=>x.id!==p.id);owner.creditAdjustment=(owner.creditAdjustment||0)+refund-p.price;
    const priorSaleIds=[];for(const sale of a.log)if(sale.player.id===p.id&&sale.team===owner.id&&!sale.undone&&!sale.released){sale.released=true;priorSaleIds.push(sale.id);}
    a.releases=[...(a.releases||[]),{id:id(),batch:a.releaseBatchId,player:{...p},team:owner.id,paid:p.price,refund,at:new Date(now).toISOString(),actor,undone:false,priorSaleIds}];a.table=null;
   }else{
    const release=[...(a.releases||[])].reverse().find(r=>r.player.id===input.playerId&&r.batch===a.releaseBatchId&&!r.undone);if(!release)fail('Svincolo non annullabile',409);
    if(s.teams.some(t=>t.roster.some(p=>p.id===release.player.id)))fail('Il giocatore non è più libero',409);
    const owner=s.teams.find(t=>t.id===release.team);owner.roster.push({...release.player,price:release.paid});owner.creditAdjustment=(owner.creditAdjustment||0)-release.refund+release.paid;release.undone=true;for(const sale of a.log)if(release.priorSaleIds?.includes(sale.id))sale.released=false;
   }
  }else if(a.phase==='releases'&&kind==='table'){
   const owner=s.teams.find(t=>t.roster.some(p=>p.id===input.playerId)),p=owner?.roster.find(p=>p.id===input.playerId);if(input.playerId&&!p)fail('Scegli un giocatore già assegnato');a.table=p?{...p,ownerTeam:{id:owner.id,name:owner.name}}:null;
  }else if(a.phase==='releases'&&kind!=='cancel-lot')fail('Completa prima gli svincoli',409);
  else if(kind==='cancel-lot'){
const p=a.lot?.player||a.table;if(!p)return s;if(input.lotId&&a.lot?.id!==input.lotId||input.playerId&&p.id!==input.playerId)fail('Il giocatore sul tavolo è cambiato. Rileggi l’asta.',409);clearLot('called-player-cancelled');a.callDeadline=a.mode==='live'&&a.phase!=='releases'?new Date(now+s.rules.callSeconds*1000).toISOString():null;
  }else if(kind==='mode'){if(!['manual','live'].includes(input.mode)||a.lot||a.table)fail('Concludi prima il giocatore sul tavolo');a.mode=input.mode;if(a.mode==='live')nextCaller(s,now);else a.callDeadline=null;
  }else if(kind==='table'){if(a.mode!=='manual')fail('Comando riservato all’asta dal vivo');if(input.playerId!=null&&!free(player))fail('Giocatore non disponibile');a.table=input.playerId==null?null:player;
  }else if(kind==='assign'){if(a.mode!=='manual'||a.table?.id!==input.playerId)fail('Metti prima questo giocatore sul tavolo');sell(s,input.teamId,player,input.price,now,id);a.table=null;
  }else if(kind==='undo'){const sale=a.log.find(x=>x.id===input.saleId&&!x.undone&&!x.released);if(!sale)fail('Acquisto non annullabile',409);const target=s.teams.find(t=>t.id===sale.team);if(!target?.roster.some(p=>p.id===sale.player.id&&p.price===sale.price))fail('La rosa è stata corretta: questo acquisto non è più annullabile',409);target.roster=target.roster.filter(p=>p.id!==sale.player.id);sale.undone=true;a.lastSale=[...a.log].reverse().find(x=>!x.undone&&!x.released)||null;
  }else{
   if(a.mode!=='live'||!t)fail('Non puoi partecipare a questa asta',403);
   if(kind==='nominate'){if(a.lot||a.pausedUntil||a.caller!==t.id)fail('Non è il tuo turno di chiamata',409);if(!free(player))fail('Il giocatore non è libero');const amount=input.amount??1;if(!Number.isInteger(amount)||amount<1||eligible(s,t,player,amount))fail('Importo o posto del ruolo non valido');
    a.lot={id:id(),player,bid:amount,leader:t.id,endsAt:new Date(now+duration(s.rules.openSeconds,s.rules)).toISOString(),timerSeconds:s.rules.openSeconds,closing:false,passed:[],autoPassed:{},history:[{team:t.id,amount,at:new Date(now).toISOString(),call:true}]};a.callDeadline=null;
   }else if(kind==='bid'||kind==='pass'){
    const lot=a.lot;if(!lot||lot.id!==input.lotId||Date.parse(lot.endsAt)<=now)fail('Il lotto è già chiuso',409);if(lot.leader===t.id)fail('Sei già in testa');if(lot.passed.includes(t.id)||lot.autoPassed[t.id])fail('Hai già passato questo giocatore',409);
    if(kind==='pass'){lot.passed.push(t.id);lot.history.push({team:t.id,pass:true,at:new Date(now).toISOString()});}
    else{if(!Number.isInteger(input.amount)||input.amount<lot.bid+s.rules.minRaise)fail('Serve almeno '+(lot.bid+s.rules.minRaise));if(eligible(s,t,lot.player,input.amount))fail('Crediti o posti del ruolo insufficienti');lot.bid=input.amount;lot.leader=t.id;lot.endsAt=new Date(now+duration(s.rules.raiseSeconds,s.rules)).toISOString();lot.timerSeconds=s.rules.raiseSeconds;lot.closing=false;lot.history.push({team:t.id,amount:input.amount,at:new Date(now).toISOString()});}
   }else fail('Comando asta non riconosciuto',404);
   const lot=a.lot;if(lot){for(const team of s.teams.filter(x=>x.id!==lot.leader)){const reason=eligible(s,team,lot.player,lot.bid+s.rules.minRaise);if(reason)lot.autoPassed[team.id]=reason;}
    if(s.teams.every(x=>x.id===lot.leader||lot.passed.includes(x.id)||lot.autoPassed[x.id])){lot.closing=true;lot.endsAt=new Date(now+1500).toISOString();}}
  }
 }
 a.version++;return s;
}
export function auctionView(s,uid,now=Date.now()){
 const a=s.auction,t=s.teams.find(t=>t.userId===uid),isAdmin=s.league.adminUid===uid;
 return {...a,singlePlayerAvailable:s.teams.filter(t=>t.userId).length===1&&s.teams.some(t=>!t.userId),log:a.log.filter(x=>!x.undone).slice().reverse(),rules:s.rules,serverTime:new Date(now).toISOString(),me:t?.id||null,isAdmin,auctioneer:s.teams.find(t=>t.userId===s.league.adminUid)?.manager||'Presidente',teams:s.teams.map(t=>({team:t,...teamBudget(t,s.rules),online:!!t.userId})),myRoster:t?.roster||[]};
}
