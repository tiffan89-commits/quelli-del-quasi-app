// Official lineups win. Estimates are stored once by the backend, never learnt
// from a previous forecast or from API-Football's rating instead of our base vote.
export const PRESENCE_MODEL='recent-form-v2';
const numeric=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const clamp=x=>Math.max(0,Math.min(1,x));
export function currentPresenceEstimate(p){const e=p.presenceEstimate;return e?.model===PRESENCE_MODEL&&(!p.clubId||e.clubId===p.clubId)&&numeric(e.pct)!==null&&e.pct>=0&&e.pct<=100?e:null;}
export function estimatePresence(p){
 if(/injured|suspended|unavailable|infortun|squalific|indispon/i.test(p.status?.type||''))return null;
 const minutes=numeric(p.stats?.minutes)??numeric(p.seasonStats?.games?.minutes),matches=numeric(p.stats?.teamMatches)??numeric(p.matches);
 const prior=minutes!==null&&minutes>=0&&matches!==null&&matches>0?clamp(minutes/(90*matches)):null;
 const seen=new Set(),recent=(p.stats?.recentPresence||[]).filter((r,i)=>{const id=r.fixtureId||'row:'+i;if(seen.has(id))return false;seen.add(id);return true;}).slice(0,5);
 let denominator=0,minuteShare=0,quality=0,count=0,starts=0,misses=0;
 for(const [i,r]of recent.entries()){
  const m=numeric(r.minutes);if(r.known!==true||m===null||m<0)continue;
  const weight=2**(-i),good=numeric(r.baseVote)>6.2||r.decisiveGoal===true||r.decisiveAssist===true;
  denominator+=weight;minuteShare+=weight*clamp(m/90);count++;
  if(good&&m>0)quality+=weight*(r.starter===true?1:.35)*(r.decisiveGoal||r.decisiveAssist?1.25:1);
 }
 for(const r of recent){if(r.known!==true||r.starter!==true)break;starts++;}
 for(const r of recent){if(r.known!==true||numeric(r.minutes)!==0)break;misses++;}
 if(!count)return prior===null?null:{pct:Math.min(97,Math.round(prior*100)),evidence:{recentMatches:0,starterStreak:0,missedStreak:0,seasonShare:prior}};
 const recentShare=minuteShare/denominator,form=quality/denominator,recentWeight=.6+.3*(1-Math.exp(-(count-1)));
 let chance=(1-recentWeight)*(prior??recentShare)+recentWeight*recentShare;
 // Exponential saturation: recent consecutive starts quickly displace an old
 // bench-player prior, while remaining an estimate rather than a guaranteed XI.
 chance=1-(1-chance)*Math.exp(-.28*starts-.35*form);
 if(misses)chance*=Math.exp(-.3*misses);
 return {pct:Math.min(97,Math.max(0,Math.round(chance*100))),evidence:{recentMatches:count,starterStreak:starts,missedStreak:misses,seasonShare:prior,recentShare,recentWeight,goodForm:form}};
}
export function presenceProbability(p){
 const value=numeric(p.play?.pct);
 if(p.play?.source==='official'&&value!==null&&value>=0&&value<=100)return {pct:Math.round(value),source:'official'};
 if(/injured|suspended|unavailable|infortun|squalific|indispon/i.test(p.status?.type||''))return null;
 const stored=currentPresenceEstimate(p);if(stored)return {pct:Math.min(97,Math.round(stored.pct)),source:'minutes-estimate'};
 if(p.presenceEstimate?.model===PRESENCE_MODEL&&(!p.clubId||p.presenceEstimate.clubId===p.clubId))return null;
 if(p.stats?.recentPresence?.length){const estimate=estimatePresence(p);return estimate?{pct:estimate.pct,source:'minutes-estimate'}:null;}
 if(p.play?.source==='minutes-estimate'&&value!==null&&value>=0&&value<=100)return {pct:Math.min(97,Math.round(value)),source:'minutes-estimate'};
 const estimate=estimatePresence(p);return estimate?{pct:estimate.pct,source:'minutes-estimate'}:null;
}
