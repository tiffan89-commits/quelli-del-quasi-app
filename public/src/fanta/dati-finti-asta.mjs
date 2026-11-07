// Asta finta per l'anteprima: un piccolo "server" in memoria. Le altre squadre (finte) chiamano, rilanciano
// e passano da sole; nell'app vera sono persone. Nell'app vera tutto questo lo fa il server, con ogni
// offerta salvata in una transazione; il browser legge lo stato ogni secondo.
//
// Regole di base (decise da Francesco):
// - ordine di chiamata casuale, deciso dall'app all'inizio; a turno OGNI squadra deve chiamare lei un giocatore
//   (il sistema non sceglie mai al posto suo); ha 60 secondi, altrimenti salta il turno;
// - il giocatore chiamato parte con 60 secondi; ogni rilancio riporta il timer a 30;
// - gli ultimi 3 secondi hanno durata reale, identica per tutti;
// - si può passare: chi passa non può più rientrare su quel giocatore; passo automatico se il ruolo è già
//   completo o se i crediti non bastano; se passano tutti tranne chi è in testa, il giocatore è suo subito.
import { TEAMS, MY_TEAM, team } from './squadre-finte.mjs';
import { rosterOf, seasonOf } from './dati-finti-giornata.mjs';
import {demoMarketPlayers} from './demo-football.mjs';

export const AUCTION_RULES = {
  budget: 500, roster: { P: 3, D: 8, C: 8, A: 6 }, minRaise: 1,
  callSeconds: 60,      // tempo per chiamare
  openSeconds: 60,      // timer del giocatore appena chiamato
  raiseSeconds: 30,     // timer dopo ogni rilancio
  finalSeconds: 3,      // ultimi secondi mostrati…
  finalStretch: 3,      // …con durata reale identica
};
// Durata vera di un timer che mostra `s` secondi (senza rallentamenti).
export const realMs = (s, r = AUCTION_RULES) => (s - r.finalSeconds + r.finalStretch) * 1000;

const PREBOUGHT = { P: 1, D: 3, C: 3, A: 2 }; // l'asta è già a metà: ogni squadra ha 9 giocatori
const SLOTS = Object.values(AUCTION_RULES.roster).reduce((a, b) => a + b, 0);

export const AUCTION_TYPES = { iniziale: 'Asta iniziale', riparazione: 'Asta di riparazione', lampo: 'Asta lampo' };
export function createDemoAuctionEngine({fullRosters=false}={}){
let A=null;const rooms=new Map();
function select(id,now=Date.now()){A=rooms.get(id)||null;if(!A){init(now);rooms.set(id,A);}}
const rand = () => Math.random();
const pick = list => list[Math.floor(rand() * list.length)];
function hashNum(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// Listone: tutti i giocatori della lega di prova, con il nostro valore e la fantamedia della stagione.
function buildListone() {
  return Object.keys(TEAMS).flatMap(id => rosterOf(id)).map(p => {
    const top = { P: 26, D: 32, C: 48, A: 95 }[p.role], u = (hashNum('valore:' + p.id) % 1000) / 1000;
    const s = seasonOf(p);
    return { ...p, value: 1 + Math.round(top * u * u), fm: s.avgFanta, played: s.played, status: s.status };
  });
}

const owned = t => A.players.filter(p => p.soldTo === t);
const roleCount = (t, role) => owned(t).filter(p => p.role === role).length;
const credits = t => AUCTION_RULES.budget + (A.adjustments?.[t]||0) - owned(t).reduce((s, p) => s + p.price, 0);
const slotsLeft = t => SLOTS - owned(t).length;
// Puntata massima: deve restare almeno 1 credito per ogni posto ancora da riempire.
const maxBid = t => slotsLeft(t) > 0 ? credits(t) - (slotsLeft(t) - 1) : 0;
const roleOpen = (t, role) => roleCount(t, role) < AUCTION_RULES.roster[role];

function init(now) {
  const order = Object.keys(TEAMS);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } // ordine casuale
  // phase: scheduled (programmata) → running (sala aperta) → ended. Nell'anteprima parte già aperta.
  A = { phase: 'running', type: 'riparazione', startsAt: new Date(now - 40 * 60000).toISOString(), mode: 'live', table: null, order, players:buildListone().concat(fullRosters?demoMarketPlayers().map((p,i)=>({...p,value:5+i,fm:seasonOf(p).avgFanta,played:seasonOf(p).played})):[]), callerIdx: 0, lot: null, pauseUntil: now + 2500, lastSale: null, log: [], version: 1, lastTick: now, callSince: null, skipped: null };
  for (const t of order) {
    for (const [role, n] of Object.entries(fullRosters?AUCTION_RULES.roster:PREBOUGHT)) {
      const mine = A.players.filter(p => p.role === role && p.id.startsWith(t + '-') && !p.soldTo).slice(0, n);
      for (const p of mine) { p.soldTo = t; p.price = Math.max(1, Math.round(p.value * (0.8 + hashNum('prezzo:' + p.id) % 60 / 100))); }
    }
  }
  if(fullRosters){for(const t of order){const mine=owned(t),sum=mine.reduce((n,p)=>n+p.price,0);for(const p of mine)p.price=Math.max(1,Math.floor(p.price*460/sum));}A.mode='manual';A.releasePhase=true;A.releaseBatchId='demo-releases';A.releases=[];}
}

const changed = () => { A.version++; };
const nextCaller = () => { A.callerIdx = (A.callerIdx + 1) % A.order.length; A.callSince = null; };

// Perché una squadra non può partecipare a questo giocatore (passo automatico), oppure null.
function autoPassReason(t, lot) {
  const p = A.players.find(x => x.id === lot.playerId);
  if (!roleOpen(t, p.role)) return 'role';
  if (maxBid(t) < lot.bid + AUCTION_RULES.minRaise) return 'credits';
  return null;
}

function sell(now) {
  const { lot } = A, p = A.players.find(x => x.id === lot.playerId);
  p.soldTo = lot.leader; p.price = lot.bid;
  A.lastSale = { id: 'sale-' + A.version, playerId: p.id, team: lot.leader, price: lot.bid, at: now };
  A.log.unshift(A.lastSale);
  A.lot = null; A.pauseUntil = now + 3500;
  nextCaller();
  changed();
}

// Se tutti tranne chi è in testa hanno passato (a mano o in automatico), si chiude subito.
function checkAllPassed(now) {
  const { lot } = A;
  const others = A.order.filter(t => t !== lot.leader && slotsLeft(t) > 0);
  if (others.every(t => lot.passed[t] || autoPassReason(t, lot)) && lot.endsAt > now + 1500) {
    lot.endsAt = now + 1500; lot.closing = true; changed();
  }
}

function openLot(caller, playerId, amount, now) {
  const p = A.players.find(x => x.id === playerId);
  // Quanto vuole spendere ogni squadra finta per questo giocatore (metà circa non è interessata).
  const wills = Object.fromEntries(A.order.filter(t => t !== MY_TEAM).map(t => [t, rand() < 0.5 ? 0 : Math.round(p.value * (0.7 + rand() * 0.7))]));
  A.lot = { id: 'lot-' + A.version, playerId, bid: amount, leader: caller, endsAt: now + realMs(AUCTION_RULES.openSeconds), history: [{ team: caller, amount, at: now, call: true }], wills, passed: {} };
  A.callSince = null; A.skipped = null;
  changed();
  checkAllPassed(now);
}

function bid(t, amount, now) {
  const { lot } = A;
  lot.bid = amount; lot.leader = t; lot.endsAt = now + realMs(AUCTION_RULES.raiseSeconds); lot.closing = false;
  lot.history.unshift({ team: t, amount, at: now });
  changed();
  checkAllPassed(now);
}

function pass(t, now) {
  A.lot.passed[t] = true;
  A.lot.history.unshift({ team: t, pass: true, at: now });
  changed();
  checkAllPassed(now);
}

function bots(now) {
  const { lot } = A, live = A.order.filter(t => t !== MY_TEAM && t !== lot.leader && !lot.passed[t] && !autoPassReason(t, lot));
  // Chi non è interessato passa, prima o poi.
  for (const t of live) if (lot.wills[t] <= lot.bid && rand() < 0.35) pass(t, now);
  const eager = live.filter(t => !lot.passed[t] && lot.wills[t] > lot.bid);
  if (!eager.length || rand() > 0.3) return;
  const t = pick(eager), amount = Math.min(lot.bid + pick([1, 1, 1, 2, 2, 5]), lot.wills[t], maxBid(t));
  if (amount > lot.bid) bid(t, amount, now);
}

// Le squadre finte chiamano dopo qualche secondo (come persone che cercano nel listone).
function botCall(t, now) {
  if (!A.callSince) { A.callSince = now; A.botDelay = 3000 + rand() * 9000; changed(); return; }
  if (now - A.callSince < A.botDelay) return;
  const needs = Object.keys(AUCTION_RULES.roster).filter(r => roleOpen(t, r));
  const role = pick(needs), free = A.players.filter(p => !p.soldTo && p.role === role).sort((a, b) => b.value - a.value).slice(0, 12);
  if (!free.length) { nextCaller(); changed(); return; }
  const p = pick(free);
  openLot(t, p.id, Math.min(maxBid(t), Math.max(1, Math.round(p.value * 0.25))), now);
}

// Avanza il tempo a passi di mezzo secondo fino ad "adesso".
function tick(now) {
  if (!A) init(now);
  // All'orario programmato la sala si apre da sola.
  if (A.phase === 'scheduled' && now >= Date.parse(A.startsAt)) Object.assign(A, { phase: 'running', pauseUntil: now + 2500, lastTick: now, callerIdx: 0, callSince: null, version: A.version + 1 });
  if (A.mode === 'manual' || A.releasePhase || A.phase !== 'running') { A.lastTick = now; return; } // dal vivo o sala chiusa: niente timer
  let t = Math.max(A.lastTick, now - 120000);
  while (t < now) {
    t = Math.min(now, t + 500);
    if (A.lot) {
      if (t >= A.lot.endsAt) sell(A.lot.endsAt);
      else if ((A.step = (A.step || 0) + 1) % 2 === 0) bots(t); // le squadre finte "pensano" una volta al secondo
      continue;
    }
    if (t < A.pauseUntil) continue;
    for (let i = 0; i < A.order.length && slotsLeft(A.order[A.callerIdx]) === 0; i++) nextCaller(); // rosa completa: si salta
    const caller = A.order[A.callerIdx];
    if (slotsLeft(caller) === 0) break; // asta finita
    if (caller !== MY_TEAM) { botCall(caller, t); continue; }
    if (!A.callSince) { A.callSince = t; changed(); }
    if (t - A.callSince > realMs(AUCTION_RULES.callSeconds)) { // tempo scaduto: salta il turno
      A.skipped = { team: caller, at: t }; A.pauseUntil = t + 2500; nextCaller(); changed();
    }
  }
  A.lastTick = now;
}

const playerView = p => p && { id: p.id, name: p.name, role: p.role, club: p.club, jersey: p.jersey, value: p.value, fm: p.fm, played: p.played, status: p.status };

function auctionFor(leagueId, now = Date.now()) {
 select(leagueId);
  tick(now);
  const caller = A.order[A.callerIdx], finished = A.order.every(t => slotsLeft(t) === 0), L = A.lot;
  const lot = L && {
    id: L.id, player: playerView(A.players.find(p => p.id === L.playerId)), bid: L.bid, leader: L.leader,
    endsAt: new Date(L.endsAt).toISOString(), timerSeconds: L.history.length > 1 && L.history.some(h => !h.call && !h.pass) ? AUCTION_RULES.raiseSeconds : AUCTION_RULES.openSeconds,
    closing: !!L.closing,
    passed: Object.keys(L.passed),
    autoPassed: Object.fromEntries(A.order.map(t => [t, t === L.leader ? null : autoPassReason(t, L)]).filter(([, r]) => r)),
    history: L.history.slice(0, 10).map(h => ({ ...h, at: new Date(h.at).toISOString() })),
  };
  return {
    version: A.version,
    serverTime: new Date(now).toISOString(),
    status: finished&&!A.releasePhase || A.phase === 'ended' ? 'ended' : A.phase,
 phase:A.releasePhase?'releases':'bidding',releaseBatchId:A.releaseBatchId,releases:A.releases||[],
    type: A.type,
    startsAt: A.startsAt,
    mode: A.mode,
    computerTeamsActive: A.mode==='live',
    isAdmin: isAdmin(leagueId),
    auctioneer: team(MY_TEAM).manager, // nell'anteprima il banditore è l'admin della lega
    table: A.mode === 'manual' && A.table ? (()=>{const p=A.players.find(p=>p.id===A.table);return {...playerView(p),...(A.releasePhase&&p.soldTo?{ownerTeam:team(p.soldTo),price:p.price}: {})};})() : null,
    rules: AUCTION_RULES,
    me: MY_TEAM,
    order: A.order,
    caller,
    callDeadline: !L && A.callSince && now >= A.pauseUntil ? new Date(A.callSince + realMs(AUCTION_RULES.callSeconds)).toISOString() : null,
    pausedUntil: !L && now < A.pauseUntil ? new Date(A.pauseUntil).toISOString() : null,
    skipped: A.skipped && now < A.pauseUntil ? { team: A.skipped.team } : null,
    teams: A.order.map(t => ({
      team: team(t), credits: credits(t), maxBid: maxBid(t), slotsLeft: slotsLeft(t), online: t === MY_TEAM || hashNum('online:' + t) % 5 !== 0,computer:A.mode==='live'&&t!==MY_TEAM,
      roles: Object.fromEntries(Object.entries(AUCTION_RULES.roster).map(([r, max]) => [r, { have: roleCount(t, r), max }])),
    })),
    lot,
    lastSale: A.lastSale && { player: playerView(A.players.find(p => p.id === A.lastSale.playerId)), team: A.lastSale.team, price: A.lastSale.price, at: new Date(A.lastSale.at).toISOString() },
    log: A.log.slice(0, A.mode === 'manual' ? 30 : 10).map(s => ({ id: s.id, manual: !!s.manual, player: playerView(A.players.find(p => p.id === s.playerId)), team: s.team, price: s.price })),
    myRoster: owned(MY_TEAM).map(p => ({ ...playerView(p), price: p.price })),
  };
}

function auctionPlayersFor(leagueId) {
 select(leagueId);
  if (!A) tick(Date.now());
  return A.players.filter(p => !p.soldTo).map(playerView).sort((a, b) => b.value - a.value);
}

function myLot(lotId, now) {
  tick(now);
  const lot = A.lot;
  if (!lot || lot.id !== lotId) throw Error('Il giocatore è già stato aggiudicato');
  if (lot.passed[MY_TEAM]) throw Error('Hai passato su questo giocatore');
  return lot;
}

function bidFake(leagueId, { lotId, amount }, now = Date.now()) {
 select(leagueId);
  const lot = myLot(lotId, now);
  if (lot.leader === MY_TEAM) throw Error('Sei già in testa');
  const auto = autoPassReason(MY_TEAM, lot);
  if (auto === 'role') throw Error('Hai già tutti i giocatori di questo ruolo');
  if (amount < lot.bid + AUCTION_RULES.minRaise) throw Error(`Serve almeno ${lot.bid + AUCTION_RULES.minRaise}`);
  if (amount > maxBid(MY_TEAM)) throw Error(`Puoi offrire al massimo ${maxBid(MY_TEAM)}`);
  bid(MY_TEAM, amount, now);
  return auctionFor(leagueId, now);
}

function passFake(leagueId, { lotId }, now = Date.now()) {
 select(leagueId);
  const lot = myLot(lotId, now);
  if (lot.leader === MY_TEAM) throw Error('Sei in testa: non puoi passare');
  pass(MY_TEAM, now);
  return auctionFor(leagueId, now);
}

// ---------- Asta dal vivo (manuale): si fa a voce, il banditore (admin) registra ----------
// Nell'anteprima l'utente è admin della "Lega dei Quasi" e semplice partecipante nel "Fanta Ufficio".
const isAdmin = leagueId => leagueId !== 'fanta-ufficio';
function needAdmin(leagueId) { if (!isAdmin(leagueId)) throw Error('Solo l\'admin della lega può farlo'); }
function needOpen() { if (A.phase !== 'running') throw Error('La sala d\'asta non è aperta'); }

function setModeFake(leagueId, { mode }, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId); tick(now);
  if (!['live', 'manual'].includes(mode)) throw Error('Modalità non valida');
  if (mode !== A.mode) {
    A.mode = mode; A.lot = null; A.table = null; A.callSince = null; A.skipped = null; A.pauseUntil = now + 2500; A.lastTick = now;
    changed();
  }
  return auctionFor(leagueId, now);
}

function setTableFake(leagueId, { playerId }, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId); tick(now); needOpen();
  const p = playerId && A.players.find(x => x.id === playerId);
  if (playerId && (!p || (A.releasePhase?!p.soldTo:!!p.soldTo))) throw Error('Giocatore non disponibile');
  A.table = playerId || null;
  changed();
  return auctionFor(leagueId, now);
}

function assignFake(leagueId, { playerId, teamId, price }, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId); tick(now); needOpen();
  const p = A.players.find(x => x.id === playerId);
  if (!p || p.soldTo) throw Error('Giocatore non disponibile');
  if (!A.order.includes(teamId)) throw Error('Squadra non valida');
  if (!roleOpen(teamId, p.role)) throw Error(`${team(teamId).name} ha già tutti i giocatori di questo ruolo`);
  if (!(price >= 1)) throw Error('Il prezzo minimo è 1');
  if (price > maxBid(teamId)) throw Error(`${team(teamId).name} può spendere al massimo ${maxBid(teamId)}`);
  p.soldTo = teamId; p.price = price;
  A.lastSale = { id: 'sale-' + A.version, playerId, team: teamId, price, at: now, manual: true };
  A.log.unshift(A.lastSale);
  A.table = null;
  changed();
  return auctionFor(leagueId, now);
}

// Annulla un'assegnazione (errore del banditore): il giocatore torna nel listone.
function undoFake(leagueId, { saleId }, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId); tick(now);
  const sale = A.log.find(s => s.id === saleId);
  if (!sale) throw Error('Assegnazione non trovata');
  const p = A.players.find(x => x.id === sale.playerId);
  p.soldTo = null; p.price = null;
  A.log = A.log.filter(s => s !== sale);
  if (A.lastSale === sale) A.lastSale = A.log[0] || null;
  changed();
  return auctionFor(leagueId, now);
}

// ---------- Programmazione dell'asta (admin) ----------


function scheduleFake(leagueId, { type, mode, startsAt }, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId); tick(now);
  if (A.phase === 'running') throw Error('C\'è già un\'asta in corso: chiudila prima');
  if (!AUCTION_TYPES[type] || !['live', 'manual'].includes(mode)) throw Error('Dati dell\'asta non validi');
  if (!(Date.parse(startsAt) > now - 60000)) throw Error('Scegli una data futura');
  Object.assign(A, { phase: 'scheduled', type, mode, startsAt, lot: null, table: null, callSince: null, skipped: null,releasePhase:type==='riparazione',releaseBatchId:'release-'+A.version,releases:[] });
  changed();
  return auctionFor(leagueId, now);
}

function startFake(leagueId, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId); tick(now);
  if (A.phase === 'running') throw Error('L\'asta è già aperta');
  Object.assign(A, { phase: 'running', startsAt: new Date(now).toISOString(), pauseUntil: now + 2500, lastTick: now, callerIdx: 0, callSince: null });
  changed();
  return auctionFor(leagueId, now);
}

function closeFake(leagueId, now = Date.now()) {
 select(leagueId);
  needAdmin(leagueId);
  Object.assign(A, { phase: 'ended', lot:null,table: null, callSince: null,pauseUntil:0 });
  changed();
  return auctionFor(leagueId, now);
}

function cancelLotFake(leagueId,{lotId,playerId}={},now=Date.now()){
 select(leagueId);
 needAdmin(leagueId);needOpen();const currentPlayer=A.lot?.playerId||A.table;
 if(lotId&&A.lot?.id!==lotId||playerId&&currentPlayer!==playerId)throw Error('Il giocatore sul tavolo è cambiato');
 Object.assign(A,{lot:null,table:null,callSince:now,pauseUntil:0,skipped:null});changed();return auctionFor(leagueId,now);
}

function nominateFake(leagueId, { playerId, amount }, now = Date.now()) {
 select(leagueId);
  tick(now);
  const p = A.players.find(x => x.id === playerId);
  needOpen();
  if (A.lot || A.order[A.callerIdx] !== MY_TEAM || now < A.pauseUntil) throw Error('Non è il tuo turno di chiamata');
  if (!p || p.soldTo) throw Error('Giocatore non disponibile');
  if (!roleOpen(MY_TEAM, p.role)) throw Error('Hai già tutti i giocatori di questo ruolo');
  if (amount < 1 || amount > maxBid(MY_TEAM)) throw Error(`Offerta tra 1 e ${maxBid(MY_TEAM)}`);
  openLot(MY_TEAM, playerId, amount, now);
  return auctionFor(leagueId, now);
}

function auctionAssigned(leagueId,query=''){select(leagueId);return A.players.filter(p=>p.soldTo&&(!query||p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map(p=>({...playerView(p),team:team(p.soldTo),ownerTeam:team(p.soldTo),price:p.price}));}
function release(leagueId,playerId,refund){select(leagueId);needAdmin(leagueId);needOpen();if(!A.releasePhase)throw Error('Gli svincoli sono chiusi');const p=A.players.find(p=>p.id===playerId&&p.soldTo);if(!p)throw Error('Giocatore non assegnato');if(!Number.isInteger(refund)||refund<0||refund>p.price)throw Error('Rimborso non valido');A.releases.push({id:playerId,batch:A.releaseBatchId,player:playerView(p),team:p.soldTo,price:p.price,refund});A.adjustments??={};A.adjustments[p.soldTo]=(A.adjustments[p.soldTo]||0)+refund-p.price;p.soldTo=null;p.price=null;A.table=null;changed();return auctionFor(leagueId);}
function releaseUndo(leagueId,playerId){select(leagueId);needAdmin(leagueId);needOpen();if(!A.releasePhase)throw Error('Gli svincoli sono chiusi');const r=A.releases.find(r=>r.id===playerId);if(!r)throw Error('Svincolo non trovato');const p=A.players.find(p=>p.id===playerId);if(p.soldTo)throw Error('Giocatore già assegnato');p.soldTo=r.team;p.price=r.price;A.adjustments[r.team]-=r.refund-r.price;A.releases=A.releases.filter(x=>x!==r);changed();return auctionFor(leagueId);}
function releasesDone(leagueId){select(leagueId);needAdmin(leagueId);needOpen();A.releasePhase=false;A.table=null;changed();return auctionFor(leagueId);}

function correctRoster(leagueId,kind,{teamId,playerId,price,toTeamId}){
 select(leagueId);needAdmin(leagueId);if(['running','scheduled'].includes(A.phase))throw Error('Usa gli strumenti dell’asta aperta');
 const p=A.players.find(p=>p.id===playerId);if(!p||!A.order.includes(teamId))throw Error('Calciatore o squadra non disponibile');
 if(kind==='add'){if(p.soldTo)throw Error('Giocatore già assegnato');if(!roleOpen(teamId,p.role))throw Error('Ruolo completo');}
 else if(p.soldTo!==teamId)throw Error('Il giocatore non è in questa rosa');
 if(kind!=='remove'&&(!Number.isInteger(price)||price<0))throw Error('Prezzo non valido');
 if(kind==='move'&&(!A.order.includes(toTeamId)||toTeamId===teamId||!roleOpen(toTeamId,p.role)))throw Error('Destinazione non valida');
 const target=kind==='move'?toTeamId:teamId,available=credits(target)+(kind==='price'?p.price:0);if(kind!=='remove'&&price>available)throw Error('Crediti insufficienti');
 if(kind==='remove'){p.soldTo=null;p.price=null;}else if(['add','price','move'].includes(kind)){p.soldTo=target;p.price=price;}else throw Error('Operazione non valida');changed();return {ok:true};
}
return {correctRoster,auctionFor,auctionPlayersFor,bidFake,passFake,nominateFake,setModeFake,setTableFake,assignFake,undoFake,scheduleFake,startFake,closeFake,cancelLotFake,auctionAssigned,release,releaseUndo,releasesDone};
}
const defaultEngine=createDemoAuctionEngine();
export const {correctRoster,auctionFor,auctionPlayersFor,bidFake,passFake,nominateFake,setModeFake,setTableFake,assignFake,undoFake,scheduleFake,startFake,closeFake,cancelLotFake,auctionAssigned,release,releaseUndo,releasesDone}=defaultEngine;
