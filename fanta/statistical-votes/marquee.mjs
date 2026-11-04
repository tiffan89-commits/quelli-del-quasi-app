import {clamp,round} from './math.mjs';
import {matchTimeline} from './presence.mjs';
// Career facts must come from a verified cached history, never from nationality
// or from the first time the application happened to observe the player.
export function marqueeEvidence(raw,playerId,teamId,profile={}){
 const t=matchTimeline(raw),home=raw.teams?.home?.id,away=raw.teams?.away?.id,side=teamId===home?'home':'away',other=side==='home'?'away':'home',score={home:0,away:0},decisive=[];
 if(t.consistent)for(const e of t.goals){const scoring=e.scoring===home?'home':'away';score[scoring]++;
  const own=e.scoring===teamId&&!/own goal/i.test(e.detail||''),winner=t.actual[side]>t.actual[other]&&score[side]===t.actual[other]+1,equalizer=t.actual[side]===t.actual[other]&&scoring===side&&score[side]===score[other]&&score[side]===t.actual[side];
  const ambiguous=t.goals.filter(g=>g.clock.key===e.clock.key).length>1;
  if(own&&!ambiguous&&(winner||equalizer)&&(e.player?.id===playerId||e.assist?.id===playerId))decisive.push({kind:e.player?.id===playerId?'goal':'assist',minute:e.clock.elapsed,type:winner?'match-winner':'equalizer'});
 }
 const birth=profile.birthDate||profile.birth?.date,date=raw.fixture?.date;let age=null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(birth||'')&&date){const d=String(date).slice(0,10);age=Number(d.slice(0,4))-Number(birth.slice(0,4))-(d.slice(5)<birth.slice(5)?1:0);}
 return {timelineVerified:t.consistent,decisive,age,firstItalySeason:profile.verified===true&&Number.isInteger(profile.firstItalySeason)?profile.firstItalySeason:null,careerVerified:profile.verified===true,careerSource:profile.source||null};
}
export function evaluateMarquee(input,{config,individual,context}={}){
 const p=config.marquee,teams=input.fixture?.teams,ids=[teams?.home?.id,teams?.away?.id].map(Number),cartello=!!p?.enabled&&ids.every(id=>p.teamIds.includes(id)),e=input.context?.marqueeEvidence,eligible=cartello&&input.final&&input.onField&&input.ratingRanks?.matchBest===1&&e?.timelineVerified&&e.decisive?.length>0;
 const youngDebut=eligible&&e.careerVerified&&Number.isFinite(e.age)&&e.age>=0&&e.age<=p.youngMaxAge&&e.firstItalySeason===Number(input.fixture?.season);
 const performance=clamp(((individual?.value??6)-5.5)/2,0,1),decisiveness=Math.max(0,...(e?.decisive||[]).map(event=>clamp((event.type==='match-winner'?.85:.6)+.15*clamp(event.minute/90,0,1),0,1)*(event.kind==='assist'?.85:1)));
 const winProbability=context?.odds?.probabilities?.[input.fixture?.teamSide==='home'?'1':'2'],difficulty=Number.isFinite(winProbability)?clamp((.75-winProbability)/.55,0,1):.5,participation=clamp((input.minutes||0)/(input.fixture?.duration||90),0,1);
 const weights=p.weights,strength=weights.performance*performance+weights.decisiveness*decisiveness+weights.difficulty*difficulty+weights.participation*participation;
 const development=youngDebut ? .8+.2*clamp((p.youngMaxAge-e.age)/5,0,1):(p.regularMax-p.bonus)/(p.youngDebutBonus-p.bonus||1),delta=eligible?round(clamp(p.bonus+(p.youngDebutBonus-p.bonus)*strength*development,p.bonus,p.youngDebutBonus),2):0;
 return {available:cartello,label:eligible?'Contesto partita di cartello':'Contesto della partita',delta,policy:'continuous-marquee-v1',factors:{performance,decisiveness,difficulty,participation,strength,development,oddsAvailable:Number.isFinite(winProbability)},mvp:input.ratingRanks?.matchBest===1,mvpSource:'Primo rating della partita tra i giocatori scesi in campo (anche ex aequo)',decisive:e?.decisive||[],youngDebut:!!youngDebut,age:e?.age??null,careerVerified:e?.careerVerified===true,provisional:!input.final};
}
