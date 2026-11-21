import {playerSurname} from './player-label.mjs';
import {sameClub} from './fanta/maglie.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v==null?'—':esc(v);
const labels={'Shots on Goal':'Tiri in porta','Shots off Goal':'Tiri fuori','Total Shots':'Tiri totali','Blocked Shots':'Tiri respinti','Shots insidebox':'Tiri in area','Shots outsidebox':'Tiri da fuori','Fouls':'Falli','Corner Kicks':'Calci d’angolo','Offsides':'Fuorigioco','Ball Possession':'Possesso palla','Yellow Cards':'Ammonizioni','Red Cards':'Espulsioni','Goalkeeper Saves':'Parate','Total passes':'Passaggi','Passes accurate':'Passaggi riusciti','Passes %':'Precisione passaggi','expected_goals':'Gol attesi','goals_prevented':'Gol evitati'};
export function footballStatistics(match,{compact=false}={}){
  const d=match.details||{},stats=d.statistics||[],homeId=d.matchInfo?.teams?.home?.id;
  const home=stats.find(t=>t.side==='home')||stats.find(t=>t.team?.id===homeId)||stats[0],away=stats.find(t=>t!==home),types=[...new Set(stats.flatMap(t=>(t.statistics||[]).map(x=>x.type)))];
  const value=(t,type)=>number(t?.statistics?.find(x=>x.type===type)?.value);
  const statTable=rows=>`<div class="match-stats-scroll"><table class="rule-table"><thead><tr><th>${esc(match.home)}</th><th>Statistica</th><th>${esc(match.away)}</th></tr></thead><tbody>${rows.map(type=>`<tr><td>${value(home,type)}</td><th>${esc(labels[type]||type)}</th><td>${value(away,type)}</td></tr>`).join('')}</tbody></table></div>`;
  let html=types.length?`<details class="match-statistics"><summary>La partita in numeri</summary>${statTable(types.slice(0,4))}${types.length>4?'<details class="statistics-more"><summary>Altro <span aria-hidden="true">⌄</span></summary>'+statTable(types.slice(4))+'</details>':''}</details>`:'';
  html+=footballPenalties(match,{compact});
  if(d.playerStats?.length){
   const table=players=>`<div class="match-stats-scroll"><table class="rule-table"><thead><tr><th>Giocatore</th><th>Min.</th>${compact?'<th aria-label="Gol">⚽</th><th aria-label="Assist">👟</th>':'<th>Gol</th><th>Assist</th>'}<th>🟨</th><th>🟥</th></tr></thead><tbody>${players.map(p=>`<tr><th>${esc(compact?playerSurname(p):p.name)}</th><td>${number(p.minutes)}</td><td>${number(p.goals)}</td><td>${number(p.assists)}</td><td>${number(p.yellow)}</td><td>${number(p.red)}</td></tr>`).join('')}</tbody></table></div>`;
   html+=`<details class="match-statistics player-statistics"><summary>I numeri dei giocatori</summary><div class="stats-team-tabs" role="tablist" aria-label="Statistiche per squadra">${['home','away'].map((side,i)=>`<button type="button" role="tab" data-stats-team="${side}" aria-selected="${!i}">${esc(match[side])}</button>`).join('')}</div>${['home','away'].map((side,i)=>{const players=d.playerStats.filter(p=>p.side?p.side===side:p.team===match[side]).sort((a,b)=>(b.minutes||0)-(a.minutes||0));return `<section data-stats-panel="${side}" role="tabpanel" aria-label="${esc(match[side])}" ${i?'hidden':''}>${table(players.slice(0,5))}${players.length>5?'<details class="statistics-more"><summary>Altro <span aria-hidden="true">⌄</span></summary>'+table(players.slice(5))+'</details>':''}</section>`;}).join('')}</details>`;
  }
  return html;
}

export function footballPenalties(match,{compact=false}={}){
 const penalties=match.details?.penalties||[];
 return penalties.length?`<details class="match-statistics"><summary>Dal dischetto</summary>${penalties.map(p=>`<div class="event-item${compact?' compact-penalty':''}"><strong>${esc(compact?playerSurname(p.player):p.player)}</strong><small class="muted"> · ${esc(p.team)}</small><p>${[['scored','Rigori segnati'],['missed','Rigori sbagliati'],['saved','Rigori parati'],['won','Rigori procurati'],['committed','Rigori causati']].filter(([k])=>Number(p[k])>0).map(([k,label])=>label+': <b>'+number(p[k])+'</b>').join(' · ')}</p></div>`).join('')}</details>`:'';
}

export function bindFootballStatistics(root){
 root.querySelectorAll('[data-stats-team]').forEach(button=>button.onclick=()=>{const section=button.closest('.player-statistics');section.querySelectorAll('[data-stats-team]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));section.querySelectorAll('[data-stats-panel]').forEach(p=>p.hidden=p.dataset.statsPanel!==button.dataset.statsTeam);});
}

const featured=['Ball Possession','Shots on Goal','expected_goals'];
const comparisonOrder=[...featured,'Total Shots','Corner Kicks','Goalkeeper Saves','Passes accurate','Total passes','Passes %','Fouls','Free Kicks','Yellow Cards','Red Cards','Offsides','Shots off Goal','Blocked Shots','Shots insidebox','Shots outsidebox','goals_prevented'];
const comparisonLabels={...labels,'Free Kicks':'Calci di punizione',expected_goals:'xG · Gol attesi'};
const decimals=new Intl.NumberFormat('it-IT',{maximumFractionDigits:2});
const numeric=value=>{
 if(typeof value!=='number'&&typeof value!=='string')return null;
 const normalized=String(value).trim().replace(/%$/,'').replace(',','.');
 return /^-?\d+(?:\.\d+)?$/.test(normalized)&&Number.isFinite(Number(normalized))?Number(normalized):null;
};
const displayNumber=(value,suffix='')=>value===null?'—':decimals.format(value)+suffix;

export function footballComparison(match,{summary=false}={}){
 const stats=match.details?.statistics||[],homeId=match.details?.matchInfo?.teams?.home?.id;
 const home=stats.find(t=>t.side==='home'||homeId!=null&&t.team?.id===homeId)
  ||stats.find(t=>!t.side&&t.team?.name===match.home)||stats.find(t=>!t.side);
 const away=stats.find(t=>t.side==='away')||stats.find(t=>!t.side&&t!==home);
 const values=team=>new Map((team?.statistics||[]).map(row=>[row.type,numeric(row.value)]));
 const sides=[values(home),values(away)];
 const rows=(summary?featured:comparisonOrder).flatMap(type=>{
  const [a,b]=sides.map(side=>side.get(type)??null);
  if(a===null&&b===null)return [];
  const suffix=type==='Ball Possession'||type==='Passes %'?'%':'';
  const left=displayNumber(a,suffix),right=displayNumber(b,suffix),label=comparisonLabels[type];
  const shares=a!==null&&b!==null&&a>=0&&b>=0&&a+b>0
   ?[a,b].map(value=>Math.round(10000*(value/(a+b)))/100):null;
  return [`<div class="live-stat" role="group" aria-label="${esc(label+'. '+match.home+' '+left+', '+match.away+' '+right)}">
   <div class="live-stat-values" aria-hidden="true"><b>${left}</b><span>${label}</span><b>${right}</b></div>
   ${shares?`<div class="live-stat-bar" aria-hidden="true">${shares.map((share,i)=>share?`<span class="${i?'away':'home'}" style="--stat-share:${share}%"></span>`:'').join('')}</div>`:''}
  </div>`];
 });
 if(!rows.length)return '';
 return `<div class="live-stat-comparison"><div class="live-stat-teams" aria-hidden="true"><span>${esc(match.home)}</span><span>${esc(match.away)}</span></div>${rows.join('')}</div>`;
}

const providerId=value=>String(value??'').replace(/^af:/,'');
const playerNameKey=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
function statsForPlayer(match,player){
 const team=match[player.side],id=providerId(player.id),name=playerNameKey(player.name);
 const players=(match.details?.playerStats||[]).filter(row=>row.side?row.side===player.side:row.team&&sameClub(row.team,team));
 const byId=id?players.find(row=>providerId(row.id)===id):null;
 if(byId||!name)return byId;
 const matches=players.filter(row=>playerNameKey(row.name)===name);
 return matches.length===1?matches[0]:null;
}

export function footballPlayerStats(match,player){
 const p=statsForPlayer(match,player);
 if(!p||!(Number(p.minutes)>0||numeric(p.rating)!==null||[p.goals,p.assists,p.saves,p.yellow,p.red].some(value=>Number(value)>0))){
  return '<p class="live-match-empty muted">Statistiche non ancora disponibili per questo giocatore.</p>';
 }
 const values=[
  ['Minuti',p.minutes],['Gol',p.goals],['Assist',p.assists],['Voto del fornitore',p.rating],
  ['Parate',p.saves,true],['Ammonizioni',p.yellow,true],['Espulsioni',p.red,true],
  ...[['Rigori segnati',p.penalty?.scored],['Rigori sbagliati',p.penalty?.missed],['Rigori parati',p.penalty?.saved]]
   .filter(([,value])=>Number(value)>0)
 ];
 return `<dl class="live-player-figures">${values.filter(([,value,optional])=>!optional||numeric(value)!==null)
  .map(([label,value])=>`<div><dt>${label}</dt><dd>${displayNumber(numeric(value))}</dd></div>`).join('')}</dl>`;
}
