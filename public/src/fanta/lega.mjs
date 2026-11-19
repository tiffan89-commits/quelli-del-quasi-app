import {fantaLeagueFallback,leagueWorkspace} from '../league-workspace.mjs';
import {presidentOperationButtons,presidentWorkspace} from '../president-workspace.mjs';
import {backButton} from '../back-navigation.mjs';
import {leagueIdentityForm} from '../league-identity-form.mjs';
import {leagueName} from '../league-theme.mjs';
// Pagina "Lega": classifica completa, calendario, asta (stato, ingresso e comandi dell'admin),
// regolamento, partecipanti con invito (massimo 12). Funzioni pure: dati di GET /fanta-api/league → HTML.
import { esc, pts, dayTime, OUTCOME, extremeClass } from './formato.mjs';
import {teamLogo} from './team-logo.mjs';
import {fitTeamName} from './team-name.mjs';
import {renderCompetitionManagement,renderCompetitions} from './competitions-ui.mjs';
import {auctionWhen} from './auction-wizard.mjs';

export const LEGA_GROUPS={classifica:['classifica','calendario','schedine'],lega:['asta','regole','competizioni']};
export const groupOf=sub=>LEGA_GROUPS.classifica.includes(sub)?'classifica':'lega';
const SUBS = [['classifica', 'Classifica'], ['calendario', 'Calendario'],['schedine','Classifica schedine'], ['asta', 'Asta'], ['regole', 'Regolamento'],['competizioni','Competizioni']];
const MODE = { live: 'Online, a turni con timer', manual: 'Dal vivo, a voce con banditore' };

const formDots = form => `<span class="fanta-form is-small">${form.map(f => `<i class="is-${f}" title="${OUTCOME[f]}">${f}</i>`).join('')}</span>`;

function standings(l) {
  if(l.competition?.kind==='groups'&&l.groups?.length)return l.groups.map(g=>`<h2 class="fanta-group-title">Girone ${esc(g.id)}</h2>${standings({...l,competition:{kind:'league'},standings:g.standings})}`).join('')+calendar(l,{});
  if(l.competition?.kind==='knockout')return calendar(l,{});
  return `<section class="fanta-block is-first">
    ${l.standingsProvisional?'<p class="fanta-note">Punteggi in aggiornamento</p>':''}
    <div class="fanta-table-scroll" role="region" aria-label="Classifica completa, scorri per tutte le statistiche" tabindex="0"><table class="fanta-table fanta-table-full">
      <thead><tr><th scope="col">#</th><th scope="col">Squadra</th><th scope="col" title="Partite giocate">PG</th><th scope="col" title="Vittorie">V</th><th scope="col" title="Pareggi">N</th><th scope="col" title="Sconfitte">S</th><th scope="col" title="Gol fatti">GF</th><th scope="col" title="Gol subiti">GS</th><th scope="col">Pt</th><th scope="col" title="Fantapunti totali">FP</th></tr></thead>
      <tbody>${l.standings.map(s => `<tr${s.team.id === l.members.find(m => m.isMe)?.team.id ? ' class="is-me"' : ''}>
        <td>${s.position}</td>
        <td><div class="fanta-team-identity">${teamLogo(s.team)}<div class="fanta-team-copy"><button type="button" class="fanta-team-name" data-team-roster="${esc(s.team.id)}">${fitTeamName(s.team.name)}</button><small>${esc(s.team.manager)} · ${formDots(s.form)}</small></div></div></td>
        <td>${s.played??0}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td>${s.goalsFor??0}</td><td>${s.goalsAgainst??0}</td>
        <td><strong >${s.points}</strong></td><td><strong class="score-cell ${extremeClass(l.standings,'fantapoints',s.fantapoints)}">${pts(s.fantapoints)}</strong></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="fanta-note">${esc(l.rules.table)} V = vittorie · N = pareggi · S = sconfitte · GF/GS = gol fatti/subiti · FP = fantapunti totali. Scorri di lato per tutte le colonne.</p>
  </section>`;
}

function calendar(l, ui) {
  const {current}=l.calendar;
  const rounds=[...l.calendar.rounds].sort((a,b)=>a.number-b.number);
  const open=ui.openRound??rounds.find(round=>round.number===current&&round.state!=='calcolata')?.number;
  return `<section class="fanta-block is-first">
    <p class="fanta-note">Giornata ${l.calendar.current} di ${l.calendar.last}. Tocca una sfida per vedere formazioni e voti.</p>
    <div class="fanta-cal">${rounds.map(r => {
      const label = { calcolata: 'Calcolata', 'in-corso': 'In corso', 'schierata': 'Si gioca', 'da-schierare': 'Si gioca', futura: 'Da giocare' }[r.state];
      const isOpen = r.number === open;
      return `<div class="fanta-cal-round${isOpen ? ' is-open' : ''}${r.number === current ? ' is-current' : ''}">
        <button type="button" class="fanta-cal-head" data-lega-round="${r.number}" aria-expanded="${isOpen}">
          <b>${esc(r.label||'Giornata '+r.number)}</b><span class="fanta-cal-state is-${r.state}">${label}</span><i aria-hidden="true">${isOpen ? '▴' : '▾'}</i></button>
        ${isOpen ? `<ul>${r.matchups.map(m => {
          const played = m.home.goals != null;
          const row = `<span class="fanta-cal-team${m.home.team.id === l.members.find(x => x.isMe)?.team.id ? ' is-me' : ''}">${teamLogo(m.home.team)}${fitTeamName(m.home.team.name)}</span>
            <span class="fanta-cal-score">${played ? `<strong>${m.home.goals}–${m.away.goals}</strong><small>${pts(m.home.points)} · ${pts(m.away.points)}</small>` : '<small>vs</small>'}</span>
            <span class="fanta-cal-team is-away${m.away.team.id === l.members.find(x => x.isMe)?.team.id ? ' is-me' : ''}">${fitTeamName(m.away.team.name)}${teamLogo(m.away.team)}</span>`;
          return r.state === 'futura'
            ? `<li class="fanta-cal-match${m.isMine ? ' is-mine' : ''}">${row}</li>`
            : `<li><button type="button" class="fanta-cal-match${m.isMine ? ' is-mine' : ''}" data-go="giornata" data-round="${r.number}" data-mu="${esc(m.id)}">${row}</button></li>`;
        }).join('')}</ul>${r.byes?.length?`<p class="fanta-note">Passano il turno: ${r.byes.map(t=>esc(t.name)).join(', ')}</p>`:''}` : ''}
      </div>`;
    }).join('')}</div>
  </section>`;
}

export function auctionSection(l) {
  const a=l.auction;
  const title=a.status==='scheduled'?'Asta programmata':a.status==='running'?'Asta in corso':a.status==='ended'?'Asta conclusa':'Nessuna asta in programma';
  return `<section class="fanta-block is-first fanta-league-auction"><div class="fanta-lg-card card"><h2>${title}</h2>
    ${a.status==='scheduled'?`<p>${esc(auctionWhen(a.startsAt))} · ${MODE[a.mode]}</p>`:''}
    ${['running','scheduled','ended'].includes(a.status)?'<button type="button" class="primary" data-go="asta">Entra nella sala →</button>':''}
  </div></section>`;
}
function rules(l) {
  const r = l.rules;
  return `<section class="fanta-block is-first fanta-rules">
    <h3>Bonus e malus</h3>
    <ul class="fanta-rule-list">${r.scoring.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
    <h3>Il voto</h3><p>Il voto statistico considera la prestazione, il contesto della gara e il piazzamento nel rating. Bonus e malus compongono il fantavoto.</p>
    <section class="fanta-rating-rules"><h3>Migliori e peggiori in campo</h3><p>Vale un solo contributo: quello più alto in valore assoluto tra partita e squadra. A pari rating si condivide il piazzamento; senza rating non si applica alcun contributo.</p><div class="fanta-table-scroll"><table class="rule-table"><thead><tr><th>Piazzamento</th><th>Migliori partita</th><th>Migliori squadra</th><th>Peggiori partita</th><th>Peggiori squadra · sconfitta</th><th>Peggiori squadra · vittoria/pareggio</th></tr></thead><tbody><tr><td>1°</td><td>+0,5</td><td>+0,3</td><td>-0,5</td><td>-0,3</td><td>-0,1</td></tr><tr><td>2°</td><td>+0,3</td><td>+0,18</td><td>-0,3</td><td>-0,18</td><td>-0,06</td></tr><tr><td>3°</td><td>+0,1</td><td>+0,06</td><td>-0,1</td><td>-0,06</td><td>-0,02</td></tr><tr><td>4°</td><td>+0,05</td><td>+0,03</td><td>-0,05</td><td>-0,03</td><td>-0,01</td></tr></tbody></table></div><p>Nel live il confronto è provvisorio. Un gol mantiene almeno la sufficienza; un rigore parato mantiene almeno 6,5.</p></section>
    <h3>Modificatore difesa</h3><p>${esc(r.modifier.rule)}</p>
    <ul class="fanta-rule-list">${r.modifier.bands.map(([k, v]) => `<li><span>Media ${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
    <h3>Dai punti ai gol</h3><p>${esc(r.goals)}</p>
    <h3>Formazione</h3>
    <ul class="fanta-rule-list"><li><span>Moduli</span><b>${r.lineup.formations.join(' · ')}</b></li></ul>
    <p>${esc(r.lineup.bench)}. ${esc(r.lineup.subs)} ${esc(r.lineup.missing)}</p>
    <h3>Classifica</h3><p>${esc(r.table)}</p>
  </section>`;
}

function teamAssociations(l,ui){
 return `<form class="fanta-lg-form" data-team-link-form><label>Squadra<select name="team">${l.members.map(m=>`<option value="${esc(m.team.id)}">${esc(m.team.name)}</option>`).join('')}</select></label><label>Email o vecchio username del giocatore<input name="username" required maxlength="254" autocapitalize="none" autocorrect="off" autocomplete="off"></label><button type="submit" class="primary">Associa account</button>${ui.linkError?`<p class="fanta-note is-alert" role="alert">${esc(ui.linkError)}</p>`:''}</form>`;
}

export function renderLega(l, ui = {}, now = Date.now()) {
  if (!l) return '<div class="fanta-loading" role="status">Carichiamo la lega…</div>';
  const pilot=l.league.kind==='pilot',group=ui.group||'classifica';
  if(group==='lega')return leagueWorkspace({id:l.league.id,mode:'fanta',fallback:fantaLeagueFallback(l,ui.bar||ui.invite,ui.viewer)});
  if(group==='competizioni'&&ui.adminTool&&l.isAdmin)return presidentWorkspace({tool:ui.adminTool,body:renderCompetitionManagement(l,ui.adminTool),back:ui.adminBack});
  if(group==='regolamento'||group==='competizioni'){
   const title=group==='regolamento'?'Regolamento del Fanta':'Competizioni';
   return `<header class="participants-heading" data-os-header>${backButton('data-go="lega"','Torna alla lega')}<h1>${title}</h1></header>
   <div data-os-content>${group==='regolamento'?rules(l):renderCompetitions(l)}</div>`;
  }
  const tabs=SUBS.filter(([k])=>LEGA_GROUPS[group].includes(k)&&(!pilot||k!=='competizioni')),sub=tabs.some(([k])=>k===ui.sub)?ui.sub:tabs[0][0];
  const body = { classifica: standings, calendario: calendar, asta: auctionSection, regole: rules, competizioni:renderCompetitions,schedine:()=>ui.slipsHtml||'<p>Classifica schedine in arrivo.</p>' }[sub](l, ui, now);
  return `<div class="fanta-lega">
    <header class="fanta-sq-head" data-os-header><span class="eyebrow">${esc(l.league.season)} · Lega da ${l.league.maxMembers} partecipanti</span><h1 data-league-heading>${esc(leagueName(ui.identity||l.league))}</h1>${l.competition&&l.competition.name!==l.league.name?`<p>${esc(l.competition.name)}</p>`:''}</header>
    <div class="v2-chips fanta-lg-tabs" data-os-header role="tablist">${tabs.map(([k, label]) => `<button type="button" role="tab" class="v2-chip${sub === k ? ' is-active' : ''}" data-lega-sub="${k}" aria-selected="${sub === k}">${label}${k === 'asta' && l.auction.status === 'running' ? ' <i class="fanta-lg-live"></i>' : ''}</button>`).join('')}</div>
    <div data-os-content${sub==='calendario'?' data-os-flow class="fanta-calendar-scroll"':''}>
    ${body}

    </div>
  </div>`;
}

export function renderFantaPresident(l,ui={}){
 if(!l)return '<div class="fanta-loading" role="status">Caricamento…</div>';
 if(!l.isAdmin)return renderLega(l,{...ui,group:'lega'});
 const tool=ui.adminTool;
 const bodies={
  ...(ui.identity?{identita:()=>leagueIdentityForm(ui.identity,{standalone:true})}:{}),
  associa:()=>teamAssociations(l,ui),
  rose:()=>'<nav class="president-operation-list" aria-label="Squadre">'+l.members.map(m=>'<button type="button" class="secondary president-operation" data-team-roster="'+esc(m.team.id)+'">'+esc(m.team.name)+'<span aria-hidden="true">›</span></button>').join('')+'</nav>',
  importazione:()=>l.importReview?.length?'<ul class="fanta-rule-list">'+l.importReview.map(p=>'<li><span>'+esc(p.team)+(p.name?' · '+esc(p.name):'')+'</span><small>'+esc(p.issue)+'</small></li>').join('')+'</ul>':'<p>Nessuna rosa importata da controllare.</p>',
  rimuovi:()=>leagueWorkspace({id:l.league.id,mode:'fanta',view:'manage'}),
 };
 const selected=Object.hasOwn(bodies,tool)?tool:null;
 return presidentWorkspace({tool:selected,body:selected?bodies[selected]():'',buttons:presidentOperationButtons({mode:'fanta',fanta:l.league,hasTrades:ui.hasTrades,hasIdentity:!!ui.identity}),
  back:selected?ui.adminBack:'data-go="lega"'});
}
