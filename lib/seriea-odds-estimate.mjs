import {poissonOdds} from './bar-fanta-odds.mjs';
import {normalizeTeam} from './calendar.mjs';

const points=(forGoals,against)=>forGoals>against?3:forGoals===against?1:0;
const clamp=value=>Math.max(.3,Math.min(4,value));

export function estimateSerieAOdds(fixtures,history,now){
 const form=new Map();
 const games=[...history].sort((a,b)=>Date.parse(b.kickoff)-Date.parse(a.kickoff));
 const team=name=>{
  const key=normalizeTeam(name);
  if(!form.has(key))form.set(key,{points:0,forGoals:0,against:0,recent:[]});
  return form.get(key);
 };
 for(const fixture of fixtures){team(fixture.home);team(fixture.away);}
 for(const game of games){
  const [home,away]=game.score;
  for(const [name,forGoals,against] of [[game.home,home,away],[game.away,away,home]]){
   const row=team(name);
   row.points+=points(forGoals,against);row.forGoals+=forGoals;row.against+=against;
   if(row.recent.length<5)row.recent.push({forGoals,against,points:points(forGoals,against)});
  }
 }
 const ranking=[...form.values()].sort((a,b)=>b.points-a.points||
  (b.forGoals-b.against)-(a.forGoals-a.against)||b.forGoals-a.forGoals);
 const mean=games.length?games.reduce((sum,m)=>sum+m.score[0]+m.score[1],0)/(2*games.length):1.35;
 const project=(row,column,prior)=>{
  const weight=row.recent.reduce((total,_,i)=>total+1-i*.12,0);
  return (2.5*prior+row.recent.reduce((total,r,i)=>total+r[column]*(1-i*.12),0))/(2.5+weight);
 };
 const rank=row=>{
  const index=ranking.findIndex(other=>row.points===other.points&&row.forGoals===other.forGoals&&row.against===other.against);
  return index/Math.max(1,ranking.length-1);
 };
 const acquiredAt=new Date(now).toISOString();
 return new Map(fixtures.map(fixture=>{
  const home=team(fixture.home),away=team(fixture.away);
  const relative=(rank(away)-rank(home))*.24+(project(home,'points',1.4)-project(away,'points',1.4))*.10;
  const expected=(attack,defence,edge)=>clamp((.55*project(attack,'forGoals',mean)+.45*project(defence,'against',mean))*Math.exp(edge));
  const odds=poissonOdds(expected(home,away,.13+relative),expected(away,home,-.13-relative));
  return [fixture.id,Object.fromEntries(Object.entries(odds).map(([pick,value])=>
   [pick,{value,provider:'STIMA-SERIE-A',estimated:true,sources:[],acquiredAt}]))];
 }));
}
