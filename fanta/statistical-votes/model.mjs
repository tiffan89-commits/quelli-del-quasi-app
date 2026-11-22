import {statNumber} from '../../public/src/fanta/stat-number.mjs';
import {evaluateKeeperPerformance,applyKeeperPerformance} from './keeper-performance.mjs';
import {evaluateMarquee} from './marquee.mjs';
import {bonuses,DEFAULT_RULES,round2} from '../rules.mjs';
import {MODEL,voteConfig,configDigest} from './config.mjs';
import {round,clamp,roundByBands,digest} from './math.mjs';
import {evaluateIndividual,LABELS} from './individual.mjs';
import {evaluateContext} from './context.mjs';
import {evaluateGoalSupport,multiGoalVote,MULTI_GOAL_VOTE_POLICY} from './goal-impact.mjs';
import {hasMultipleAssists,multiAssistAdjustment,MULTI_ASSIST_VOTE_POLICY} from './assist-impact.mjs';
import {evaluateRatingImpact} from './rating-impact.mjs';
import {describePerformance,NARRATIVE_VERSION} from './narrative.mjs';
export function calculateStatisticalVote(input,{rules=DEFAULT_RULES,config:overrides={},baselines=null,baselineVersion=null}={}){
 const config=voteConfig(overrides),bonus=bonuses(input.events,input.role,rules),keeperPerformance=evaluateKeeperPerformance(input,{config}),individual=applyKeeperPerformance(evaluateIndividual(input,{config,baseline:baselines}),keeperPerformance,config.base),context=evaluateContext(input,individual,{config}),goalSupport=evaluateGoalSupport(input,individual,context,{config}),warnings=[...new Set([...(input.warnings||[]),...individual.warnings,...context.warnings])];
 context.delta=statNumber(context.delta);goalSupport.delta=statNumber(goalSupport.delta);
 const marquee=evaluateMarquee(input,{config,individual,context});marquee.delta=statNumber(marquee.delta);context.marquee=marquee;if(marquee.delta)context.label=marquee.label;
 const base={id:input.id,name:input.name,role:input.role,subrole:input.classification?.subrole||null,club:input.club,minutes:input.minutes,events:input.events,model:MODEL,experimental:false,ai:null,needsReview:!!input.needsReview,baselineVersion,configHash:configDigest(config),warnings,
 confidence:{value:round(individual.confidence*config.confidenceWeights.individual+context.confidence*config.confidenceWeights.context),label:'Copertura e robustezza dei dati, non probabilità di correttezza',individual:individual.confidence,context:context.confidence},individual,context,presence:input.presence||null};
 const empty=(status,why)=>({...base,status,vote:null,rawVote:null,fantavote:null,why,breakdown:{start:config.base,lines:[],bonus:[]},stats:[]});
 if(!input.onField)return empty(input.final?'sv':'to-play',input.final?'Non è entrato in campo.':'Deve ancora giocare.');
 if(!input.role)return {...empty('sv','Ruolo non disponibile.'),needsReview:true};
 const eventCount=key=>Number.isInteger(input.events?.[key])&&input.events[key]>0?input.events[key]:0,penSaved=input.role==='P'?eventCount('penSaved'):0,penMissed=eventCount('penMissed'),keyEvent=goalSupport.count>0||penSaved>0||penMissed>0,eventOnly=input.final&&(input.minutes==null||individual.coverage===0);
 if(eventOnly&&!keyEvent)return {...empty('sv','Statistiche della prestazione non disponibili.'),needsReview:true};
 const shortFinal=input.final&&input.minutes!=null&&input.minutes<config.minMinutes;if(shortFinal&&!keyEvent&&(!config.eventExceptions||!bonus.length))return empty('sv','Meno di '+config.minMinutes+' minuti giocati.');
 const referenceOnly=shortFinal||eventOnly,penaltyMissedDelta=-config.eventVotes.penaltyMiss*penMissed,performanceVote=referenceOnly?config.base:individual.value+context.delta;
 const ratingImpact=evaluateRatingImpact(input,{config});ratingImpact.delta=statNumber(ratingImpact.delta);
 const preFloorVote=performanceVote+goalSupport.delta+penaltyMissedDelta+ratingImpact.delta+marquee.delta+keeperPerformance.resultDelta;
 const multiGoal=multiGoalVote(goalSupport,preFloorVote,{base:config.base,coverage:referenceOnly?0:individual.coverage,penMissed});
 const minimumVote=Math.max(goalSupport.count>0?config.eventVotes.scorerMinimum:config.minVote,penSaved>0?config.eventVotes.penaltySaveMinimum:config.minVote,multiGoal?.minimum??config.minVote);
 const floorAdjustment=round(Math.max(0,minimumVote-preFloorVote)),beforeAssists=preFloorVote+floorAdjustment;
 const assistAdjustment=multiAssistAdjustment(input.events,beforeAssists,individual,{config,referenceOnly});
 const rawVote=statNumber(beforeAssists+assistAdjustment),bounded=round(clamp(rawVote,config.minVote,multiGoal?.maximum??config.maxVote));
 const vote=multiGoal&&bounded>=9?(bounded>9.75?10:bounded>9.25?9.5:9):roundByBands(bounded,config.rounding.bands);
 const eventImpact={performanceVote:round(performanceVote),penSaved,penMissed,penaltyMissedDelta,minimumVote,floorAdjustment,...(multiGoal?{multiGoal}:null),...(assistAdjustment?{assistAdjustment}:null)};
 const lines=referenceOnly?[]:individual.blocks.filter(b=>b.observed).map(b=>({kind:'individual',key:b.key,label:b.label,delta:b.delta,why:b.metrics.map(m=>LABELS[m.key]||m.key).join(', ')}));
 if(!referenceOnly&&context.available)lines.push({kind:'context',key:'match-context',label:'Contesto della partita',delta:context.delta,why:context.underdogWin?.eligible?'Vittoria contro pronostico verificata sulle quote archiviate prima della gara; contributo da 0 a +0,3, ponderato per presenza, prestazione e attendibilità. Non si somma un secondo premio per la vittoria.':'Aspettative prepartita e qualità collettiva, attenuate per presenza ed efficacia individuale; contributo positivo massimo +0,3.'});
 if(keeperPerformance.resultDelta)lines.push({kind:'impact',key:'keeper-result',label:keeperPerformance.resultKind==='clean-sheet'?'Porta inviolata e interventi':'Parate che sostengono la vittoria',delta:keeperPerformance.resultDelta,why:'Fino a +0,5, ponderato per interventi e presenza. Porta inviolata e contributo alla vittoria sono alternativi, mai sommati.'});
 if(marquee.delta)lines.push({kind:'context',key:'marquee-match',label:marquee.label,delta:marquee.delta,why:marquee.youngDebut?'MVP statistico con gol o assist decisivo; giovane fino a 23 anni al primo anno in Italia verificato.':'MVP statistico con gol o assist decisivo in una partita di cartello.'});
 if(goalSupport.delta)lines.push({kind:'impact',key:'goals',label:'Incisività sotto porta',delta:goalSupport.delta,why:'Prima rete +0,5; altre reti ponderate per prestazione, difficoltà e risultato, anche nella sconfitta.'});
 if(ratingImpact.delta)lines.push({kind:'impact',key:'provider-rating-rank',label:ratingImpact.selected.label+' · '+ratingImpact.selected.rank+'°',delta:ratingImpact.delta,why:'Piazzamento per rating API-FOOTBALL. Un solo contributo, il maggiore in valore assoluto; nessuna somma tra partita e squadra.'});
 if(penaltyMissedDelta)lines.push({kind:'impact',key:'penalty-missed',label:'Errore dal dischetto',delta:penaltyMissedDelta,why:'−0,5 alla prestazione per ogni rigore sbagliato; il malus fantacalcio resta separato.'});
 if(floorAdjustment)lines.push({kind:'impact',key:'event-minimum',label:multiGoal?(multiGoal.goals>=4?'Quattro o più gol':multiGoal.goals===3?'Tripletta':'Doppietta'):penSaved?'Rigore parato: soglia minima':'Gol: soglia della sufficienza',delta:floorAdjustment,
  why:multiGoal?(multiGoal.goals>=4?'Dieci di base da quattro gol segnati.':'Il valore delle reti si combina con rendimento, contesto ed episodi della partita.'):penSaved?'Voto tecnico non inferiore a 6,5 dopo un rigore parato.':'Voto tecnico non inferiore a 6 dopo un gol.'});
 if(assistAdjustment)lines.push({kind:'impact',key:'multi-assist',label:'Incisività negli assist',delta:assistAdjustment,
  why:'Con almeno due assist e una buona prestazione, aggiunge fino a un decimo quando basta per arrivare a 7.'});
 const accounted=config.base+lines.reduce((n,x)=>n+x.delta,0),rounding=round(vote-accounted);if(rounding)lines.push({kind:'rounding',key:'rounding',label:'Arrotondamento e limiti',delta:rounding,why:'Soglie strette sul grezzo: oltre 5,6 → 6; oltre 6,2 → 6,5; oltre 6,65 → 7; oltre 7,25 → 7,5. Un solo arrotondamento finale.'});
 const stats=Object.values(individual.features).map(f=>{const rate=f.key==='passAccuracy'||f.key.endsWith('Efficiency'),factor=rate?100:1;return {key:f.key,label:f.label,value:statNumber(rate?f.value*100:f.value),avg:statNumber(rate?f.reference*100:f.expected),unit:rate?'%':'',comparison:f.comparison,neutralBand:round(f.neutralBand*factor),score:f.score,attempts:f.attempts,successes:f.key==='passAccuracy'?input.metrics?.passesCompleted:null,referenceLabel:individual.historical?'mediana del ruolo':'riferimento del ruolo',source:f.source};});
 const why=describePerformance(input,{individual,context,goalSupport,eventImpact,ratingImpact,keeperPerformance,vote,shortFinal,eventOnly});
 const policies={...(multiGoal?{goalPolicy:MULTI_GOAL_VOTE_POLICY}:null),...(hasMultipleAssists(input.events)?{assistPolicy:MULTI_ASSIST_VOTE_POLICY}:null)};
 return {...base,status:input.final?'voted':'playing',rawVote:round(rawVote),boundedVote:round(bounded),vote,fantavote:round2(vote+bonus.reduce((n,b)=>n+b.delta,0)),why,narrativeVersion:NARRATIVE_VERSION,keeperPerformance,goalSupport,eventImpact,ratingImpact,breakdown:{start:config.base,lines,bonus},stats,
 calculation:{version:MODEL,configHash:configDigest(config),rounding:'strict-progressive-bands-v2',...policies,signature:digest({model:MODEL,config:configDigest(config),input,baseline:individual.baselineUsed,rules:rules.bonus,...policies})}};
}
