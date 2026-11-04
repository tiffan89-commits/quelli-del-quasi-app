import {slipSummary} from './slip-state.mjs';
import {fantasyAccount} from './fantasy-accounts.mjs';
// Purely local transaction: validate everything before changing balances.
export function saveDemoSlip(state,payload){
 const league=state.leagues.find(l=>l.id===payload.league),round=league?.rounds.find(r=>r.id===payload.round),uid=state.user?.id,member=league?.members.find(m=>m.uid===uid&&!m.removed);
 if(!round||!member)throw Error('Lega o giornata non disponibile');
 const wallet=round.source==='fantacalcio'?fantasyAccount(member,round,league):member;
 if(Object.hasOwn(payload,'baseSavedAt')&&(payload.baseSavedAt||null)!==(round.slip?.savedAt||null)){const e=Error('La schedina è cambiata: ricarica la versione salvata.');e.status=409;throw e;}
 const summary=slipSummary(round,payload.picks,payload.stake,wallet.credits);
 if(!summary.canSave||round.matches.some(m=>!m.void&&(!Number.isFinite(m.odds?.[payload.picks?.[m.id]])||m.odds[payload.picks[m.id]]<=1)))throw Error(summary.closed?'Giornata chiusa':'Completa gli esiti e verifica la puntata');
 const stake=round.pointsOnly?0:Number(payload.stake),delta=(round.slip?.stake||0)-stake;
 const previous=Date.parse(round.slip?.savedAt||0)||0,savedAt=new Date(Math.max(Date.now(),previous+1)).toISOString();
 const slip={uid,picks:{...payload.picks},stake,savedAt,odds:summary.odds,acceptedOdds:Object.fromEntries(round.matches.map(m=>[m.id,m.odds?.[payload.picks[m.id]]])),points:0};
 wallet.credits+=delta;round.slip=slip;round.publicSlips??=[];round.publicSlips=round.publicSlips.filter(s=>s.uid!==uid).concat(structuredClone(slip));
 const ranking=league.fantasyRanking?.groups?.find(g=>g.key===round.nativeFanta?.leagueId)?.members.find(m=>m.uid===uid);if(ranking){ranking.credits=wallet.credits;ranking.committed=league.rounds.filter(r=>r.source==='fantacalcio'&&!r.settled).reduce((n,r)=>n+(r.slip?.stake||0),0);}
 league.ledger??=[];const ledger={id:'demo-save-'+round.id+'-'+savedAt,uid,created:savedAt,amount:delta,reason:'Schedina '+round.title};if(delta)league.ledger.unshift(ledger);
 return {ok:true,receipt:{uid,league:league.id,round:round.id,slip:structuredClone(slip),member:structuredClone(member),fantasyRanking:structuredClone(league.fantasyRanking),ledger:delta?[ledger]:[]}};
}
