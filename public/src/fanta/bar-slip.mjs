// Only the user's already-authorized Bar snapshot. No extra DB or provider reads.
export function findBarSlip(home, leagues = [], now = Date.now()) {
  if (!home?.match) return null;
  for (const league of leagues) for (const round of league.rounds || []) {
    if (round.archived || round.nativeFanta?.leagueId !== home.league.id ||
        round.nativeFanta?.competitionId !== home.competition?.id || round.number !== home.round.number) continue;
    const match = round.matches.find(m =>
      m.home === home.match.home.name && m.away === home.match.away.name);
    if (!match) continue;
    return {league:league.id,round:round.id,match:match.id,odds:match.odds || {},
      closed:!!(round.closed || round.settled || now >= Date.parse(round.deadline || round.kickoff)),
      competition:round.competitionKey};
  }
  return null;
}
