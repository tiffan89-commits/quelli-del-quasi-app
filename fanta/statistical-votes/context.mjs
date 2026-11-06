import {count,finite,median,round,validTimestamp,digest,clamp} from './math.mjs';
import {DEFAULT_CONFIG} from './config.mjs';
const PICKS=['1','X','2'];
export function prematchSnapshot(match){
 const kickoff=validTimestamp(match?.kickoff);if(!kickoff)return null;const frozen=match.frozen||{},books=new Map(),rejected=[];
 for(const pick of PICKS)for(const source of frozen[pick]?.sources||[]){const id=String(source.id||'');if(!id)continue;const b=books.get(id)||{id,name:source.name||id,quotes:{},timestamps:{},acquiredAt:{}};b.quotes[pick]=finite(source.odd);b.timestamps[pick]=source.updatedAt;b.acquiredAt[pick]=frozen[pick].acquiredAt;books.set(id,b);}
 const valid=[];for(const b of books.values()){
  const times=PICKS.flatMap(p=>[validTimestamp(b.timestamps[p]),validTimestamp(b.acquiredAt[p])]);
  if(PICKS.some(p=>!(b.quotes[p]>1))){rejected.push({id:b.id,reason:'incomplete-1x2'});continue;}
  if(times.some(t=>!t||Date.parse(t)>=Date.parse(kickoff))){rejected.push({id:b.id,reason:'not-a-verifiable-prematch-snapshot'});continue;}
  const implied=PICKS.map(p=>1/b.quotes[p]),margin=implied.reduce((a,b)=>a+b,0);valid.push({...b,overround:round(margin-1),probabilities:Object.fromEntries(PICKS.map((p,i)=>[p,implied[i]/margin]))});
 }
 let probabilities,sourceKind='bookmaker',capturedAt;if(valid.length){const med=PICKS.map(p=>median(valid.map(b=>b.probabilities[p]))),sum=med.reduce((a,b)=>a+b,0);probabilities=Object.fromEntries(PICKS.map((p,i)=>[p,med[i]/sum]));capturedAt=PICKS.flatMap(p=>valid.map(b=>validTimestamp(b.acquiredAt[p]))).sort().at(-1);}
 else{
  const rows=PICKS.map(p=>frozen[p]),times=rows.map(r=>validTimestamp(r?.acquiredAt));if(rows.some(r=>!(finite(r?.value)>1))||times.some(t=>!t||Date.parse(t)>=Date.parse(kickoff)))return {available:false,kickoff,rejected,warnings:['no-valid-prematch-odds']};
  const values=rows.map(r=>1/r.value),total=values.reduce((a,b)=>a+b,0);probabilities=Object.fromEntries(PICKS.map((p,i)=>[p,values[i]/total]));sourceKind=rows.some(r=>r.estimated)?'estimated':'averaged';capturedAt=times.sort().at(-1);
 }
 const data={available:true,fixtureId:match.apiFootballId||match.id,kickoff,capturedAt,source:rowsProvider(match),sourceKind,method:valid.length?'median-of-overround-removed-complete-books':'normalized-inverse-average-odds-approximation',books:valid,bookmakers:valid.length,probabilities:Object.fromEntries(PICKS.map(p=>[p,round(probabilities[p],12)])),rejected,warnings:sourceKind==='bookmaker'?[]:[sourceKind==='estimated'?'model-odds-low-confidence':'averaged-odds-approximation']};return {...data,signature:digest(data)};
}
export function collectiveQuality(team={},opponent={},config=DEFAULT_CONFIG){
 const q=config.context.q,components=[];if(team.xg!=null&&opponent.xg!=null)components.push({key:'xg-difference',weight:q.xgWeight,value:Math.tanh((team.xg-opponent.xg)/q.xgScale)});
 if(team.shotsOn!=null&&opponent.shotsOn!=null)components.push({key:'on-target-share',weight:q.onTargetWeight,value:(team.shotsOn-opponent.shotsOn)/(team.shotsOn+opponent.shotsOn+q.onTargetSmoothing)});
 if(team.shotsTotal!=null&&opponent.shotsTotal!=null)components.push({key:'shot-volume-support',weight:q.shotsWeight,value:(team.shotsTotal-opponent.shotsTotal)/(team.shotsTotal+opponent.shotsTotal+q.shotsSmoothing)});
 const hasXg=components.some(c=>c.key==='xg-difference'),coverage=components.reduce((n,c)=>n+c.weight,0),value=components.length?clamp(components.reduce((n,c)=>n+c.weight*c.value,0),-1,1):null;
 return {value:round(value),coverage:round(coverage),components:components.map(c=>({...c,value:round(c.value),contribution:round(c.weight*c.value)})),reliability:hasXg?coverage:coverage*q.missingXgReliability,warnings:[...(!hasXg?['team-xg-unavailable-no-equivalence-assumed']:[]),...(team.xg!=null&&team.xgIncludesPenalties!==false?['xg-includes-penalties-no-standard-subtraction']:[])]};
}
const points=(score,side)=>{if(score?.home==null||score?.away==null)return null;const me=score[side],other=score[side==='home'?'away':'home'];return me>other?3:me<other?0:1;};
export function evaluateContext(input,individual,{config=DEFAULT_CONFIG}={}){
 const c=config.context,fixture=input.fixture||{},presence=input.presence||{},side=fixture.teamSide||presence.ownSide,quality=collectiveQuality(input.context?.team,input.context?.opponent,config),snapshot=input.context?.odds,warnings=[...quality.warnings],kickoff=validTimestamp(fixture.kickoff),oddsValid=snapshot?.available&&kickoff&&snapshot.kickoff===kickoff&&validTimestamp(snapshot.capturedAt)&&Date.parse(snapshot.capturedAt)<Date.parse(kickoff),actualPoints=points(fixture.score,side);let expectedPoints=null,surprise=null,oddsReliability=0;
 if(oddsValid){const p=snapshot.probabilities,ps=[p?.['1'],p?.X,p?.['2']];if(ps.every(p=>Number.isFinite(p)&&p>=0&&p<=1)&&Math.abs(ps.reduce((a,b)=>a+b,0)-1)<1e-6){expectedPoints=3*p[side==='home'?'1':'2']+p.X;if(actualPoints!=null)surprise=(actualPoints-expectedPoints)/3;oddsReliability=snapshot.sourceKind==='estimated'?c.modelOddsReliability:snapshot.sourceKind==='averaged'?c.averagedOddsReliability:c.bookmakerReliability;}}
 if(surprise==null)warnings.push('expectation-component-unavailable');if(snapshot?.sourceKind==='estimated')warnings.push('model-odds-context-confidence-reduced');
 const interval=presence.intervals?.[0],exitPoints=points(interval?.scoreAtExit,side),worsenedAfterExit=!!presence.endedBeforeFinal&&exitPoints!=null&&actualPoints!=null&&exitPoints>actualPoints;
 const resultAttenuation=worsenedAfterExit&&surprise<0?c.afterExitNegativeWeight:1,qualityAttenuation=worsenedAfterExit&&quality.value<0?c.afterExitQualityWeight:1;
 const presenceReliability=presence.confidence??c.unknownPresenceWeight,exposure=presence.exposure??clamp((input.minutes||0)/(fixture.duration||90),0,1),liveMaturity=input.final?1:clamp((fixture.minute??input.minutes??0)/c.liveMaturityMinutes,0,1),roleCaution=c.roleCaution[input.role]||c.roleCaution.P;
 // Only two correlated team signals enter z. Score evolution attenuates them, it is not another win bonus.
 const expectationTerm=surprise==null?null:c.expectationWeight*surprise*oddsReliability*resultAttenuation,
 qualityTerm=quality.value==null?null:c.qualityWeight*quality.value*quality.reliability*c.finalTeamCaution*qualityAttenuation,
 z=c.correlationScale*((expectationTerm??0)+(qualityTerm??0)),positive=z>=0,modulation=positive?c.positiveIndividualFloor+(1-c.positiveIndividualFloor)*(1+Math.tanh(individual.delta/c.individualModulationScale))/2:c.negativeIndividualFloor+(1-c.negativeIndividualFloor)*(1-Math.tanh(individual.delta/c.individualModulationScale))/2;
 const missingExpectationFactor=surprise==null?c.missingOddsMax:1,available=expectationTerm!=null||qualityTerm!=null,baselineDelta=available?c.max*Math.tanh(z)*modulation*exposure*presenceReliability*liveMaturity*roleCaution*missingExpectationFactor:0;
 const u=c.underdogWin,winProbability=surprise!=null?snapshot.probabilities[side==='home'?'1':'2']:null,opponentProbability=surprise!=null?snapshot.probabilities[side==='home'?'2':'1']:null,gap=winProbability==null?null:opponentProbability-winProbability;
 const eligible=actualPoints===3&&winProbability!=null&&winProbability<u.maxWinProbability&&gap>u.minProbabilityGap;
 const severity=eligible?Math.min(clamp((u.maxWinProbability-winProbability)/(u.maxWinProbability-u.fullWinProbability),0,1),clamp((gap-u.minProbabilityGap)/(u.fullProbabilityGap-u.minProbabilityGap),0,1)):0;
 const performanceFactor=clamp(.85+.15*individual.delta,.25,1),evidenceFactor=clamp(oddsReliability/c.bookmakerReliability,0,1),upsetDelta=u.max*severity*exposure*presenceReliability*liveMaturity*performanceFactor*evidenceFactor;
 // One context contribution: use the strongest signal, never sum two versions of the win.
 const delta=clamp(eligible?Math.max(baselineDelta,upsetDelta):baselineDelta,-c.max,c.positiveMax);
 const underdogWin={eligible,severity:round(severity),winProbability,opponentProbability,gap:round(gap),delta:round(upsetDelta),performanceFactor:round(performanceFactor),evidenceFactor:round(evidenceFactor),provisional:!input.final,selected:eligible&&upsetDelta>=baselineDelta};
 return {available,delta:round(delta),baselineDelta:round(baselineDelta),underdogWin,expectedPoints:round(expectedPoints),actualPoints,surprise:round(surprise),quality,z:round(z),terms:{expectation:round(expectationTerm),quality:round(qualityTerm)},modulation:round(modulation),exposure:round(exposure),presenceReliability:round(presenceReliability),liveMaturity:round(liveMaturity),roleCaution,worsenedAfterExit,exitPoints,resultAttenuation,qualityAttenuation,odds:oddsValid?{signature:snapshot.signature,capturedAt:snapshot.capturedAt,bookmakers:snapshot.bookmakers,sourceKind:snapshot.sourceKind,probabilities:snapshot.probabilities}:null,confidence:round((surprise==null?quality.reliability*.5:(oddsReliability+quality.reliability)/2)*presenceReliability*liveMaturity),warnings};
}

function rowsProvider(match){const providers=[...new Set(['1','X','2'].map(p=>match.frozen?.[p]?.provider).filter(Boolean))];return providers.length?providers.join(' / ')+' / archived application snapshot':'The Odds API / archived application snapshot';}
