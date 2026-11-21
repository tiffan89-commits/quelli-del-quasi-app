import {clamp,round} from './math.mjs';

export const MULTI_GOAL_VOTE_POLICY='multi-goal-performance-v1';

export function multiGoalVote(goalSupport,preFloorVote,{base,coverage,penMissed}){
 const goals=goalSupport.count;
 if(goals<2)return null;
 if(goals>=4)return {goals,target:10,minimum:10,maximum:10,performance:0};
 const target=goals===3?9:8,maximum=goals===3?10:9.5;
 const evidence=preFloorVote-base-goalSupport.first;
 const seriousNegative=evidence<-.85&&(coverage>=.45||penMissed>=2);
 const performance=round(clamp(evidence*.65,seriousNegative?-.5:0,maximum-target));
 return {goals,target,minimum:round(target+performance),maximum,performance};
}

// Describe observed goals, never infer a scorer or the order of same-minute goals.
export function playerGoalImpact(raw,playerId,teamId,timeline){
 const side=teamId===raw.teams?.home?.id?'home':'away',other=side==='home'?'away':'home';
 if(!timeline.consistent)return {verified:false,usefulResult:false,goals:[],reason:'goal-timeline-incomplete'};
 const score={home:0,away:0},goals=[],sameMinute=new Map();
 for(const e of timeline.goals)sameMinute.set(e.clock.key,(sameMinute.get(e.clock.key)||0)+1);
 for(const e of timeline.goals){
  const scoring=e.scoring===raw.teams.home.id?'home':'away',against=scoring==='home'?'away':'home',before={...score};score[scoring]++;
  if(e.player?.id!==playerId||e.scoring!==teamId||/own goal/i.test(e.detail||'')||timeline.playing&&e.clock.elapsed>timeline.end)continue;
  const ambiguous=sameMinute.get(e.clock.key)>1,types=[];
  if(!ambiguous){if(score[scoring]===score[against]&&before[scoring]<before[against])types.push('equalizer');if(score[scoring]===score[against]+1&&before[scoring]===before[against])types.push('go-ahead');if(timeline.actual[scoring]>timeline.actual[against]&&score[scoring]===timeline.actual[against]+1)types.push('match-winner');}
  goals.push({minute:e.clock.elapsed,extra:e.clock.extra,types,important:types.length>0,ambiguous,scoreBefore:before,scoreAfter:{...score},penalty:/penalty/i.test(e.detail||'')});
 }
 return {verified:true,usefulResult:timeline.actual[side]>=timeline.actual[other],final:timeline.final,result:timeline.actual[side]>timeline.actual[other]?'win':timeline.actual[side]===timeline.actual[other]?'draw':'loss',margin:timeline.actual[side]-timeline.actual[other],goals};
}

export function evaluateGoalSupport(input,individual,context,{config}={}){
 const policy=config.goalSupport,impact=input.goalImpact,count=input.events?.goals;
 if(!Number.isInteger(count)||count<=0)return {delta:0,first:0,count:0,additional:[],reason:'no-observed-goal',provisional:!input.final};
 const observed=impact?.verified?impact.goals||[]:[],anchor=observed.find(g=>g.important&&!g.ambiguous)||observed[0]||{types:[],important:false,source:'player-statistics'};
 const side=input.fixture?.teamSide,other=side==='home'?'away':'home',score=input.fixture?.score,marginValue=Number.isFinite(score?.[side])&&Number.isFinite(score?.[other])?score[side]-score[other]:null,resultKind=marginValue==null?null:marginValue>0?'win':marginValue<0?'loss':'draw';
 const performance=clamp(1+(individual.value-config.base)/policy.performanceScale,policy.performanceMin,policy.performanceMax),probability=context.odds?.probabilities?.[input.fixture?.teamSide==='home'?'1':'2'];
 const oddsWeight=context.odds?.sourceKind==='estimated'?.45:context.odds?.sourceKind==='averaged'?.65:1;
 const difficulty=Number.isFinite(probability)?clamp(1+(.5-probability)*oddsWeight,policy.difficultyMin,policy.difficultyMax):1;
 const result=resultKind==='draw'?policy.drawFactor:resultKind==='loss'?policy.lossFactor:1,margin=marginValue==null?1:Math.max(policy.marginFloor,1/Math.max(1,Math.abs(marginValue))),remaining=observed.filter(g=>g!==anchor);
 const additional=Array.from({length:count-1},(_,i)=>{const goal=remaining[i]||{types:[],important:false,source:'player-statistics'},importance=goal.important&&!goal.ambiguous?1:policy.otherGoalFactor;return {goal,delta:round(policy.additional*policy.decay**i*performance*difficulty*result*margin*importance),importance};});
 return {delta:round(Math.min(policy.max,policy.first+additional.reduce((n,g)=>n+g.delta,0))),first:policy.first,count,anchor,additional,factors:{performance:round(performance),difficulty:round(difficulty),result,margin:round(margin),oddsAvailable:Number.isFinite(probability)},provisional:!input.final,reason:'observed-goal-regardless-of-result'};
}
