// Forecasts take precedence. Estimates use minutes, never the last round's forecast.
const numeric=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export function presenceProbability(p){
 const value=numeric(p.play?.pct);
 if(p.play?.source==='official'&&value!==null&&value>=0&&value<=100)return {pct:Math.round(value),source:'official'};
 if(/injured|suspended|unavailable|infortun|squalific|indispon/i.test(p.status?.type||''))return null;
 if(p.play?.source==='minutes-estimate'&&value!==null&&value>=0&&value<=100)return {pct:Math.round(value),source:'minutes-estimate'};
 const minutes=numeric(p.stats?.minutes)??numeric(p.seasonStats?.games?.minutes);
 const matches=numeric(p.stats?.teamMatches)??numeric(p.matches);
 if(minutes===null||minutes<0||matches===null||matches<=0)return null;
 return {pct:Math.min(100,Math.max(0,Math.round(minutes/(90*matches)*100))),source:'minutes-estimate'};
}
