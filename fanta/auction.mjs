import {randomUUID,randomInt} from 'node:crypto';
import {DEFAULT_RULES,fail} from './rules.mjs';
import {AUCTION_TYPES,LAMPO,lampoDuration} from '../public/src/auction-formats.mjs';
export {AUCTION_TYPES};
export const duration=(seconds,rules=DEFAULT_RULES)=>(seconds-rules.finalSeconds+rules.finalStretch)*1000;
export function teamBudget(team,rules){const spent=team.roster.reduce((sum,p)=>sum+p.price,0),roles=Object.fromEntries(Object.entries(rules.roster).map(([r,max])=>[r,{have:team.roster.filter(p=>p.role===r).length,max}])),slotsLeft=Object.values(roles).reduce((n,x)=>n+Math.max(0,x.max-x.have),0),credits=rules.budget-spent+(team.creditAdjustment||0);return {spent:rules.budget-credits,rosterCost:spent,unrefunded:Math.max(0,-(team.creditAdjustment||0)),credits,slotsLeft,maxBid:slotsLeft?Math.max(0,credits-(slotsLeft-1)):0,roles};}
const eligible=(s,t,p,amount)=>{const b=teamBudget(t,s.rules);return b.roles[p.role].have>=b.roles[p.role].max?'role':b.maxBid<amount?'credits':null;};
export const singlePlayerAvailable=s=>s.teams.filter(t=>t.userId).length===1&&s.teams.some(t=>!t.userId);
export const computerTeamsAvailable=s=>s.teams.some(t=>t.userId)&&s.teams.some(t=>!t.userId);
export const computerTeamsActive=s=>s.auction.mode==='live'&&computerTeamsAvailable(s)&&(s.auction.computerTeams??(!!s.auction.singlePlayer&&singlePlayerAvailable(s)));
const participants=s=>computerTeamsActive(s)?s.teams:s.teams.filter(t=>t.userId);
function validateType(s,type,config){
 if(!config||type==='lampo')return;
 const full=s.teams.length===(s.league.maxMembers??s.teams.length)&&s.teams.every(t=>!teamBudget(t,s.rules).slotsLeft);
 if(type==='iniziale'&&full)fail('Le rose sono complete: puoi aprire un’asta di riparazione',409);
 if(type==='riparazione'&&!full)fail('Completa tutte le rose con l’asta a chiamata prima di aprire gli svincoli',409);
}
const ROLES=['P','D','C','A'];
const freePlayers=s=>{const owned=new Set(s.teams.flatMap(t=>t.roster.map(p=>p.id)));return s.players.filter(p=>p.active!==false&&!owned.has(p.id));};
function configure(s,input,type){
 const x=input.config;
 if(x===undefined&&type!=='lampo')return null;
 const config=x===undefined?{budget:s.rules.budget}:x;
 const minimum=Object.values(s.rules.roster).reduce((sum,count)=>sum+count,0);
 if(!config||!Number.isSafeInteger(config.budget)||config.budget<minimum||config.budget>100000)fail('Controlla il budget dell’asta');
 const nomination=type==='lampo'?'random':type==='iniziale'?'personal':config.nomination;
 const playerOrder=type==='riparazione'?config.playerOrder:'roles';
 if(!['personal','random'].includes(nomination)||!['roles','mixed'].includes(playerOrder))fail('Controlla l’ordine di chiamata');
 const teamOrder=nomination==='personal'?config.teamOrder:null;
 if(teamOrder!=null&&(!Array.isArray(teamOrder)||teamOrder.length!==s.teams.length||new Set(teamOrder).size!==s.teams.length||s.teams.some(t=>!teamOrder.includes(t.id))))fail('L’ordine delle squadre deve contenere tutte le squadre una sola volta');
 return {budget:config.budget,nomination,playerOrder,teamOrder:teamOrder??null};
}
const sameConfig=(a,b)=>a==null||b==null?a==null&&b==null:a.budget===b.budget&&a.nomination===b.nomination&&a.playerOrder===b.playerOrder&&JSON.stringify(a.teamOrder??null)===JSON.stringify(b.teamOrder);
function updateRole(s,teams,players=freePlayers(s)){
 const roles=new Set(players.map(p=>p.role));
 s.auction.currentRole=s.auction.config?.playerOrder==='roles'?ROLES.find(role=>roles.has(role)&&teams.some(t=>!eligible(s,t,{role},1)))??null:null;
}
function rotateCaller(a,ids){
 const current=a.order.indexOf(a.caller);
 a.caller=Array.from({length:a.order.length},(_,i)=>a.order[(current+i+1)%a.order.length]).find(id=>ids.includes(id))??null;
}
function manualTurn(s,rotate=true){
 const a=s.auction,skipped=new Set(a.randomSkipped),players=freePlayers(s).filter(p=>!skipped.has(p.id));
 updateRole(s,s.teams,players);
 if(a.config.nomination==='personal'&&rotate){
  const roles=new Set(players.filter(p=>!a.currentRole||p.role===a.currentRole).map(p=>p.role));
  rotateCaller(a,s.teams.filter(t=>[...roles].some(role=>!eligible(s,t,{role},1))).map(t=>t.id));
 }
}
function openLot(s,player,now,id,leader=null,bid=0){
 const a=s.auction,lampo=a.type==='lampo',seconds=lampo?LAMPO.open:s.rules.openSeconds;
 a.lot={id:id(),player,bid,leader,endsAt:new Date(now+(lampo?lampoDuration(seconds):duration(seconds,s.rules))).toISOString(),timerSeconds:seconds,closing:false,passed:[],autoPassed:{},history:leader?[{team:leader,amount:bid,at:new Date(now).toISOString(),call:true}]:[]};
 a.callDeadline=null;
 updateLot(s,now);
}
function updateLot(s,now){
 const lot=s.auction.lot;if(!lot)return;
 const rivals=participants(s).filter(t=>t.id!==lot.leader);
 for(const team of rivals){const reason=eligible(s,team,lot.player,lot.bid+s.rules.minRaise);if(reason)lot.autoPassed[team.id]=reason;}
 if(rivals.every(t=>lot.passed.includes(t.id)||lot.autoPassed[t.id])){lot.closing=true;lot.endsAt=new Date(now+1500).toISOString();}
}
function nextCaller(s,now,{id,rng}){
 const a=s.auction,teams=participants(s);
 const random=a.config?.nomination==='random';
 const skipped=new Set(a.randomSkipped||[]);
 const players=a.config?freePlayers(s).filter(p=>!random||!skipped.has(p.id)):[];
 if(a.config)updateRole(s,teams,players);
 const available=players.filter(p=>!a.currentRole||p.role===a.currentRole),roles=new Set(available.map(p=>p.role));
 const ids=teams.filter(t=>a.config?[...roles].some(role=>!eligible(s,t,{role},1)):teamBudget(t,s.rules).slotsLeft>0).map(t=>t.id);
 a.lot=null;a.skipped=null;
 if(!ids.length){a.status='ended';a.caller=null;a.callDeadline=null;return;}
 if(random){a.caller=null;const candidates=available.filter(p=>teams.some(t=>!eligible(s,t,p,1)));openLot(s,candidates[rng(candidates.length)],now,id);return;}
 rotateCaller(a,ids);
 a.callDeadline=new Date(now+s.rules.callSeconds*1000).toISOString();
}
function sell(s,teamId,player,price,now,id){const team=s.teams.find(t=>t.id===teamId);if(!team||!player||!Number.isInteger(price)||price<1||eligible(s,team,player,price))fail('Prezzo, crediti o posti del ruolo non validi');if(s.teams.some(t=>t.roster.some(p=>p.id===player.id)))fail('Il giocatore è già stato aggiudicato',409);team.roster.push({...player,price});const sale={id:id(),player:{...player},team:team.id,price,at:new Date(now).toISOString(),undone:false};s.auction.log.push(sale);s.auction.lastSale=sale;return sale;}
function start(s,now,tools){
 const a=s.auction;
 if(a.type==='lampo'){a.mode='live';a.config=configure(s,{config:a.config??undefined},a.type);}
 if(a.type==='iniziale'&&a.config)a.config=configure(s,{config:a.config},a.type);
 if(a.config)s.rules.budget=a.config.budget;
 a.singlePlayer=a.mode==='live'&&a.computerTeams!==false&&singlePlayerAvailable(s);
 a.status='running';a.phase=a.type==='riparazione'?'releases':'bidding';
 if(a.phase==='releases')a.releaseBatchId=a.version+':'+now;
 const ids=s.teams.map(t=>t.id);
 a.order=a.config?.teamOrder?[...new Set([...a.config.teamOrder.filter(id=>ids.includes(id)),...ids])]:ids;
 if(!a.config?.teamOrder)for(let i=a.order.length-1;i>0;i--){const j=tools.rng(i+1);[a.order[i],a.order[j]]=[a.order[j],a.order[i]];}
 Object.assign(a,{caller:null,callDeadline:null,currentRole:null,randomSkipped:[],skipped:null,pausedUntil:null,lobbyEndsAt:null});
 if(a.phase==='releases')return;
 if(a.mode==='live'&&a.config)a.phase='lobby';
 else if(a.mode==='live')nextCaller(s,now,tools);
 else if(a.config)manualTurn(s);
}
export const auctionTickNeedsCatalog=a=>!!a.config&&(a.status==='scheduled'||!!a.pausedUntil||!!a.lobbyEndsAt);
export const lotDeadline=a=>a.lot?Date.parse(a.lot.endsAt)+(a.type==='lampo'&&!a.lot.closing?LAMPO.maxGrace:0):null;
export function auctionTickDue(a,now=Date.now()){
 if(a.status==='scheduled')return Date.parse(a.startsAt)<=now;
 if(a.status!=='running'||a.mode==='manual'||a.phase==='releases')return false;
 if(a.phase==='lobby')return !!a.lobbyEndsAt&&Date.parse(a.lobbyEndsAt)<=now;
 if(a.pausedUntil)return Date.parse(a.pausedUntil)<=now;
 return a.lot?lotDeadline(a)<=now:!!a.callDeadline&&Date.parse(a.callDeadline)<=now;
}
export function advanceAuction(s,now=Date.now(),{id=randomUUID,rng=randomInt}={}){
 const a=s.auction;if(a.status==='scheduled'&&Date.parse(a.startsAt)<=now){start(s,now,{id,rng});a.version++;}
 if(a.status!=='running'||a.mode==='manual'||a.phase==='releases')return;
 if(a.phase==='lobby'){
  if(!a.lobbyEndsAt||Date.parse(a.lobbyEndsAt)>now)return;
  a.phase='bidding';a.lobbyEndsAt=null;nextCaller(s,now,{id,rng});a.version++;return;
 }
 if(a.pausedUntil){if(Date.parse(a.pausedUntil)>now)return;a.pausedUntil=null;nextCaller(s,now,{id,rng});a.version++;}
 if(a.lot&&lotDeadline(a)<=now){
  if(a.lot.leader)sell(s,a.lot.leader,a.lot.player,a.lot.bid,now,id);
  else{a.skipped={player:a.lot.player.name};a.randomSkipped.push(a.lot.player.id);}
  a.lot=null;a.pausedUntil=new Date(now+2500).toISOString();a.version++;return;
 }
 if(!a.lot&&a.callDeadline&&Date.parse(a.callDeadline)<=now){a.skipped={team:a.caller};a.callDeadline=null;a.pausedUntil=new Date(now+2500).toISOString();a.version++;}
}
export function auctionAction(state,kind,input,actor,{admin=false,now=Date.now(),id=randomUUID,rng=randomInt,computerTeam=null,receivedAt=now,latencyGrace=0}={}){
 const s=structuredClone(state),a=s.auction;
 const adminActions=['schedule','start','start-now','lobby-start','close','cancel-lot','mode','table','draw','assign','undo','release','release-undo','releases-done'];if(adminActions.includes(kind)&&!admin)fail('Solo il presidente può gestire l’asta',403);
 if(['schedule','start','start-now'].includes(kind)&&input.computerTeams!==undefined&&typeof input.computerTeams!=='boolean')fail('Impostazione squadre del computer non valida');
 // Closing/cancelling must never implicitly sell an expired lot before handling the command.
 if(!['close','cancel-lot'].includes(kind))advanceAuction(s,kind==='bid'&&a.type==='lampo'?Math.min(now,receivedAt):now,{id,rng});
 const clearLot=reason=>{const lot=a.lot,p=lot?.player||a.table;if(p)a.cancellations=[...(a.cancellations||[]),{playerId:p.id,lotId:lot?.id||null,at:new Date(now).toISOString(),actor,reason,history:lot?.history||[]}].slice(-1000);a.lot=null;a.table=null;a.pausedUntil=null;a.skipped=null;};
 const t=computerTeam?(computerTeamsActive(s)?s.teams.find(t=>t.id===computerTeam&&!t.userId):null):s.teams.find(t=>t.userId===actor),player=s.players.find(p=>p.id===input.playerId);
 const free=p=>p&&p.active!==false&&!s.teams.some(t=>t.roster.some(x=>x.id===p.id));
 if(kind==='read')return s;
 if(kind==='schedule'){
  if(a.status==='running')fail('Chiudi prima l’asta in corso',409);if(!AUCTION_TYPES[input.type]||!['live','manual'].includes(input.mode)||!Number.isFinite(Date.parse(input.startsAt))||Date.parse(input.startsAt)<now)fail('Controlla tipo, modalità e orario dell’asta');
  const config=configure(s,input,input.type),startsAt=new Date(input.startsAt).toISOString(),mode=input.type==='lampo'?'live':input.mode;
  validateType(s,input.type,config);
  if(a.status==='scheduled'&&a.startsAt===startsAt&&a.type===input.type&&a.mode===mode&&a.computerTeams===input.computerTeams&&sameConfig(a.config,config))return s;
  Object.assign(a,{status:'scheduled',type:input.type,mode,config,computerTeams:input.computerTeams,singlePlayer:false,startsAt,lot:null,table:null,caller:null,callDeadline:null,currentRole:null,pausedUntil:null,lobbyEndsAt:null});
 }else if(kind==='start-now'){
  if(a.status==='running')return s;
  const initialType=s.rules.rosterMode==='empty'&&s.teams.every(t=>t.roster.length===0)?'iniziale':'riparazione';
  if(!AUCTION_TYPES[input.type||initialType]||!['manual','live'].includes(input.mode||'manual'))fail('Modalità asta non valida');
  const type=input.type||initialType,config=configure(s,input,type);validateType(s,type,config);
  Object.assign(a,{status:'scheduled',type,mode:type==='lampo'?'live':input.mode||'manual',config,computerTeams:input.computerTeams,startsAt:new Date(now).toISOString(),lot:null,table:null,pausedUntil:null});start(s,now,{id,rng});
 }else if(kind==='start'){if(a.status!=='scheduled')fail('Programma prima un’asta');if(a.mode==='live'&&input.computerTeams!==undefined)a.computerTeams=input.computerTeams;start(s,now,{id,rng});
 }else if(kind==='close'){if(a.status==='ended'&&!a.lot&&!a.table)return s;clearLot('auction-closed');a.status='ended';a.caller=null;a.callDeadline=null;a.lobbyEndsAt=null;
 }else{
  if(a.status!=='running')fail('L’asta non è aperta',409);
  if(kind==='lobby-start'){
   if(a.phase!=='lobby')fail('La sala d’attesa è già chiusa',409);
   if(a.lobbyEndsAt)return s;
   a.lobbyEndsAt=new Date(now+10000).toISOString();
  }else if(a.phase==='lobby')fail('Aspetta che il presidente avvii l’asta',409);
  else if(kind==='release'||kind==='release-undo'||kind==='releases-done'){
   if(a.phase!=='releases')fail('La fase svincoli è chiusa',409);
   if(kind==='releases-done'){a.phase='bidding';a.table=null;if(a.mode==='live'&&a.config)a.phase='lobby';else if(a.mode==='live')nextCaller(s,now,{id,rng});else if(a.config)manualTurn(s);}
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
   const p=a.lot?.player||a.table;if(!p)return s;if(input.lotId&&a.lot?.id!==input.lotId||input.playerId&&p.id!==input.playerId)fail('Il giocatore sul tavolo è cambiato. Rileggi l’asta.',409);clearLot('called-player-cancelled');
   if(a.mode==='live'&&a.phase!=='releases'){
    if(a.config?.nomination==='random'){a.randomSkipped.push(p.id);nextCaller(s,now,{id,rng});}
    else a.callDeadline=new Date(now+s.rules.callSeconds*1000).toISOString();
   }else if(a.phase!=='releases'&&a.config?.nomination==='random'){a.randomSkipped.push(p.id);manualTurn(s,false);}
  }else if(kind==='mode'){if(a.config||!['manual','live'].includes(input.mode)||a.lot||a.table)fail('La modalità si sceglie nel wizard dell’asta');a.mode=input.mode;if(a.mode==='live')nextCaller(s,now,{id,rng});else a.callDeadline=null;
  }else if(kind==='draw'){
   if(a.mode!=='manual'||a.config?.nomination!=='random'||a.table)fail('Concludi prima il giocatore sul tavolo');
   const skipped=new Set(a.randomSkipped),candidates=freePlayers(s).filter(p=>!skipped.has(p.id)&&(!a.currentRole||p.role===a.currentRole)&&s.teams.some(t=>!eligible(s,t,p,1)));
   if(!candidates.length)fail('Nessun giocatore disponibile');a.table=candidates[rng(candidates.length)];
  }else if(kind==='table'){if(a.mode!=='manual')fail('Comando riservato all’asta dal vivo');if(input.playerId!=null&&(!free(player)||a.config?.nomination==='random'||a.currentRole&&player.role!==a.currentRole))fail('Giocatore non disponibile per questa chiamata');a.table=input.playerId==null?null:player;
  }else if(kind==='assign'){if(a.mode!=='manual'||a.table?.id!==input.playerId)fail('Metti prima questo giocatore sul tavolo');sell(s,input.teamId,player,input.price,now,id);a.table=null;if(a.config)manualTurn(s);
  }else if(kind==='undo'){const sale=a.log.find(x=>x.id===input.saleId&&!x.undone&&!x.released);if(!sale)fail('Acquisto non annullabile',409);const target=s.teams.find(t=>t.id===sale.team);if(!target?.roster.some(p=>p.id===sale.player.id&&p.price===sale.price))fail('La rosa è stata corretta: questo acquisto non è più annullabile',409);target.roster=target.roster.filter(p=>p.id!==sale.player.id);sale.undone=true;a.lastSale=[...a.log].reverse().find(x=>!x.undone&&!x.released)||null;if(a.config&&a.mode==='manual'&&!a.table)manualTurn(s,false);
  }else{
   if(a.mode!=='live'||!t)fail('Non puoi partecipare a questa asta',403);
   if(kind==='nominate'){if(a.lot||a.pausedUntil||a.caller!==t.id||a.config?.nomination==='random')fail('Non è il tuo turno di chiamata',409);if(!free(player)||a.currentRole&&player.role!==a.currentRole)fail('Il giocatore non è disponibile per questo ruolo');const amount=input.amount??1;if(!Number.isInteger(amount)||amount<1||eligible(s,t,player,amount))fail('Importo o posto del ruolo non valido');
    openLot(s,player,now,id,t.id,amount);
   }else if(kind==='bid'||kind==='pass'){
    const lot=a.lot,lampo=a.type==='lampo';
    const allowLate=lampo&&kind==='bid'&&!computerTeam&&!lot?.closing;
    const elapsedAt=allowLate?Math.min(receivedAt,now)-Math.min(LAMPO.maxGrace,Math.max(0,latencyGrace)):now;
    if(!lot||lot.id!==input.lotId||Date.parse(lot.endsAt)<=elapsedAt)fail('Il lotto è già chiuso',409);if(lot.leader===t.id)fail('Sei già in testa');if(lot.passed.includes(t.id)||lot.autoPassed[t.id])fail('Hai già passato questo giocatore',409);
    if(kind==='pass'){lot.passed.push(t.id);lot.history.push({team:t.id,pass:true,at:new Date(now).toISOString()});}
    else{if(!Number.isInteger(input.amount)||input.amount<lot.bid+s.rules.minRaise)fail('Serve almeno '+(lot.bid+s.rules.minRaise));if(eligible(s,t,lot.player,input.amount))fail('Crediti o posti del ruolo insufficienti');lot.bid=input.amount;lot.leader=t.id;
     if(!lampo||Date.parse(lot.endsAt)-now<lampoDuration(LAMPO.raise)){
      const seconds=lampo?LAMPO.raise:s.rules.raiseSeconds;
      lot.endsAt=new Date(now+(lampo?lampoDuration(seconds):duration(seconds,s.rules))).toISOString();lot.timerSeconds=seconds;
     }
     lot.closing=false;lot.history.push({team:t.id,amount:input.amount,at:new Date(now).toISOString()});}
   }else fail('Comando asta non riconosciuto',404);
   if(kind!=='nominate')updateLot(s,now);
  }
 }
 a.version++;return s;
}
export function auctionView(s,uid,now=Date.now()){
 const a=s.auction,t=s.teams.find(t=>t.userId===uid),isAdmin=s.league.adminUid===uid;
 const mixed=computerTeamsActive(s);
 const {randomSkipped,cancellations,...visible}=a;
 const rules=a.type==='lampo'?{...s.rules,openSeconds:LAMPO.open,raiseSeconds:LAMPO.raise,finalSeconds:LAMPO.final,finalStretch:LAMPO.stretch}:s.rules;
 return {...visible,lot:a.lot?{...a.lot,history:a.lot.history.filter(h=>!h.pass).slice(-5)}:null,singlePlayerAvailable:singlePlayerAvailable(s),computerTeamsAvailable:computerTeamsAvailable(s),computerTeamsActive:mixed,log:a.log.filter(x=>!x.undone).slice(-5).reverse(),rules,serverTime:new Date(now).toISOString(),me:t?.id||null,isAdmin,auctioneer:s.teams.find(t=>t.userId===s.league.adminUid)?.manager||'Presidente',teams:s.teams.map(t=>({team:t,...teamBudget(t,s.rules),human:!!t.userId,online:false,computer:mixed&&!t.userId})),myRoster:t?.roster||[]};
}
