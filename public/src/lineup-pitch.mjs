import {roundPresenceEstimate} from './fanta/presence-probability.mjs';
import {canonicalPitchRows} from './pitch-layout.mjs';
import {playerSurname,playerJersey,opponentLabel} from './player-label.mjs';
import {shirtBack} from './fanta/maglie-portieri.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formationRows(team){
 return canonicalPitchRows(team)?.reverse()||null;
}
const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
export const shirtSurname=playerSurname;
function isGoalkeeper(p,team){
 const role=p.role||p.position;
 return role?/^(p|g|gk|goalkeeper|portiere)$/i.test(role):team.players[0]===p;
}
const AVAILABLE_ROLES=[['all','Tutti'],['P','Portieri'],['D','Difensori'],['C','Centrocampisti'],['A','Attaccanti']];
export function availablePlayerRole(p){
 const role=String(p.role||p.position||'').toUpperCase();
 return /^(P|G|GK|GOALKEEPER|PORTIERE)$/.test(role)?'P':/^(D|DEFENDER|DIFENSORE)$/.test(role)?'D':/^(C|M|MIDFIELDER|CENTROCAMPISTA)$/.test(role)?'C':/^(A|F|FW|ATTACKER|FORWARD|ATTACCANTE)$/.test(role)?'A':'other';
}
function availablePlayers(team){
 const players=team.bench||[],roles=[...AVAILABLE_ROLES,...(players.some(p=>availablePlayerRole(p)==='other')?[['other','Altri']]:[])];
 return `<details class="lineup-bench"><summary>Altri giocatori a disposizione · ${players.length}</summary><div class="lineup-role-tabs" role="group" aria-label="Filtra i giocatori disponibili per ruolo">${roles.map(([role,label])=>`<button type="button" data-lineup-role="${role}" aria-pressed="${role==='all'}">${label} <small>${role==='all'?players.length:players.filter(p=>availablePlayerRole(p)===role).length}</small></button>`).join('')}</div><div class="bench-stickers">${players.map(p=>sticker(p,team,true)).join('')}</div><p class="lineup-role-empty muted" data-lineup-role-empty hidden>Non ci sono altri giocatori disponibili in questo ruolo.</p></details>`;
}
function sticker(p,team,available=false){
 const probability=Number.isFinite(p.probability)&&p.probability>=0&&p.probability<=100?(p.probabilityKind==='official'?p.probability:roundPresenceEstimate(p.probability)):null;
 return `<div class="pitch-player" ${available?`data-available-role="${availablePlayerRole(p)}"`:''} data-fantasy-player="${esc(p.id||'')}"><div class="player-sticker">${shirtBack(p.club||team.team,playerJersey(p),shirtSurname(p),{goalkeeper:isGoalkeeper(p,team),nameSize:5})}</div>${probability!==null?`<span class="player-probability ${p.probabilityKind==='official'?'':'estimated'}" title="${p.probabilityKind==='official'?'Probabilità effettiva':'Probabilità stimata'}">${probability}%</span>`:''}<span class="pitch-player-name sr-only">${esc(p.name)}</span>${p.next?'<small class="pitch-next-opponent">'+esc(opponentLabel(p.next))+'</small>':''}${p.club&&!same(p.club,team.team)?'<small class="pitch-player-club">'+esc(p.club)+'</small>':''}<small class="pitch-player-grades" data-fantasy-grade="pitch" ${Number.isFinite(p.grade)||Number.isFinite(p.fantagrade)?'':'hidden'}>V ${Number.isFinite(p.grade)?p.grade:'—'} · FV ${Number.isFinite(p.fantagrade)?p.fantagrade:'—'}</small></div>`;
}
export function renderLineup(data){
 const l=data.lineups;if(!l)return '<section class="card"><h3>Probabili formazioni</h3><p class="muted">Formazioni non ancora disponibili.</p></section>';
 return `<section class="lineup-section"><h3>${l.kind==='fantasy'?'Le formazioni':l.kind==='official'?'Formazioni ufficiali':'Probabili formazioni'}</h3><div class="pitch-tabs" role="tablist" aria-label="Formazione da visualizzare">${l.teams.map((t,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-pitch-tab="${i}">${esc(t.team)}</button>`).join('')}</div><div class="pitch-slides">${l.teams.map(t=>{const rows=formationRows(t);return `<section class="pitch-team" aria-label="Formazione ${esc(t.team)}"><div class="pitch-heading"><strong>${esc(t.team)}</strong><span>${esc(t.formation||'')}</span></div>${rows?`<div class="football-pitch"><div class="pitch-marks" aria-hidden="true"></div><div class="pitch-rows">${rows.map(row=>`<div class="pitch-row${row.length>=5?' row-5':''}" style="--players:${row.length}">${row.map(p=>sticker(p,t)).join('')}</div>`).join('')}</div></div>`:`<div class="lineup-sticker-list">${!t.players.length?'<p class="muted">Formazione non ancora salvata.</p>':''}${t.players.map(p=>sticker(p,t)).join('')}</div>`}${(t.bench||[]).length?(l.kind==='probable'?availablePlayers(t):`<details class="lineup-bench"><summary>Panchina · ${t.bench.length}</summary><div class="bench-stickers">${t.bench.map(p=>sticker(p,t)).join('')}</div></details>`):''}${l.kind==='fantasy'&&[...t.players,...(t.bench||[])].some(p=>Number.isFinite(p.grade)||Number.isFinite(p.fantagrade)||p.events?.length)?fantasyVotes(t):''}${l.kind==='probable'&&(t.unavailable||[]).length?`<details class="lineup-unavailable"><summary>Indisponibili e in dubbio</summary>${t.unavailable.map(p=>`<p><strong>${esc(p.name)}</strong> · ${esc(p.status)}${p.note?'<small>'+esc(p.note)+'</small>':''}</p>`).join('')}</details>`:''}</section>`;}).join('')}</div><p class="lineup-source">${l.kind==='fantasy'?(l.complete?'Definitive':l.teams.some(t=>t.players.length)?'Formazioni consegnate':'In attesa delle formazioni'):l.kind==='official'?'Formazione confermata':['minutes-presence-v1','recent-form-v2','recent-form-v3'].includes(l.method)?'Presenza stimata':'Stima basata su '+(l.sourceCount||1)+' fonti'+((l.sourceCount||1)<5?' · copertura parziale':'')}${l.updatedAt?' · '+new Date(l.updatedAt).toLocaleString('it-IT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</p>${l.kind==='probable'?'<small class="lineup-method">Presenza stimata da minuti, titolarità e forma recente. Verde: formazione ufficiale.</small>':''}${l.kind==='probable'&&Number(l.accuracy?.validMatches)>=10&&Number.isFinite(l.accuracy?.accuracyPct)?'<p class="lineup-accuracy">Accuratezza degli 11: <strong>'+Number(l.accuracy.accuracyPct).toLocaleString('it-IT',{maximumFractionDigits:1})+'%</strong> · su '+Math.floor(l.accuracy.validMatches)+' partite</p>':''}</section>`;
}
export function bindLineupPitch(root){
 root._pitchCleanup?.();
 const slides=root.querySelector('.pitch-slides');if(!slides)return;
 const tabs=[...root.querySelectorAll('[data-pitch-tab]')],teams=[...root.querySelectorAll('.pitch-team')];let current=0,settleTimer=null,scrolling=false;
 const size=()=>{const team=teams[current];if(team)slides.style.height=Math.ceil(team.getBoundingClientRect().height)+'px';};
 const select=i=>{current=i;tabs.forEach((b,j)=>b.setAttribute('aria-selected',String(j===i)));};
 // Changing height while horizontal scrolling can reset the browser's snap target.
 const settled=()=>{clearTimeout(settleTimer);scrolling=false;size();};
 const scheduleSize=()=>{scrolling=true;clearTimeout(settleTimer);settleTimer=setTimeout(settled,140);};
 tabs.forEach((b,i)=>b.onclick=()=>{select(i);scheduleSize();slides.scrollTo({left:i*slides.clientWidth,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 slides.onscroll=()=>{select(Math.max(0,Math.min(teams.length-1,Math.round(slides.scrollLeft/slides.clientWidth))));scheduleSize();};
 slides.addEventListener?.('scrollend',settled);
 root.addEventListener('toggle',size,true);
 const filterRole=event=>{const button=event.target.closest?.('[data-lineup-role]'),panel=button?.closest('.lineup-bench');if(!panel)return;const role=button.dataset.lineupRole;panel.querySelectorAll('[data-lineup-role]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let visible=0;panel.querySelectorAll('[data-available-role]').forEach(card=>{card.hidden=role!=='all'&&card.dataset.availableRole!==role;if(!card.hidden)visible++;});const empty=panel.querySelector('[data-lineup-role-empty]');if(empty)empty.hidden=visible>0;size();};
 root.addEventListener('click',filterRole);
 const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!scrolling)size();});teams.forEach(t=>observer?.observe(t));
 const cleanup=()=>{clearTimeout(settleTimer);slides.onscroll=null;tabs.forEach(b=>b.onclick=null);slides.removeEventListener?.('scrollend',settled);observer?.disconnect();root.removeEventListener('toggle',size,true);root.removeEventListener('click',filterRole);root.removeEventListener('close',cleanup);};root._pitchCleanup=cleanup;root.addEventListener('close',cleanup,{once:true});size();
}

const grade=v=>Number.isFinite(v)?String(v):'s.v.';
function fantasyVotes(team){return '<details class="lineup-votes"><summary>Voti e bonus/malus</summary>'+[...team.players,...(team.bench||[])].map(p=>{const events=new Map();for(const e of p.events||[])events.set(e.label,(events.get(e.label)||0)+1);return '<div class="fantasy-player" data-fantasy-player="'+esc(p.id||'')+'"><span>'+esc(p.name)+(p.club?'<small class="fantasy-club">'+esc(p.club)+'</small>':'')+'<small class="fantasy-events" data-fantasy-events>'+[...events].map(([label,n])=>esc(label)+(n>1?' ×'+n:'')).join(' · ')+'</small></span><b data-fantasy-grade="list">'+grade(p.grade)+' / '+grade(p.fantagrade)+'</b></div>';}).join('')+'</details>';}
function fantasyPlayer(p){
 const labels={goals:'Gol',assists:'Assist',yellow:'Ammonizione',red:'Espulsione',penSaved:'Rigore parato',penMissed:'Rigore sbagliato',ownGoals:'Autogol',conceded:'Gol subiti'};
 const events=Array.isArray(p.events)?p.events:Object.entries(p.events||{}).flatMap(([kind,count])=>Number.isInteger(count)&&count>0?Array.from({length:Math.min(10,count)},()=>({label:labels[kind]||kind})):[]);
 return {...p,grade:p.grade??p.vote,fantagrade:p.fantagrade??p.fantavote,events,next:p.next||(p.opponent?{opponent:p.opponent,home:p.home}:undefined)};
}
export function renderFantasyLineup(details){return renderLineup({lineups:{kind:'fantasy',complete:details.complete,updatedAt:details.at,teams:details.teams.map(t=>({team:t.name,formation:t.formation,players:t.players.filter(p=>p.starter).map(fantasyPlayer),bench:t.players.filter(p=>!p.starter).map(fantasyPlayer)}))}});}
