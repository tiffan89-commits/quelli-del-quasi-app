import {hasEntered,fantasyGradeText,hasPitchPerformance,pitchPerformance} from './pitch-events.mjs';
import {roundPresenceEstimate} from './fanta/presence-probability.mjs';
import {canonicalPitchRows,partialPitchRows,recoverOfficialPitchLayout,normalizePitchLayout} from './pitch-layout.mjs';
import {playerDisplayName,playerSurname,playerJersey,pitchFixture} from './player-label.mjs';
import {shirtBack} from './fanta/maglie-portieri.mjs';
import {sameClub} from './fanta/maglie.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formationRows(team,{allowVacancies=false}={}){
 return (canonicalPitchRows(team)||(allowVacancies?partialPitchRows(team):null))?.reverse()||null;
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
 const started=(!team.fantasy&&!!team.started)||hasPitchPerformance(p);
 const probability=!started&&Number.isFinite(p.probability)&&p.probability>=0&&p.probability<=100?(p.probabilityKind==='official'?p.probability:roundPresenceEstimate(p.probability)):null;
 const club=!started&&!team.fantasy&&p.club&&!sameClub(p.club,team.team)?'<small class="pitch-player-club">'+esc(p.club)+'</small>':'';
 const kit=team.fantasy?{vs:p.next?.opponent??p.opponent,home:p.next?.home??p.home}:team.kit;
 return `<div class="pitch-player" ${available?`data-available-role="${availablePlayerRole(p)}"`:''} data-fantasy-player="${esc(p.id||'')}"><div class="player-sticker">${shirtBack(p.club||team.team,playerJersey(p),shirtSurname(p),{goalkeeper:isGoalkeeper(p,team),nameSize:6.2,...kit})}</div>${bench?`<span class="bench-player-surname" aria-hidden="true">${esc(shirtSurname(p))}</span>`:''}${probability!==null?`<span class="player-probability ${p.probabilityKind==='official'?'':'estimated'}" title="${p.probabilityKind==='official'?'Probabilità effettiva':'Probabilità stimata'}">${probability}%</span>`:''}<span class="pitch-player-name sr-only">${esc(playerDisplayName(p))}</span>${started?'':pitchFixture(p)}${club}${pitchPerformance(p,started)}</div>`;
}
function benchSections(t,kind){
 const entered=t.started?(t.bench||[]).filter(hasEntered):[],rest=(t.bench||[]).filter(p=>!entered.includes(p));
 const incoming=entered.length?'<details class="lineup-bench lineup-substitutes" open><summary>Subentrati · '+entered.length+'</summary><div class="bench-stickers">'+entered.map(p=>sticker(p,t)).join('')+'</div></details>':'';
 if(!rest.length)return incoming;
 return incoming+(kind==='probable'&&!t.started?availablePlayers({...t,bench:rest}):'<details class="lineup-bench"><summary>A disposizione · '+rest.length+'</summary><div class="bench-stickers">'+rest.map(p=>sticker(p,t)).join('')+'</div></details>');
}
function pitchField(t,kind){
 const rows=formationRows(t,{allowVacancies:kind==='probable'});
 if(!rows)return `<div class="lineup-sticker-list">${t.players.length?t.players.map(p=>sticker(p,t)).join(''):'<p class="muted">Formazione non ancora salvata.</p>'}</div>`;
 return `<div class="football-pitch"><div class="pitch-marks" aria-hidden="true"></div><div class="pitch-rows" style="--pitch-lines:${rows.length}">${rows.map(row=>`<div class="pitch-row${row.length>=5?' row-5':''}" style="--players:${row.length}">${row.map(p=>p?sticker(p,t):'<span class="pitch-vacancy">Da definire</span>').join('')}</div>`).join('')}</div></div>`;
}

function benchPage(t,kind,label){
 const bench=t.bench||[],players=t.started?[...bench.filter(hasEntered),...bench.filter(p=>!hasEntered(p))]:bench;
 const filter=kind==='probable'&&!t.started&&players.length>0;
 const roles=[...AVAILABLE_ROLES,...(players.some(p=>availablePlayerRole(p)==='other')?[['other','Altri']]:[])];
 return `<div class="pitch-bench-room lineup-bench"><div class="bench-room-label"><b>${label}</b><span>${players.length} giocatori</span></div>${filter?`<div class="lineup-role-tabs" role="group" aria-label="Filtra la panchina per ruolo">${roles.map(([role,label])=>`<button type="button" data-lineup-role="${role}" aria-pressed="${role==='all'}">${label}</button>`).join('')}</div>`:''}<div class="bench-stickers" style="--bench-rows:${Math.max(1,Math.ceil(players.length/5))};--bench-rows-short:${Math.max(1,Math.ceil(players.length/7))}">${players.map(p=>sticker(p,t,filter,true)).join('')}</div><p class="lineup-role-empty muted" data-lineup-role-empty ${players.length?'hidden':''}>${players.length?'Nessun giocatore disponibile in questo ruolo.':'Panchina non disponibile.'}</p></div>`;
}

function pitchExtras(t,kind){
 if(kind==='fantasy'&&[...t.players,...(t.bench||[])].some(p=>Number.isFinite(p.grade)||Number.isFinite(p.fantagrade)||p.events?.length))return fantasyVotes(t);
 if(kind==='probable'&&t.unavailable?.length)return `<details class="lineup-unavailable"><summary>Indisponibili e in dubbio</summary>${t.unavailable.map(p=>`<p><strong>${esc(p.name)}</strong> · ${esc(p.status)}${p.probability===0?' · 0%':''}${p.note?'<small>'+esc(p.note)+'</small>':''}</p>`).join('')}</details>`;
 return '';
}

export function matchAvailability(data){
 if(!['NS','TBD','PST',''].includes(data.status||'')||data.lineups?.started)return '';
 const sections=(data.lineups?.teams||[]).map(team=>{
  const players=(team.unavailable||[]).filter(p=>p.name);
  if(!players.length)return '';
  return `<section><h4>${esc(team.team)}</h4>${players.map(p=>`<div class="match-availability-row"><strong>${esc(playerSurname(p))}</strong><span>${esc(p.status||'Indisponibile')}${p.probability===0?' · 0%':''}</span></div>`).join('')}</section>`;
 }).join('');
 return sections?`<section class="match-availability"><h3>Indisponibili e in dubbio</h3>${sections}</section>`:'';
}

export const PITCH_FLIP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a9 9 0 0 1 15-5l3 3m0-5v5h-5M21 14a9 9 0 0 1-15 5l-3-3m0 5v-5h5"/></svg>';

export function renderPitchFlip(front,back,label='Panchina',flipped=false){
 return `<div class="pitch-flip-card${flipped?' is-flipped':''}">
      <div class="pitch-flip-face pitch-flip-front" ${flipped?'inert ':''}aria-hidden="${flipped}">${front}</div>
      <div class="pitch-flip-face pitch-flip-back" ${flipped?'':'inert '}aria-hidden="${!flipped}">${back}</div>
      <button type="button" class="pitch-flip-button" data-pitch-flip="${label}" aria-pressed="${flipped}">
        ${PITCH_FLIP_ICON}
        <span>${flipped?'Titolari':label}</span>
      </button>
    </div>`;
}

export function setPitchFlip(button,bench){
 const card=button.closest('.pitch-flip-card'),front=card.querySelector('.pitch-flip-front'),back=card.querySelector('.pitch-flip-back');
 card.classList.toggle('is-flipped',bench);
 front.toggleAttribute('inert',bench);
 front.setAttribute('aria-hidden',String(bench));
 back.toggleAttribute('inert',!bench);
 back.setAttribute('aria-hidden',String(!bench));
 button.setAttribute('aria-pressed',String(bench));
 button.querySelector('span').textContent=bench?(button.dataset.pitchBackLabel||'Titolari'):button.dataset.pitchFlip;
}

function pagedLineup(l,title,notes,details,detailsAvailable,showExtras=true){
 const teams=l.teams.map((team,i)=>{
  const benchLabel=l.kind==='probable'&&!team.started?'A disposizione':'Panchina';
  return `<section class="pitch-team" data-pitch-team="${i}" aria-label="Formazione ${esc(team.team)}">
    <div class="pitch-heading"><strong>${esc(team.team)}</strong><span>${esc(team.formation||'')}</span></div>
    ${renderPitchFlip(pitchField(team,l.kind),benchPage(team,l.kind,benchLabel),benchLabel)}
  </section>`;
 }).join('')||'<section class="pitch-team pitch-empty"><p class="muted">Formazioni non ancora disponibili.</p></section>';
 return `<section class="lineup-section lineup-paged">${title?`<h3>${title}</h3>`:''}
   ${l.teams.length?`<div class="pitch-tabs" role="tablist" aria-label="Squadra da visualizzare">${l.teams.map((t,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-pitch-tab="${i}">${esc(t.team)}</button>`).join('')}</div>`:''}
   <div class="pitch-slides" aria-label="Titolari, panchine e dettagli">${teams}${details!==null?`<section class="pitch-details-panel" aria-label="Dettagli della partita" ${detailsAvailable?'':'hidden'}>${details}</section>`:''}</div>
   ${details!==null||!showExtras?'':l.teams.map((t,i)=>`<div data-pitch-extras="${i}" ${i?'hidden':''}>${pitchExtras(t,l.kind)}</div>`).join('')}${notes}
 </section>`;
}

export function renderLineup(data,{paged=false,details=null,detailsAvailable=true,showExtras=true}={}){
 const source=recoverOfficialPitchLayout(data.lineups,data.details?.sourceLineups),started=['1H','HT','2H','LIVE','FT','AET','PEN','ET'].includes(data.status)||source?.started;
 const homeTeam=data.home??source?.teams[0]?.team,awayTeam=data.away??source?.teams[1]?.team;
 const l=source?{...source,teams:source.teams.map((t,i)=>{
  const home=sameClub(t.team,homeTeam)||(!sameClub(t.team,awayTeam)&&i===0);
  return {...t,fantasy:source.kind==='fantasy',started:started||t.started,kit:{home,vs:home?awayTeam:homeTeam}};
 })}:null;
 if(!l)return paged&&details!==null?pagedLineup({teams:[]},'','',details,detailsAvailable):'<section class="card"><h3>Probabili formazioni</h3><p class="muted">Formazioni non ancora disponibili.</p></section>';
 const title=l.kind==='fantasy'?'Le formazioni':l.kind==='official'?'Formazioni ufficiali':'Probabili formazioni';
 const notes=`<p class="lineup-source">${l.kind==='fantasy'?(l.complete?'Definitive':l.teams.some(t=>t.players.length)?'Formazioni consegnate':'In attesa delle formazioni'):l.kind==='official'?'Formazione confermata':['minutes-presence-v1','recent-form-v2','recent-form-v3'].includes(l.method)?'Presenza stimata':'Stima basata su '+(l.sourceCount||1)+' fonti'+((l.sourceCount||1)<5?' · copertura parziale':'')}${l.updatedAt?' · '+new Date(l.updatedAt).toLocaleString('it-IT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</p>${l.kind==='probable'?'<small class="lineup-method">Presenza stimata da minuti, titolarità e forma recente. Verde: formazione ufficiale.</small>':''}${l.kind==='probable'&&Number(l.accuracy?.validMatches)>=10&&Number.isFinite(l.accuracy?.accuracyPct)?'<p class="lineup-accuracy">Accuratezza degli 11: <strong>'+Number(l.accuracy.accuracyPct).toLocaleString('it-IT',{maximumFractionDigits:1})+'%</strong> · su '+Math.floor(l.accuracy.validMatches)+' partite</p>':''}`;
 if(paged)return pagedLineup(l,details!==null&&l.kind==='official'?'':title,notes,details,detailsAvailable,showExtras);
 return `<section class="lineup-section"><h3>${title}</h3><div class="pitch-tabs" role="tablist" aria-label="Formazione da visualizzare">${l.teams.map((t,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-pitch-tab="${i}">${esc(t.team)}</button>`).join('')}</div><div class="pitch-slides">${l.teams.map(t=>`<section class="pitch-team" aria-label="Formazione ${esc(t.team)}"><div class="pitch-heading"><strong>${esc(t.team)}</strong><span>${esc(t.formation||'')}</span></div>${pitchField(t,l.kind)}${benchSections(t,l.kind)}${pitchExtras(t,l.kind)}</section>`).join('')}</div>${notes}</section>`;
}
export function bindLineupPitch(root,{onPage,autoHeight=true}={}){
 root._pitchCleanup?.();
 const slides=root.querySelector('.pitch-slides');if(!slides)return;
 const tabs=[...root.querySelectorAll('[data-pitch-tab]')],teams=[...root.querySelectorAll('.pitch-team')];
 const paged=!!slides.closest('.lineup-paged'),flips=[...root.querySelectorAll('[data-pitch-flip]')],extras=[...root.querySelectorAll('[data-pitch-extras]')];
 const details=paged?slides.querySelector('.pitch-details-panel'):null;
 const last=()=>teams.length-1+(details&&!details.hidden?1:0);
 let current=paged?Math.min(root._pitchPage||0,last()):0,settleTimer=null,scrolling=false;
 if(!teams.length)return;
 const flipped=paged?(root._pitchFlips??=new Set()):null;
 const size=()=>{const team=teams[Math.min(current,teams.length-1)];if(autoHeight&&team)slides.style.height=Math.ceil(team.getBoundingClientRect().height)+'px';};
 const fit=()=>{const page=root.closest?.('#match-page-root');if(!page||!slides.clientWidth||!Number.isFinite(globalThis.window?.innerHeight))return;const pitch=slides.querySelector('.football-pitch');if(!pitch&&!paged)return;
  if(paged){
   const nav=page.ownerDocument.querySelector('nav.v2-tabbar'),navRect=nav?.getBoundingClientRect();
   const bottom=navRect?.top>window.innerHeight/2?navRect.top:window.innerHeight;
   const reserved=[...page.querySelectorAll('.lineup-accuracy,:scope>details.match-statistics>summary,[data-pitch-extras]:not([hidden]) details>summary, :scope>details.card>summary')]
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
  extras.forEach((el,j)=>{el.hidden=j!==team;});
  onPage?.(i>=teams.length,i);
 };
 // Changing height while horizontal scrolling can reset the browser's snap target.
 const settled=()=>{
  clearTimeout(settleTimer);scrolling=false;
  if(paged)fit();size();
 };
 const scheduleSize=()=>{scrolling=true;clearTimeout(settleTimer);settleTimer=setTimeout(settled,140);};
 const go=i=>{const target=Math.max(0,Math.min(i,last()));if(!details)select(target);scheduleSize();slides.scrollTo({left:target*slides.clientWidth,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
 tabs.forEach(b=>b.onclick=()=>go(Number(b.dataset.pitchTab)));
 flips.forEach(button=>{
  const i=Number(button.closest('[data-pitch-team]').dataset.pitchTeam);
  const paint=()=>setPitchFlip(button,flipped.has(i));
  button.onclick=()=>{if(flipped.has(i))flipped.delete(i);else flipped.add(i);paint();};
  paint();
 });
 slides.onscroll=()=>{
  const width=slides.clientWidth;
  if(!width)return;
  select(Math.max(0,Math.min(last(),Math.round(slides.scrollLeft/width))));
  scheduleSize();
 };
 slides.addEventListener?.('scrollend',settled);
 root.addEventListener('toggle',size,true);
 const filterRole=event=>{const button=event.target.closest?.('[data-lineup-role]'),panel=button?.closest('.lineup-bench');if(!panel)return;const role=button.dataset.lineupRole;panel.querySelectorAll('[data-lineup-role]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let visible=0;panel.querySelectorAll('[data-available-role]').forEach(card=>{card.hidden=role!=='all'&&card.dataset.availableRole!==role;if(!card.hidden)visible++;});const empty=panel.querySelector('[data-lineup-role-empty]');if(empty)empty.hidden=visible>0;if(paged){const grid=panel.querySelector('.bench-stickers');grid?.style.setProperty('--bench-rows',Math.max(1,Math.ceil(visible/5)));grid?.style.setProperty('--bench-rows-short',Math.max(1,Math.ceil(visible/7)));}size();};
 root.addEventListener('click',filterRole);
 const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!scrolling)size();});teams.forEach(t=>observer?.observe(t));
 const cleanup=()=>{clearTimeout(settleTimer);slides.onscroll=null;[...tabs,...flips].forEach(b=>b.onclick=null);slides.removeEventListener?.('scrollend',settled);observer?.disconnect();root.removeEventListener('toggle',size,true);root.removeEventListener('click',filterRole);root.removeEventListener('close',cleanup);globalThis.window?.removeEventListener?.('resize',fit);};root._pitchCleanup=cleanup;root.addEventListener('close',cleanup,{once:true});globalThis.window?.addEventListener?.('resize',fit);select(current);fit();size();if(paged&&current)slides.scrollLeft=current*slides.clientWidth;
 return {go,teamCount:teams.length};
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
