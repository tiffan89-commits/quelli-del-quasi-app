// Apply only an acknowledged save for the current authenticated user. A compact
// server receipt avoids downloading every league, calendar and avatar again.
export function applySlipReceipt(state,result){
 const receipt=result?.receipt;if(!receipt||receipt.uid!==state.user?.id)return false;
 const league=state.leagues?.find(l=>l.id===receipt.league),round=league?.rounds?.find(r=>r.id===receipt.round),member=league?.members?.find(m=>m.uid===receipt.uid);
 if(!round||!member||receipt.slip?.uid!==receipt.uid||!receipt.slip.savedAt||!Number.isFinite(receipt.member?.credits))return false;
 if(round.slip?.savedAt&&Date.parse(round.slip.savedAt)>Date.parse(receipt.slip.savedAt))return false;
 round.slip=structuredClone(receipt.slip);Object.assign(member,structuredClone(receipt.member));
 if(Array.isArray(receipt.ledger))league.ledger=[...new Map([...structuredClone(receipt.ledger),...(league.ledger||[])].map(x=>[x.id,x])).values()].sort((a,b)=>Date.parse(b.created||0)-Date.parse(a.created||0));
 if(receipt.fantasyRanking)league.fantasyRanking=structuredClone(receipt.fantasyRanking);
 if(receipt.user){if(receipt.user.avatar)state.user.avatar=structuredClone(receipt.user.avatar);if(Array.isArray(receipt.user.rewards))state.user.rewards=structuredClone(receipt.user.rewards);}
 return true;
}
