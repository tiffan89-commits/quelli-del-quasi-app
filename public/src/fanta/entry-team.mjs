// Explicit entry action: one POST on first Fanta entry, never a GET-side write
// or a timer. Existing coaches and unrelated leagues are left alone.
export async function assignEntryTeam(api,bootstrap){
 const id=bootstrap?.choiceLeagueId,choice=bootstrap?.teamChoices?.find(l=>l.id===id);
 if(bootstrap?.me?.access!=='full'||!choice||choice.pending||!choice.teams.some(t=>t.available)||bootstrap.leagues.some(l=>l.id===id))return {bootstrap,assigned:false};
 try{await api.claimTeam(id,null);api.invalidateReads?.();return {bootstrap:await api.bootstrap(id),assigned:true};}
 catch(error){
  // A response may time out after the assignment committed. Re-read once,
  // without making another claim or creating another team.
  try{api.invalidateReads?.();const fresh=await api.bootstrap(id);if(fresh.leagues.some(l=>l.id===id))return {bootstrap:fresh,assigned:true};return {bootstrap:{...fresh,autoClaimError:error.message},assigned:false};}
  catch{return {bootstrap:{...bootstrap,autoClaimError:error.message},assigned:false};}
 }
}
