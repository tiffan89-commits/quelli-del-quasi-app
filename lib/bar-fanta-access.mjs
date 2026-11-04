// Shared authorization for cached public projections. Mutations additionally
// check current relational membership in the same database transaction.
export function visibleBarRounds(state,league,user){return state.rounds.filter(r=>r.league!==league.id||r.source!=='fantacalcio'||r.nativeFanta&&league.fantaSlipsEnabled!==false&&league.nativeFantaLink?.coachIds?.includes(user.id));}
