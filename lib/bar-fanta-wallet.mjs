import {fantasyWalletKey} from '../public/src/fantasy-accounts.mjs';
export {fantasyWalletKey};
const cents = (n) => Math.round(n * 100) / 100;
// One initial endowment per user/Quasi league. Preserve all debits and payouts
// from old competition wallets, removing only the duplicated starting credits.
export function ensureFantasyWallet(l, member, key=null) {
  if(key){member.fantasyWallets??={};return member.fantasyWallets[key]??={initial:500,credits:500};}
  if (member.fantasyWallet) return member.fantasyWallet;
  const previous = Object.values(member.fantasyBalances || {}),
    initial = previous.find((w) => Number.isFinite(w.initial))?.initial ?? 500;
  member.fantasyWallet = {
    initial,
    credits: cents(
      initial +
        previous.reduce(
          (sum, w) =>
            sum +
            (Number.isFinite(w.credits) ? w.credits : initial) -
            (Number.isFinite(w.initial) ? w.initial : initial),
          0,
        ),
    ),
  };
  member.fantasyWalletMigration = {
    version: 1,
    at: new Date().toISOString(),
    previousBalances: structuredClone(member.fantasyBalances || {}),
  };
  return member.fantasyWallet;
}
export function migrateFantasyWallets(s,onlyLeague=null) {
  let migrated=0;
  for (const l of s.leagues||[]) {
    if(onlyLeague&&l.id!==onlyLeague)continue;
    const rounds=(s.rounds||[]).filter(r=>r.league===l.id&&r.virtualBookmaker);if(!rounds.length)continue;
    l.fantasyWalletScopes??={};
    for(const r of rounds)l.fantasyWalletScopes[r.competitionKey]??=r.nativeFanta?.leagueId||r.competitionKey;
    for(const r of rounds)if(r.nativeFanta?.leagueId)l.fantasyWalletScopes[r.competitionKey]=r.nativeFanta.leagueId;
    const groups=[...new Set(rounds.map(r=>fantasyWalletKey(r,l)))].filter(Boolean).sort();
    for(const m of [...l.members,...(l.removedMembers||[])]){
      if(m.fantasyWalletMigration?.version!==2){
        const legacy=structuredClone(ensureFantasyWallet(l,m)),wallets={};let net=0;
        for(const key of groups){const own=rounds.filter(r=>fantasyWalletKey(r,l)===key),slips=own.flatMap(r=>r.slips||[]).filter(x=>x.uid===m.uid),change=cents(slips.reduce((n,x)=>n-(x.stake||0)+(x.creditsSettled?x.prize||0:0),0));
          wallets[key]={initial:legacy.initial,credits:cents(legacy.initial+change)};net+=change;
        }
        const residual=cents(legacy.credits-legacy.initial-net);if(groups.length)wallets[groups[0]].credits=cents(wallets[groups[0]].credits+residual);
        m.fantasyWallets=wallets;
        m.fantasyWalletMigration={version:2,at:new Date().toISOString(),previousWallet:legacy,previousBalances:structuredClone(m.fantasyBalances||{}),previousMigration:m.fantasyWalletMigration||null,initialPerLeague:legacy.initial,unattributedAdjustment:residual,adjustmentLeague:residual?groups[0]:null,policy:'independent-league-funds-v2'};
        migrated++;
      }
      for(const key of groups)ensureFantasyWallet(l,m,key);
    }
  }
  return migrated;
}
