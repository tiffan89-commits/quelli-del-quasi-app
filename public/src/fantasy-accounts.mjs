export function fantasyWalletKey(round,league){return league?.fantasyWalletScopes?.[round?.competitionKey]||round?.nativeFanta?.leagueId||round?.competitionKey||null;}
export function fantasyGroup(league,competition){const groups=league?.fantasyRanking?.groups||[];return groups.find(g=>g.key===competition||g.competitionKeys?.includes(competition))||groups[0]||league?.fantasyRanking;}
export function fantasyAccount(member,round,league){return member?.fantasyWallets?.[fantasyWalletKey(round,league)]||member?.fantasyWallet||{initial:500,credits:500};}
export function fantasyProgression(league,competition){const group=fantasyGroup(league,competition);return league?.progression?.fantacalcioByLeague?.[group?.key]||league?.progression?.fantacalcio;}
