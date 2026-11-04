import {finite,round} from './math.mjs';
export const RATING_RANK_POLICY=Object.freeze({
 matchBest:[.5,.3,.1,.05],teamBest:[.3,.18,.06,.03],
 matchWorst:[-.5,-.3,-.1,-.05],teamWorstLoss:[-.3,-.18,-.06,-.03],teamWorstOther:[-.1,-.06,-.02,-.01],
});
export function validRating(value){const n=finite(value);return n!==null&&n>0&&n<=10?n:null;}
export const hasFixtureRatings=raw=>(raw.players||[]).some(t=>(t.players||[]).some(p=>validRating(p.statistics?.[0]?.games?.rating)!==null));
export function attachRatingRanks(players,raw){
 const ratings=new Map((raw.players||[]).flatMap(t=>(t.players||[]).map(p=>['af:'+p.player.id,validRating(p.statistics?.[0]?.games?.rating)])));
 const eligible=players.filter(p=>p.onField&&ratings.get(p.id)!==null&&ratings.has(p.id));
 const rank=(pool,rating,best)=>pool.length>1&&pool.some(p=>ratings.get(p.id)!==rating)?1+pool.filter(p=>best?ratings.get(p.id)>rating:ratings.get(p.id)<rating).length:null;
 return players.map(p=>{const rating=ratings.get(p.id)??null,team=eligible.filter(x=>x.teamId===p.teamId),available=p.onField&&rating!==null;
  return {...p,providerRating:rating,ratingRanks:{matchCount:eligible.length,teamCount:team.length,
   matchBest:available?rank(eligible,rating,true):null,matchWorst:available?rank(eligible,rating,false):null,
   teamBest:available?rank(team,rating,true):null,teamWorst:available?rank(team,rating,false):null}};
 });
}
export function evaluateRatingImpact(input,{config}={}){
 const policy=config?.ratingRanks||RATING_RANK_POLICY,ranks=input.ratingRanks||{},rating=validRating(input.providerRating),score=input.fixture?.score,side=input.fixture?.teamSide,opposite=side==='home'?'away':'home';
 const known=side&&Number.isFinite(score?.[side])&&Number.isFinite(score?.[opposite]),losing=known&&score[side]<score[opposite];
 if(!input.onField||rating===null)return {available:false,delta:0,candidates:[],selected:null};
 const candidates=[['matchBest',policy.matchBest,'Migliori della partita'],['teamBest',policy.teamBest,'Migliori della squadra'],['matchWorst',policy.matchWorst,'Peggiori della partita'],['teamWorst',losing?policy.teamWorstLoss:policy.teamWorstOther,'Peggiori della squadra']]
  .flatMap(([key,values,label])=>{const rank=ranks[key],delta=values?.[rank-1];return Number.isInteger(rank)&&Number.isFinite(delta)?[{key,rank,label,delta}]:[];});
 const max=Math.max(0,...candidates.map(c=>Math.abs(c.delta))),strongest=candidates.filter(c=>Math.abs(c.delta)===max),ambiguous=strongest.some(c=>c.delta>0)&&strongest.some(c=>c.delta<0),selected=ambiguous?null:strongest[0]||null;
 return {available:true,rating,ranks,losing,provisional:!input.final,delta:round(selected?.delta||0),selected,candidates,ambiguous,
  policy:'single-largest-absolute-v1'};
}
