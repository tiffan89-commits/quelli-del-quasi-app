import {renderFantasyLineup} from './lineup-pitch.mjs';
export function fantasyMatchHeadline(match,teamLabel,closeAttribute){
 const score=(match.status==='LIVE'?match.liveScore:match.score)?.join(' – ')||'—';
 return `<div class="match-headline fantasy-match-headline"><button type="button" class="secondary match-nav-button match-close" ${closeAttribute} aria-label="Chiudi partita">×</button><h2 class="match-page-title">${teamLabel(match.home)}<b class="match-page-score" data-live-detail-score>${score}</b>${teamLabel(match.away)}</h2></div>`;
}
export function fantasyMatchView(
  match,
  round,
  esc,
  teamLabel,
  fmt,
  connection = null,
) {
  const details = match.details,
    model = match.oddsModel;
  return `${fantasyMatchHeadline(match,teamLabel,'id="close-modal"')}${match.fantasyPoints ? '<p class="muted" data-fantasy-points>Fantapunti ' + (match.status==='FT'?'finali':'live') + ': ' + match.fantasyPoints.map(fmt).join(" – ") + "</p>" : ""}${
    model
      ? `<details class="card"><summary>Il bookmaker del bar · quote virtuali</summary><p class="tiny muted">${esc(model.note)}</p><div class="odds-model-grid">${Object.entries(
          match.odds,
        )
          .map(([p, q]) => `<span>${esc(p)} <b>${fmt(q)}</b></span>`)
          .join(
            "",
          )}</div><p class="tiny muted">Gol attesi ${model.expectedGoals.map(fmt).join(" – ")} · storico ${model.samples.join(" / ")} partite · fantapunti medi ${model.meanFantasyPoints.map((x) => (x === null ? "n.d." : fmt(x))).join(" / ")} · giocatori con storico ${model.knownPlayers.join(" / ")}. Le quote accettate sono fissate quando confermi la schedina.</p></details>`
      : ""
  }${details ? renderFantasyLineup(details,{paged:true,showExtras:false}) : '<p class="muted">Formazioni non ancora disponibili.</p>'}`;
}
