import {slipCreditReserve} from '../slip-events.mjs';
import {slipSummary} from './slip-state.mjs';
import {MAIN,EXTRA} from './v2/slip-v2.mjs';
import {fantasyAccount} from './fantasy-accounts.mjs';
// Purely local transaction: validate everything before changing balances.
export function saveDemoSlip(state,payload){
 const league=state.leagues.find(l=>l.id===payload.league),round=league?.rounds.find(r=>r.id===payload.round),uid=state.user?.id,member=league?.members.find(m=>m.uid===uid&&!m.removed);
 if(!round||!member)throw Error('Lega o giornata non disponibile');
 const wallet=round.source==='fantacalcio'?fantasyAccount(member,round,league):member;
 if(Object.hasOwn(payload,'baseSavedAt')&&(payload.baseSavedAt||null)!==(round.slip?.savedAt||null)){const e=Error('La schedina è cambiata: ricarica la versione salvata.');e.status=409;throw e;}
 const summary=slipSummary({...round,stakeReserve:slipCreditReserve(round,league.rounds,league,uid)},payload.picks,payload.stake,wallet.credits);
 const legal=round.pointsOnly?MAIN:[...MAIN,...EXTRA];
 if(Object.values(payload.picks||{}).some(p=>!legal.includes(p))||!summary.canSave||round.eventBetting&&(Object.keys(summary.picks).length!==Object.keys(payload.picks||{}).length||Object.entries(payload.picks||{}).some(([id,pick])=>summary.picks[id]!==pick)))throw Error(summary.closed?'Giornata chiusa':'Scegli gli esiti ancora aperti e verifica la puntata');
 const stake=round.pointsOnly?0:Number(payload.stake),delta=(round.slip?.stake||0)-stake;
 const previous=Date.parse(round.slip?.savedAt||0)||0,savedAt=new Date(Math.max(Date.now(),previous+1)).toISOString();
 const slip={uid,picks:summary.picks,eventBetting:!!round.eventBetting,stake,savedAt,odds:summary.odds,acceptedOdds:Object.fromEntries(round.matches.filter(m=>summary.picks[m.id]).map(m=>[m.id,round.slip?.picks?.[m.id]===summary.picks[m.id]?round.slip.acceptedOdds?.[m.id]??m.odds?.[summary.picks[m.id]]:m.odds?.[summary.picks[m.id]]])),points:0};
 wallet.credits+=delta;round.slip=slip;round.publicSlips??=[];round.publicSlips=round.publicSlips.filter(s=>s.uid!==uid).concat(structuredClone(slip));
 const ranking=league.fantasyRanking?.groups?.find(g=>g.key===round.nativeFanta?.leagueId)?.members.find(m=>m.uid===uid);if(ranking){ranking.credits=wallet.credits;ranking.committed=league.rounds.filter(r=>r.source==='fantacalcio'&&!r.settled).reduce((n,r)=>n+(r.slip?.stake||0),0);}
 league.ledger??=[];const ledger={id:'demo-save-'+round.id+'-'+savedAt,uid,created:savedAt,amount:delta,reason:'Schedina '+round.title};if(delta)league.ledger.unshift(ledger);
 return {ok:true,receipt:{uid,league:league.id,round:round.id,slip:structuredClone(slip),member:structuredClone(member),fantasyRanking:structuredClone(league.fantasyRanking),ledger:delta?[ledger]:[]}};
}
