import {parseHTML} from 'linkedom';
import {normalizeTeam} from './calendar.mjs';
import {recordExternal} from './platform-admin.mjs';
export const EDITORIAL_URL='https://www.fantacalcio.it/probabili-formazioni-serie-a';
const text=e=>e?.textContent?.replace(/\s+/g,' ').trim()||'';
const name=e=>text(e.querySelector('.player-name span')||e.querySelector('.player-name'));
export function parseEditorialLineups(html){
 if(typeof html!=='string'||html.length>2000000)return [];
 const {document:d}=parseHTML(html),matches=[];
 for(const container of d.querySelectorAll('[data-team-formation]')){
  const match=container.closest('li.match');if(!match||matches.some(x=>x.externalId===match.getAttribute('data-match-id')))continue;
  const link=match.querySelector('a.match-score')?.getAttribute('href')||'',season=link.match(/\/calendario\/\d+\/(\d{4})-/)?.[1],round=Number(text(match.querySelector('.matchweek')));
  const teams=[...match.querySelectorAll('.team-card')].map((card,i)=>{
   const team=text(card.querySelector('h3.team-name')),players=[...card.querySelectorAll('.player-item')].map(p=>({name:name(p),position:p.querySelector('.role')?.getAttribute('data-value')||'',probability:Number(p.querySelector('[aria-valuenow]')?.getAttribute('aria-valuenow')),probabilityKind:'editorial'})).filter(p=>p.name);
   const starting=players.slice(0,11),ballots=[];
   for(const column of match.querySelectorAll('.ballots .content')){const club=column.querySelector('img')?.getAttribute('alt')?.replace(/^Stemma /,'');if(normalizeTeam(club)!==normalizeTeam(team))continue;
    for(const b of column.querySelectorAll('.ballot')){const candidates=[...b.querySelectorAll('.ballot-list li')].map(x=>({name:name(x),probability:Number(text(x.querySelector('.percentage')).replace('%',''))})).filter(p=>p.name&&Number.isFinite(p.probability)&&p.probability>=0&&p.probability<=100);if(candidates.length>=2)ballots.push({players:candidates,note:text(b.querySelector('.description')),kind:'editorial'});}
   }
   const unavailable=[];for(const [selector,label]of [['.injureds','Infortunato'],['.suspendeds','Squalificato'],['.dubts','In dubbio']])for(const li of match.querySelectorAll(selector+' li')){const href=li.querySelector('.player-name')?.getAttribute('href')||'',slug=href.match(/\/squadre\/([^/]+)\//)?.[1];if(normalizeTeam(slug)!==normalizeTeam(team))continue;const n=name(li);if(n)unavailable.push({name:n,status:label,note:text(li.querySelector('.description'))});}
   return {team,side:i?'away':'home',formation:text(card.querySelector('.team-formation')),players:starting,bench:players.slice(11),ballots,unavailable};
  });
  if(teams.length===2&&teams.every(t=>t.players.length===11))matches.push({externalId:match.getAttribute('data-match-id'),round,season,kind:'probable',source:'Fantacalcio.it',sourceUrl:EDITORIAL_URL,teams});
 }
 return matches;
}
export async function editorialFor(s,m,fetcher,now){
 const r=s.football.calendar.rounds.find(r=>r.matches.some(x=>x.id===m.id));if(!r)return null;
 let cache=s.football.editorialLineupCache;
 if(!cache||cache.version!==5||+now-Date.parse(cache.at)>=3600000){
  const response=await fetcher(EDITORIAL_URL,{signal:AbortSignal.timeout(10000)});recordExternal('Fantacalcio.it probabili','/probabili-formazioni-serie-a',response.status);
  if(!response.ok)return null;
  cache={version:5,at:now.toISOString(),matches:parseEditorialLineups(await response.text())};s.football.editorialLineupCache=cache;
 }
 return cache.matches.find(x=>x.round===r.number&&x.season===String(s.football.calendar.season)&&normalizeTeam(x.teams[0].team)===normalizeTeam(m.home)&&normalizeTeam(x.teams[1].team)===normalizeTeam(m.away))||null;
}
