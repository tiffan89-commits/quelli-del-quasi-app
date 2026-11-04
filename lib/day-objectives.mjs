import {OBJECTIVE_VERSION,createDayObjectives,objectiveNumber,objectiveSeason,currentObjectiveRound} from '../public/src/day-objectives.mjs';
import {roundPerformance} from './progression.mjs';
const scope=r=>(r.source==='fantacalcio'?'fantacalcio:'+r.competitionKey:'seriea')+':'+objectiveSeason(r);
const complete=r=>r.settled&&(r.matches||[]).some(m=>!m.void)&&(r.matches||[]).every(m=>m.void||Array.isArray(m.score)&&(!m.status||m.status==='FT'));
const family=p=>['1','X','2'].includes(p)?'result':['1X','12','X2'].includes(p)?'double':/Under|Over/.test(p)?'total':'goals';
export function objectiveMet(s,l,r,uid,id){
 const slip=(r.slips||[]).find(p=>p.uid===uid),p=roundPerformance(r,uid);
 if(id==='day-award')return !!s.playerRewards?.[uid]?.some(a=>a.round===r.id);
 if(id==='royalty')return complete(r)&&p.played&&p.total>0&&(p.correct===p.total||p.total>1&&p.correct===p.total-1);
 if(!slip)return false;
 if(id==='minimum')return slip.stake===1;
 if(id==='maximum')return r.rules?.maxStake>0&&slip.stake===r.rules.maxStake;
 if(id==='attendance'){const n=objectiveNumber(r);return n>=3&&[n-2,n-1,n].every(num=>s.rounds.some(x=>x.league===l.id&&scope(x)===scope(r)&&objectiveNumber(x)===num&&x.slips?.some(p=>p.uid===uid)));}
 if(!complete(r))return false;
 if(id==='five-correct')return p.correct>=5;
 if(id==='profit')return slip.creditsSettled&&p.profit>0;
 if(id==='opening-leader')return objectiveNumber(r)===1&&slip.points>0&&l.members.every(m=>((r.slips||[]).find(p=>p.uid===m.uid)?.points||0)<=slip.points);
 if(id==='mixed-markets')return p.total>0&&p.correct/p.total>=.5&&new Set(Object.values(slip.picks||{}).map(family)).size>=3;
 return false;
}
export function syncDayObjectives(s,now){
 for(const r of s.rounds){
  const deadline=Date.parse(r.deadline||r.kickoff);
  if(!r.dayObjectives&&Number.isFinite(deadline)&&deadline>now&&!r.settled){r.dayObjectives=createDayObjectives(r);r.objectiveVersion=OBJECTIVE_VERSION;}
  if(r.objectiveVersion!==OBJECTIVE_VERSION||!r.dayObjectives)continue;
  const l=s.leagues.find(l=>l.id===r.league);if(!l)continue;
  for(const m of l.members){const u=s.users.find(u=>u.id===m.uid);if(!u||u.adminOnly||u.createdAt&&Date.parse(u.createdAt)>deadline||m.joinedAt&&Date.parse(m.joinedAt)>deadline)continue;
   for(const goal of r.dayObjectives){
    if(goal.id==='royalty'){
     const slip=r.slips?.find(p=>p.uid===m.uid),p=roundPerformance(r,m.uid),valid=r.matches.filter(m=>!m.void),award=s.playerRewards[m.uid]?.find(a=>a.round===r.id);
     if(award&&complete(r)&&!r.pointsOnly&&slip?.creditsSettled&&valid.length>=5&&p.correct===p.total&&valid.every(m=>['1','X','2'].includes(slip.picks?.[m.id]))&&slip.odds>=100&&p.profit>=1000&&!award.ids.includes('room-100'))award.ids.push('room-100');
     continue;
    }
    if(goal.id==='day-award'||!objectiveMet(s,l,r,m.uid,goal.id))continue;
    const key=goal.seasonal?'season:'+l.id+':'+scope(r)+':'+goal.id:'day:'+r.id+':'+goal.id;
    const awards=s.playerRewards[m.uid]??=[];if(awards.some(a=>a.objectiveKey===key))continue;
    awards.push({objectiveKey:key,achievement:goal.id,round:'objective:'+r.id+':'+goal.id,sourceRound:r.id,league:l.id,leagueName:l.name,title:goal.title,competitionName:r.competitionName||'Serie A',source:r.source==='fantacalcio'?'fantacalcio':'seriea',ids:goal.rewardIds,reason:r.title+' · '+goal.condition,earnedAt:new Date(now).toISOString()});
   }
  }
 }
}
export function objectivesFor(s,l,uid,now=Date.now()){
 const rounds=s.rounds.filter(r=>r.league===l.id),groups=new Map();for(const r of rounds){const key=scope(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 return [...groups.values()].flatMap(items=>{const first=items[0],r=currentObjectiveRound({rounds:items},first.source==='fantacalcio'?'fantacalcio':'seriea',first.competitionKey,now,s.football?.calendar);return r?.dayObjectives?[{round:r.id,goals:r.dayObjectives.map(g=>({...g,earned:objectiveMet(s,l,r,uid,g.id)}))}]:[];});
}
