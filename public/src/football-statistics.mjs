import {playerSurname} from './player-label.mjs';
import {matchEventLabel} from '../match-events.mjs';
import {assistBootIcon,ballIcon,substitutionMark} from './pitch-events.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v==null?'—':esc(v);
const labels={'Shots on Goal':'Tiri in porta','Shots off Goal':'Tiri fuori','Total Shots':'Tiri totali','Blocked Shots':'Tiri respinti','Shots insidebox':'Tiri in area','Shots outsidebox':'Tiri da fuori','Fouls':'Falli','Corner Kicks':'Calci d’angolo','Offsides':'Fuorigioco','Ball Possession':'Possesso palla','Yellow Cards':'Ammonizioni','Red Cards':'Espulsioni','Goalkeeper Saves':'Parate','Total passes':'Passaggi','Passes accurate':'Passaggi riusciti','Passes %':'Precisione passaggi','expected_goals':'Gol attesi','goals_prevented':'Gol evitati'};
export function eventColumns(match, events){
 const aliases={acmilan:'milan',internazionale:'inter',intermilan:'inter',asroma:'roma',ssclazio:'lazio',sscnapoli:'napoli',hellasverona:'verona'};
 const key=name=>{const k=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');return aliases[k]||k;};
 const home=[],away=[],unknown=[];
 for(const e of events){
  if(e.side==='home'||key(e.team)===key(match.home))home.push(e);
  else if(e.side==='away'||key(e.team)===key(match.away))away.push(e);
  else unknown.push(e);
 }
 const event=e=>{
  const icon=e.kind==='goal'||e.kind==='own-goal'?ballIcon(e.kind==='own-goal'):e.kind==='substitution'?substitutionMark():({yellow:'🟨',red:'🟥','penalty-missed':'✕','penalty-saved':'🧤',var:'▣'})[e.kind];
  const names=[(e.players||[]).map(playerSurname).filter(Boolean).join(', '),playerSurname(e.incoming)].filter(Boolean).join(' → ');
  const description=[names,e.kind==='var'?e.detail:''].filter(Boolean).join(' · ');
  const assist=e.kind==='goal'&&!e.penalty&&typeof e.assist==='string'?playerSurname(e.assist):'';
  const credit=assist?`<span class="match-event-assist" title="Assist di ${esc(assist)}">${assistBootIcon()}<span><span class="sr-only">Assist di </span>${esc(assist)}</span></span>`:'';
  return `<div class="event-item match-event-row"><b class="green">${esc(e.minute)}</b><span role="img" aria-label="${esc(matchEventLabel(e))}">${icon}</span><div class="match-event-names"><strong title="${esc(description)}">${esc(description)}</strong>${credit}</div></div>`;
 };
 const section=(team,rows)=>`<section><h3>${esc(team)}</h3>${rows.length?rows.map(event).join(''):'<p class="tiny muted">Nessun evento disponibile.</p>'}</section>`;
 return `<div class="events-columns">${section(match.home,home)}${section(match.away,away)}</div>${unknown.length?'<div class="notice">Squadra non indicata dalla fonte</div>'+unknown.map(event).join(''):''}`;
}

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
