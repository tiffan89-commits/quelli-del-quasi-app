import {quasiBanner} from './quasi-scene.mjs';

import {recapView} from './progression-ui.mjs';
import {rewardById} from './reward-catalog.mjs';

import { sourceOf, deadlineOf, isClosed } from './slip-state.mjs';
import {fantasyGroup} from './fantasy-accounts.mjs';
export function dashboardModel(league, uid, source='seriea', now=Date.now(), competition=null) {
  const fantasy=source==='fantacalcio', members=league.members||[];
  const group=fantasyGroup(league,competition);
  const totals=m=>fantasy?(group?.members||[]).find(t=>t.uid===m.uid)||{points:0,credits:0}:m;
  const mine=members.find(m=>m.uid===uid), own=mine?totals(mine):null, creditsAvailable=!fantasy||Number(group?.bookmakerCompetitions)>0;
  const rank=key=>own?1+members.filter(m=>Number(totals(m)[key]||0)>Number(own[key]||0)).length:null;
  const rounds=(league.rounds||[]).filter(r=>sourceOf(r)===source && (!fantasy||!competition||r.competitionKey===competition) && r.matches?.length);
  const upcoming=rounds.filter(r=>!isClosed(r,now)&&Number.isFinite(Date.parse(deadlineOf(r)))&&Date.parse(deadlineOf(r))>now).sort((a,b)=>Date.parse(deadlineOf(a))-Date.parse(deadlineOf(b)))[0];
  const startedAt=r=>{const dates=[Date.parse(r.kickoff),...(r.matches||[]).map(m=>Date.parse(m.kickoff))].filter(Number.isFinite);return dates.length?Math.min(...dates):NaN;};
  const complete=r=>r.settled||(r.matches||[]).every(m=>m.void||m.status==='FT'&&Array.isArray(m.score)&&m.score.length===2);
  const latest=list=>list.filter(r=>Number.isFinite(startedAt(r))&&startedAt(r)<=now).sort((a,b)=>startedAt(b)-startedAt(a))[0];
  const serieACurrent=latest((league.rounds||[]).filter(r=>sourceOf(r)==='seriea'&&r.matches?.length));
  const serieAActive=serieACurrent&&!complete(serieACurrent)?serieACurrent:null;
  const ownCurrent=latest(rounds),ownActive=ownCurrent&&!complete(ownCurrent)?ownCurrent:null;
  const active=fantasy&&serieAActive?(rounds.find(r=>r.serieARound===serieAActive.number)||ownActive||serieAActive):ownActive;
  return {pointsRank:rank('points'),creditsRank:creditsAvailable?rank('credits'):null,creditsAvailable,points:own?.points||0,credits:own?.credits||0,memberCount:members.length,lastRound:latest(rounds.filter(complete))||null,round:active||upcoming||null,active:!!active,deadline:active?null:upcoming?deadlineOf(upcoming):null};
}
export function countdownLabel(deadline,now=Date.now()) {
  const diff=Date.parse(deadline)-now;
  if(!Number.isFinite(diff)) return 'In attesa';
  if(diff<=0) return 'Tempo scaduto';
  const mins=Math.ceil(diff/60000),days=Math.floor(mins/1440),hours=Math.floor(mins%1440/60),minutes=mins%60;
  return days?`${days}g ${hours}h ${minutes}m`:`${hours}h ${String(minutes).padStart(2,'0')}m`;
}
export function leagueDashboard(league,user,source,fantasyAvailable,esc,fmt,competition=null) {
  if(source==='fantacalcio'&&!fantasyAvailable)source='seriea';
  const competitions=[...new Map((league.rounds||[]).filter(r=>sourceOf(r)==='fantacalcio').map(r=>[r.competitionKey,r.competitionName||'Fantalega'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'it'));
  if(!competitions.some(([key])=>key===competition))competition=competitions[0]?.[0]||null;
  const d=dashboardModel(league,user.id,source,Date.now(),source==='fantacalcio'?competition:null),title=rewardById(user.avatar?.rewardTitle);
  const selector=source==='fantacalcio'?'<label class="field dashboard-competition">Il tuo campo di gioco<select id="dashboard-competition" aria-label="Scegli Fantalega">'+competitions.map(([key,name])=>{const next=dashboardModel(league,user.id,source,Date.now(),key).round;return '<option value="'+esc(key)+'" '+(key===competition?'selected':'')+'>'+esc(name+(next?' · '+next.title:''))+'</option>';}).join('')+'</select></label>':'';
  const alerts=(league.notifications||[]).slice(-3).map(a=>{let round='';try{round=new URL(a.url,'https://quellidelquasi.com').searchParams.get('round')||'';}catch{}return '<aside class="league-alert" role="status"><span><strong>'+esc(a.title)+'</strong>'+esc(a.body)+'</span><button data-dashboard-slip="'+esc(round)+'">Apri ↗</button></aside>';}).join('');
  const slipLabel=d.active?'Segui in diretta':d.round?(d.round.slip?'Rivedi la schedina':'Compila la schedina'):'Vai alle schedine';
  const stats=`<div class="dash-numbers"><button data-dashboard-rank="points"><span>Punti</span><strong>${fmt(d.points)}</strong><small>${d.pointsRank?d.pointsRank+'° in classifica':'—'}</small></button><button data-dashboard-rank="credits" ${d.creditsAvailable?'':'disabled'}><span>Crediti</span><strong>${d.creditsAvailable?fmt(d.credits):'—'}</strong><small>${d.creditsRank?d.creditsRank+'° in classifica':'Solo punti'}</small></button><button data-dashboard-rank="points"><span>Al bancone</span><strong>${d.memberCount}</strong><small>partecipanti</small></button></div>`;
  return alerts+`<section class="league-dashboard home-sections" aria-label="La tua dashboard" data-selected-competition="${esc(competition||'')}"><div class="dash-hero">${quasiBanner(user.avatar,user.name)}<div class="dash-hero-copy"><span class="eyebrow">${esc(league.name)}</span><h1>Ciao, ${esc(user.name)}.</h1><p>${title?esc(title.name):'Le certezze passano. Il bar resta.'}</p>${stats}</div></div><div class="dash-next home-card"><div class="dash-next-copy"><span class="eyebrow">LA TUA PROSSIMA MOSSA</span><h2>${d.round?esc(d.round.title):'La prossima sfida arriva.'}</h2><p>${d.round?(source==='fantacalcio'?esc(d.round.competitionName||'La tua Fantalega'):d.active?'Segui i risultati della giornata.':'Scegli gli esiti prima della chiusura.'):'Intanto, prendi posto.'}</p></div><div class="dash-clock dashboard-countdown"><span>${d.active?'Giornata in corso':'Alla chiusura'}</span><strong data-dashboard-countdown ${d.deadline?`data-deadline="${esc(d.deadline)}"`:''}>${d.active?'In corso':countdownLabel(d.deadline)}</strong></div><button class="secondary dash-cta" data-dashboard-slip="${esc(d.round?.id||'')}">${slipLabel} <span aria-hidden="true">→</span></button></div>${fantasyAvailable?`<div class="dashboard-sources" aria-label="Riepilogo competizione"><button data-dashboard-source="seriea" aria-pressed="${source==='seriea'}">Campionato</button><button data-dashboard-source="fantacalcio" aria-pressed="${source==='fantacalcio'}">Fantacalcio</button></div>`:''}${selector}${recapView(league,source,competition,d.lastRound,esc,fmt)}</section>`;
}
