import {parseHTML} from 'linkedom';
import {normalizePersonName} from './player-identities.mjs';
import {normalizeTeam} from '../lib/calendar.mjs';

const sources=[
 {name:'Sky Sport',url:'https://sport.sky.it/rss/sport_calcio_serie-a.xml'},
 {name:'La Gazzetta dello Sport',url:'https://www.gazzetta.it/dynamic-feed/rss/section/Calcio/Serie-A.xml'},
 {name:'Corriere dello Sport',group:'amodei',url:'https://www.corrieredellosport.it/rss/calcio/serie-a'},
 {name:'Tuttosport',group:'amodei',url:'https://www.tuttosport.com/rss/calcio/serie-a'},
 {name:'SportMediaset',url:'https://www.sportmediaset.mediaset.it/calcio/seriea/',html:true},
];
const normalize=normalizePersonName;
const includes=(text,word)=>!!word&&(' '+text+' ').includes(' '+word+' ');
const topic=/infortun|squalific|giudice.sportivo|salter|lesione|indisponib|bollettino|problema.muscolare/i;
const fresh=(date,now)=>Number.isFinite(date)&&date>=now-72*3600000&&date<=now+300000;

async function readPage(url,fetcher,limit=2_000_000){
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw Error('News source unavailable');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let size=0,body='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)return body+decoder.decode();
   size+=value.byteLength;
   if(size>limit)throw Error('News source too large');
   body+=decoder.decode(value,{stream:true});
  }
 }finally{await reader.cancel().catch(()=>{});}
}
const plain=value=>parseHTML('<html><body>'+String(value||'')+'</body></html>').document.body.textContent;

export function readAvailabilityFeed(xml,now){
 if(!/<rss[\s>]/i.test(xml))throw Error('Invalid news feed');
 return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(([,item])=>{
  const field=tag=>item.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'))?.[1]?.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1');
  const title=plain(field('title')),description=plain(field('description')),date=Date.parse(field('pubDate'));
  return fresh(date,now)&&topic.test(title+' '+description)?[{title,description,date}]:[];
 });
}

async function mediasetArticles(html,source,fetcher,now){
 const base=new URL(source.url);
 const listed=[...new Set([...html.matchAll(/href="([^"]+\.shtml)"/g)].map(([,url])=>url))];
 const urls=listed.filter(url=>url.startsWith(base.origin+'/calcio/')&&!url.endsWith('/calcio-ora-per-ora.shtml'));
 if(!urls.length)throw Error('Invalid news index');
 const selected=[...new Set([...urls.filter(url=>topic.test(url)).slice(0,5),...urls.slice(0,4)])];
 const pages=await Promise.allSettled(selected.map(url=>readPage(url,fetcher,3_000_000)));
 if(!pages.some(page=>page.status==='fulfilled'))throw Error('News articles unavailable');
 return pages.flatMap(page=>{
  if(page.status!=='fulfilled')return [];
  const {document}=parseHTML(page.value);
  return [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(script=>{
   try{
    const a=JSON.parse(script.textContent),date=Date.parse(a.datePublished);
    return a['@type']==='NewsArticle'&&fresh(date,now)&&topic.test(a.headline+' '+a.description+' '+a.articleBody)
     ?[{title:a.headline,description:a.description,body:a.articleBody,date}]:[];
   }catch{return [];}
  });
 });
}

export async function readAvailabilityNews({fetcher=fetch,now=Date.now()}={}){
 const feeds=await Promise.allSettled(sources.map(async source=>{
  const page=await readPage(source.url,fetcher);
  const articles=source.html?await mediasetArticles(page,source,fetcher,now):readAvailabilityFeed(page,now);
  return articles.map(article=>({...article,source:source.name,group:source.group||source.name}));
 }));
 return {articles:feeds.flatMap(feed=>feed.status==='fulfilled'?feed.value:[]),
  providers:feeds.map((feed,i)=>({name:sources[i].name,ok:feed.status==='fulfilled',articles:feed.value?.length||0}))};
}

const uncertain=/\b(non e|non sembra|non si sa|nessun[ao]?|potrebbe|rischia|in dubbio|da valutare|da monitorare|da verificare|se dovesse|rientra|ha recuperato|recuperato|torna a disposizione|era infortunato|finito il periodo|dopo l infortunio|dopo la squalifica|in vista|diffidat\w*|allenamento a parte)\b/;
const injury=/\b(?:infortunio|infortunat[oa]|lesione|problema muscolare|uscit[oa] per infortunio)\b/;
const suspension=/\b(?:squalificat[oa]|squalifica|stop di (?:un|due|tre) turn[oi])\b/;
const miss=/\b(?:salta|saltera|non ci sara|non sara a disposizione|non recupera|dara forfait|indisponibile|out per|fuori per|stop di|out almeno|fuori almeno)\b/;

export function availabilityFromNews(players,articles,{notBefore}={}){
 const aliases=new Map();
 for(const player of players)for(const name of new Set([player.name,player.display_name,player.surname].map(normalize))){
  if(name.length<4)continue;
  const ids=aliases.get(name)||new Set();
  ids.add(player.id);aliases.set(name,ids);
 }
 const reports=[];
 for(const article of articles){
  if(notBefore&&article.date<notBefore)continue;
  const context=normalize([article.title,article.description].join(' '));
  const sentences=[article.title,article.description,article.body].filter(Boolean).flatMap(text=>String(text).split(/[.!?;\n]/));
  for(const raw of sentences){
   const sentence=normalize(raw);
   if(uncertain.test(sentence))continue;
   const type=suspension.test(sentence)&&miss.test(sentence)?'suspended':injury.test(sentence)&&miss.test(sentence)?'injured':null;
   if(!type)continue;
   const mentioned=new Set();
   for(const [name,ids] of aliases)if(includes(sentence,name))for(const id of ids)mentioned.add(id);
   if(mentioned.size!==1)continue;
   const player=players.find(p=>p.id===[...mentioned][0]);
   const club=normalize(normalizeTeam(player.team));
   if(!includes(context,club)&&!includes(sentence,club))continue;
   reports.push({playerId:player.api_id,type,source:article.source,group:article.group,headline:normalize(article.title)});
  }
 }
 const confirmed=[];
 for(const player of players)for(const type of ['suspended','injured']){
  const matching=reports.filter(r=>r.playerId===player.api_id&&r.type===type);
  const independent=new Map();
  for(const report of matching)if(![...independent.values()].some(r=>r.headline===report.headline))independent.set(report.group,report);
  if(independent.size<2)continue;
  const sources=[...independent.values()].map(r=>r.source);
  confirmed.push({playerId:player.api_id,type,note:'Indisponibilità riportata da '+sources.join(' e '),source:'news',sources});
  break;
 }
 return confirmed;
}
