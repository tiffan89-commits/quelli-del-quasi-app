import {hasEntered,fantasyGradeText,hasPitchPerformance,pitchPerformance} from './pitch-events.mjs';
import {roundPresenceEstimate} from './fanta/presence-probability.mjs';
import {canonicalPitchRows,recoverOfficialPitchLayout,normalizePitchLayout} from './pitch-layout.mjs';
import {playerSurname,playerJersey,pitchFixture} from './player-label.mjs';
import {shirtBack} from './fanta/maglie-portieri.mjs';
import {sameClub} from './fanta/maglie.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formationRows(team){
 return canonicalPitchRows(team)?.reverse()||null;
}
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
function sticker(p,team,available=false,bench=false){
 const started=!!team.started||hasPitchPerformance(p);
 const probability=!started&&Number.isFinite(p.probability)&&p.probability>=0&&p.probability<=100?(p.probabilityKind==='official'?p.probability:roundPresenceEstimate(p.probability)):null;
 const club=!started&&!team.fantasy&&p.club&&!sameClub(p.club,team.team)?'<small class="pitch-player-club">'+esc(p.club)+'</small>':'';
 const kit=team.fantasy?{vs:p.next?.opponent??p.opponent,home:p.next?.home??p.home}:team.kit;
 return `<div class="pitch-player" ${available?`data-available-role="${availablePlayerRole(p)}"`:''} data-fantasy-player="${esc(p.id||'')}"><div class="player-sticker">${shirtBack(p.club||team.team,playerJersey(p),shirtSurname(p),{goalkeeper:isGoalkeeper(p,team),nameSize:6.2,...kit})}</div>${bench?`<span class="bench-player-surname" aria-hidden="true">${esc(shirtSurname(p))}</span>`:''}${probability!==null?`<span class="player-probability ${p.probabilityKind==='official'?'':'estimated'}" title="${p.probabilityKind==='official'?'Probabilità effettiva':'Probabilità stimata'}">${probability}%</span>`:''}<span class="pitch-player-name sr-only">${esc(p.name)}</span>${started?'':pitchFixture(p)}${club}${pitchPerformance(p,started)}</div>`;
}
function benchSections(t,kind){
 const entered=t.started?(t.bench||[]).filter(hasEntered):[],rest=(t.bench||[]).filter(p=>!entered.includes(p));
 const incoming=entered.length?'<details class="lineup-bench lineup-substitutes" open><summary>Subentrati · '+entered.length+'</summary><div class="bench-stickers">'+entered.map(p=>sticker(p,t)).join('')+'</div></details>':'';
 if(!rest.length)return incoming;
 return incoming+(kind==='probable'&&!t.started?availablePlayers({...t,bench:rest}):'<details class="lineup-bench"><summary>A disposizione · '+rest.length+'</summary><div class="bench-stickers">'+rest.map(p=>sticker(p,t)).join('')+'</div></details>');
}
function pitchField(t){
 const rows=formationRows(t);
 if(!rows)return `<div class="lineup-sticker-list">${t.players.length?t.players.map(p=>sticker(p,t)).join(''):'<p class="muted">Formazione non ancora salvata.</p>'}</div>`;
 return `<div class="football-pitch"><div class="pitch-marks" aria-hidden="true"></div><div class="pitch-rows" style="--pitch-lines:${rows.length}">${rows.map(row=>`<div class="pitch-row${row.length>=5?' row-5':''}" style="--players:${row.length}">${row.map(p=>sticker(p,t)).join('')}</div>`).join('')}</div></div>`;
}

function benchPage(t,kind){
 const bench=t.bench||[],players=t.started?[...bench.filter(hasEntered),...bench.filter(p=>!hasEntered(p))]:bench;
 const filter=kind==='probable'&&!t.started&&players.length>0;
 const roles=[...AVAILABLE_ROLES,...(players.some(p=>availablePlayerRole(p)==='other')?[['other','Altri']]:[])];
 return `<div class="pitch-bench-room lineup-bench"><div class="bench-room-label"><b>Panchina</b><span>${players.length} a disposizione</span></div>${filter?`<div class="lineup-role-tabs" role="group" aria-label="Filtra la panchina per ruolo">${roles.map(([role,label])=>`<button type="button" data-lineup-role="${role}" aria-pressed="${role==='all'}">${label}</button>`).join('')}</div>`:''}<div class="bench-stickers" style="--bench-rows:${Math.max(1,Math.ceil(players.length/5))};--bench-rows-short:${Math.max(1,Math.ceil(players.length/7))}">${players.map(p=>sticker(p,t,filter,true)).join('')}</div><p class="lineup-role-empty muted" data-lineup-role-empty ${players.length?'hidden':''}>${players.length?'Nessun giocatore disponibile in questo ruolo.':'Panchina non disponibile.'}</p></div>`;
}

function pitchExtras(t,kind){
 if(kind==='fantasy'&&[...t.players,...(t.bench||[])].some(p=>Number.isFinite(p.grade)||Number.isFinite(p.fantagrade)||p.events?.length))return fantasyVotes(t);
 if(kind==='probable'&&t.unavailable?.length)return `<details class="lineup-unavailable"><summary>Indisponibili e in dubbio</summary>${t.unavailable.map(p=>`<p><strong>${esc(p.name)}</strong> · ${esc(p.status)}${p.note?'<small>'+esc(p.note)+'</small>':''}</p>`).join('')}</details>`;
 return '';
}

function pagedLineup(l,title,notes,swipeDetails){
 const panes=l.teams.flatMap((team,index)=>[{team,index,bench:false},{team,index,bench:true}]);
 return `<section class="lineup-section lineup-paged">${title?`<h3>${title}</h3>`:''}<div class="pitch-tabs" role="tablist" aria-label="Squadra da visualizzare">${l.teams.map((t,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-pitch-tab="${i*2}">${esc(t.team)}</button>`).join('')}</div><div class="pitch-slides" aria-label="Titolari e panchine">${panes.map(({team,index,bench})=>`<section class="pitch-team ${bench?'pitch-bench-page':'pitch-starters-page'}" data-pitch-team="${index}" aria-label="${bench?'Panchina':'Titolari'} ${esc(team.team)}">${bench?benchPage(team,l.kind):`<div class="pitch-heading"><strong>${esc(team.team)}</strong><span>${esc(team.formation||'')}</span></div>${pitchField(team)}`}</section>`).join('')}${swipeDetails?'<div class="pitch-details-edge" aria-hidden="true"></div>':''}</div><div class="pitch-page-buttons" aria-label="Pagine della formazione">${panes.map(({team,bench},i)=>`<button type="button" data-pitch-page="${i}" aria-label="${bench?'Panchina':'Titolari'} ${esc(team.team)}" ${i===0?'aria-current="step"':''}>${bench?'Panchina':'Titolari'}</button>`).join('')}</div>${l.teams.map((t,i)=>`<div data-pitch-extras="${i}" ${i?'hidden':''}>${pitchExtras(t,l.kind)}</div>`).join('')}${notes}</section>`;
}

export function renderLineup(data,{paged=false,swipeDetails=false}={}){
 const source=recoverOfficialPitchLayout(data.lineups,data.details?.sourceLineups),started=['1H','HT','2H','LIVE','FT','AET','PEN','ET'].includes(data.status)||source?.started;
 const homeTeam=data.home??source?.teams[0]?.team,awayTeam=data.away??source?.teams[1]?.team;
 const l=source?{...source,teams:source.teams.map((t,i)=>{
  const home=sameClub(t.team,homeTeam)||(!sameClub(t.team,awayTeam)&&i===0);
  return {...t,fantasy:source.kind==='fantasy',started:started||t.started,kit:{home,vs:home?awayTeam:homeTeam}};
 })}:null;
 if(!l)return '<section class="card"><h3>Probabili formazioni</h3><p class="muted">Formazioni non ancora disponibili.</p></section>';
 const title=l.kind==='fantasy'?'Le formazioni':l.kind==='official'?'Formazioni ufficiali':'Probabili formazioni';
 const notes=`<p class="lineup-source">${l.kind==='fantasy'?(l.complete?'Definitive':l.teams.some(t=>t.players.length)?'Formazioni consegnate':'In attesa delle formazioni'):l.kind==='official'?'Formazione confermata':['minutes-presence-v1','recent-form-v2','recent-form-v3'].includes(l.method)?'Presenza stimata':'Stima basata su '+(l.sourceCount||1)+' fonti'+((l.sourceCount||1)<5?' · copertura parziale':'')}${l.updatedAt?' · '+new Date(l.updatedAt).toLocaleString('it-IT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</p>${l.kind==='probable'?'<small class="lineup-method">Presenza stimata da minuti, titolarità e forma recente. Verde: formazione ufficiale.</small>':''}${l.kind==='probable'&&Number(l.accuracy?.validMatches)>=10&&Number.isFinite(l.accuracy?.accuracyPct)?'<p class="lineup-accuracy">Accuratezza degli 11: <strong>'+Number(l.accuracy.accuracyPct).toLocaleString('it-IT',{maximumFractionDigits:1})+'%</strong> · su '+Math.floor(l.accuracy.validMatches)+' partite</p>':''}`;
 if(paged)return pagedLineup(l,swipeDetails&&l.kind==='official'?'':title,notes,swipeDetails);
 return `<section class="lineup-section"><h3>${title}</h3><div class="pitch-tabs" role="tablist" aria-label="Formazione da visualizzare">${l.teams.map((t,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-pitch-tab="${i}">${esc(t.team)}</button>`).join('')}</div><div class="pitch-slides">${l.teams.map(t=>`<section class="pitch-team" aria-label="Formazione ${esc(t.team)}"><div class="pitch-heading"><strong>${esc(t.team)}</strong><span>${esc(t.formation||'')}</span></div>${pitchField(t)}${benchSections(t,l.kind)}${pitchExtras(t,l.kind)}</section>`).join('')}</div>${notes}</section>`;
}
export function bindLineupPitch(root,{onDetails}={}){
 root._pitchCleanup?.();
 const slides=root.querySelector('.pitch-slides');if(!slides)return;
 const tabs=[...root.querySelectorAll('[data-pitch-tab]')],teams=[...root.querySelectorAll('.pitch-team')];
 const paged=!!slides.closest('.lineup-paged'),links=[...root.querySelectorAll('[data-pitch-page]')],extras=[...root.querySelectorAll('[data-pitch-extras]')];
 let current=paged?Math.min(root._pitchPage||0,teams.length-1):0,settleTimer=null,scrolling=false;
 const size=()=>{const team=teams[current];if(team)slides.style.height=Math.ceil(team.getBoundingClientRect().height)+'px';};
 const fit=()=>{const page=root.closest?.('#match-page-root');if(!page||!slides.clientWidth||!Number.isFinite(globalThis.window?.innerHeight))return;const pitch=slides.querySelector('.football-pitch');if(!pitch&&!paged)return;
  if(paged){
   const nav=page.ownerDocument.querySelector('nav.v2-tabbar'),navRect=nav?.getBoundingClientRect();
   const bottom=navRect?.top>window.innerHeight/2?navRect.top:window.innerHeight;
   const reserved=[...page.querySelectorAll('.pitch-page-buttons,.lineup-accuracy,:scope>details.match-statistics>summary,[data-pitch-extras]:not([hidden]) details>summary, :scope>details.card>summary')]
    .reduce((sum,el)=>sum+(el.getBoundingClientRect().height?el.getBoundingClientRect().height+16:0),0);
   const height=Math.max(142,Math.floor(bottom-slides.getBoundingClientRect().top-(globalThis.scrollY||0)-reserved-32));
   page.style.setProperty('--match-pitch-height',height+'px');return;
  }
  const nav=document.querySelector('nav.v2-tabbar'),fixed=nav&&getComputedStyle(nav).position==='fixed',bottom=fixed?nav.getBoundingClientRect().height:0;
  const top=pitch.getBoundingClientRect().top+(globalThis.scrollY||0),height=Math.max(240,Math.floor(window.innerHeight-bottom-top-8));
  page.style.setProperty('--match-pitch-height',height+'px');size();};
 const select=i=>{
  current=i;
  if(paged)root._pitchPage=i;
  const team=paged?Number(teams[i]?.dataset.pitchTeam):i;
  tabs.forEach((b,j)=>b.setAttribute('aria-selected',String(j===team)));
  links.forEach(b=>{if(Number(b.dataset.pitchPage)===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  extras.forEach((el,j)=>{el.hidden=j!==team;});
 };
 // Changing height while horizontal scrolling can reset the browser's snap target.
 const settled=()=>{
  clearTimeout(settleTimer);scrolling=false;
  const width=slides.clientWidth;
  if(onDetails&&width&&slides.scrollLeft>=teams.length*width-2){
   slides.scrollLeft=(teams.length-1)*width;
   onDetails();
   return;
  }
  if(paged)fit();size();
 };
 const scheduleSize=()=>{scrolling=true;clearTimeout(settleTimer);settleTimer=setTimeout(settled,140);};
 const go=i=>{select(i);scheduleSize();slides.scrollTo({left:i*slides.clientWidth,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
 tabs.forEach(b=>b.onclick=()=>go(Number(b.dataset.pitchTab)));
 links.forEach(b=>b.onclick=()=>go(Number(b.dataset.pitchPage)));
 slides.onscroll=()=>{if(!slides.clientWidth)return;select(Math.max(0,Math.min(teams.length-1,Math.round(slides.scrollLeft/slides.clientWidth))));scheduleSize();};
 slides.addEventListener?.('scrollend',settled);
 root.addEventListener('toggle',size,true);
 const filterRole=event=>{const button=event.target.closest?.('[data-lineup-role]'),panel=button?.closest('.lineup-bench');if(!panel)return;const role=button.dataset.lineupRole;panel.querySelectorAll('[data-lineup-role]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let visible=0;panel.querySelectorAll('[data-available-role]').forEach(card=>{card.hidden=role!=='all'&&card.dataset.availableRole!==role;if(!card.hidden)visible++;});const empty=panel.querySelector('[data-lineup-role-empty]');if(empty)empty.hidden=visible>0;if(paged){const grid=panel.querySelector('.bench-stickers');grid?.style.setProperty('--bench-rows',Math.max(1,Math.ceil(visible/5)));grid?.style.setProperty('--bench-rows-short',Math.max(1,Math.ceil(visible/7)));}size();};
 root.addEventListener('click',filterRole);
 const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!scrolling)size();});teams.forEach(t=>observer?.observe(t));
 const cleanup=()=>{clearTimeout(settleTimer);slides.onscroll=null;[...tabs,...links].forEach(b=>b.onclick=null);slides.removeEventListener?.('scrollend',settled);observer?.disconnect();root.removeEventListener('toggle',size,true);root.removeEventListener('click',filterRole);root.removeEventListener('close',cleanup);globalThis.window?.removeEventListener?.('resize',fit);};root._pitchCleanup=cleanup;root.addEventListener('close',cleanup,{once:true});globalThis.window?.addEventListener?.('resize',fit);select(current);fit();size();if(paged&&current)slides.scrollLeft=current*slides.clientWidth;
}

const grade=v=>Number.isFinite(v)?String(v):'s.v.';
function fantasyVotes(team){return '<details class="lineup-votes"><summary>Voti e bonus/malus</summary>'+[...team.players,...(team.bench||[])].map(p=>{const events=new Map();for(const e of p.events||[])events.set(e.label,(events.get(e.label)||0)+1);return '<div class="fantasy-player" data-fantasy-player="'+esc(p.id||'')+'"><span>'+esc(p.name)+(p.club?'<small class="fantasy-club">'+esc(p.club)+'</small>':'')+'<small class="fantasy-events" data-fantasy-events>'+[...events].map(([label,n])=>esc(label)+(n>1?' ×'+n:'')).join(' · ')+'</small></span><b data-fantasy-grade="list">'+fantasyGradeText(p)+'</b></div>';}).join('')+'</details>';}
function fantasyPlayer(p){
 const labels={goals:'Gol',assists:'Assist',yellow:'Ammonizione',red:'Espulsione',penSaved:'Rigore parato',penMissed:'Rigore sbagliato',ownGoals:'Autogol',conceded:'Gol subiti'};
 const events=Array.isArray(p.events)?p.events:Object.entries(p.events||{}).flatMap(([kind,count])=>Number.isInteger(count)&&count>0?Array.from({length:Math.min(10,count)},()=>({label:labels[kind]||kind})):[]);
 return {...p,grade:p.grade??p.vote,fantagrade:p.fantagrade??p.fantavote,events};
}
export function fantasyPitchTeam(t){
 const players=t.players.filter(p=>p.starter).map(fantasyPlayer).map(({grid,...p})=>p),counts=String(t.formation||'').split('-').map(Number),roles=['P','D','C','A'];
 const ordered=counts.length===3&&players.length===11&&roles.every((r,i)=>players.filter(p=>availablePlayerRole(p)===r).length===(i?counts[i-1]:1))?roles.flatMap(r=>players.filter(p=>availablePlayerRole(p)===r)):players;
 return normalizePitchLayout({team:t.name,formation:t.formation,players:ordered,bench:t.players.filter(p=>!p.starter).map(fantasyPlayer)});
}
export function renderFantasyLineup(details,options){return renderLineup({lineups:{kind:'fantasy',started:details.started||details.complete,complete:details.complete,updatedAt:details.at,teams:details.teams.map(fantasyPitchTeam)}},options);}
