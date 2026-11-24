import {eventLocked,noOpenEvents,stakeLocked,slipStakeLimit} from '../slip-events.mjs';
import {slipPointTerms} from '../scoring.mjs';
export function roundAvailability(round,now=Date.now()){
 if(round?.waitingForOpen)return 'non ancora aperta';
 if(round?.eventBetting){
  if(noOpenEvents(round,now))return 'chiusa';
  const priced=round.matches.some(m=>!eventLocked(round,m,now)&&['1','X','2'].some(k=>Number.isFinite(m.odds?.[k])&&m.odds[k]>1));
  return priced?'aperta':'non ancora aperta';
 }
 if(round?.settled||Number.isFinite(Date.parse(deadlineOf(round)))&&Date.parse(deadlineOf(round))<=now)return 'chiusa';
 const matches=round?.matches||[],priced=matches.length&&matches.every(m=>m.void||['1','X','2'].every(k=>Number.isFinite(m.odds?.[k])&&m.odds[k]>0));
 return !priced?'non ancora aperta':round?.closed?'chiusa':'aperta';
}
const byRound=(a,b)=>(Number(a.number)-Number(b.number))||((Date.parse(deadlineOf(a))||Infinity)-(Date.parse(deadlineOf(b))||Infinity));
export const sourceOf = (round) => round?.source === 'fantacalcio' || round?.provider === 'Leghe Fantacalcio' ? 'fantacalcio' : 'seriea';
export const deadlineOf = (round) => round?.deadline || round?.kickoff;
const finishedSerieAStatuses=new Set(['FT','AET','PEN','PST','CANC','ABD','AWD','WO']);
const inactiveSerieAStatuses=new Set(['PST','CANC','ABD','AWD','WO']);
const canonicalFixture=m=>/^seriea:\d{4}:\d+:\d+$/.test(m?.id||'');
export function slipWaitingForPrevious(round,calendarRounds,now=Date.now()){
 const number=Number(sourceOf(round)==='fantacalcio'?round.serieARound:round.number);
 if(!Number.isInteger(number)||number<=1||Date.parse(deadlineOf(round))<=now)return false;
 const previous=calendarRounds?.find(r=>Number(r.number)===number-1);
 const matches=previous?.matches||[];
 if(matches.some(canonicalFixture))return new Set(matches.map(m=>m.id)).size!==10||!matches.every(m=>finishedSerieAStatuses.has(m.status));
 return !!matches.length&&!matches.every(m=>m.void||finishedSerieAStatuses.has(m.status)||Array.isArray(m.score)&&m.status!=='LIVE');
}
export function alignSerieASlipKickoffs(round,calendar){
 if(!round||sourceOf(round)!=='seriea')return;
 const official=calendar?.rounds?.find(r=>Number(r.number)===Number(round.number));
 if(!official?.matches?.length)return;
 const byId=new Map(official.matches.map(m=>[m.id,m]));
 for(const match of round.matches||[]){
  const source=byId.get(match.id);
  if(canonicalFixture(source)){
   match.kickoff=match.officialKickoff=Number.isFinite(Date.parse(source.officialKickoff))?source.officialKickoff:null;
   continue;
  }
  const kickoff=source?.officialKickoff||source?.kickoff;
  if(Number.isFinite(Date.parse(kickoff)))match.kickoff=match.officialKickoff=kickoff;
 }
}
export function alignSlipSchedule(round,calendar){
 if(!round||round.archived||round.settled)return;
 const fanta=sourceOf(round)==='fantacalcio';
 if(!fanta)alignSerieASlipKickoffs(round,calendar);
 else if(!round.nativeFanta)return;
 const number=Number(fanta?round.serieARound:round.number);
 const official=calendar?.rounds?.find(r=>Number(r.number)===number)?.matches||[];
 if(official.length!==10||!official.every(canonicalFixture))return;
 const kickoffs=official.filter(m=>!inactiveSerieAStatuses.has(m.status)).map(m=>Date.parse(m.officialKickoff));
 if(!kickoffs.length||kickoffs.some(t=>!Number.isFinite(t)))return;
 round.kickoff=round.deadline=new Date(Math.min(...kickoffs)).toISOString();
 if(fanta)round.matches=(round.matches||[]).map(m=>({...m,kickoff:round.deadline}));
}
const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'});
export const slipRomeDay=(now=Date.now())=>dayFormatter.format(new Date(now));
export function slipRoundLastDay(round,calendar){
 const number=sourceOf(round)==='fantacalcio'?round.serieARound:round.number;
 const canonical=calendar?.rounds?.find(r=>Number(r.number)===Number(number));
 const dates=(canonical?.matches?.length?canonical.matches:round.matches||[]).filter(m=>!['PST','CANC','ABD','AWD','WO'].includes(m.status)).flatMap(m=>{
  const start=Date.parse(m.officialKickoff||m.kickoff);if(!Number.isFinite(start))return [];
  const ended=Date.parse(m.finishedAt||m.apiFootballFinalAt),actual=Number.isFinite(ended)&&ended>=start&&ended-start<=12*3600000;
  return [actual?ended:start+135*60000];
 });
 return dates.length?slipRomeDay(Math.max(...dates)):null;
}
export function currentSlipRound(rounds = [], now = Date.now(),calendar) {
 const playable=rounds.filter(r=>!r.archived),today=slipRomeDay(now);
 const pending=playable.filter(r=>{const last=slipRoundLastDay(r,calendar);return last?today<=last:!r.settled;});
 const started=pending.filter(r=>Date.parse(deadlineOf(r))<=now).sort((a,b)=>Date.parse(deadlineOf(b))-Date.parse(deadlineOf(a)));
 return started[0]||pending.filter(r=>roundAvailability(r,now)==='aperta').sort((a,b)=>(Number(a.number)-Number(b.number))||(Date.parse(deadlineOf(a))-Date.parse(deadlineOf(b))))[0]||pending.sort(byRound)[0]||playable.filter(r=>!slipRoundLastDay(r,calendar)).at(-1);
}
export function selectableSlipRounds(rounds=[],now=Date.now(),calendar){
 const ordered=rounds.filter(r=>!r.archived).sort(byRound);
 const next=ordered.find(r=>roundAvailability(r,now)==='aperta');
 const upcoming=ordered.find(r=>Date.parse(deadlineOf(r))>now);
 // "Closed" and "settled" are not proof that a later numbered round belongs
 // to history: imported placeholders can carry either flag or stale dates.
 // The first upcoming/open round is the frontier for every matchday selector.
 const frontier=[next,upcoming].filter(Boolean).sort(byRound)[0];
 return ordered.filter(r=>(!frontier||byRound(r,frontier)<=0)&&(r.settled||Date.parse(deadlineOf(r))<=now||r.id===next?.id));
}
export function nextSlipPreview(rounds=[],now=Date.now()){
 const next=rounds.filter(r=>!r.archived&&!isClosed(r,now)&&r.matches?.length&&Date.parse(deadlineOf(r))>now).sort(byRound)[0];
 return next&&roundAvailability(next,now)==='non ancora aperta'?{...next,preview:true}:null;
}
export function defaultSlipRound(rounds=[],now=Date.now(),calendar){
 const eligible=selectableSlipRounds(rounds,now,calendar);
 return eligible.find(r=>roundAvailability(r,now)==='aperta')||currentSlipRound(eligible,now,calendar)||eligible.at(-1);
}
export function currentPublicSlipRound(rounds=[],now=Date.now(),calendar){
 return defaultSlipRound(rounds,now,calendar);
}
export function selectablePublicSlipRounds(rounds=[],now=Date.now(),calendar){
 return selectableSlipRounds(rounds,now,calendar);
}
export function isClosed(round, now = Date.now()) {
  return !!(round?.closed || round?.settled || (deadlineOf(round) && now >= Date.parse(deadlineOf(round))));
}
export const editingClosed=(round,now=Date.now())=>round?.eventBetting?noOpenEvents(round,now):isClosed(round,now);
export const editingEventLocked=(round,match,now=Date.now())=>round?.eventBetting?eventLocked(round,match,now):isClosed(round,now);
export function editablePicks(round,picks,now=Date.now()){
 const valid=cleanPicks(round,picks);
 if(round?.eventBetting)for(const match of round.matches){
  if(!eventLocked(round,match,now))continue;
  const saved=round.slip?.picks?.[match.id];
  if(saved)valid[match.id]=saved;else delete valid[match.id];
 }
 return valid;
}
export function cleanPicks(round, picks = {}) {
  return Object.fromEntries((round?.matches || []).filter(m => typeof picks[m.id] === 'string').map(m => [m.id, picks[m.id]]));
}
export function fingerprint(picks = {}, stake = 1) {
  return JSON.stringify([Object.entries(picks).sort(([a],[b]) => a.localeCompare(b)), Number(stake)]);
}
function maximumSlipPoints(round, matches, picks) {
  if(!round?.rules)return null;
  const selected=matches.filter(m=>!m.void&&Object.hasOwn(picks,m.id));
  if(!selected.length)return null;
  let total=0;
  for(const match of selected){
    const saved=round.slip?.picks?.[match.id]===picks[match.id]?round.slip:null;
    const {correct}=slipPointTerms(round,match,saved||{picks});
    if(!Number.isFinite(correct))return null;
    total+=correct;
  }
  return Math.round(total*100)/100;
}
export function slipSummary(round, picks, stake, credits = Infinity, now = Date.now()) {
  const matches = round?.matches || [], partial=round?.eventBetting===true, valid = editablePicks(round, picks,now);
  const count = Object.keys(valid).length, total = matches.length;
  const pointsOnly = round?.pointsOnly === true;
  const value = Number(stake), reserve=round?.stakeReserve||0, maxStake=slipStakeLimit(credits,round?.slip?.stake,reserve),fixedStake=partial&&stakeLocked(round,round.slip?.picks,now);
  const validStake = pointsOnly || (Number.isFinite(value) && value >= 1 && value <= maxStake && (!fixedStake||value===round.slip.stake) && Math.round(value*100)/100 === value && value <= credits + Number(round?.slip?.stake || 0));
  const dirty = fingerprint(valid, pointsOnly ? 0 : value) !== fingerprint(round?.slip?.picks, pointsOnly ? 0 : round?.slip?.stake || 1);
  const price=m=>valid[m.id]===round?.slip?.picks?.[m.id]?(round.slip?.acceptedOdds?.[m.id]??m.odds?.[valid[m.id]]):m.odds?.[valid[m.id]];
  const missing = matches.filter(m => !m.void && valid[m.id] && !Number.isFinite(price(m))).length;
  const odds = missing || !count || (!partial&&count!==total) ? null : matches.reduce((a,m) => m.void ? a : a * (price(m) || 1), 1);
  const closed = editingClosed(round, now);
  const status = round?.settled ? 'Liquidata' : roundAvailability(round,now)==='non ancora aperta'?'Non ancora aperta':closed?'Chiusa' : round?.slip && !dirty ? 'Salvata' : round?.slip ? 'Modifiche da salvare' : 'Bozza';
  return {count,total,missing,odds,pointsOnly,validStake,dirty,closed,status,fixedStake,maxStake,reserve,picks:valid,maximumPoints:maximumSlipPoints(round,matches,valid),potential:odds === null ? null : Math.round(odds*value*100)/100,canSave:round?.preview!==true && total>0 && (partial?count>0&&(!round.virtualBookmaker||!missing):count===total) && validStake && !closed && (partial||roundAvailability(round,now)==='aperta')};
}
export function draftKey(user, league, round) {
  return ['quasi-draft-v1',user,league,sourceOf(round),round?.id].join(':');
}
export function loadDraft(storage, key, round, now=Date.now()) {
  try {
    const draft=JSON.parse(storage.getItem(key) || 'null');
    if(!draft || draft.version!==1 || now-draft.updatedAt>30*86400000 || draft.updatedAt>now+60000 || editingClosed(round,now)) return null;
    // A draft made against another saved version needs an explicit choice by the user.
    const base=fingerprint(round.slip?.picks,round.pointsOnly?0:round.slip?.stake||1);
    const draftBase=!round.slip&&draft.base===fingerprint({},10)?base:draft.base;
    return {...draft,base:draftBase,picks:cleanPicks(round,draft.picks),conflict:draftBase!==base};
  } catch { return null; }
}
export function saveDraft(storage,key,{round,picks,stake,base},now=Date.now()) {
  try {
    storage.setItem(key,JSON.stringify({version:1,updatedAt:now,base:base??fingerprint(round.slip?.picks,round.pointsOnly ? 0 : round.slip?.stake || 1),picks:cleanPicks(round,picks),stake:round.pointsOnly ? 0 : stake}));
    return true;
  } catch { return false; }
}
