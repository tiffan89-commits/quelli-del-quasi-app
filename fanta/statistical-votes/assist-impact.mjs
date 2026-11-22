import {statNumber} from '../../public/src/fanta/stat-number.mjs';
import {roundByBands} from './math.mjs';

export const MULTI_ASSIST_VOTE_POLICY='multi-assist-seven-v1';
export const hasMultipleAssists=events=>Number.isInteger(events?.assists)&&events.assists>=2;

export function multiAssistAdjustment(events,rawVote,individual,{config,referenceOnly}){
 if(!hasMultipleAssists(events)||referenceOnly||individual.coverage<.5||individual.value<config.base
   ||events.red>0||events.penMissed>0||events.ownGoals>0||config.maxVote<7)return 0;
 const bands=config.rounding.bands,previous=statNumber(rawVote);
 if(roundByBands(previous,bands)!==6.5)return 0;
 // Supply only the missing amount, up to a tenth, if that is enough to reach 7.
 return [.05,.1].find(delta=>roundByBands(statNumber(previous+delta),bands)===7)||0;
}
