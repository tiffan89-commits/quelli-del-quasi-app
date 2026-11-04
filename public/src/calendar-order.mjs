const romeDay = (value) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(value),
  );
// Keep the whole matchday visible until midnight after its last game. A postponed
// game does not hold every following round back: the latest started round wins.
export function calendarSections(rounds, calendar, now = new Date()) {
  const sorted = [...rounds].sort((a, b) => a.number - b.number),
    today = romeDay(now);
  const windows = sorted.map((r) => {
    const base =
      r.source === "fantacalcio" || r.serieARound
        ? calendar?.rounds.find((x) => x.number === r.serieARound)
        : r;
    const dates = (base?.matches || r.matches || [])
      .map((m) => Date.parse(m.kickoff))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const fallback = base?.date || r.date;
    return {
      r,
      first: dates.length ? romeDay(dates[0]) : fallback,
      last: dates.length ? romeDay(dates.at(-1) + 135 * 60000) : fallback,
    };
  });
  let current = windows
    .filter((w) => w.first && w.first <= today && (!w.last || today <= w.last))
    .at(-1);
  current ??= windows.find((w) => w.first && w.first > today);
  current ??= windows.at(-1);
  if (!current) return [];
  const index = sorted.indexOf(current.r);
  return [
    { kind: "current", label: "Giornata in evidenza", rounds: [current.r] },
    {
      kind: "future",
      label: "Prossime giornate",
      rounds: sorted.slice(index + 1),
    },
    {
      kind: "past",
      label: "Giornate precedenti",
      rounds: sorted.slice(0, index),
    },
  ].filter((s) => s.rounds.length);
}
