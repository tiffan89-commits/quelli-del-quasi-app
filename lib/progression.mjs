import {REWARD_CATALOG,stableHash} from '../public/src/reward-catalog.mjs';

import {canonicalRoomRewardId,canonicalBaseRoomId} from '../public/src/locker-rooms.mjs';
import {syncDayObjectives,objectivesFor} from './day-objectives.mjs';
import {migrateFantasyWallets,fantasyWalletKey} from './bar-fanta-wallet.mjs';
const cents=n=>Math.round(n*100)/100;
const source=r=>r.source==='fantacalcio'?'fantacalcio':'seriea';
const won=(pick,[a,b])=>({'1':a>b,X:a===b,'2':b>a,'1X':a>=b,'12':a!==b,X2:b>=a,Goal:a>0&&b>0,'No Goal':a===0||b===0,'Under 2.5':a+b<2.5,'Over 2.5':a+b>2.5})[pick];
export function roundPerformance(r,uid){const slip=(r.slips||[]).find(x=>x.uid===uid),valid=(r.matches||[]).filter(m=>!m.void),correct=slip?valid.filter(m=>m.score&&won(slip.picks?.[m.id],m.score)).length:0;return {played:!!slip,correct,total:valid.length,points:slip?.points||0,profit:cents((slip?.prize||0)-(slip?.stake||0)),stake:slip?.stake||0,prize:slip?.prize||0};}
export function ownedRewardIds(s,uid){return [...new Set((s.playerRewards?.[uid]||[]).flatMap(a=>a.ids).map(canonicalRoomRewardId))];}
export function syncRoundRewards(s,now=Date.now()){
 s.playerRewards??={};
 for(const u of s.users)if(u.avatar){u.avatar.room=canonicalBaseRoomId(u.avatar.room);u.avatar.rewardRoom=canonicalRoomRewardId(u.avatar.rewardRoom);}
 for(const awards of Object.values(s.playerRewards))for(const a of awards)a.ids=[...new Set(a.ids.map(canonicalRoomRewardId))];
 const globalCounts=new Map();for(const list of Object.values(s.playerRewards))for(const id of new Set(list.flatMap(a=>a.ids)))globalCounts.set(id,(globalCounts.get(id)||0)+1);
 for(const r of [...s.rounds].sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||a.id.localeCompare(b.id))){
  if(!r.settled||r.rewardVersion===1||!(r.matches||[]).some(m=>!m.void)||r.matches.some(m=>!m.void&&(!Array.isArray(m.score)||m.status&&m.status!=='FT')))continue;
  const l=s.leagues.find(l=>l.id===r.league);if(!l)continue;
  const members=l.members.filter(m=>{const u=s.users.find(u=>u.id===m.uid);return u&&!u.adminOnly&&(!u.createdAt||Date.parse(u.createdAt)<=Date.parse(r.deadline||r.kickoff||now))&&(!m.joinedAt||Date.parse(m.joinedAt)<=Date.parse(r.deadline||r.kickoff||now));}).sort((a,b)=>stableHash(r.id+a.uid)-stableHash(r.id+b.uid));
  const used=new Set(),ordinary=REWARD_CATALOG.filter(r=>r.id.startsWith('quasi-')||r.type==='room'&&!r.exclusive);
  for(const m of members){const list=s.playerRewards[m.uid]??=[];if(list.some(a=>a.round===r.id))continue;
   const p=roundPerformance(r,m.uid),seed=stableHash(r.id+':'+m.uid),owned=new Set(ownedRewardIds(s,m.uid)),ratio=p.total?p.correct/p.total:0;
   const rarity=ratio===1&&p.played?'legendary':ratio>=.75?'epic':ratio>=.5?'rare':'common';
   let pool=ordinary.filter(x=>x.rarity===rarity&&!owned.has(x.id));if(!pool.length)pool=ordinary.filter(x=>!owned.has(x.id));if(!pool.length)pool=ordinary;
   const unique=pool.filter(x=>!used.has(x.id)),allowDuplicate=seed%50===0;if(unique.length&&!allowDuplicate)pool=unique;
   if(!allowDuplicate){const least=Math.min(...pool.map(x=>globalCounts.get(x.id)||0));pool=pool.filter(x=>(globalCounts.get(x.id)||0)===least);}
   const award=pool[seed%pool.length],ids=[award.id];used.add(award.id);
   if(!owned.has(award.id))globalCounts.set(award.id,(globalCounts.get(award.id)||0)+1);
   if(p.played&&p.correct===p.total&&p.total){ids.push('king-crown','king-title');const slip=r.slips.find(x=>x.uid===m.uid),valid=r.matches.filter(x=>!x.void);if(!r.pointsOnly&&valid.length>=5&&valid.every(x=>['1','X','2'].includes(slip.picks[x.id]))&&slip.odds>=100&&p.profit>=1000)ids.push('room-100');}else if(p.played&&p.total>1&&p.correct===p.total-1)ids.push('almost-title');
   list.push({round:r.id,league:l.id,leagueName:l.name,title:r.title,competitionName:r.competitionName||'Campionato',source:source(r),ids,reason:!p.played?'Presenza scenica: anche la panchina ha il suo stile.':p.correct===p.total?'Schedina perfetta. Il bar si inchina.':p.correct===p.total-1?'Un solo errore: quasi leggenda.':`${p.correct} su ${p.total}: il risultato passa, lo stile resta.`,earnedAt:new Date(now).toISOString(),performance:p});
  }
  r.rewardVersion=1;
 }
 syncDayObjectives(s,now);
}
export function progressionFor(s,l,uid){
 migrateFantasyWallets(s,l.id);
 const own=l.members.find(m=>m.uid===uid);if(!own)return null;
 const result={fantacalcioByLeague:{}},keys=[...new Set(s.rounds.filter(r=>r.league===l.id&&source(r)==='fantacalcio').map(r=>fantasyWalletKey(r,l)))].filter(Boolean);
 for(const [scope,key] of [['seriea',null],...keys.map(key=>['fantacalcio',key])]){
  const selected=s.rounds.filter(r=>r.league===l.id&&source(r)===scope&&(scope!=='fantacalcio'||fantasyWalletKey(r,l)===key));
  const rounds=selected.filter(r=>r.settled&&r.matches?.some(m=>!m.void)).sort((a,b)=>Date.parse(a.deadline||a.kickoff||0)-Date.parse(b.deadline||b.kickoff||0)||a.id.localeCompare(b.id));
  const histories=new Map(l.members.map(m=>[m.uid,rounds.map(r=>roundPerformance(r,m.uid))]));
  const pointsNow=m=>scope==='seriea'?m.points||0:[...new Set(selected.map(r=>r.competitionKey))].reduce((v,k)=>v+(m.competitionPoints?.[k]||0),0);
  const basePoints=new Map(l.members.map(m=>[m.uid,pointsNow(m)-histories.get(m.uid).reduce((n,p)=>n+p.points,0)]));
  const wallet=scope==='seriea'?own:own.fantasyWallets?.[key]||{credits:0,initial:0};
  const committed=selected.filter(r=>!r.pointsOnly).flatMap(r=>r.slips||[]).filter(x=>x.uid===uid&&!x.creditsSettled).reduce((n,p)=>n+(p.stake||0),0);
  const profits=histories.get(uid).reduce((n,p)=>n+p.profit,0),initial=cents((wallet.credits||0)+committed-profits);
  let capital=initial,points=basePoints.get(uid)||0;
  const scores=new Map(basePoints),rank=()=>1+[...scores.values()].filter(v=>v>(scores.get(uid)||0)).length;
  const history=rounds.map((r,i)=>{const p=histories.get(uid)[i],before=rank();for(const m of l.members)scores.set(m.uid,cents(scores.get(m.uid)+histories.get(m.uid)[i].points));capital=cents(capital+p.profit);points=cents(points+p.points);return {id:r.id,title:r.title,competitionKey:r.competitionKey||null,competitionName:r.competitionName||'Campionato',at:r.deadline||r.kickoff,...p,capital,pointsTotal:points,position:rank(),positionChange:before-rank(),awards:(s.playerRewards?.[uid]||[]).find(a=>a.round===r.id)?.ids||[]};});
  const profile={initial,initialPoints:basePoints.get(uid)||0,capital,points,history};
  if(scope==='seriea')result.seriea=profile;else{result.fantacalcioByLeague[key]=profile;result.fantacalcio??=profile;}
 }
 result.objectives=objectivesFor(s,l,uid);return result;
}

