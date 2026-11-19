import {esc} from './fanta/formato.mjs';
import {hubTile} from './league-hub.mjs';
import {backButton} from './back-navigation.mjs';

const barOperations=[
 ['identita','Modifica identità della lega','shield','Stemma, colore e motto'],
 ['regole','Modifica regole del Bar','rules','Crediti e premi'],
 ['invita','Invita per nickname o email','invite','Invito in app'],
 ['whatsapp','Invita con WhatsApp','whatsapp','Condividi il link d’ingresso'],
 ['richieste','Gestisci richieste di ingresso','inbox','Approva o rifiuta'],
 ['rimuovi','Rimuovi un partecipante','person-remove','Gestisci le uscite'],
 ['riammetti','Riammetti un partecipante','person-add','Ripristina l’accesso'],
 ['attiva','Attiva il Fanta','lineup','Crea le squadre'],
 ['preparazione','Controlla la preparazione del Fanta','search','Stato delle rose'],
 ['elimina','Elimina lega e storico','trash','Cancellazione definitiva'],
];
const fantaOperations=[
 ['asta','Gestisci asta e svincoli','auction','Configura la sala','asta'],
 ['scambi','Gestisci gli scambi','trade','Apri o programma','scambi'],
 ['dimensione','Cambia dimensione della lega','expand','Numero di squadre','competizioni'],
 ['crea-competizione','Crea una competizione','competition','Formato e partecipanti','competizioni'],
 ['avvia-competizione','Avvia una competizione','play','Genera il calendario','competizioni'],
 ['schedine-fanta','Imposta le schedine Fanta','rules','Attiva o disattiva','competizioni'],
 ['associa','Associa un account a una squadra','link','Abbina il giocatore','presidente'],
 ['rose','Correggi le rose','lineup','Gestisci i calciatori','presidente'],
 ['importazione','Controlla le rose importate','search','Verifica i calciatori','presidente'],
];
const operations=new Map([...barOperations,...fantaOperations].map(entry=>[entry[0],entry]));
export const presidentTitle=key=>operations.get(key)?.[1]||'Pannello del presidente';
export const fantaPresidentTool=(tab,key)=>operations.get(key)?.[4]===tab?key:tab==='presidente'&&key==='rimuovi'?key:null;

export const presidentLaunch=(attributes)=>`<button class="secondary president-launch" type="button" ${attributes}>Pannello del presidente <span aria-hidden="true">›</span></button>`;
export const presidentBarBridge='data-mode="bar" data-bar-page="admin"';
export const presidentBack=barOwn=>barOwn?presidentBarBridge:'data-go="presidente"';

export function presidentWorkspace({tool,body='',buttons='',back}){
 const title=presidentTitle(tool);
 return `<section class="president-workspace" aria-label="${esc(title)}">
  <header class="participants-heading" data-os-header>${backButton(back,tool?'Torna al pannello del presidente':'Torna alla lega')}${tool?'':`<h1>${esc(title)}</h1>`}</header>
  <div data-os-content data-os-flow>${tool?body:`<nav class="lega-hub president-tiles" aria-label="Operazioni del presidente">${buttons}</nav>`}</div>
 </section>`;
}

export function presidentOperationButtons({bar=null,fanta=null,mode='bar',demo=false,hasTrades=false}={}){
 const available=bar?new Set(['identita','regole','rimuovi','riammetti',...(bar.code?['whatsapp']:[]),...(!demo?['invita','richieste','elimina']:[]),...(bar.fantaCreation?.status&&bar.fantaCreation.status!=='ready'?['preparazione']:!bar.nativeFantaLink&&!fanta?['attiva']:[])]):new Set(['rimuovi']);
 const barButtons=barOperations.filter(([key])=>available.has(key)).map(([key])=>
  [key,mode==='bar'?`data-president-operation="${key}"`:`data-go="presidente" data-president-tool="${key}"`]);
 const nativeButtons=fanta?fantaOperations.filter(([key])=>{
  if(key==='scambi')return hasTrades;
  if(key==='associa')return !['pilot','random'].includes(fanta.kind);
  if(['asta','dimensione','crea-competizione','avvia-competizione'].includes(key))return fanta.kind!=='pilot';
  return true;
 }).map(([key,,,,tab])=>[key,mode==='bar'?
  `data-league-fanta="${tab}" data-league-section="${key}" data-native-league="${esc(fanta.id)}"`:
  `data-go="${tab}" data-president-tool="${key}"`]):[];
 return [...barButtons.filter(([key])=>key!=='elimina'),...nativeButtons,...barButtons.filter(([key])=>key==='elimina')].map(([key,action])=>{
  const [,title,icon,description]=operations.get(key);
  return hubTile(icon,title,description,{action,arrow:true,danger:key==='elimina',badge:false});
 }).join('');
}
