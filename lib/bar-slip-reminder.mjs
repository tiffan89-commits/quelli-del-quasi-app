import {deadlineOf,isClosed,sourceOf} from '../public/src/slip-state.mjs';

export function barSlipReminder(league,rounds,uid,now=Date.now()){
 if(league.admin!==uid||league.demo)return null;
 const upcoming=rounds.filter(r=>r.league===league.id&&sourceOf(r)==='seriea'&&r.matches?.length&&
  !r.archived&&!r.calculated&&!r.sourceConflict&&!isClosed(r,now)&&Date.parse(deadlineOf(r))>now)
  .sort((a,b)=>Date.parse(deadlineOf(a))-Date.parse(deadlineOf(b)))[0];
 if(!upcoming)return null;
 const submitted=new Set(upcoming.slips?.map(slip=>slip.uid));
 const missing=league.members.filter(m=>m.uid&&m.uid!==uid&&!m.removed&&!submitted.has(m.uid)).map(m=>m.uid);
 return missing.length?{round:upcoming.id,number:upcoming.number,deadline:deadlineOf(upcoming),missing}:null;
}
