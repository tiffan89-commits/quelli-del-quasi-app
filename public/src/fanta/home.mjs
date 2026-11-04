import {extremeClass} from './formato.mjs';
// Home del Fanta ("Oggi"): squadra, prossima mossa, sfida della giornata, ultimo risultato, classifica.
// Funzione pura: riceve la risposta di api.home() e restituisce HTML. Nessun accesso a rete o stato globale.
import { esc, pts, odd, countdown, dayTime, timeAgo, OUTCOME } from './formato.mjs';

const formDots = form => `<span class="fanta-form" aria-label="Ultime ${form.length}: ${form.map(f => OUTCOME[f]).join(', ')}">${
  form.map(f => `<i class="is-${f}">${f}</i>`).join('')}</span>`;

export function homeTeam(h){
 const id=h?.me?.teamId;
 return [h?.match?.home,h?.match?.away,...(h?.standings||[]).map(s=>s.team)].find(t=>t?.id===id)||{id,name:h?.me?.teamName||'La tua squadra',branding:h?.me?.branding||{}};
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
    <div class="fanta-hero-form"><small>Ultime cinque</small>${formDots(me.form)}</div>
  </section>`;
}

function nextMove(h, now) {
  const round=h.nextLineup?{number:h.nextLineup.round,state:h.nextLineup.savedAt?'schierata':'da-schierare',deadline:h.nextLineup.deadline}:h.round;
  const lineup=h.round.state==='calcolata'&&h.nextLineup?{formation:h.nextLineup.formation,savedAt:h.nextLineup.savedAt}:h.lineup;
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
      title: 'Formazione pronta',
      text: `${esc(lineup.formation)} salvata ${timeAgo(lineup.savedAt, now)}. Puoi cambiarla fino alla scadenza.`,
      side: clock('Chiude tra'),
      cta: `<button type="button" class="secondary dash-cta" data-go="formazione">Modifica la formazione <span aria-hidden="true">→</span></button>`,
    },
    'in-corso': {
      title: `Giornata ${round.number}`,
      text: round.matchesTotal>0&&round.matchesDone>=round.matchesTotal?'Tutte le partite sono finite. Voti provvisori, in attesa dei definitivi.':`${round.matchesDone} partite di Serie A su ${round.matchesTotal} finite. Voti e punteggi sono provvisori.`,
      side: '<div class="dash-clock"><span>Stato</span><strong>'+((round.matchesTotal>0&&round.matchesDone>=round.matchesTotal)?'Finita':'LIVE')+'</strong></div>',
      cta: `<button type="button" class="primary dash-cta" data-go="giornata" data-round="${round.number}">${round.matchesTotal>0&&round.matchesDone>=round.matchesTotal?'Risultati e voti':'Segui in diretta'} <span aria-hidden="true">→</span></button>`,
    },
    'calcolata': {
      title: `Giornata ${round.number} chiusa`,
      text: 'Voti ufficiali e punteggi definitivi. Guarda chi ti ha fatto vincere, voto per voto.',
      side: '',
      cta: `<button type="button" class="primary dash-cta" data-go="giornata" data-round="${round.number}">Vedi voti e bonus <span aria-hidden="true">→</span></button>`,
    },
  };
  const v = variants[round.state] || variants['da-schierare'];
  return `<section class="dash-next fanta-next" aria-labelledby="fanta-next-title">
    <div><span class="eyebrow">La tua prossima mossa</span><h2 id="fanta-next-title">${v.title}</h2><p>${v.text}</p></div>
    ${v.side}${h.openingLineup?v.cta.replace('<button ','<button disabled aria-busy="true" ').replace(/(Schiera|Modifica) la formazione/,'Apriamo la formazione…'):v.cta}
  </section>`;
}

function side(t, score, meId) {
  return `<div class="fanta-vs-team${t.id === meId ? ' is-me' : ''}">
    ${teamLogo(t,{className:'is-medium'})}
    <b>${esc(t.name)}</b><small>${esc(t.manager)}</small>${score}
  </div>`;
}

function matchCard(h, now) {
  const { match, round, me } = h;
  if (!match) return '<section class="fanta-block"><h2>La tua sfida</h2><p>Il calendario sta per arrivare.</p></section>';
  let middle, scores = ['', ''], foot = '';
  if (match.final) {
    middle = `<div class="fanta-vs-mid"><strong>${match.final.home.goals}–${match.final.away.goals}</strong><small>Finale</small></div>`;
    scores = [match.final.home, match.final.away].map(s => `<span class="fanta-vs-points">${pts(s.points)}</span>`);
    const top = h.lastResult?.topPlayer;
    foot = h.lastResult ? `<p class="fanta-vs-foot"><span class="fanta-badge is-${h.lastResult.outcome}">${OUTCOME[h.lastResult.outcome]}</span>${top ? ` <span>Migliore in campo: <b>${esc(top.name)}</b> · ${pts(top.fantavoto)}</span>` : ''}</p>` : '';
  } else if (match.live) {
    middle = `<div class="fanta-vs-mid"><strong>${round.matchesTotal>0&&round.matchesDone>=round.matchesTotal?'Finita':'LIVE'}</strong><small>voti provvisori</small></div>`;
    scores = [match.live.home, match.live.away].map(s => `<span class="fanta-vs-points">${pts(s.points)}</span><small class="fanta-vs-played">${Number.isInteger(s.withVote)?s.withVote:Number.isInteger(s.played)?s.played:'–'}/${match.live.of||11} a voto</small>`);
  } else {
    middle = `<div class="fanta-vs-mid"><strong>vs</strong><small>${esc(dayTime(round.firstKickoff))}</small></div>`;
  }
  const bar = h.bar
    ? `<button type="button" class="fanta-bar-link" data-mode="bar" data-bar-page="schedina" data-bar-league="${esc(h.bar.league||'')}" data-bar-round="${esc(h.bar.round||'')}" data-bar-match="${esc(h.bar.match||'')}">
        <span><b>${h.bar.closed?'Segui la schedina →':'Compila la schedina →'}</b><small>Crediti virtuali · ${esc(match.home.name)} – ${esc(match.away.name)}</small></span>
        <span class="fanta-bar-odds">${['1', 'X', '2'].filter(k => h.bar.odds[k]).map(k => `<i><small>${k}</small>${odd(h.bar.odds[k])}</i>`).join('')}</span>
      </button>`
    : '';
  return `<section class="fanta-block" aria-labelledby="fanta-match-title">
    <button type="button" class="fanta-match-link" data-go="giornata" data-round="${round.number}" data-mu="${esc(match.id||match.matchupId||'')}" aria-label="Apri i risultati della giornata ${round.number}">
      <div class="dash-section-head"><div><h2 id="fanta-match-title">La tua sfida</h2><small>Giornata ${round.number}</small></div><span class="fanta-match-open" aria-hidden="true">→</span></div>
      <div class="fanta-vs">${side(match.home, scores[0], me.teamId)}${middle}${side(match.away, scores[1], me.teamId)}</div>
      ${foot}
    </button>
    ${finalVerificationNote(h,now)}${bar}
  </section>`;
}

function lastResult(h) {
  const r = h.lastResult;
  if (!r) return '';
  return `<section class="fanta-block" aria-labelledby="fanta-last-title">
    <div class="dash-section-head"><div><h2 id="fanta-last-title">Com'è andata</h2><small>Giornata ${r.round}</small></div>
      <span class="fanta-badge is-${r.outcome}">${OUTCOME[r.outcome]}</span></div>
    <button type="button" class="fanta-result" data-go="giornata" data-round="${r.round}" data-mu="${esc(r.matchupId||'')}">
      <span class="fanta-result-row"><b>${esc(r.home.name)}</b><span>${pts(r.home.points)}</span><strong>${r.home.goals}</strong></span>
      <span class="fanta-result-row"><b>${esc(r.away.name)}</b><span>${pts(r.away.points)}</span><strong>${r.away.goals}</strong></span>
      <span class="fanta-result-foot">${r.topPlayer ? `Migliore: ${esc(r.topPlayer.name)} · ${pts(r.topPlayer.fantavoto)} · ` : ''}Vedi voti e bonus <span aria-hidden="true">→</span></span>
    </button>
  </section>`;
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
// Compare solo con l'asta aperta, o programmata entro 24 ore (allora porta alla sezione Asta della Lega).
function auctionCard(h, now) {
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
  if (a.status === 'scheduled' && left > 0 && left < 24 * 3600000) {
    return `<button type="button" class="fanta-auction-card is-soon" data-tab="lega" data-lega-open="asta">
      <span class="eyebrow">Asta in arrivo</span>
      <b>${esc(a.title)}</b>
      <small>${esc(dayTime(a.startsAt))} · ${a.mode === 'manual' ? 'dal vivo' : 'online'} · si apre tra <span data-countdown="${esc(a.startsAt)}">${countdown(a.startsAt, now)}</span></small>
      <span class="fanta-auction-cta">Vedi i dettagli <span aria-hidden="true">→</span></span>
    </button>`;
  }
  return '';
}

export function renderHome(h, now = Date.now()) {
  if(h.competition?.status==='draft')return `<section class="fanta-block"><span class="eyebrow">${esc(h.league.name)}</span><h1>${esc(h.competition.name)}</h1><h2>Ai blocchi di partenza.</h2><p>${esc(h.me.teamName)} · Il presidente prepara le rose e sceglie la giornata iniziale. Poi si gioca.</p><button type="button" class="primary" data-tab="lega" data-lega-open="competizioni">Vedi la competizione</button></section>`;
  return `<div class="fanta-home">
    ${auctionCard(h, now)}
    ${hero(h)}
    ${nextMove(h, now)}

    ${matchCard(h, now)}
    ${lastResult(h)}
    ${standings(h)}
  </div>`;
}

// Aggiorna solo i numeri del conto alla rovescia, senza ridisegnare la pagina.
export function tickCountdowns(root, now = Date.now()) {
  for (const el of root.querySelectorAll('[data-countdown]')) el.textContent = countdown(el.dataset.countdown, now) || 'chiusa';
}
import {teamLogo} from './team-logo.mjs';

export function finalVerificationNote(h,now=Date.now()){
 const pending=['in-corso','calcolata'].includes(h.round?.state),r=pending?h.round:h.lastResult;
 if(!r)return '';const number=r.number||r.round,provisional=pending&&h.round.state!=='calcolata',v=h.finalVerification;
 const time=v?.at?new Date(v.at).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):null;
 const note=!provisional?'':v?.status==='running'?'Verifica dei dati definitivi in corso. I risultati restano provvisori.':time&&Date.parse(v.at)>now?'Risultati provvisori · prossima verifica dei definitivi: '+time+'.':v?.status==='queued'?'Risultati provvisori · verifica dei definitivi in coda.':'Risultati provvisori · la prossima verifica dei definitivi sarà indicata qui appena programmata.';
 return note?'<p class="tiny muted final-verification-note">'+esc(note)+'</p>':'';
}
