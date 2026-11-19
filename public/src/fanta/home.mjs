import {extremeClass} from './formato.mjs';
import {renderLeagueInvite} from './league-invite.mjs';
// Home del Fanta ("Oggi"): squadra, prossima mossa, sfida della giornata, ultimo risultato, classifica.
// Funzione pura: riceve la risposta di api.home() e restituisce HTML. Nessun accesso a rete o stato globale.
import { esc, pts, countdown, dayTime, timeAgo, OUTCOME } from './formato.mjs';

const formDots = form => `<span class="fanta-form" aria-label="Ultime ${form.length}: ${form.map(f => OUTCOME[f]).join(', ')}">${
  form.map(f => `<i class="is-${f}">${f}</i>`).join('')}</span>`;

export function homeTeam(h){
 const id=h?.me?.teamId;
 return [h?.match?.home,h?.match?.away,...(h?.standings||[]).map(s=>s.team)].find(t=>t?.id===id)||{id,name:h?.me?.teamName||'La tua squadra',branding:h?.me?.branding||{}};
}

function heroBalances(balances){
 if(!balances||!Number.isFinite(balances.slip)&&!Number.isFinite(balances.auction))return '';
 return `<div class="fanta-hero-balances">${Number.isFinite(balances.slip)?`<span><b>${pts(balances.slip)}</b> crediti schedina</span>`:''}${Number.isFinite(balances.auction)?`<span><b data-fanta-hero-auction-credits>${pts(balances.auction)}</b> crediti asta</span>`:''}</div>`;
}

function hero(h) {
  const { league, me } = h;
  const team=homeTeam(h);
  return `<section class="fanta-hero" aria-labelledby="fanta-team">
    <div class="fanta-hero-pitch" aria-hidden="true"></div>
    <span class="eyebrow">${esc(String(league.name||'La tua lega').replace(/^Random League/i,'Lega pilota'))} · ${esc(league.season)}</span>
    <div class="fanta-hero-identity">
      <button type="button" class="fanta-hero-crest" data-action="edit-logo" aria-label="Modifica il logo di ${esc(team.name)}">${teamLogo(team,{eager:true})}<span class="fanta-crest-edit" aria-hidden="true">✎</span></button>
      <div class="fanta-hero-copy"><h1 id="fanta-team">${esc(me.teamName)}</h1><p class="fanta-hero-manager">${esc(me.manager)}</p></div>
    </div>
    <dl class="fanta-hero-stats">
      <div><dt>Posizione</dt><dd>${me.position}<sup>°</sup></dd></div>
      <div><dt>Punti</dt><dd>${me.points}</dd></div>
      <div><dt>Fantapunti</dt><dd>${pts(me.fantapoints)}</dd></div>
    </dl>
    ${heroBalances(h.balances)}
    ${me.form?.length?'<div class="fanta-hero-form"><small>Ultime cinque</small>'+formDots(me.form)+'</div>':''}
  </section>`;
}

function nextMove(h, now) {
  const round=h.nextLineup?{number:h.nextLineup.round,state:h.nextLineup.savedAt?'schierata':'da-schierare',deadline:h.nextLineup.deadline}:h.round;
  const lineup=h.nextLineup||h.lineup;
  if (!h.nextLineup && (round.state==='in-corso' || (h.lastResult && round.state==='calcolata'))) return '';
  const left = countdown(round.deadline, now);
  const clock = label => left ? `<div class="dash-clock"><span>${label}</span><strong data-countdown="${esc(round.deadline)}">${left}</strong></div>` : '';
  const variants = {
    'da-schierare': {
      title: `Giornata ${round.number}`,
      text: 'Schiera la formazione prima della scadenza.',
      side: clock('Chiude tra'),
      cta: `<button type="button" class="primary dash-cta" data-go="formazione">Schiera la formazione <span aria-hidden="true">→</span></button>`,
    },
    'schierata': {
      title: h.nextLineup ? `Formazione pronta · Giornata ${round.number}` : 'Formazione pronta',
      text: `Salvata ${timeAgo(lineup.savedAt, now)}.`,
      side: clock('Chiude tra'),
      cta: `<button type="button" class="secondary dash-cta" data-go="formazione">Modifica la formazione <span aria-hidden="true">→</span></button>`,
    },
    'calcolata': {
      title: `Giornata ${round.number} chiusa`,
      text: 'Voti ufficiali e punteggi definitivi. Guarda chi ti ha fatto vincere, voto per voto.',
      side: '',
      cta: `<button type="button" class="primary dash-cta" data-go="giornata" data-round="${round.number}">Vedi voti e bonus <span aria-hidden="true">→</span></button>`,
    },
  };
  const v = variants[round.state] || variants['da-schierare'];
  return `<section class="dash-next fanta-next home-card" aria-labelledby="fanta-next-title">
    <div><span class="eyebrow">La tua prossima mossa</span><h2 id="fanta-next-title">${v.title}</h2><p>${v.text}</p></div>
    ${v.side}${h.openingLineup?v.cta.replace('<button ','<button disabled aria-busy="true" ').replace(/(Schiera|Modifica) la formazione/,'Apriamo la formazione…'):v.cta}
  </section>`;
}

function barLink(h) {
  const bar=h.bar;
  return bar?.saved?`<button type="button" class="fanta-bar-link secondary dash-cta" data-mode="bar" data-bar-page="schedina" data-bar-league="${esc(bar.league)}" data-bar-round="${esc(bar.round)}" data-bar-match="${esc(bar.match)}"><b>Segui la schedina</b><span aria-hidden="true">→</span></button>`:'';
}

function matchCard(h) {
  const { match, round } = h;
  if (!match) return round.state==='in-corso'
    ? `<section class="home-card"><button type="button" class="fanta-result fanta-last-result" data-go="giornata" data-round="${round.number}"><span><b>Live</b><small>Giornata ${round.number}</small></span><span aria-hidden="true">→</span></button>${barLink(h)}</section>`
    : '';
  const live=round.state==='in-corso',title=match.final?'Ultima partita':live?'Live':'Prossima partita';
  const status=match.final||live?'':dayTime(round.firstKickoff);
  const scores=match.final||match.live;
  const total=Number.isFinite(scores?.home?.goals)&&Number.isFinite(scores?.away?.goals)
    ? `${scores.home.goals}–${scores.away.goals}` : h.bar?.score?.length===2&&h.bar.score.every(Number.isFinite) ? h.bar.score.join('–') : '–';
  const count=key=>scores?.[key]?.withVote??scores?.[key]?.played;
  const side=key=>`<span class="fanta-vs-team">${teamLogo(match[key])}<b>${esc(match[key].name)}</b>${
    Number.isFinite(scores?.[key]?.points)?`<small>${pts(scores[key].points)} FP${!match.final&&Number.isInteger(count(key))?' · '+count(key)+'/'+(match.live.of||11)+' a voto':''}</small>`:''}</span>`;
  return `<section class="fanta-block fanta-home-match home-card" aria-labelledby="fanta-match-title">
    <button type="button" class="fanta-match-link" data-go="giornata" data-round="${round.number}" data-mu="${esc(match.id||match.matchupId||h.bar?.matchup||'')}" aria-label="${title}, giornata ${round.number}. Apri lo Studio Live">
      <span class="fanta-home-match-head"><b id="fanta-match-title">${title}</b><small>Giornata ${round.number}${status?' · '+esc(status):''}</small><span aria-hidden="true">→</span></span>
      <span class="fanta-vs">${side('home')}<strong class="fanta-home-score">${total}</strong>${side('away')}</span>
    </button>
    ${barLink(h)}
  </section>`;
}

function lastResult(h) {
  const r = h.lastResult;
  if (!r) return '';
  return `<button type="button" class="fanta-result fanta-last-result home-card" data-go="giornata" data-round="${r.round}" data-mu="${esc(r.matchupId||'')}">
    <span><b>Ultima partita</b><small>Giornata ${r.round} · ${esc(r.home.name)} – ${esc(r.away.name)}</small></span>
    <strong>${r.home.goals}–${r.away.goals}</strong><span aria-hidden="true">→</span>
  </button>`;
}

function standings(h) {
  return `<section class="fanta-block" aria-labelledby="fanta-table-title">
    <div class="dash-section-head"><div><h2 id="fanta-table-title">Classifica</h2><small>dopo ${h.standings[0]?.played ?? 0} giornate</small></div>
      <button type="button" class="fanta-link" data-tab="classifica" data-lega-open="classifica">Completa <span aria-hidden="true">→</span></button></div>
    <table class="fanta-table">
      <thead><tr><th scope="col"><span class="sr-only">Posizione</span>#</th><th scope="col">Squadra</th><th scope="col" title="Partite giocate">PG</th><th scope="col">Pt</th><th scope="col">FP</th></tr></thead>
      <tbody>${h.standings.map(s => `<tr${s.team.id === h.me.teamId ? ' class="is-me"' : ''}>
        <td>${s.position}</td>
        <td><span class="fanta-dot" style="background:${esc(s.team.color)}"></span><b>${esc(s.team.name)}</b><small>${esc(s.team.manager)}</small></td>
        <td>${s.played??0}</td><td><strong >${s.points}</strong></td><td><strong class="score-cell ${extremeClass(h.standings,'fantapoints',s.fantapoints)}">${pts(s.fantapoints)}</strong></td>
      </tr>`).join('')}</tbody>
    </table>
  </section>`;
}

// Quando l'asta è aperta è la cosa più urgente: un invito in cima, sopra la squadra.
export function auctionCard(h, now) {
  const a = h.auction;
  if (!a) return '';
  if (a.status === 'running') {
    return `<button type="button" class="fanta-auction-card" data-go="asta">
      <span class="fanta-live">${a.mode === 'manual' ? 'ASTA DAL VIVO' : 'ASTA IN CORSO'}</span>
      <b>${esc(a.title)}</b>
      <small>${a.slotsLeft} giocatori ancora da prendere · ${a.credits} crediti</small>
      <span class="fanta-auction-cta">Entra nella sala <span aria-hidden="true">→</span></span>
    </button>`;
  }
  const left = Date.parse(a.startsAt) - now;
  if (a.status === 'scheduled') {
    return `<button type="button" class="fanta-auction-card is-soon" data-go="asta">
      <span class="eyebrow">Asta in arrivo</span>
      <b>${esc(a.title)}</b>
      <small>${esc(dayTime(a.startsAt))} · ${a.mode === 'manual' ? 'dal vivo' : 'online'}${left>0?` · si apre tra <span data-countdown="${esc(a.startsAt)}">${countdown(a.startsAt, now)}</span>`:''}</small>
      <span class="fanta-auction-cta">Vedi i dettagli <span aria-hidden="true">→</span></span>
    </button>`;
  }
  return '';
}

const auctionHomeSlot=(h,now)=>`<div data-fanta-auction-banner>${auctionCard(h,now)}</div>`;
export function renderHome(h, now = Date.now()) {
  const invite=renderLeagueInvite(h.league,h.invite);
  if(h.competition?.status==='draft')return `${auctionHomeSlot(h,now)}<section class="fanta-block"><span class="eyebrow">${esc(h.league.name)}</span><h1>${esc(h.competition.name)}</h1><h2>Ai blocchi di partenza.</h2><p>${esc(h.me.teamName)} · Il presidente prepara le rose e sceglie la giornata iniziale. Poi si gioca.</p>${heroBalances(h.balances)}<button type="button" class="primary" data-go="competizioni">Vedi la competizione</button></section>${invite}`;
  const showMatch=h.round.state==='in-corso'||!h.lastResult;
  const live=h.round.state==='in-corso';
  return `<div class="fanta-home fanta-home-compact home-sections">
    ${auctionHomeSlot(h,now)}
    ${hero(h)}
    ${live?matchCard(h):''}
    ${lastResult(h)}
    ${nextMove(h,now)}
    ${!live&&showMatch?matchCard(h):''}
    ${!live&&!showMatch?barLink(h):''}
    ${invite}
    ${standings(h)}
  </div>`;
}

// Aggiorna solo i numeri del conto alla rovescia, senza ridisegnare la pagina.
export function tickCountdowns(root, now = Date.now()) {
  for (const el of root.querySelectorAll('[data-countdown]')) el.textContent = countdown(el.dataset.countdown, now) || 'chiusa';
}
import {teamLogo} from './team-logo.mjs';
