import {parseHTML} from 'linkedom';
import {normalizeTeam} from './calendar.mjs';
import {recordExternal} from './platform-admin.mjs';
const text=e=>e?.textContent?.replace(/\s+/g,' ').trim()||'';
const documentFor=html=>typeof html==='string'&&html.length<=2000000?parseHTML(html).document:null;
const players=(root,selector)=>[...(root?.querySelectorAll(selector)||[])].map(e=>({name:text(e),jersey:text(e.nextElementSibling)})).filter(p=>p.name);
const valid=teams=>teams.length===2&&teams.every(t=>t.team&&t.players.length===11&&t.players.every(p=>p.name)&&new Set(t.players.map(p=>p.name)).size===11);
export function parseSos(html){
 const d=documentFor(html);if(!d)return [];
 return [...d.querySelectorAll('article[data-match-id]')].flatMap(card=>{
  const names=[...card.querySelectorAll('header h2')],sections=[...card.querySelectorAll('section')];
  const section=label=>sections.find(s=>text(s.querySelector('h3'))===label);
  const list=(label,i)=>[...(section(label)?.querySelectorAll('ul')[i]?.children||[])];
  const parse=li=>{const spans=[...li.querySelectorAll('span')],pct=spans.find(e=>/^\d+%$/.test(text(e))),name=spans.find(e=>e!==pct&&!e.children.length&&!/^\d+%$/.test(text(e)));return {name:text(name),...(pct?{probability:Number(text(pct).replace('%',''))}:{})};};
  const teams=names.map((n,i)=>({team:text(n),side:i?'away':'home',pitchOrder:'right-to-left',formation:text(n.nextElementSibling),players:list('Titolari',i).map(parse),bench:list('Panchina',i).map(parse),ballots:list('Ballottaggi',i).flatMap(li=>{const spans=[...li.querySelectorAll('span')],names=text(spans.at(-1)).split(/\s+-\s+/),pcts=spans.filter(e=>/^\d+%$/.test(text(e))).map(e=>Number(text(e).replace('%','')));return names.length>=2&&names.length===pcts.length?[{players:names.map((name,j)=>({name,probability:pcts[j]}))}]:[];})}));
  return valid(teams)?[{kind:'probable',source:'SOS Fanta',kickoff:card.querySelector('time')?.getAttribute('datetime'),teams}]:[];
 });
}
export function parseGazzetta(html){
 const d=documentFor(html);if(!d)return [];const season=text(d.querySelector('h2')).match(/(20\d{2})\//)?.[1],round=Number(text(d.querySelector('h3')).match(/^(\d+)/)?.[1]);
 return [...d.querySelectorAll('.bck-box-match-details')].flatMap(card=>{
  const teams=[...card.querySelectorAll('.details-team__name')].map((n,i)=>{const side=i?'away':'home',root=card.querySelector('.lineup-team.is--'+side);let bench=[];const unavailable=[],ballots=[];
   for(const row of card.querySelectorAll('.match-details__note-row')){const p=row.querySelector('p.is--'+side),label=text(p?.querySelector('strong')),value=text(p).slice(label.length).trim();if(/^Panchina/.test(label))bench=value.split(',').map(s=>({jersey:s.trim().match(/^\d+/)?.[0]||'',name:s.trim().replace(/^\d+\s*/, '')})).filter(p=>p.name);if(/^(Squalificati|Indisponibili):/.test(label))unavailable.push(...value.split(',').map(s=>({name:s.replace(/\(.*?\)/g,'').trim(),status:label.startsWith('Squalificati')?'Squalificato':'Indisponibile'})).filter(p=>p.name&&!/^nessuno$/i.test(p.name)));if(/^Ballottaggio/.test(label))for(const part of value.split(',')){const m=part.trim().match(/^(.+?)-(.+?)\s+(\d+)-(\d+)%$/);if(m)ballots.push({players:[{name:m[1],probability:+m[3]},{name:m[2],probability:+m[4]}]});}}
   return {team:text(n),side,pitchOrder:'right-to-left',formation:text(card.querySelectorAll('.match-details__info-match')[i?2:0]).match(/Modulo:\s*([\d-]+)/)?.[1],players:[...(root?.querySelectorAll('.lineup-team__player')||[])].map(p=>({name:text(p.querySelector('.lineup-team__name')),jersey:text(p.querySelector('.lineup-team__number'))})),bench,ballots,unavailable};});
  return valid(teams)?[{kind:'probable',source:'La Gazzetta dello Sport',season,round,day:text(card.querySelector('.has-text-centered')).match(/(\d{1,2})\/(\d{1,2})/)?.slice(1).map(n=>n.padStart(2,'0')).join('/'),teams}]:[];
 });
}
export function parseCorriere(html){
 const d=documentFor(html);if(!d)return [];const round=Number(text(d.querySelector('h1')).match(/(\d+)[°ª]/)?.[1]);
 return [...d.querySelectorAll('[class*="ProbabiliFormazioni_wrapper__"]')].flatMap(card=>{
  const teams=[...card.querySelectorAll('[class*="ProbabiliFormazioni_teamName__"]')].map((n,i)=>{const side=i?'away':'home';return {team:text(n),side,pitchOrder:'right-to-left',formation:text(n.nextElementSibling),players:players(card,`[class*="ProbabiliFormazioni_${side}Player__"]`),bench:players(card,`[class*="ProbabiliFormazioni_${side}PlayerOthers__"]`),ballots:[]};});
  const date=text(card.querySelector('time')).match(/(\d{2})\.(\d{2})\.(\d{4})/);return valid(teams)&&date?[{kind:'probable',source:'Corriere dello Sport',round,date:date[3]+'-'+date[2]+'-'+date[1],teams}]:[];
 });
}
export const FORECAST_SOURCES=[
 {id:'sos',url:'https://www.sosfanta.com/lista-formazioni/probabili-formazioni-serie-a/',parse:parseSos},
 {id:'gazzetta',url:'https://www.gazzetta.it/Calcio/prob_form/',parse:parseGazzetta},
 {id:'corriere',url:'https://www.corrieredellosport.it/probabili-formazioni/calcio/serie-a',parse:parseCorriere},
];
export function forecastMatches(x,m,calendar){
 const r=calendar.rounds.find(r=>r.matches.some(a=>a.id===m.id));if(!r)return false;
 const date=new Date(m.kickoff).toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'}),day=date.slice(8)+'/'+date.slice(5,7);
 return normalizeTeam(x.teams[0]?.team)===normalizeTeam(m.home)&&normalizeTeam(x.teams[1]?.team)===normalizeTeam(m.away)&&(!x.round||x.round===r.number)&&(!x.season||x.season===String(calendar.season))&&(x.kickoff?Math.abs(Date.parse(x.kickoff)-Date.parse(m.kickoff))<12*3600000:x.date?x.date===date:x.day?x.day===day&&x.season===String(calendar.season):false);
}
export async function additionalForecasts(s,m,fetcher,now){
 s.football.forecastSourceCache??={};
 const results=await Promise.all(FORECAST_SOURCES.map(async source=>{
  let cache=s.football.forecastSourceCache[source.id];
  if(!cache||cache.version!==6||+now-Date.parse(cache.at)>=3600000){
   try{const r=await fetcher(source.url,{signal:AbortSignal.timeout(8000),redirect:'error'});recordExternal('Probabili '+source.id,new URL(source.url).pathname,r.status);if(!r.ok)throw Error('HTTP '+r.status);const matches=source.parse(await r.text());if(!matches.length)throw Error('Formato non riconosciuto');cache={version:6,at:now.toISOString(),matches};}
   catch{cache={version:6,at:now.toISOString(),matches:[],unavailable:true};}
   s.football.forecastSourceCache[source.id]=cache;
  }
  return cache.matches.find(x=>forecastMatches(x,m,s.football.calendar));
 }));
 return results.filter(Boolean);
}
