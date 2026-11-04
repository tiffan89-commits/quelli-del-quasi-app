import {renderFantasyLineup} from './lineup-pitch.mjs';
export function fantasyMatchView(
  match,
  round,
  esc,
  fixtureTeams,
  fmt,
  connection = null,
) {
  const details = match.details,
    model = match.oddsModel;
  return `<button class="secondary" id="close-modal">Chiudi ×</button><div class="eyebrow" style="margin-top:25px">IL FANTA DEL TUO BAR · GIORNATA ${round.number}</div><h2 style="margin:20px 0">${fixtureTeams(match.home, match.away)}</h2><p class="live-score">${(match.status==='LIVE'?match.liveScore:match.score)?.join(" – ") || "Da giocare"}</p>${match.fantasyPoints ? '<p class="muted" data-fantasy-points>Fantapunti ' + (match.status==='FT'?'finali':'live') + ': ' + match.fantasyPoints.map(fmt).join(" – ") + "</p>" : ""}${
    model
      ? `<details class="card"><summary>Il bookmaker del bar · quote virtuali</summary><p class="tiny muted">${esc(model.note)}</p><div class="odds-model-grid">${Object.entries(
          match.odds,
        )
          .map(([p, q]) => `<span>${esc(p)} <b>${fmt(q)}</b></span>`)
          .join(
            "",
          )}</div><p class="tiny muted">Gol attesi ${model.expectedGoals.map(fmt).join(" – ")} · storico ${model.samples.join(" / ")} partite · fantapunti medi ${model.meanFantasyPoints.map((x) => (x === null ? "n.d." : fmt(x))).join(" / ")} · giocatori con storico ${model.knownPlayers.join(" / ")}. Le quote accettate sono fissate quando confermi la schedina.</p></details>`
      : ""
  }<div class="row"><h3>Formazioni e bonus/malus</h3>${details?.complete ? '<span class="pill">Definitiva</span>' : ''}</div><p class="tiny muted">${details?.provisional ? 'Provvisorie' : ''}</p>${details ? renderFantasyLineup(details) : '<p class="muted">Formazioni non ancora disponibili.</p>'}`;
}
