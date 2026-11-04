import {slipTeamLabel} from '../club-crest.mjs';
import {pointTerms} from '../../scoring.mjs';
// 0.26: righe compatibili con patchSlipResults (data-match-card, data-inline-result, data-match-status, data-pick-feedback).
// Schedina v2: 1/X/2 al primo livello, altri mercati espandibili, barra fissa con puntata e quota totale.
// Usa lo stesso modello dati di app.mjs: picks[match.id] = valore (es. "1", "X2", "Over 2.5").
import { slipSummary, isClosed, sourceOf,roundAvailability } from '../slip-state.mjs';
import { inlineResultView } from '../slip-results.mjs';
import {orderSlipMatches} from '../../match-layout.mjs';

export const MAIN = ['1', 'X', '2'];
export const EXTRA = ['1X', '12', 'X2', 'Under 2.5', 'Over 2.5', 'Goal', 'No Goal'];
const show = (p) => p.replace(' 2.5', ' 2,5');
// Tagli rapidi della puntata; il campo "Altro" resta vuoto quando la puntata coincide con uno di essi.
export const quickStakes = (max) => [1, Math.round(max / 2), max];
export const stakeInputValue = (stake, max) => (quickStakes(max).includes(Number(stake)) ? '' : stake);

export function totalOdds(round, picks) {
  let t = 1, n = 0;
  for (const m of round?.matches || []) {
    const p = picks[m.id];
    if (typeof p === 'string' && Number.isFinite(m.odds?.[p])) { t *= m.odds[p]; n++; }
  }
  return n ? t : null;
}

function option(m, p, picks, closed, esc, fmt, pointsOnly,round) {
  const on = picks[m.id] === p, odd = m.odds?.[p];
  const accepted=closed&&round.slip?.picks?.[m.id]===p?round.slip?.pointTerms?.[m.id]:null;
  const terms=accepted||m.pointOffers?.[p]||pointTerms(m,p,{mode:'weighted',scoring:'difficulty-v2',correct:1,wrong:-1,...round.rules});
  const amount=n=>Number.isFinite(n)?(n>0?'+':n<0?'−':'')+Number(Math.abs(n).toFixed(2)).toLocaleString('it-IT'):'—';
  const gain=amount(terms.correct),loss=amount(terms.wrong),points='<small class="v2-odd-points"><em class="points-gain">'+gain+'</em><span aria-hidden="true"> / </span><em class="points-loss">'+loss+'</em> pt</small>';
  return '<button type="button" class="v2-odd' + (on ? ' is-on' : '') + '" data-pick="' + esc(m.id) + '" data-value="' + esc(p) + '"' +
    (closed ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + esc(m.home + ' – ' + m.away + ': ' + show(p)+'; '+gain+' punti se corretto, '+loss+' punti se sbagliato') + '">' +
    '<b>' + esc(show(p)) + '</b><span>' + (pointsOnly ? 'Solo punti' : Number.isFinite(odd) ? 'Quota '+fmt(odd) + (m.oddsEstimated?.[p] ? '*' : '') : 'Quota in arrivo') + '</span>'+points+'</button>';
}

export function renderSlipV2({ round, picks = {}, stake = 10, credits = Infinity, openMatch = null, esc, fmt, date, fantasyMeta, teamLabel=slipTeamLabel }) {
  if (!round) return '<section class="card empty"><h1>La prossima è quella buona.</h1><p>La prossima schedina sarà disponibile a breve.</p></section>';
  const availability=roundAvailability(round),closed = isClosed(round),ready=availability==='aperta', fanta = sourceOf(round) === 'fantacalcio', pointsOnly = round.pointsOnly === true;
  const sum = slipSummary(round, picks, stake, credits), max = Number(round.rules?.maxStake || 20);
  const chosen = Object.keys(picks).filter(k => typeof picks[k] === 'string').length, tot = totalOdds(round, picks);
  const rows = orderSlipMatches(round.matches || []).map(m => {
    const extraOn = EXTRA.includes(picks[m.id]), open = openMatch === m.id;
    const meta = fanta && fantasyMeta ? fantasyMeta(m) : (m.kickoff ? date(m.kickoff) : '');
    const live = m.status === 'LIVE', status = live ? 'In corso' : m.score ? 'Risultato finale' : (meta || '');
    return '<article class="v2-match" data-match-card="' + esc(m.id) + '" data-result-score="' + esc(JSON.stringify(live ? m.liveScore || null : m.score || null)) + '"><button type="button" class="v2-match-head match-link" data-detail="' + esc(m.id) + '"><div><b class="slip-teams">' + teamLabel(m.home) + '<span class="slip-versus">–</span>' + teamLabel(m.away) + '</b><small data-match-status>' + esc(status) + '</small></div><span class="inline-result" data-inline-result aria-live="polite">' + inlineResultView(m) + '</span></button>' +
      '<div class="v2-odds-main">' + MAIN.map(p => option(m, p, picks, closed||!ready, esc, fmt, pointsOnly,round)).join('') +
      (pointsOnly ? '' : '<button type="button" class="v2-more' + (extraOn ? ' is-on' : '') + '" data-v2-more="' + esc(m.id) + '" aria-expanded="' + open + '" aria-label="Altri mercati">' + (open ? '–' : '+') + '</button>') + '</div>' +
      (open && !pointsOnly ? '<div class="v2-odds-extra">' + EXTRA.map(p => option(m, p, picks, closed||!ready, esc, fmt, pointsOnly,round)).join('') + '</div>' : '') +
      '<div data-pick-feedback></div></article>';
  }).join('');
  const quick = quickStakes(max), left = (round.matches?.length || 0) - chosen;
  const saved = !!round.slip && !sum.dirty;
  const state = saved ? ['is-ok', 'Confermata · modificabile fino a ' + date(round.deadline || round.kickoff)]
    : round.slip ? ['is-warn', 'Modifiche da salvare'] : ['is-todo', 'Non ancora confermata'];
  const hint = sum.canSave ? null : left > 0
    ? ['v2-error is-hint', 'status', 'Mancano ' + left + (left === 1 ? ' partita' : ' partite') + ': scegli un esito per ognuna per confermare.']
    : ['v2-error', 'alert', 'Controlla la puntata (1–' + max + ') e i crediti disponibili.'];
  const label = saved ? 'Confermata ✓' : round.slip ? 'Salva' : 'Conferma';
  return '<section class="v2-slip" data-slip-match-list><div class="v2-eyebrow">' + (fanta ? 'IL FANTA DEL TUO BAR' : 'SERIE A') + ' · ' + esc(round.title || ('Giornata ' + round.number)) + '</div>' +
    '<h1 class="v2-title">La schedina</h1><p class="v2-points-legend">Su ogni esito: <span>punti se indovini</span> / <span>punti se sbagli</span></p><p class="v2-sub">' + chosen + ' / ' + (round.matches?.length || 0) + ' esiti · ' +
    (availability==='non ancora aperta'?'non ancora aperta':closed ? 'chiusa' : 'chiude ' + esc(date(round.deadline || round.kickoff))) + ' · una scelta per partita</p>' + rows +
    '<p class="tiny muted">Punti per gli esiti indovinati, crediti per la puntata moltiplicata per la quota totale. Quote uguali per tutti. <a href="#" data-v2-go="regolamento">Regolamento</a></p></section>' +
    (!ready ? '' : '<div class="v2-slipbar"><p class="v2-state ' + state[0] + '" role="status">' + esc(state[1]) + '</p>' +
      (pointsOnly ? '' : '<div class="v2-stakes">' + quick.map(v =>
        '<button type="button" class="v2-stake' + (Number(stake) === v ? ' is-on' : '') + '" data-v2-stake="' + v + '">' + v + (v === max ? ' max' : '') + '</button>').join('') +
        '<input id="stake" class="v2-stake-input" type="number" inputmode="decimal" min="1" max="' + max + '" value="' + esc(stakeInputValue(stake, max)) + '" placeholder="Altro" aria-label="Puntata personalizzata in crediti"></div>') +
      '<button type="button" class="v2-save' + (saved ? ' is-done' : '') + '" id="save-slip"' + (sum.canSave && !saved ? '' : ' disabled') + '><span>' + label + (pointsOnly || saved ? '' : ' · ' + fmt(stake) + ' cr') + '</span>' +
      (pointsOnly ? '' : '<span>quota ' + (tot ? fmt(tot) : '–') + ' · ' + (tot ? fmt(Math.round(stake * tot)) : 0) + ' cr</span>') + '</button>' +
      (hint ? '<p class="' + hint[0] + '" role="' + hint[1] + '">' + hint[2] + '</p>' : '') + '</div>');
}

// handlers: onPick(matchId, value), onToggle(matchId), onStake(n), onSave(), onGo(page)
export function bindSlipV2(root, { onPick, onToggle, onStake, onSave, onGo }) {
  root.querySelectorAll('.v2-odd[data-pick]').forEach(b => b.onclick = () => onPick(b.dataset.pick, b.dataset.value));
  root.querySelectorAll('[data-v2-more]').forEach(b => b.onclick = () => onToggle(b.dataset.v2More));
  root.querySelectorAll('[data-v2-stake]').forEach(b => b.onclick = () => onStake(Number(b.dataset.v2Stake)));
  const input = root.querySelector('#stake'); if (input) input.oninput = () => onStake(Number(input.value));
  const save = root.querySelector('#save-slip'); if (save) save.onclick = onSave;
  root.querySelectorAll('[data-v2-go]').forEach(a => a.onclick = (e) => { e.preventDefault(); onGo(a.dataset.v2Go); });
}
