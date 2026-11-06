// Public precision: steps of 0.05, at most two decimals; dust is exactly zero.
export function statNumber(n){return Number.isFinite(n)?Math.abs(n)<.025?0:Math.round((n+Number.EPSILON)*20)/20:null;}
export const formatStatNumber=n=>statNumber(n)==null?'–':statNumber(n).toLocaleString('it-IT',{maximumFractionDigits:2});
