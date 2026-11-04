// Statistical comparison tables can use a complete calculation before the
// provider's final verification. Incomplete live totals never enter the table.
export const tableEligible=r=>!!r.official||!r.historical&&r.data?.calculation?.complete===true;
export const tableResults=results=>results.filter(tableEligible).map(r=>({...r.data,official:true}));
