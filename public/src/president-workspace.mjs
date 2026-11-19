import {esc} from './fanta/formato.mjs';

const barOperations=[
 ['identita','Modifica identità della lega'],
 ['regole','Modifica regole del Bar'],
 ['invita','Invita per nickname o email'],
 ['whatsapp','Invita con WhatsApp'],
 ['richieste','Gestisci richieste di ingresso'],
 ['rimuovi','Rimuovi un partecipante'],
 ['riammetti','Riammetti un partecipante'],
 ['attiva','Attiva il Fanta'],
 ['preparazione','Controlla la preparazione del Fanta'],
 ['elimina','Elimina lega e storico'],
];
const fantaOperations=[
 ['asta','Gestisci asta e svincoli','asta'],
 ['scambi','Gestisci gli scambi','scambi'],
 ['dimensione','Cambia dimensione della lega','competizioni'],
 ['crea-competizione','Crea una competizione','competizioni'],
 ['avvia-competizione','Avvia una competizione','competizioni'],
 ['schedine-fanta','Imposta le schedine Fanta','competizioni'],
 ['associa','Associa un account a una squadra','presidente'],
 ['rose','Correggi le rose','presidente'],
 ['importazione','Controlla le rose importate','presidente'],
];
const operations=new Map([...barOperations,...fantaOperations].map(entry=>[entry[0],entry]));
export const presidentTitle=key=>operations.get(key)?.[1]||'Pannello del presidente';
export const fantaPresidentTool=(tab,key)=>operations.get(key)?.[2]===tab?key:tab==='presidente'&&key==='rimuovi'?key:null;

export const presidentLaunch=(attributes)=>`<button class="secondary president-launch" type="button" ${attributes}>Pannello del presidente <span aria-hidden="true">›</span></button>`;
export const presidentBarBridge='data-mode="bar" data-bar-page="admin"';
export const presidentBack=barOwn=>barOwn?presidentBarBridge:'data-go="presidente"';

export function presidentWorkspace({tool,body='',buttons='',back}){
 const title=presidentTitle(tool);
 return `<section class="president-workspace">
  <header class="participants-heading" data-os-header><button type="button" class="secondary league-settings-back" ${back}>‹ Indietro</button><h1>${esc(title)}</h1></header>
  <div data-os-content data-os-flow>${tool?body:`<nav class="president-operation-list" aria-label="Operazioni del presidente">${buttons}</nav>`}</div>
 </section>`;
}

export function presidentOperationButtons({bar=null,fanta=null,mode='bar',demo=false,hasTrades=false}={}){
 const available=bar?new Set(['identita','regole','rimuovi','riammetti',...(bar.code?['whatsapp']:[]),...(!demo?['invita','richieste','elimina']:[]),...(bar.fantaCreation?.status&&bar.fantaCreation.status!=='ready'?['preparazione']:!bar.nativeFantaLink&&!fanta?['attiva']:[])]):new Set(['rimuovi']);
 const barButtons=barOperations.filter(([key])=>available.has(key)).map(([key,label])=>
  [key,label,mode==='bar'?`data-president-operation="${key}"`:`data-go="presidente" data-president-tool="${key}"`]);
 const nativeButtons=fanta?fantaOperations.filter(([key])=>{
  if(key==='scambi')return hasTrades;
  if(key==='associa')return !['pilot','random'].includes(fanta.kind);
  if(['asta','dimensione','crea-competizione','avvia-competizione'].includes(key))return fanta.kind!=='pilot';
  return true;
 }).map(([key,label,tab])=>[key,label,mode==='bar'?
  `data-league-fanta="${tab}" data-league-section="${key}" data-native-league="${esc(fanta.id)}"`:
  `data-go="${tab}" data-president-tool="${key}"`]):[];
 return [...barButtons.filter(([key])=>key!=='elimina'),...nativeButtons,...barButtons.filter(([key])=>key==='elimina')].map(([key,label,attrs])=>
  `<button type="button" class="secondary president-operation${key==='elimina'?' league-delete-action':''}" ${attrs}>${esc(label)}<span aria-hidden="true">›</span></button>`).join('');
}
