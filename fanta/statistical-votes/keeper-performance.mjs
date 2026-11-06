import {clamp} from './math.mjs';
import {statNumber} from '../../public/src/fanta/stat-number.mjs';
// xG is pressure, never an invented measure of the difficulty of an individual save.
export function evaluateKeeperPerformance(p,{config}={}){
 const empty={available:false,stopping:null,resultDelta:0,resultKind:null,evidence:'unavailable'};
 if(p.role!=='P'||!p.onField||!Number.isFinite(p.metrics?.saves)||!(p.minutes>0))return empty;
 const c=config.keeper,saves=p.metrics.saves,interval=p.presence?.intervals?.[0],conceded=interval?.goalsAgainst??p.events?.conceded;
 if(!Number.isFinite(conceded))return empty;
 const exposure=clamp(p.minutes/(p.fixture?.duration||90),0,1),shots=p.context?.opponent?.shotsOn,xgot=p.context?.opponent?.xgot,xg=p.context?.opponent?.xg;
 const faced=Math.max(saves+conceded,Number.isFinite(shots)?shots:0),saveRate=faced?saves/faced:0;
 const volume=clamp((saves-1)/(c.exceptionalSaves-1),0,1),efficiency=clamp((saveRate-.6)/.275,0,1),pressure=Number.isFinite(xg)&&Number.isFinite(shots)?.65*clamp(xg/2,0,1)+.35*clamp(shots/8,0,1):Number.isFinite(xg)?clamp(xg/2,0,1):Number.isFinite(shots)?clamp(shots/8,0,1):0;
 const rating=Number.isFinite(p.providerRating)?p.providerRating:null;
 // A very high provider assessment corroborates the proxy; it is not another additive rating bonus.
 const corroboration=rating==null?.65:rating>=c.exceptionalRating?1:rating>=8?.85:rating>=7?.65:.45;
 let stopping=c.maxStopping*volume*(.55+.45*efficiency)*(.55+.45*pressure)*corroboration*exposure,evidence='volume-efficiency-pressure-proxy';
 if(Number.isFinite(xgot)&&p.final&&p.presence?.starter&&!p.presence?.endedBeforeFinal&&exposure===1){stopping=clamp((xgot-conceded)/2,-1,1)*c.maxStopping;evidence='documented-postshot-goals-prevented';}
 const side=p.fixture?.teamSide||p.presence?.ownSide,score=p.fixture?.score,other=side==='home'?'away':'home',win=side&&Number.isFinite(score?.[side])&&Number.isFinite(score?.[other])&&score[side]>score[other];
 let resultKind=null,resultDelta=0;
 if(p.minutes>=c.minResultMinutes&&saves>0){
  if(conceded===0&&(Number.isFinite(score?.[other])?score[other]===0:exposure===1)){resultKind='clean-sheet';resultDelta=c.resultMax*Math.min(1,saves/5)*exposure;}
  else if(win&&conceded===1&&saveRate>=.65){resultKind='winning-saves';resultDelta=c.resultMax*Math.min(1,saves/5)*efficiency*exposure;}
 }
 return {available:true,stopping:statNumber(stopping),resultDelta:statNumber(resultDelta),resultKind,evidence,saves,conceded,saveRate,pressure,corroboration,provisional:!p.final,shotQualityKnown:Number.isFinite(xgot)};
}
export function applyKeeperPerformance(individual,keeper,base=6){
 if(!keeper.available)return individual;
 const blocks=individual.blocks.map(b=>b.key==='stopping'?{...b,observed:true,delta:keeper.stopping,keeperEvidence:keeper.evidence}:b);
 const delta=statNumber(blocks.reduce((n,b)=>n+(b.delta||0),0));return {...individual,blocks,delta,value:statNumber(base+delta)};
}
