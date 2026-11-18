import { esc } from './formato.mjs';

import {AUCTION_TYPES,AUCTION_DESCRIPTIONS} from '../auction-formats.mjs';
const teamOf=row=>row.team||row;
export function auctionWhen(value){
  return new Date(value).toLocaleString('it-IT',{timeZone:'Europe/Rome',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
}
export function auctionWizard(league, now=Date.now()){
  const auction=league.auction, scheduled=auction.status==='scheduled', previous=scheduled?auction.config:null;
  const when=new Date(scheduled?auction.startsAt:now+3600000);
  const startsAt=new Date(when.getTime()-when.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const teams=auction.teams.map(teamOf),ids=teams.map(t=>t.id),complete=teams.length>0&&teams.length===(league.league.maxMembers??teams.length)&&auction.teams.every(t=>t.slotsLeft===0);
  const allowedTypes=[complete?'riparazione':'iniziale','lampo'];
  return {step:1,type:scheduled&&allowedTypes.includes(auction.type)?auction.type:allowedTypes[0],mode:scheduled?auction.mode:'live',timing:scheduled?'scheduled':'now',startsAt,
    computerTeams:scheduled?(auction.computerTeams??auction.singlePlayerAvailable):auction.singlePlayerAvailable,
    budget:previous?.budget??500,minBudget:Object.values(league.rules.roster).reduce((sum,count)=>sum+count,0),nomination:previous?.nomination??'personal',playerOrder:previous?.playerOrder??'roles',turns:previous?.teamOrder?'custom':'random',
    teamOrder:[...new Set([...(previous?.teamOrder||[]).filter(id=>ids.includes(id)),...ids])],teams,hasComputers:auction.computerTeamsAvailable,allowedTypes};
}

function options(name, value, choices){
  return `<div class="auction-choices">${choices.map(([key,title,detail])=>`<label><input type="radio" name="${name}" value="${key}" ${value===key?'checked':''}><span><b>${title}</b>${detail?`<small>${detail}</small>`:''}</span></label>`).join('')}</div>`;
}
export function renderAuctionWizard(w){
  const first=`<fieldset><legend>Tipo di asta</legend>${options('type',w.type,w.allowedTypes.map(key=>[key,AUCTION_TYPES[key],AUCTION_DESCRIPTIONS[key]]))}</fieldset>
    ${w.type!=='lampo'?`<fieldset><legend>Modalità</legend>${options('mode',w.mode,[['live','Online','Offerte in app con timer'],['manual','Dal vivo','Offerte a voce, registra il banditore']])}</fieldset>`:''}
    <fieldset><legend>Quando</legend>${options('timing',w.timing,[['now','Apri subito'],['scheduled','Programma per dopo']])}</fieldset>
    ${w.timing==='scheduled'?`<label class="auction-field">Data e ora<input type="datetime-local" name="startsAt" value="${esc(w.startsAt)}" required></label>`:''}
    ${(w.type==='lampo'||w.mode==='live')&&w.hasComputers?`<label class="auction-bots"><input name="computerTeams" type="checkbox" ${w.computerTeams?'checked':''}> Squadre del computer <small>Chiamano e rilanciano per le squadre senza allenatore.</small></label>`:''}`;
  const second=`<label class="auction-field">Crediti per squadra<input type="number" name="budget" min="${w.minBudget}" max="100000" required inputmode="numeric" value="${esc(w.budget)}"></label>
    <p class="auction-help">È il budget totale. In un’asta di riparazione il costo delle rose e i rimborsi già registrati concorrono al saldo disponibile.</p>`;
  const third=w.type==='lampo'?'<p>Estrazione casuale per ruolo · P, D, C, A</p>':`${w.type==='riparazione'?`<fieldset><legend>Chi chiama il giocatore?</legend>${options('nomination',w.nomination,[['personal','A chiamata','Il partecipante di turno sceglie il giocatore'],['random','Estrazione casuale','Il sistema pesca dal listone disponibile']])}</fieldset>
    <fieldset><legend>Ordine dei ruoli</legend>${options('playerOrder',w.playerOrder,[['roles','Per ruolo','Portieri, difensori, centrocampisti, attaccanti'],['mixed','Misto','Qualsiasi ruolo disponibile']])}</fieldset>`:''}
    ${(w.type==='iniziale'||w.nomination==='personal')?`<fieldset><legend>Ordine delle squadre</legend>${options('turns',w.turns,[['random','Casuale'],['custom','Scelto dal presidente']])}</fieldset>`:''}
    ${(w.type==='iniziale'||w.nomination==='personal')&&w.turns==='custom'?`<ol class="auction-team-order">${w.teamOrder.map((id,i)=>`<li><span>${esc(w.teams.find(t=>t.id===id)?.name)}</span><button type="button" data-auction-order="${i}" data-step="-1" aria-label="Anticipa squadra" ${i===0?'disabled':''}>↑</button><button type="button" data-auction-order="${i}" data-step="1" aria-label="Posticipa squadra" ${i===w.teamOrder.length-1?'disabled':''}>↓</button></li>`).join('')}</ol>`:''}`;
  const title=['Tipo e orario','Crediti per squadra','Ordine di chiamata'][w.step-1];
  return `<section class="fanta-asta auction-wizard" aria-label="Configurazione asta"><header class="auction-page-head"><button type="button" class="secondary" data-auction-exit="1">Chiudi ×</button><div><span class="eyebrow">Passo ${w.step} di 3</span><h1>${title}</h1></div></header>
    <form data-auction-wizard class="auction-wizard-form"><div class="auction-wizard-fields">${[first,second,third][w.step-1]}</div>
    ${w.error?`<p role="alert" class="fanta-note is-alert">${esc(w.error)}</p>`:''}
    <div class="auction-wizard-actions">${w.step>1?`<button type="button" class="secondary" data-auction-prev="1" ${w.busy?'disabled':''}>Indietro</button>`:''}<button type="submit" class="primary" ${w.busy?'disabled aria-busy="true"':''}>${w.busy?'Salvataggio…':w.step<3?'Continua':w.timing==='now'?'Avvia l’asta':'Programma l’asta'}</button></div></form></section>`;
}
