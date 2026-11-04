import fs from 'node:fs/promises';
import {getStore as localStore} from './local-blobs.mjs';
const mode=process.argv[2],file=process.argv[3];
if(!['export','import','init-fresh'].includes(mode))throw Error('Uso: blob-transfer.mjs export|import FILE oppure init-fresh');
if(mode==='export'){
 if(!file||!process.env.NETLIFY_AUTH_TOKEN||!process.env.NETLIFY_SITE_ID)throw Error('File, NETLIFY_AUTH_TOKEN e NETLIFY_SITE_ID necessari; non passarli come argomenti');
 const {getStore}=await import('@netlify/blobs');const stores={};
 // Only durable scheduling and the public score snapshot; private read caches
 // are deliberately rebuilt, not downloaded. No DB or secret export here.
 for(const [name,key] of [['quasi-operations-v1','calendar'],['quasi-public-football-v1','scores']]){
  const store=getStore({name,siteID:process.env.NETLIFY_SITE_ID,token:process.env.NETLIFY_AUTH_TOKEN,consistency:'strong'}),value=await store.get(key,{type:'json'});
  if(name==='quasi-operations-v1'&&!value)throw Error('Piano operativo Netlify non trovato: migrazione interrotta');stores[name]={[key]:value};
 }
 await fs.writeFile(file,JSON.stringify({version:1,exportedAt:new Date().toISOString(),stores}),{mode:0o600,flag:'wx'});console.log('Piano e risultati esportati; nessuna cache privata scaricata');
}else if(mode==='import'){
 const body=JSON.parse(await fs.readFile(file));if(body.version!==1||!body.stores?.['quasi-operations-v1']?.calendar)throw Error('Esportazione non valida');
 for(const [name,key] of [['quasi-operations-v1','calendar'],['quasi-public-football-v1','scores']]){
  const value=body.stores[name]?.[key];if(value==null)continue;const store=localStore({name});
  if(! (await store.setJSON(key,value,{onlyIfNew:true})).modified)throw Error('Store locale già presente: nessuna sovrascrittura automatica');
 }
 console.log('Piano importato senza azzerare job, quote o installazioni');
}else{
 const {bootstrapPlan}=await import('../lib/operations/store.mjs'),plan=bootstrapPlan();plan.jobs=plan.jobs.filter(j=>j.kind!=='maintenance');
 if(!(await localStore({name:'quasi-operations-v1'}).setJSON('calendar',plan,{onlyIfNew:true})).modified)throw Error('Piano esistente: init-fresh vietato');
 console.log('Piano nuovo creato: solo per installazioni nuove, non per migrare lo storico');
}
