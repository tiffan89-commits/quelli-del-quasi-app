// Same neutral band in the statistical engine and the player detail.
export const NEUTRAL_STAT_POLICY=Object.freeze({scaleFraction:.25,volumeFraction:.10,rateFloor:.02});
export function compareStat(value,reference,{scale=0,rate=false,policy=NEUTRAL_STAT_POLICY}={}){
 if(!Number.isFinite(value)||!Number.isFinite(reference))return {comparison:'unknown',tolerance:null,excess:null};
 const tolerance=Math.max(Math.abs(scale||0)*policy.scaleFraction,rate?policy.rateFloor:Math.abs(reference)*policy.volumeFraction),difference=value-reference;
 const excess=Math.sign(difference)*Math.max(0,Math.abs(difference)-tolerance);
 return {comparison:Math.abs(difference)<=tolerance+1e-9?'near':difference>0?'above':'below',tolerance,excess:Math.abs(excess)<1e-9?0:excess};
}
