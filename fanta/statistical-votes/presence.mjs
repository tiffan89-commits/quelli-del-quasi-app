import {count,round,clamp} from './math.mjs';
export function eventClock(time){const elapsed=count(time?.elapsed),extra=time?.extra==null?0:count(time.extra);if(elapsed==null||elapsed>120||extra==null||extra>30)return null;return {elapsed,extra,key:elapsed+extra/100};}
const isGoal=e=>e.type==='Goal'&&!/missed|disallow|cancel|shootout/i.test(e.detail||'')&&!/shootout/i.test(e.comments||'');
export function matchTimeline(raw){
 const warnings=[],home=raw.teams?.home?.id,away=raw.teams?.away?.id,teams=[home,away],players=new Map((raw.players||[]).flatMap(t=>(t.players||[]).map(p=>[p.player.id,t.team.id])));
 const events=(raw.events||[]).flatMap((e,index)=>{const clock=eventClock(e.time);if(!clock){warnings.push('invalid-event-minute');return [];}return [{...e,clock,index}];}).sort((a,b)=>a.clock.key-b.clock.key||a.index-b.index);
 const goals=events.filter(isGoal).map(e=>{const own=/own goal/i.test(e.detail||''),ownTeam=players.get(e.player?.id),scoring=own?teams.find(t=>t!==ownTeam):e.team?.id;return {...e,scoring};}).filter(e=>teams.includes(e.scoring));
 const final=['FT','AET','PEN'].includes(raw.fixture?.status?.short),playing=['1H','HT','2H','ET','BT','P','LIVE'].includes(raw.fixture?.status?.short),duration=['AET','PEN','ET','BT','P'].includes(raw.fixture?.status?.short)?120:90;
 const actual={home:count(raw.goals?.home),away:count(raw.goals?.away)},totals={home:goals.filter(e=>e.scoring===home).length,away:goals.filter(e=>e.scoring===away).length},consistent=Array.isArray(raw.events)&&actual.home!=null&&actual.away!=null&&actual.home===totals.home&&actual.away===totals.away;
 if(!consistent)warnings.push('goal-timeline-incomplete');if(raw.fixture?.status?.short==='P')warnings.push('shootout-not-rated');
 const elapsed=count(raw.fixture?.status?.elapsed),end=final?duration:elapsed!=null?Math.min(duration,elapsed):null;
 const scoreAt=key=>!consistent||key==null?null:{home:goals.filter(e=>e.scoring===home&&e.clock.key<key).length,away:goals.filter(e=>e.scoring===away&&e.clock.key<key).length};
 return {events,goals,final,playing,duration,end,actual,consistent,warnings,scoreAt};
}
export function reconstructPresence(raw,row,timeline){
 const id=row.player.id,teamId=row.team,listed=(raw.lineups||[]).find(t=>t.team.id===teamId),starter=listed?.startXI?.some(p=>p.player.id===id)??false,reported=count(row.games?.minutes),warnings=[];
 const ins=timeline.events.filter(e=>e.type==='subst'&&e.assist?.id===id),outs=timeline.events.filter(e=>e.type==='subst'&&e.player?.id===id),reds=timeline.events.filter(e=>e.type==='Card'&&/red|second yellow/i.test(e.detail||'')&&e.player?.id===id);
 const entry=starter?{elapsed:0,extra:0,key:0}:ins[0]?.clock||null;
 const goalEvidence=timeline.goals.some(e=>e.player?.id===id||e.assist?.id===id),statEventEvidence=[row.goals?.total,row.penalty?.saved,row.penalty?.missed].some(v=>Number.isInteger(count(v))&&count(v)>0),hasAppearance=reported>0||!!ins.length||goalEvidence||statEventEvidence||starter&&timeline.playing;
 const onField=!!(hasAppearance||starter&&timeline.final&&reported==null),red=onField?reds.find(e=>!entry||e.clock.key>=entry.key):null;
 const departure=[...outs.map(e=>({clock:e.clock,type:'substitution'})),...(red?[{clock:red.clock,type:'red-card'}]:[])].filter(e=>!entry||e.clock.key>=entry.key).sort((a,b)=>a.clock.key-b.clock.key)[0];
 const exit=departure?.clock||(onField&&entry&&timeline.end!=null?{elapsed:timeline.end,extra:0,key:timeline.final?timeline.duration+1:timeline.end+.99}:null);
 let minutes=reported;if(minutes==null&&entry&&departure&&entry.extra===0&&departure.clock.extra===0)minutes=Math.max(0,departure.clock.elapsed-entry.elapsed);
 if(entry&&departure&&entry.extra===0&&departure.clock.extra===0&&reported!=null&&Math.abs(reported-(departure.clock.elapsed-entry.elapsed))>2){minutes=Math.max(0,departure.clock.elapsed-entry.elapsed);warnings.push('reported-minutes-overridden-by-events');}
 if(reported!=null&&reported>timeline.duration+30){minutes=null;warnings.push('invalid-player-minutes');}
 if(starter&&row.games?.substitute===true||listed?.substitutes?.some(p=>p.player.id===id)&&row.games?.substitute===false)warnings.push('substitute-flag-overridden');
 if(ins.length>1||outs.length>1)warnings.push('multiple-presence-events');if(onField&&!entry)warnings.push('entry-unknown');if(onField&&minutes==null)warnings.push('minutes-unknown');
 const ambiguous=timeline.goals.filter(e=>entry?.key===e.clock.key||departure?.clock.key===e.clock.key);if(ambiguous.length)warnings.push('same-minute-goal-order-unknown');
 const exact=onField&&entry&&exit&&timeline.consistent&&!ambiguous.length;
 const within=timeline.goals.filter(e=>entry&&exit&&e.clock.key>entry.key&&e.clock.key<exit.key),ownSide=teamId===raw.teams?.home?.id?'home':'away';
 const intervals=onField?[{entry:entry?{elapsed:entry.elapsed,extra:entry.extra}:null,exit:exit?{elapsed:exit.elapsed,extra:exit.extra}:null,exitReason:departure?.type||(timeline.final?'full-time':'current-minute'),minutes,scoreAtEntry:exact?timeline.scoreAt(entry.key):null,scoreAtExit:exact?timeline.scoreAt(exit.key):null,goalsFor:exact?within.filter(e=>e.scoring===teamId).length:null,goalsAgainst:exact?within.filter(e=>e.scoring!==teamId).length:null}]:[];
 return {onField,minutes,starter,intervals,ownSide,endedBeforeFinal:!!departure&&timeline.final&&departure.clock.elapsed<timeline.duration,confidence:onField?(exact ? .9 : entry?.key===0 ? .65 : .35):.9,exposure:minutes==null?null:round(clamp(minutes/timeline.duration,0,1)),warnings};
}
