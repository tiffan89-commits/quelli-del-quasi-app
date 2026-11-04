import {digest} from './math.mjs';
import {NEUTRAL_STAT_POLICY} from '../../public/src/fanta/stat-comparison.mjs';
export const MODEL='quasi-statistical-v2.4.0';
const settings={
 neutralStats:{...NEUTRAL_STAT_POLICY},
 contextDataVersion:'career-import-2026-v1',
 marquee:{enabled:true,teamIds:[489,505,496,492,497,487,499],bonus:.5,regularMax:.75,youngDebutBonus:1,youngMaxAge:23,weights:{performance:.45,decisiveness:.3,difficulty:.15,participation:.1}},
 experimental:true,base:6,minVote:3,maxVote:9,individualScale:1.8,categoryCap:1,
 ratingRanks:{matchBest:[.5,.3,.1,.05],teamBest:[.3,.18,.06,.03],matchWorst:[-.5,-.3,-.1,-.05],teamWorstLoss:[-.3,-.18,-.06,-.03],teamWorstOther:[-.1,-.06,-.02,-.01]},
 minMinutes:15,eventExceptions:true,
 rounding:{bands:[[3,3],[3.3,3.5],[3.6,4],[4.3,4.5],[4.6,5],[5.3,5.5],[5.6,6,true],[6.2,6.5,true],[6.65,7,true],[7.25,7.5,true],[7.75,8,true],[8.25,8.5,true],[8.75,9,true]]},
 eventVotes:{scorerMinimum:6,penaltySaveMinimum:6.5,penaltyMiss:.5},
 goalSupport:{first:.5,additional:.2,decay:.5,max:.9,performanceScale:2,performanceMin:.4,performanceMax:1.2,difficultyMin:.6,difficultyMax:1.25,drawFactor:.8,lossFactor:.65,marginFloor:.25,otherGoalFactor:.5},
 aggregation:{passing:[.25,.75],defense:[.55,.45],dribbling:[.35,.65],shooting:[.35,.65],creation:[.85,.15],defendingDuels:[.65,.35],dribblingDuels:[.7,.3],midfieldProgression:[.8,.2],forwardParticipation:[.8,.2],zCap:3,scaleFloor:.5,exposureFloor:.25,keeperSaveCap:.4,keeperSaveLogBase:9,keeperPostshotScale:2,opportunityAdjustment:.25,opportunityCap:.2},
 confidenceWeights:{individual:.8,context:.2},
 maxRedistribution:0.10,maxWeightMultiplier:1.25,
 weights:{P:{stopping:.60,distribution:.20,defending:.20},D:{defending:.40,duels:.25,distribution:.25,creation:.10},C:{distribution:.30,creation:.30,defendingDuels:.25,shooting:.15},A:{shooting:.40,creation:.25,dribblingDuels:.25,defending:.10}},
 quality:{minHistoricalRows:50,minHistoricalFixtures:8,minHistoricalPlayers:20,minHistoricalMinutes:60,maxHistoricalDays:730,heuristicConfidence:.45,historyConfidence:.8,attemptPrior:10,passPrior:20,shortMinutesShrinkage:30},
 semantics:{passesAccuracy:'completed-count',tacklesBlocks:'unverified'},
 context:{max:.75,expectationWeight:.55,qualityWeight:.45,correlationScale:.85,finalTeamCaution:.55,missingOddsMax:.55,modelOddsReliability:.45,averagedOddsReliability:.65,bookmakerReliability:.9,afterExitNegativeWeight:.10,afterExitQualityWeight:.25,unknownPresenceWeight:.35,positiveIndividualFloor:.15,negativeIndividualFloor:.20,individualModulationScale:1.5,
  roleCaution:{P:.7,D:.8,C:.9,A:.9},liveMaturityMinutes:60,
  q:{xgWeight:.65,onTargetWeight:.25,shotsWeight:.10,xgScale:1.5,onTargetSmoothing:2,shotsSmoothing:4,missingXgReliability:.45}},
 // Full-match prior volumes: shrink toward these; never extrapolate a brief spell to per-90.
 priors:{
 P:{saves:[3,2],passesTotal:[25,14],passAccuracy:[.70,.12],tackles:[.15,.5],interceptions:[.1,.4],areaClaims:[1,1]},
 D:{foulsDrawn:[.7,1],tackles:[1.5,1.5],interceptions:[1,1],duelsTotal:[8,4],duelEfficiency:[.55,.18],passesTotal:[50,22],passAccuracy:[.82,.10],keyPasses:[.5,.8],dribblesAttempts:[1,1.4],dribbleEfficiency:[.55,.22]},
 C:{foulsDrawn:[1.2,1.4],tackles:[1.5,1.5],interceptions:[1,1],duelsTotal:[8,4],duelEfficiency:[.52,.18],passesTotal:[52,24],passAccuracy:[.83,.10],keyPasses:[1.3,1.4],shotsTotal:[1.8,1.5],shotEfficiency:[.35,.22],dribblesAttempts:[2,2],dribbleEfficiency:[.55,.22]},
 A:{foulsDrawn:[1.4,1.5],tackles:[.6,.9],interceptions:[.3,.6],duelsTotal:[7,4],duelEfficiency:[.45,.18],passesTotal:[25,14],passAccuracy:[.75,.14],keyPasses:[.9,1.1],shotsTotal:[3,2],shotEfficiency:[.40,.22],dribblesAttempts:[2.5,2],dribbleEfficiency:[.52,.22]}}
};
const merge=(a,b)=>{const out=structuredClone(a);for(const[k,v]of Object.entries(b||{}))out[k]=v&&typeof v==='object'&&!Array.isArray(v)&&a?.[k]&&typeof a[k]==='object'?merge(a[k],v):v;return out;};
function validate(value,path='config'){for(const[k,v]of Object.entries(value)){if(typeof v==='number'&&!Number.isFinite(v))throw Error('Coefficiente non valido: '+path+'.'+k);if(v&&typeof v==='object')validate(v,path+'.'+k);}if(path==='config'&&(!value.neutralStats||['scaleFraction','volumeFraction','rateFloor'].some(k=>!Number.isFinite(value.neutralStats[k])||value.neutralStats[k]<0||value.neutralStats[k]>1)))throw Error('Fascia neutra delle statistiche non valida');}
function freeze(x){Object.values(x).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(x);}
export const DEFAULT_CONFIG=freeze(settings);
export function voteConfig(overrides={}){const result=merge(DEFAULT_CONFIG,overrides);validate(result);const marquee=result.marquee;if(!Array.isArray(marquee.teamIds)||marquee.teamIds.some(id=>!Number.isInteger(id)||id<=0)||marquee.bonus<0||marquee.bonus>.5||marquee.regularMax<marquee.bonus||marquee.regularMax>marquee.youngDebutBonus||Object.values(marquee.weights).some(w=>w<0)||Math.abs(Object.values(marquee.weights).reduce((a,b)=>a+b,0)-1)>1e-8||marquee.youngDebutBonus<marquee.bonus||marquee.youngDebutBonus>1||!Number.isInteger(marquee.youngMaxAge)||marquee.youngMaxAge<16||marquee.youngMaxAge>23)throw Error('Contesto partite di cartello non valido');for(const weights of Object.values(result.weights)){if(Object.values(weights).some(w=>w<0)||Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('I pesi dei blocchi devono sommare a uno');}if(result.context.max<0||result.context.max>2||result.minMinutes<0||result.maxWeightMultiplier<1||result.maxRedistribution<0)throw Error('Configurazione dei limiti non valida');const bands=result.rounding.bands;if(!Array.isArray(bands)||!bands.length||bands.some(([threshold,vote,strict],i)=>!Number.isFinite(threshold)||!Number.isFinite(vote)||strict!==undefined&&typeof strict!=='boolean'||i>0&&(threshold<=bands[i-1][0]||vote<=bands[i-1][1])))throw Error('Soglie di arrotondamento non valide');const g=result.goalSupport;if(g.first<0||g.additional<0||g.max<g.first||g.decay<0||g.decay>1||g.performanceScale<=0||g.performanceMin<0||g.performanceMax<g.performanceMin||g.difficultyMin<0||g.difficultyMax<g.difficultyMin||g.marginFloor<0||g.marginFloor>1||g.drawFactor<0||g.drawFactor>1||g.lossFactor<0||g.lossFactor>1||g.otherGoalFactor<0||g.otherGoalFactor>1)throw Error('Sostegno gol non valido');const e=result.eventVotes;if(e.scorerMinimum<result.minVote||e.scorerMinimum>result.maxVote||e.penaltySaveMinimum<e.scorerMinimum||e.penaltySaveMinimum>result.maxVote||e.penaltyMiss<0)throw Error('Soglie episodi non valide');return result;}
export const configDigest=config=>digest({model:MODEL,config});
