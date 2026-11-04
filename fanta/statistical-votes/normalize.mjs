import {marqueeEvidence} from './marquee.mjs';
import {count,finite,ratio,round,validTimestamp} from './math.mjs';
import {DEFAULT_CONFIG} from './config.mjs';
import {classifyRole} from './roles.mjs';
import {matchTimeline,reconstructPresence} from './presence.mjs';
import {playerGoalImpact} from './goal-impact.mjs';
import {attachRatingRanks} from './rating-impact.mjs';
export function normalizeTeamStatistics(raw,id){
 const rows=(raw.statistics||[]).find(t=>t.team?.id===id)?.statistics||[],get=(...types)=>{for(const type of types){const row=rows.find(r=>String(r.type).toLowerCase()===type.toLowerCase());if(row)return count(typeof row.value==='string'?row.value.replace('%',''):row.value);}return null;};
 return {xg:get('expected_goals','Expected Goals'),shotsOn:get('Shots on Goal'),shotsTotal:get('Total Shots'),possession:get('Ball Possession'),corners:get('Corner Kicks'),xgot:get('expected_goals_on_target','xGOT','post_shot_expected_goals'),xgIncludesPenalties:true};
}
function metricsFor(row,config,warnings){
 const total=count(row.passes?.total),accuracy=row.passes?.accuracy;let completed=null,completion=null;
 if(typeof accuracy==='string'&&accuracy.trim().endsWith('%')){const n=finite(accuracy.replace('%',''));if(n!=null&&n>=0&&n<=100)completion=n/100;else warnings.push('invalid-pass-accuracy');}
 else if(config.semantics.passesAccuracy==='completed-count'){completed=count(accuracy);if(completed!=null&&total!=null&&completed>total){completed=null;warnings.push('pass-completions-exceed-attempts');}completion=ratio(completed,total);}
 else if(config.semantics.passesAccuracy==='percentage'){const n=count(accuracy);completion=n!=null&&n<=100?n/100:null;}
 else if(accuracy!=null)warnings.push('pass-accuracy-semantics-unverified');
 const metrics={passesTotal:total,passesCompleted:completed,passAccuracy:completion==null?null:completion*100,keyPasses:count(row.passes?.key),shotsTotal:count(row.shots?.total),shotsOn:count(row.shots?.on),tackles:count(row.tackles?.total),interceptions:count(row.tackles?.interceptions),blocks:config.semantics.tacklesBlocks==='blocked-shots'?count(row.tackles?.blocks):null,unverifiedBlocks:count(row.tackles?.blocks),duelsTotal:count(row.duels?.total),duelsWon:count(row.duels?.won),dribblesAttempts:count(row.dribbles?.attempts),dribbles:count(row.dribbles?.success),foulsDrawn:count(row.fouls?.drawn),foulsCommitted:count(row.fouls?.committed),saves:count(row.goals?.saves),areaClaims:count(row.goalkeeper?.claims),documentedErrors:count(row.errors?.leading_to_goal)};
 for(const[success,attempts]of [['shotsOn','shotsTotal'],['duelsWon','duelsTotal'],['dribbles','dribblesAttempts']])if(metrics[success]!=null&&metrics[attempts]!=null&&metrics[success]>metrics[attempts]){metrics[success]=null;warnings.push(success+'-exceeds-attempts');}
 if(metrics.unverifiedBlocks!=null&&config.semantics.tacklesBlocks==='unverified')warnings.push('blocks-not-used-unverified-meaning');return metrics;
}
function eventsFor(raw,row,timeline,presence,warnings){
 const id=row.player.id,streamKnown=Array.isArray(raw.events),out=Object.fromEntries(['goals','assists','yellow','red','ownGoals','conceded','penSaved','penMissed'].map(k=>[k,streamKnown?0:null]));
 for(const e of timeline.events){const own=e.player?.id===id;if(e.type==='Goal'&&!/disallow|cancel|shootout/i.test(e.detail||'')){if(/missed penalty/i.test(e.detail||'')){if(own)out.penMissed=(out.penMissed||0)+1;continue;}if(own)out[/own goal/i.test(e.detail||'')?'ownGoals':'goals']++;if(e.assist?.id===id&&!/own goal/i.test(e.detail||''))out.assists++;}
  if(own&&e.type==='Card'){if(/red|second yellow/i.test(e.detail||''))out.red++;else if(/yellow/i.test(e.detail||''))out.yellow++;}
 }
 for(const[key,value]of [['goals',row.goals?.total],['assists',row.goals?.assists],['yellow',row.cards?.yellow],['red',row.cards?.red],['penMissed',row.penalty?.missed]]){const n=count(value);if(n!=null)out[key]=out[key]==null?n:Math.max(out[key],n);}
 // Conceded goals belong only to the keeper actually present, never to an outfield player.
 if((row.games?.position==='G'||row.catalogRole==='P')&&presence.onField){const interval=presence.intervals[0];out.conceded=interval?.goalsAgainst??null;if(out.conceded==null)warnings.push('keeper-conceded-timeline-unknown');
  for(const e of timeline.events.filter(e=>e.type==='Goal'&&/missed penalty/i.test(e.detail||'')&&e.team?.id!==row.team)){const entry=interval?.entry,exit=interval?.exit,key=t=>t.elapsed+(t.extra||0)/100;if(!entry||!exit||e.clock.key<=key(entry)||e.clock.key>=key(exit))continue;
   if(/saved|parat/i.test(e.comments||''))out.penSaved=(out.penSaved||0)+1;else if(!/off target|wide|post|crossbar|fuori|palo|traversa/i.test(e.comments||''))warnings.push('penalty-save-undocumented');}
 }else out.conceded=null;
 const saved=count(row.penalty?.saved);if(saved!=null)out.penSaved=Math.max(out.penSaved??0,saved);
 return out;
}
export function normalizeFixture(raw,roles={},options={}){
 const config=options.config||DEFAULT_CONFIG,timeline=matchTimeline(raw),kickoff=validTimestamp(raw.fixture?.date),fixtureId=raw.fixture?.id;
 const players=(raw.players||[]).flatMap(t=>(t.players||[]).map(p=>{
  const row={...p.statistics?.[0],player:p.player,team:t.team.id,catalogRole:roles['af:'+p.player.id]},lineup=(raw.lineups||[]).find(l=>l.team?.id===row.team),position=(lineup?.startXI||[]).find(x=>x.player.id===p.player.id)?.player;
  const classification=classifyRole({catalogRole:row.catalogRole,position:row.games?.position||position?.pos,formation:lineup?.formation,grid:position?.grid,startingXI:lineup?.startXI}),presence=reconstructPresence(raw,row,timeline),warnings=[...timeline.warnings,...presence.warnings];if(!kickoff)warnings.push('kickoff-invalid-or-missing');
  const metrics=metricsFor(row,config,warnings),events=eventsFor(raw,row,timeline,presence,warnings),home=row.team===raw.teams?.home?.id,opponent=home?raw.teams?.away:raw.teams?.home;
  return {id:'af:'+p.player.id,apiId:p.player.id,name:p.player.name,fixtureId:'af:'+fixtureId,teamId:row.team,opponentId:opponent?.id,opponent:opponent?.name||'',clubId:'af:'+row.team,club:t.team.name||raw.teams?.[home?'home':'away']?.name||'',role:classification.role,classification,minutes:presence.minutes,final:timeline.final,onField:presence.onField,presence,events,metrics,goalImpact:playerGoalImpact(raw,p.player.id,row.team,timeline),
   fixture:{id:fixtureId,leagueId:raw.league?.id,season:raw.league?.season,kickoff,final:timeline.final,status:raw.fixture?.status?.short,minute:timeline.end,duration:timeline.duration,score:timeline.actual,teams:{home:{id:raw.teams?.home?.id,name:raw.teams?.home?.name},away:{id:raw.teams?.away?.id,name:raw.teams?.away?.name}},teamSide:home?'home':'away'},
   context:{team:normalizeTeamStatistics(raw,row.team),opponent:normalizeTeamStatistics(raw,opponent?.id),odds:options.odds||null,intervalTeamStatistics:null,marqueeEvidence:marqueeEvidence(raw,p.player.id,row.team,options.playerProfiles?.['af:'+p.player.id]||{})},
   provenance:{provider:'API-FOOTBALL',endpoint:'fixtures/players + fixtures/events + fixtures/lineups + fixtures/statistics',normalizer:'quasi-normalizer-v2',semantics:{passesAccuracy:config.semantics.passesAccuracy,tacklesBlocks:config.semantics.tacklesBlocks},observedAt:validTimestamp(options.observedAt)},
   warnings:[...new Set(warnings)],needsReview:!classification.role||classification.role==='P'&&presence.onField&&warnings.some(w=>['keeper-conceded-timeline-unknown','penalty-save-undocumented','same-minute-goal-order-unknown'].includes(w))};
 }));
 return attachRatingRanks(players,raw);
}
