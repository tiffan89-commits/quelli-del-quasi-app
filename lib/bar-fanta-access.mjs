import {barAccessible,fantaAccessible} from '../public/src/league-game-access.mjs';

// Shared authorization for cached public projections. Mutations additionally
// check current relational membership in the same database transaction.
export function canReadLeagueRound(round,league,uid){
 if(round.source!=='fantacalcio')return barAccessible(league,uid);
 return !!(round.nativeFanta&&fantaAccessible(league,uid)&&league.fantaSlipsEnabled!==false&&league.nativeFantaLink?.coachIds?.includes(uid));
}
export function visibleBarRounds(state,league,user){return state.rounds.filter(r=>r.league!==league.id||canReadLeagueRound(r,league,user.id));}
