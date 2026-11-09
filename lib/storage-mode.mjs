export const barStorageMode=()=>process.env.SELFHOST_BAR_STORAGE==='rows'?'rows':'snapshot';
export const barStorageRoot=()=>barStorageMode()==='rows'?'public.fanta_state':'fanta_state';
export const barMembershipRoot=()=>barStorageMode()==='rows'?'fanta.bar_membership_document':'fanta_state';
