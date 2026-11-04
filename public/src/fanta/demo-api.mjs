import {LEAGUES,homeFor} from './dati-finti.mjs';
import {roundFor,matchupFor,rosterOf,CURRENT_ROUND,seasonOf,nextMatchOf} from './dati-finti-giornata.mjs';
import {teamFor,validateDemoLineup,standardLineup} from './dati-finti-squadra.mjs';
import {createDemoAuctionEngine} from './dati-finti-asta.mjs';
import {leagueFor} from './dati-finti-lega.mjs';
import {TEAMS,MY_TEAM} from './squadre-finte.mjs';
import {normalizeLogo} from './team-logo.mjs';
const NOTIFY_DEFAULTS={lineupReminder:true,roundStart:true,liveEvents:true,results:true,auction:true};
// Same contracts as the real adapter. No fetch, storage, provider, email or push calls.
export function createDemoFantaApi({state=()=> 'da-schierare',delay=60,user={id:'demo-user',username:'ospite',name:'Il Quasi di prova'},access='demo',onSlips=()=>{},onScenario=()=>{},fullRosters=true}={}){
 const engine=createDemoAuctionEngine({fullRosters}),rooms=new Map();let selected=null,scenario=null,settings={notify:{...NOTIFY_DEFAULTS}};
 const room=id=>{if(!LEAGUES.some(l=>l.id===id))throw Error('Lega non disponibile');if(!rooms.has(id))rooms.set(id,{competitions:[{id:'demo-main',name:'Campionato del bar',kind:'league',status:'active',start_round:1}],lineups:new Map(),branding:{},audit:[],slipsEnabled:true,links:{}});return rooms.get(id);};
 const competition=id=>room(id).competitions.find(c=>c.id===selected)||room(id).competitions[0];
 const phase=id=>(scenario||state())==='da-schierare'&&room(id).lineups.has(CURRENT_ROUND)?'schierata':scenario||state();
 const saved=id=>new Map(room(id).lineups.has(CURRENT_ROUND)?[[MY_TEAM,room(id).lineups.get(CURRENT_ROUND)]]:[]);
 const admin=id=>{room(id);if(id==='fanta-ufficio')throw Error('Solo il presidente può farlo');};
 const decorate=(value,id)=>{const walk=o=>{if(!o||typeof o!=='object')return;if(o.id&&TEAMS[o.id]){o.branding=structuredClone(room(id).branding[o.id]||{});if(o.id===MY_TEAM)o.manager=user.name;}for(const v of Object.values(o))if(typeof v==='object')walk(v);};walk(value);return value;};
 const read=fn=>{try{const value=structuredClone(fn());return new Promise(resolve=>setTimeout(()=>resolve(value),delay));}catch(e){return Promise.reject(e);}};
 const write=fn=>{try{return Promise.resolve(structuredClone(fn()));}catch(e){return Promise.reject(e);}};
 const league=id=>{const l=leagueFor(id,phase(id),Date.now(),engine.auctionFor),r=room(id);return decorate({...l,league:{...l.league,maxMembers:8,slipsEnabled:r.slipsEnabled},members:l.members.map(m=>({...m,username:r.links[m.team.id]|| (m.isMe?user.username:null)})),competitions:r.competitions,competition:competition(id),sizeLocked:r.competitions.some(c=>c.status!=='draft'),readyToStart:true},id);};
 const teamData=(id,teamId=MY_TEAM)=>{
  if(!TEAMS[teamId])throw Error('Squadra non disponibile');const r=room(id),data=teamFor(id,phase(id),Date.now(),teamId,teamId===MY_TEAM?r.lineups.get(CURRENT_ROUND):{...standardLineup(teamId),savedAt:new Date(Date.now()-3600000).toISOString()});
  if(fullRosters){data.roster=engine.auctionAssigned(id).filter(p=>p.team.id===teamId).map((p,i)=>{const s=seasonOf(p);return {...p,stats:{minutes:Math.min(990,s.played*(45+i%4*15)),teamMatches:11,played:s.played,avgVote:s.avgVote,avgFanta:s.avgFanta,goals:s.goals,assists:s.assists},next:nextMatchOf(p.club),status:s.status,play:i%3?{pct:[90,75,55,20][i%4],source:'probabili'}:null};});data.budget.spent=data.roster.reduce((n,p)=>n+p.price,0);}
  const ids=new Set(data.roster.map(p=>p.id));for(const key of ['previous','lineup'])if(data[key])data[key]={...data[key],starters:data[key].starters.filter(id=>ids.has(id)),bench:data[key].bench.filter(id=>ids.has(id))};
  const a=engine.auctionFor(id);data.canManageRoster=id!=='fanta-ufficio';data.rosterLocked=['running','scheduled'].includes(a.status);if(['in-corso','calcolata'].includes(phase(id))){const next=r.lineups.get(CURRENT_ROUND+1);data.round={number:CURRENT_ROUND+1,state:next?'schierata':'da-schierare',deadline:new Date(Date.now()+9*864e5).toISOString(),locked:teamId!==MY_TEAM};data.canEdit=teamId===MY_TEAM;data.lineup=teamId===MY_TEAM?next||null:data.lineup;data.previous={round:CURRENT_ROUND,...(r.lineups.get(CURRENT_ROUND)||standardLineup(teamId))};}
  data.calendar=league(id).calendar.rounds.flatMap(r=>r.matchups.filter(m=>m.home.team.id===teamId||m.away.team.id===teamId).map(m=>({...m,round:r.number,official:r.state==='calcolata'})));return decorate(data,id);
 };
 const change=(id,kind,input)=>{admin(id);const a=engine.auctionFor(id);if(['running','scheduled'].includes(a.status))throw Error('C’è un’asta aperta: usa gli strumenti dell’asta');const {teamId,playerId,price,toTeamId}=input;if(!TEAMS[teamId])throw Error('Squadra non valida');const result=engine.correctRoster(id,kind,input);room(id).audit.unshift({kind,created_at:new Date().toISOString(),username:user.username,data:{input}});return result;};
 const api={
  invalidateReads(){},setCompetition:id=>{selected=id||null;},
  setScenario:value=>write(()=>{if(!['da-schierare','in-corso','calcolata'].includes(value))throw Error('Scenario non valido');scenario=value;onScenario(value);return {scenario};}),
  me:()=>read(()=>({user:{...user,demo:true},access,settings})),saveSettings:next=>write(()=>settings=structuredClone(next)),
  leagues:()=>read(()=>LEAGUES.map(l=>({...l,slipsEnabled:room(l.id).slipsEnabled}))),
  bootstrap:id=>read(()=>({me:{user:{...user,demo:true},access,settings},leagues:LEAGUES,home:homeFor(id||LEAGUES[0].id,phase(id||LEAGUES[0].id),Date.now(),engine.auctionFor)})),
  home:id=>read(()=>{const r=room(id),h=homeFor(id,phase(id),Date.now(),engine.auctionFor,r.lineups.get(CURRENT_ROUND));if(['in-corso','calcolata'].includes(phase(id))){const next=r.lineups.get(CURRENT_ROUND+1);h.nextLineup={round:CURRENT_ROUND+1,deadline:new Date(Date.now()+9*864e5).toISOString(),formation:next?.formation||null,savedAt:next?.savedAt||null};}h.finalVerification=phase(id)==='in-corso'?{status:'queued',at:new Date(Date.now()+3600000).toISOString()}:null;h.lastResult.matchupId=matchupFor(h.lastResult.round,null,'calcolata',saved(id)).id;return decorate({...h,competition:competition(id),competitions:r.competitions},id);}),
  round:(id,number)=>read(()=>decorate(roundFor(number,phase(id),saved(id)),id)),
  matchup:(id,number,matchId)=>read(()=>decorate(matchupFor(number,matchId,phase(id),saved(id)),id)),
  team:(id,teamId)=>read(()=>teamData(id,teamId)),
  saveLineup:(id,number,input)=>write(()=>{room(id);const active=['in-corso','calcolata'].includes(phase(id))?CURRENT_ROUND+1:CURRENT_ROUND;if(number!==active)throw Error('Giornata chiusa');validateDemoLineup(input,teamData(id).roster);const lineup={formation:input.formation,starters:[...input.starters],bench:[...input.bench],savedAt:new Date().toISOString()};room(id).lineups.set(number,lineup);return lineup;}),
  saveLogo:(id,input)=>write(()=>{room(id);if(input.type==='image'&&(!/^data:image\/(png|jpeg|webp);base64,/.test(input.image||'')||input.image.length>350000))throw Error('Immagine non valida o troppo grande');const branding=input.type==='image'?{type:'image',imageUrl:input.image}:{type:'design',design:normalizeLogo(input.design)};room(id).branding[MY_TEAM]=branding;return {team:MY_TEAM,branding};}),
  configureLeague:(id,size)=>write(()=>{admin(id);if(room(id).competitions.some(c=>c.status!=='draft'))throw Error('La taglia è bloccata dopo l’avvio');return {size};}),
  createCompetition:(id,p)=>write(()=>{admin(id);if(!p.name?.trim()||!['league','groups','knockout'].includes(p.kind))throw Error('Dati competizione non validi');const c={id:'demo-'+crypto.randomUUID(),name:p.name.trim(),kind:p.kind,status:'draft',start_round:Number(p.startRound)||CURRENT_ROUND};room(id).competitions.push(c);return c;}),
  startCompetition:(id,p)=>write(()=>{admin(id);const c=competition(id);if(c.status!=='draft')throw Error('Competizione già avviata');Object.assign(c,{status:'active',start_round:Number(p.startRound)});return {demo:true};}),
  linkTeam:(id,team,username)=>write(()=>{admin(id);if(!TEAMS[team])throw Error('Squadra non valida');room(id).links[team]=username;return {demo:true};}),
  setSlips:(id,enabled)=>write(()=>{admin(id);room(id).slipsEnabled=!!enabled;onSlips(id,!!enabled);return {enabled:!!enabled};}),
  rosterPlayers:id=>read(()=>engine.auctionPlayersFor(id)),rosterAudit:id=>read(()=>room(id).audit),rosterChange:(id,kind,data)=>write(()=>change(id,kind,data)),
  auction:id=>write(()=>engine.auctionFor(id)),auctionPlayers:id=>read(()=>engine.auctionPlayersFor(id)),
  auctionAssigned:(id,q)=>read(()=>engine.auctionAssigned(id,q)),auctionRelease:(id,p,r)=>write(()=>engine.release(id,p,r)),auctionReleaseUndo:(id,p)=>write(()=>engine.releaseUndo(id,p)),auctionReleasesDone:id=>write(()=>engine.releasesDone(id)),
  bid:(id,lotId,amount)=>write(()=>engine.bidFake(id,{lotId,amount})),pass:(id,lotId)=>write(()=>engine.passFake(id,{lotId})),nominate:(id,playerId,amount)=>write(()=>engine.nominateFake(id,{playerId,amount})),
  league:id=>read(()=>league(id)),auctionSchedule:(id,data)=>write(()=>engine.scheduleFake(id,data)),auctionStart:id=>write(()=>engine.startFake(id)),
  auctionStartNow:(id,mode='manual')=>write(()=>{admin(id);if(engine.auctionFor(id).status==='running')return engine.auctionFor(id);engine.scheduleFake(id,{type:'riparazione',mode,startsAt:new Date(Date.now()+60000).toISOString()});return engine.startFake(id);}),
  auctionClose:id=>write(()=>engine.closeFake(id)),auctionCancelLot:(id,lotId,playerId)=>write(()=>engine.cancelLotFake(id,{lotId,playerId})),auctionMode:(id,mode)=>write(()=>engine.setModeFake(id,{mode})),auctionTable:(id,playerId)=>write(()=>engine.setTableFake(id,{playerId})),assign:(id,playerId,teamId,price)=>write(()=>engine.assignFake(id,{playerId,teamId,price})),undoSale:(id,saleId)=>write(()=>engine.undoFake(id,{saleId})),
  // Real onboarding/account operations stay outside the anonymous demo.
  randomStatus:()=>read(()=>({available:false})),pilotTeams:()=>read(()=>({teams:[]})),
 };
 for(const name of ['createRandom','claimRandom','pilotClaim'])api[name]=()=>Promise.reject(Error('Crea un account per partecipare alla lega pilota.'));
 return api;
}
export const createFakeFantaApi=createDemoFantaApi;
