import {LEAGUES,homeFor} from './dati-finti.mjs';
import {roundFor,matchupFor,rosterOf,CURRENT_ROUND,seasonOf,nextMatchOf} from './dati-finti-giornata.mjs';
import {teamFor,validateDemoLineup,standardLineup} from './dati-finti-squadra.mjs';
import {createDemoAuctionEngine} from './dati-finti-asta.mjs';
import {leagueFor} from './dati-finti-lega.mjs';
import {TEAMS,MY_TEAM} from './squadre-finte.mjs';
import {normalizeLogo} from './team-logo.mjs';
const NOTIFY_DEFAULTS={lineupReminder:true,roundStart:true,liveEvents:true,results:true,auction:true};
// Same contracts as the real adapter. No fetch, storage, provider, email or push calls.
export function createDemoFantaApi({state=()=> 'da-schierare',delay=0,user={id:'demo-user',username:'ospite',name:'Il Quasi di prova'},access='demo',onSlips=()=>{},onScenario=()=>{},fullRosters=true}={}){
 const engine=createDemoAuctionEngine({fullRosters}),rooms=new Map();let selected=null,scenario=null,settings={notify:{...NOTIFY_DEFAULTS}};
 const room=id=>{if(!LEAGUES.some(l=>l.id===id))throw Error('Lega non disponibile');if(!rooms.has(id))rooms.set(id,{competitions:[{id:'demo-main',name:'Campionato del bar',kind:'league',status:'active',start_round:1}],lineups:new Map(),branding:{},teamName:TEAMS[MY_TEAM].name,audit:[],orders:[],nextOrder:1,slipsEnabled:true,links:{}});return rooms.get(id);};
 const competition=id=>room(id).competitions.find(c=>c.id===selected)||room(id).competitions[0];
 const phase=id=>(scenario||state())==='da-schierare'&&room(id).lineups.has(CURRENT_ROUND)?'schierata':scenario||state();
 const nameDeadline=id=>['in-corso','calcolata'].includes(phase(id))?new Date(0).toISOString():null;
 const saved=id=>new Map(room(id).lineups.has(CURRENT_ROUND)?[[MY_TEAM,room(id).lineups.get(CURRENT_ROUND)]]:[]);
 const admin=id=>{room(id);if(id==='fanta-ufficio')throw Error('Solo il presidente può farlo');};
 const decorate=(value,id)=>{const r=room(id),walk=o=>{if(!o||typeof o!=='object')return;if(o.id&&TEAMS[o.id]){o.branding=structuredClone(r.branding[o.id]||{});if(o.id===MY_TEAM)Object.assign(o,{name:r.teamName,manager:user.name});}for(const v of Object.values(o))if(typeof v==='object')walk(v);};walk(value);return value;};
 const read=fn=>{try{const value=structuredClone(fn());return delay>0?new Promise(resolve=>setTimeout(()=>resolve(value),delay)):Promise.resolve(value);}catch(e){return Promise.reject(e);}};
 const write=fn=>{try{return Promise.resolve(structuredClone(fn()));}catch(e){return Promise.reject(e);}};
 const league=id=>{const l=leagueFor(id,phase(id),Date.now(),engine.auctionFor),r=room(id),a=engine.auctionFor(id);return decorate({...l,auction:{...l.auction,config:a.config,computerTeams:a.computerTeams,computerTeamsAvailable:a.computerTeamsAvailable,singlePlayerAvailable:a.singlePlayerAvailable},league:{...l.league,maxMembers:8,slipsEnabled:r.slipsEnabled},members:l.members.map(m=>({...m,username:r.links[m.team.id]|| (m.isMe?user.username:null)})),competitions:r.competitions,competition:competition(id),sizeLocked:r.competitions.some(c=>c.status!=='draft'),readyToStart:true},id);};
 const teamData=(id,teamId=MY_TEAM)=>{
  if(!TEAMS[teamId])throw Error('Squadra non disponibile');const r=room(id),data=teamFor(id,phase(id),Date.now(),teamId,teamId===MY_TEAM?r.lineups.get(CURRENT_ROUND):{...standardLineup(teamId),savedAt:new Date(Date.now()-3600000).toISOString()});
  if(fullRosters){data.roster=engine.auctionAssigned(id).filter(p=>p.team.id===teamId).map((p,i)=>{const s=seasonOf(p);return {...p,stats:{minutes:Math.min(990,s.played*(45+i%4*15)),teamMatches:11,played:s.played,avgVote:s.avgVote,avgFanta:s.avgFanta,goals:s.goals,assists:s.assists},next:nextMatchOf(p.club),status:s.status,play:i%3?{pct:[90,75,55,20][i%4],source:'probabili'}:null};});data.budget.spent=data.roster.reduce((n,p)=>n+p.price,0);}
  const ids=new Set(data.roster.map(p=>p.id));for(const key of ['previous','lineup'])if(data[key])data[key]={...data[key],starters:data[key].starters.filter(id=>ids.has(id)),bench:data[key].bench.filter(id=>ids.has(id))};
  const a=engine.auctionFor(id);data.canManageRoster=id!=='fanta-ufficio';data.rosterLocked=['running','scheduled'].includes(a.status);if(['in-corso','calcolata'].includes(phase(id))){const next=r.lineups.get(CURRENT_ROUND+1);data.round={number:CURRENT_ROUND+1,state:next?'schierata':'da-schierare',deadline:new Date(Date.now()+9*864e5).toISOString(),locked:teamId!==MY_TEAM};data.canEdit=teamId===MY_TEAM;data.lineup=teamId===MY_TEAM?next||null:data.lineup;data.previous={round:CURRENT_ROUND,...(r.lineups.get(CURRENT_ROUND)||standardLineup(teamId))};}
  data.calendar=league(id).calendar.rounds.flatMap(r=>r.matchups.filter(m=>m.home.team.id===teamId||m.away.team.id===teamId).map(m=>({...m,round:r.number,official:r.state==='calcolata'})));data.teamNameDeadline=nameDeadline(id);return decorate(data,id);
 };
 const change=(id,kind,input)=>{admin(id);const a=engine.auctionFor(id);if(['running','scheduled'].includes(a.status))throw Error('C’è un’asta aperta: usa gli strumenti dell’asta');const {teamId,playerId,price,toTeamId}=input;if(!TEAMS[teamId])throw Error('Squadra non valida');const result=engine.correctRoster(id,kind,input);room(id).audit.unshift({kind,created_at:new Date().toISOString(),username:user.username,data:{input}});return result;};
 const rosterEditor=id=>{
  admin(id);
  const a=engine.auctionFor(id),players=engine.auctionAssigned(id),budget=a.rules.budget;
  return decorate({locked:['running','scheduled'].includes(a.status),lockMessage:'Chiudi l’asta prima di correggere le rose.',budget,limits:a.rules.roster,teams:a.teams.map(({team,credits})=>{
   const roster=players.filter(p=>p.team.id===team.id);
   return {team,roster,creditAdjustment:credits-budget+roster.reduce((sum,p)=>sum+p.price,0)};
  })},id);
 };
 const api={
  invalidateReads(){},setCompetition:id=>{selected=id||null;},
  setScenario:value=>write(()=>{if(!['da-schierare','in-corso','calcolata'].includes(value))throw Error('Scenario non valido');scenario=value;onScenario(value);return {scenario};}),
  me:()=>read(()=>({user:{...user,demo:true},access,settings})),saveSettings:next=>write(()=>settings=structuredClone(next)),
  leagues:()=>read(()=>LEAGUES.map(l=>({...l,slipsEnabled:room(l.id).slipsEnabled}))),
  bootstrap:async id=>{const [me,leagues,home]=await Promise.all([api.me(),api.leagues(),api.home(id||LEAGUES[0].id)]);return {me,leagues,home};},
  home:id=>read(()=>{const r=room(id),h=homeFor(id,phase(id),Date.now(),engine.auctionFor,r.lineups.get(CURRENT_ROUND));if(['in-corso','calcolata'].includes(phase(id))){const next=r.lineups.get(CURRENT_ROUND+1);h.nextLineup={round:CURRENT_ROUND+1,deadline:new Date(Date.now()+9*864e5).toISOString(),formation:next?.formation||null,savedAt:next?.savedAt||null};}h.finalVerification=phase(id)==='in-corso'?{status:'queued',at:new Date(Date.now()+3600000).toISOString()}:null;h.lastResult.matchupId=matchupFor(h.lastResult.round,null,'calcolata',saved(id)).id;h.me.teamName=r.teamName;return decorate({...h,teamNameDeadline:nameDeadline(id),competition:competition(id),competitions:r.competitions},id);}),
  round:(id,number)=>read(()=>decorate(roundFor(number,phase(id),saved(id)),id)),
  matchup:(id,number,matchId)=>read(()=>decorate(matchupFor(number,matchId,phase(id),saved(id)),id)),
  team:(id,teamId)=>read(()=>teamData(id,teamId)),
  saveLineup:(id,number,input)=>write(()=>{room(id);const active=['in-corso','calcolata'].includes(phase(id))?CURRENT_ROUND+1:CURRENT_ROUND;if(number!==active)throw Error('Giornata chiusa');validateDemoLineup(input,teamData(id).roster);const lineup={formation:input.formation,starters:[...input.starters],bench:[...input.bench],savedAt:new Date().toISOString()};room(id).lineups.set(number,lineup);return lineup;}),
  saveLogo:(id,input)=>write(()=>{
   const r=room(id);let name=r.teamName;
   if(input.team&&input.team!==MY_TEAM)throw Error('Puoi modificare solo la tua squadra');
   if(Object.hasOwn(input,'name')){
    if(typeof input.name!=='string')throw Error('Inserisci un nome valido per la squadra');
    name=input.name.trim().replace(/\s+/g,' ');
    if(name!==r.teamName&&nameDeadline(id))throw Error('La prima partita è iniziata. Il nome della squadra è bloccato.');
    if(name.length<2||name.length>50)throw Error('Il nome deve avere da 2 a 50 caratteri validi');
   }
   if(input.type==='image'&&(!/^data:image\/(png|jpeg|webp);base64,/.test(input.image||'')||input.image.length>350000))throw Error('Immagine non valida o troppo grande');
   const branding=input.type==='image'?{type:'image',imageUrl:input.image}:input.type==='design'?{type:'design',design:normalizeLogo(input.design,name)}:r.branding[MY_TEAM]||{};
   r.teamName=name;r.branding[MY_TEAM]=branding;return {team:MY_TEAM,name,branding};
  }),
  configureLeague:(id,size)=>write(()=>{admin(id);if(room(id).competitions.some(c=>c.status!=='draft'))throw Error('La taglia è bloccata dopo l’avvio');return {size};}),
  createCompetition:(id,p)=>write(()=>{admin(id);if(!p.name?.trim()||!['league','groups','knockout'].includes(p.kind))throw Error('Dati competizione non validi');const c={id:'demo-'+crypto.randomUUID(),name:p.name.trim(),kind:p.kind,status:'draft',start_round:Number(p.startRound)||CURRENT_ROUND};room(id).competitions.push(c);return c;}),
  startCompetition:(id,p)=>write(()=>{admin(id);const c=competition(id);if(c.status!=='draft')throw Error('Competizione già avviata');Object.assign(c,{status:'active',start_round:Number(p.startRound)});return {demo:true};}),
  linkTeam:(id,team,username)=>write(()=>{admin(id);if(!TEAMS[team])throw Error('Squadra non valida');room(id).links[team]=username;return {demo:true};}),
  setSlips:(id,enabled)=>write(()=>{admin(id);room(id).slipsEnabled=!!enabled;onSlips(id,!!enabled);return {enabled:!!enabled};}),
  rosterPlayers:id=>read(()=>engine.auctionPlayersFor(id)),rosterAudit:id=>read(()=>room(id).audit),rosterChange:(id,kind,data)=>write(()=>change(id,kind,data)),
  rosterEditor:id=>read(()=>rosterEditor(id)),
  checkRosterBatch:(id,{changes})=>read(()=>{
   const view=rosterEditor(id),free=new Set(engine.auctionPlayersFor(id).map(p=>p.id));
   if(view.locked)throw Error(view.lockMessage);
   for(const {teamId,playerId,kind,previousPrice} of changes){
    const row=view.teams.find(t=>t.team.id===teamId);
    if(!row||(kind==='add'?!free.has(playerId):row.roster.find(p=>p.id===playerId)?.price!==previousPrice))throw Error('La rosa o la disponibilità è cambiata. Rivedi la bozza.');
   }
   return {ok:true};
  }),
  saveRosterBatch:(id,{changes,requestId})=>write(()=>{
   const before=rosterEditor(id),r=room(id);
   if(r.orders.some(order=>order.requestId===requestId))return before;
   engine.correctBatch(id,changes);
   const after=rosterEditor(id);
   const find=(view,change)=>view.teams.find(t=>t.team.id===change.teamId)?.roster.find(p=>p.id===change.playerId)||null;
   r.orders.unshift({id:String(r.nextOrder++),createdAt:new Date().toISOString(),requestId,changes:changes.map(change=>({
    kind:change.kind,teamId:change.teamId,before:find(before,change),after:find(after,change),
   }))});
   return after;
  }),
  rosterOrders:(id,before)=>read(()=>{
   admin(id);
   const available=room(id).orders.filter(order=>!order.reversed&&(!before||Number(order.id)<Number(before)));
   const orders=available.slice(0,20);
   return {orders,next:available.length>20?orders.at(-1).id:null};
  }),
  undoRosterOrder:(id,orderId)=>write(()=>{
   admin(id);
   const ledger=room(id).orders,order=ledger.find(entry=>entry.id===orderId);
   if(!order)throw Error('Ordine di correzione non trovato');
   if(order.reversed)return rosterEditor(id);
   const players=new Set(order.changes.map(change=>(change.before||change.after).id));
   if(ledger.some(entry=>!entry.reversed&&Number(entry.id)>Number(orderId)&&entry.changes.some(change=>players.has((change.before||change.after).id))))throw Error('Annulla prima le correzioni successive coinvolte.');
   engine.correctBatch(id,order.changes.map(({teamId,kind,before,after})=>({teamId,playerId:(before||after).id,
    kind:kind==='add'?'remove':kind==='remove'?'add':'price',price:before?.price,previousPrice:after?.price,
   })));
   order.reversed=true;
   return rosterEditor(id);
  }),
  auction:id=>write(()=>engine.auctionFor(id)),auctionPlayers:id=>read(()=>engine.auctionPlayersFor(id)),
  auctionAssigned:(id,q)=>read(()=>engine.auctionAssigned(id,q)),auctionRelease:(id,p,r)=>write(()=>engine.release(id,p,r)),auctionReleaseBatch:(id,payload)=>write(()=>engine.releaseBatch(id,payload)),auctionReleaseUndo:(id,p)=>write(()=>engine.releaseUndo(id,p)),auctionReleasesDone:id=>write(()=>engine.releasesDone(id)),
  bid:(id,lotId,amount)=>write(()=>engine.bidFake(id,{lotId,amount})),pass:(id,lotId)=>write(()=>engine.passFake(id,{lotId})),nominate:(id,playerId,amount)=>write(()=>engine.nominateFake(id,{playerId,amount})),
  league:id=>read(()=>league(id)),auctionSchedule:(id,data)=>write(()=>engine.scheduleFake(id,data)),auctionStart:id=>write(()=>engine.startFake(id)),auctionLobbyStart:id=>write(()=>engine.lobbyStartFake(id)),
  auctionStartNow:(id,mode='manual',computerTeams,settings={})=>write(()=>{admin(id);if(engine.auctionFor(id).status==='running')return engine.auctionFor(id);engine.scheduleFake(id,{type:'riparazione',...settings,mode,computerTeams,startsAt:new Date(Date.now()+60000).toISOString()});return engine.startFake(id);}),
  auctionDraw:id=>write(()=>engine.drawFake(id)),
  auctionClose:id=>write(()=>engine.closeFake(id)),auctionCancelLot:(id,lotId,playerId)=>write(()=>engine.cancelLotFake(id,{lotId,playerId})),auctionMode:(id,mode)=>write(()=>engine.setModeFake(id,{mode})),auctionTable:(id,playerId)=>write(()=>engine.setTableFake(id,{playerId})),assign:(id,playerId,teamId,price)=>write(()=>engine.assignFake(id,{playerId,teamId,price})),undoSale:(id,saleId)=>write(()=>engine.undoFake(id,{saleId})),
  // Real onboarding/account operations stay outside the anonymous demo.
  randomStatus:()=>read(()=>({available:false})),pilotTeams:()=>read(()=>({teams:[]})),
 };
 for(const name of ['createRandom','claimRandom','pilotClaim'])api[name]=()=>Promise.reject(Error('Crea un account per partecipare alla lega pilota.'));
 return api;
}
export const createFakeFantaApi=createDemoFantaApi;
