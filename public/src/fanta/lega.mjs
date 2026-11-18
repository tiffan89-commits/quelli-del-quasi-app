import {hubHead,hubTile} from '../league-hub.mjs';
import {leagueActions} from '../league-actions.mjs';
import {presidentPanel} from '../president-panel.mjs';
// Pagina "Lega": classifica completa, calendario, asta (stato, ingresso e comandi dell'admin),
// regolamento, partecipanti con invito (massimo 12). Funzioni pure: dati di GET /fanta-api/league → HTML.
import { esc, pts, dayTime, OUTCOME, extremeClass, resultsFirst } from './formato.mjs';
import {teamLogo} from './team-logo.mjs';
import {renderCompetitions} from './competitions-ui.mjs';
import {whatsappInvite} from '../league-invite.mjs';
import {renderLeagueInvite} from './league-invite.mjs';
import {auctionWhen} from './auction-wizard.mjs';

export const LEGA_GROUPS={classifica:['classifica','calendario','schedine'],lega:['asta','regole','partecipanti','competizioni']};
export const groupOf=sub=>LEGA_GROUPS.classifica.includes(sub)?'classifica':'lega';
const SUBS = [['classifica', 'Classifica'], ['calendario', 'Calendario'],['schedine','Classifica schedine'], ['asta', 'Asta'], ['regole', 'Regolamento'], ['partecipanti', 'Partecipanti'],['competizioni','Competizioni']];
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
        <td><div class="fanta-team-identity">${teamLogo(s.team)}<div class="fanta-team-copy"><button type="button" class="fanta-team-name" data-team-roster="${esc(s.team.id)}">${esc(s.team.name)}</button><small>${esc(s.team.manager)} · ${formDots(s.form)}</small></div></div></td>
        <td>${s.played??0}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td>${s.goalsFor??0}</td><td>${s.goalsAgainst??0}</td>
        <td><strong >${s.points}</strong></td><td><strong class="score-cell ${extremeClass(l.standings,'fantapoints',s.fantapoints)}">${pts(s.fantapoints)}</strong></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="fanta-note">${esc(l.rules.table)} V = vittorie · N = pareggi · S = sconfitte · GF/GS = gol fatti/subiti · FP = fantapunti totali. Scorri di lato per tutte le colonne.</p>
  </section>`;
}

function calendar(l, ui) {
  const rounds=resultsFirst(l.calendar.rounds,l.calendar.current),open=ui.openRound??rounds[0]?.number;
  return `<section class="fanta-block is-first">
    <p class="fanta-note">Giornata ${l.calendar.current} di ${l.calendar.last}. Tocca una sfida per vedere formazioni e voti.</p>
    <div class="fanta-cal">${rounds.map(r => {
      const label = { calcolata: 'Calcolata', 'in-corso': 'In corso', 'schierata': 'Si gioca', 'da-schierare': 'Si gioca', futura: 'Da giocare' }[r.state];
      const isOpen = r.number === open;
      return `<div class="fanta-cal-round${isOpen ? ' is-open' : ''}${r.number === l.calendar.current ? ' is-current' : ''}">
        <button type="button" class="fanta-cal-head" data-lega-round="${r.number}" aria-expanded="${isOpen}">
          <b>${esc(r.label||'Giornata '+r.number)}</b><span class="fanta-cal-state is-${r.state}">${label}</span><i aria-hidden="true">${isOpen ? '▴' : '▾'}</i></button>
        ${isOpen ? `<ul>${r.matchups.map(m => {
          const played = m.home.goals != null;
          const row = `<span class="fanta-cal-team${m.home.team.id === l.members.find(x => x.isMe)?.team.id ? ' is-me' : ''}">${teamLogo(m.home.team)}${esc(m.home.team.name)}</span>
            <span class="fanta-cal-score">${played ? `<strong>${m.home.goals}–${m.away.goals}</strong><small>${pts(m.home.points)} · ${pts(m.away.points)}</small>` : '<small>vs</small>'}</span>
            <span class="fanta-cal-team is-away${m.away.team.id === l.members.find(x => x.isMe)?.team.id ? ' is-me' : ''}">${esc(m.away.team.name)}${teamLogo(m.away.team)}</span>`;
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

function members(l, ui) {
  const pilot=l.league.kind==='pilot',n=l.members.filter(m=>m.human).length,max=l.league.maxMembers,full=n>=max;
  return `<section class="fanta-block is-first">
    <div class="fanta-lg-count"><strong>${n}<small>/${max}</small></strong><span>${pilot?'allenatori':'partecipanti'}${full ? ' · lega al completo' : ` · ${max - n} posti liberi`}</span>
      <i class="fanta-lg-bar"><i style="width:${n / max * 100}%"></i></i></div>
    <ul class="fanta-lg-members">${l.members.map(m => `<li>
      ${teamLogo(m.team)}
      <span class="fanta-p-name"><button type="button" class="fanta-team-name" data-team-roster="${esc(m.team.id)}">${esc(m.team.name)}</button>${m.isMe ? ' <em class="is-me">tu</em>' : ''}${m.isAdmin ? ' <em>admin</em>' : ''}<small>${m.human?esc(m.team.manager):'<em class="computer-label">Computer</em>'} · dal ${esc(new Date(m.joinedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }))}</small></span>
    </li>`).join('')}</ul>
    ${l.isAdmin&&ui.adminTools&&!pilot&&l.league.kind!=='random'?`<details class="fanta-block"><summary>Associa squadre e giocatori</summary><form class="fanta-lg-form" data-team-link-form><label>Squadra<select name="team">${l.members.map(m=>`<option value="${esc(m.team.id)}">${esc(m.team.name)}</option>`).join('')}</select></label><label>Email o vecchio username del giocatore<input name="username" required maxlength="254" autocapitalize="none" autocorrect="off" autocomplete="off"></label><button type="submit" class="primary">Associa account</button>${ui.linkError?`<p class="fanta-note is-alert" role="alert">${esc(ui.linkError)}</p>`:''}</form></details>`:''}
    ${full ? `<p class="fanta-note">La lega è al completo: ${max} partecipanti.</p>` : `<p class="fanta-note">${max-n} squadre sono guidate dal computer finché non entrano amici.</p>`}
  </section>${ui.inSettings?renderLeagueInvite(l.league,ui.invite,{copied:ui.copied,always:true}):''}`;
}

export function renderLega(l, ui = {}, now = Date.now()) {
  if (!l) return '<div class="fanta-loading" role="status">Carichiamo la lega…</div>';
  const pilot=l.league.kind==='pilot',group=ui.group||'classifica';
  if(group==='lega'){
    const name=l.league.name.replace(/^Random League/i,'Lega pilota'),count=l.members.filter(m=>m.human).length;
    const tiles=[
      l.isAdmin?hubTile('gear','Pannello del presidente','Impostazioni della lega',{action:'data-go="presidente"',admin:true,arrow:true}):'',
      hubTile('people','Partecipanti · '+count,'Chi allena le squadre',{html:members(l,{...ui,adminTools:l.isAdmin,invite:null})}),
      hubTile('rules','Regolamento del Fanta','Bonus, malus e formazioni',{html:rules(l)}),
      !pilot?hubTile('competition','Competizioni','Campionati e coppe',{html:renderCompetitions(l,{...ui,adminTools:l.isAdmin})}):'',
      !pilot&&(l.isAdmin||['running','scheduled'].includes(l.auction.status))?hubTile('auction','Asta',l.auction.status==='running'?'In corso':l.auction.status==='scheduled'?'Programmata':l.isAdmin?'Gestisci le aste':'Apri la sala',{arrow:true,action:l.isAdmin?'data-auction-manage="1"':'data-go="asta"'}):'',
      l.isAdmin&&ui.directInvite?hubTile('invite','Invita per nickname o email','Invito diretto',{action:`data-league-direct-invite="${esc(ui.directInvite)}"`}):'',
      ui.invite?.code?hubTile('invite','Invita nella tua lega','Condividi l’invito',{action:'data-lega-invite="share"',whatsapp:whatsappInvite(ui.invite,esc,{iconOnly:true})}):'',
      ui.hasTrades?hubTile('trade','Scambi','Proposte tra squadre',{action:'data-go="scambi"',arrow:true}):'',
      ui.hasChat?hubTile('chat','Chiacchiere da bar','Apri la chat della lega',{action:'data-fanta-chat aria-controls="league-chat-widget"'}):'',
    ];
    return hubHead(name,count+' / '+l.league.maxMembers+' allenatori')+'<div data-os-content><div class="lega-hub">'+tiles.join('')+'</div>'+leagueActions({bridge:true})+'</div>';
  }
  const tabs=SUBS.filter(([k])=>LEGA_GROUPS[group].includes(k)&&(!pilot||k!=='competizioni')),sub=tabs.some(([k])=>k===ui.sub)?ui.sub:tabs[0][0];
  const body = { classifica: standings, calendario: calendar, asta: auctionSection, regole: rules, partecipanti: members,competizioni:renderCompetitions,schedine:()=>ui.slipsHtml||'<p>Classifica schedine in arrivo.</p>' }[sub](l, ui, now);
  return `<div class="fanta-lega">
    <header class="fanta-sq-head" data-os-header><span class="eyebrow">${esc(l.league.season)} · Lega da ${l.league.maxMembers} partecipanti</span><h1>${esc(l.league.name.replace(/^Random League/i,'Lega pilota'))}</h1>${l.competition&&l.competition.name!==l.league.name?`<p>${esc(l.competition.name)}</p>`:''}</header>
    <div class="v2-chips fanta-lg-tabs" data-os-header role="tablist">${tabs.map(([k, label]) => `<button type="button" role="tab" class="v2-chip${sub === k ? ' is-active' : ''}" data-lega-sub="${k}" aria-selected="${sub === k}">${label}${k === 'asta' && l.auction.status === 'running' ? ' <i class="fanta-lg-live"></i>' : ''}</button>`).join('')}</div>
    <div data-os-content>
    ${body}
    ${group==='lega'?leagueActions({bridge:true}):''}
    ${l.isAdmin && l.importReview?.length ? `<details class="fanta-block"><summary>Import · ${l.importReview.length} elementi da controllare</summary><ul class="fanta-rule-list">${l.importReview.map(p=>`<li><span>${esc(p.team)}${p.name?' · '+esc(p.name):''}${p.round?' · Giornata '+p.round:''}</span><small>${esc(p.issue)}</small></li>`).join('')}</ul></details>` : ''}
    </div>
  </div>`;
}

export function fantaPresidentTasks(l,invite,{hasTrades=false,directInvite=null}={}){
 if(!l?.isAdmin)return [];
 const tasks=[],free=l.league.maxMembers-(l.members?l.members.filter(m=>m.human).length:l.league.humanMembers??l.league.maxMembers);
 if(l.league.kind!=='pilot')tasks.push({action:'Gestisci asta',auction:true,button:true});
 if(hasTrades)tasks.push({action:'Gestisci scambi',trades:true,button:true});
 if(directInvite)tasks.push({action:'Invita per nickname o email',directInvite,button:true});
 if(free>0&&invite?.code)tasks.push({action:'Invita',button:true,share:true,whatsapp:whatsappInvite(invite,esc,{iconOnly:true})});
 tasks.push({group:'persone',action:'Partecipanti ›'});
 if(l.competition?.status==='draft')tasks.push({text:'Competizione da avviare',group:'competizioni',action:'Verifica'});
 return tasks;
}
export function renderFantaPresident(l,ui={},now=Date.now()){
 if(!l)return '<div class="fanta-loading" role="status">Carichiamo il pannello…</div>';
 if(!l.isAdmin)return renderLega(l,{...ui,group:'lega'});
 const bar=ui.bar;
 return presidentPanel({mode:'fanta',title:'Pannello del presidente',back:'data-go="lega"',open:ui.presidentGroup,tasks:fantaPresidentTasks(l,ui.invite,{hasTrades:ui.hasTrades,directInvite:!ui.demo&&bar?.id}),groups:{
 regole:{summary:l.rules.budget+' crediti · bonus, malus e formazione',html:rules(l)},
 ...(l.isAdmin?{
 identita:{summary:bar?'Colori e simbolo condivisi con il Bar':'Identità della lega',html:bar?'<p>Il simbolo, il colore e il motto sono comuni a Bar e Fanta.</p><button type="button" class="secondary" data-mode="bar" data-bar-page="admin">Modifica identità nel Bar</button>':'<p>Lo stemma della tua squadra si modifica dalla pagina Oggi.</p>'}
 }:{}),

 ...(l.isAdmin&&bar?.admin===ui.me?.id&&!ui.demo?{elimina:{summary:'Bar, Fanta e storico',html:'<button type="button" class="secondary league-delete-action" data-mode="bar" data-bar-page="admin" data-president-group="elimina">Apri conferma di eliminazione</button>'}}:{})
 }});
}
