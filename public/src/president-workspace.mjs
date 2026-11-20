import {esc} from './fanta/formato.mjs';
import {hubTile} from './league-hub.mjs';
import {backButton} from './back-navigation.mjs';

const barOperations=[
 ['identita','Modifica identità della lega','shield'],
 ['regole','Modifica regole del Bar','rules'],
 ['invita','Invita per nickname o email','invite'],
 ['whatsapp','Invita con WhatsApp','whatsapp'],
 ['richieste','Gestisci richieste di ingresso','inbox'],
 ['rimuovi','Rimuovi un partecipante','person-remove'],
 ['riammetti','Riammetti un partecipante','person-add'],
 ['attiva','Attiva il Fanta','lineup'],
 ['preparazione','Controlla la preparazione del Fanta','search'],
 ['elimina','Elimina lega e storico','trash'],
];
const fantaOperations=[
 ['asta','Gestisci asta e svincoli','auction','asta'],
 ['scambi','Gestisci gli scambi','trade','scambi'],
 ['dimensione','Cambia dimensione della lega','expand','competizioni'],
 ['crea-competizione','Crea una competizione','competition','competizioni'],
 ['avvia-competizione','Avvia una competizione','play','competizioni'],
 ['schedine-fanta','Imposta le schedine Fanta','rules','competizioni'],
 ['associa','Associa un account a una squadra','link','presidente'],
 ['rose','Correggi le rose','lineup','presidente'],
 ['importazione','Controlla le rose importate','search','presidente'],
];
const operations=new Map([...barOperations,...fantaOperations].map(entry=>[entry[0],entry]));
export const presidentTitle=key=>operations.get(key)?.[1]||'Pannello del presidente';
export const fantaPresidentTool=(tab,key)=>operations.get(key)?.[3]===tab?key:tab==='presidente'&&['rimuovi','identita'].includes(key)?key:null;

export const presidentLaunch=(attributes)=>`<button class="secondary president-launch" type="button" ${attributes}>Pannello del presidente <span aria-hidden="true">›</span></button>`;
export const presidentBarBridge='data-mode="bar" data-bar-page="admin"';
export const presidentBack=barOwn=>barOwn?presidentBarBridge:'data-go="presidente"';

export function presidentWorkspace({tool,body='',buttons='',back}){
 const title=presidentTitle(tool);
 return `<section class="president-workspace${tool?' president-operation-view':''}" aria-label="${esc(title)}">
  ${tool?`<div class="president-operation-body" data-os-flow>${backButton(back,'Torna al pannello del presidente')}<div data-os-content data-os-flow>${body}</div></div>`:
    `<header class="participants-heading" data-os-header>${backButton(back,'Torna alla lega')}<h1>${esc(title)}</h1></header>
     <nav class="lega-hub president-tiles" aria-label="Operazioni del presidente" data-os-content data-os-flow>${buttons}</nav>`}
 </section>`;
}

export function presidentOperationButtons({bar=null,fanta=null,mode='bar',demo=false,hasTrades=false,hasIdentity=false}={}){
 const available=bar?new Set(['identita','regole','rimuovi','riammetti',...(bar.code?['whatsapp']:[]),...(!demo?['invita','richieste','elimina']:[]),...(bar.fantaCreation?.status&&bar.fantaCreation.status!=='ready'?['preparazione']:!bar.nativeFantaLink&&!fanta?['attiva']:[])]):new Set(hasIdentity?['identita','rimuovi']:['rimuovi']);
 const barButtons=barOperations.filter(([key])=>available.has(key)).map(([key])=>
  [key,mode==='bar'?`data-president-operation="${key}"`:`data-go="presidente" data-president-tool="${key}"`]);
 const nativeButtons=fanta?fantaOperations.filter(([key])=>{
  if(key==='scambi')return hasTrades;
  if(key==='associa')return !['pilot','random'].includes(fanta.kind);
  if(['asta','dimensione','crea-competizione','avvia-competizione'].includes(key))return fanta.kind!=='pilot';
  return true;
 }).map(([key,,,tab])=>[key,mode==='bar'?
  `data-league-fanta="${tab}" data-league-section="${key}" data-native-league="${esc(fanta.id)}"`:
  `data-go="${tab}" data-president-tool="${key}"`]):[];
 return [...barButtons.filter(([key])=>key!=='elimina'),...nativeButtons,...barButtons.filter(([key])=>key==='elimina')].map(([key,action])=>{
  const [,title,icon]=operations.get(key);
  return hubTile(icon,title,'',{action,arrow:true,danger:key==='elimina',badge:false});
 }).join('');
}
