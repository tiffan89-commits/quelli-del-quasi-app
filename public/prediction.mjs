// Shared display logic; provisional colours never assign points or credits.
export function predictionStatus(match, pick, closed) {
  if (!closed || !pick || match.void) return null;
  const live = match.status === "LIVE",
    score = live ? match.liveScore : match.score;
  if (
    !Array.isArray(score) ||
    score.length !== 2 ||
    !score.every(Number.isInteger)
  )
    return null;
  const [h, a] = score,
    results = {
      1: h > a,
      X: h === a,
      2: h < a,
      "1X": h >= a,
      12: h !== a,
      X2: h <= a,
      Goal: h > 0 && a > 0,
      "No Goal": h === 0 || a === 0,
      "Under 2.5": h + a < 2.5,
      "Over 2.5": h + a > 2.5,
    };
  if (!(pick in results)) return null;
  const winning = results[pick];
  return {
    winning,
    live,
    className: winning ? "pick-winning" : "pick-losing",
    label: live
      ? winning
        ? "Per ora vincente"
        : "Per ora perdente"
      : winning
        ? "Pronostico corretto"
        : "Pronostico sbagliato",
    note: live
      ? "Provvisorio: il risultato può cambiare."
      : match.officialConfirmed
        ? "Risultato finale confermato."
        : "In attesa della conferma finale.",
  };
}
