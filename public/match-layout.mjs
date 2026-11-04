// Slip presentation only: LIVE first, then chronological; never mutate stored fixtures or picks.
export function orderSlipMatches(matches=[]) {
  return matches.map((match,index)=>({match,index,time:Date.parse(match.kickoff)}))
    .sort((a,b)=>Number(b.match.status==='LIVE')-Number(a.match.status==='LIVE')||
      (Number.isFinite(a.time)?a.time:Infinity)-(Number.isFinite(b.time)?b.time:Infinity)||a.index-b.index)
    .map(x=>x.match);
}

export function groupMatches(matches) {
  const sorted = matches
    .map((m, i) => ({ m, i, t: m.kickoff ? Date.parse(m.kickoff) : NaN }))
    .sort(
      (a, b) =>
        (Number.isFinite(a.t) ? a.t : Infinity) -
          (Number.isFinite(b.t) ? b.t : Infinity) || a.i - b.i,
    );
  const groups = [];
  for (const { m, t } of sorted) {
    const key = Number.isFinite(t)
      ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
          new Date(t),
        )
      : "unknown";
    let group = groups.find((g) => g.key === key);
    if (!group) {
      let label =
        key === "unknown"
          ? "Data e orario da definire"
          : new Intl.DateTimeFormat("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Europe/Rome",
            }).format(new Date(t));
      label = label[0].toUpperCase() + label.slice(1);
      groups.push((group = { key, label, matches: [] }));
    }
    group.matches.push(m);
  }
  return groups;
}
