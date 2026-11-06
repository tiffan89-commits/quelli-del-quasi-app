import {DEMO_FOOTBALL} from './demo-football-data.mjs';
export const demoFootballMeta=DEMO_FOOTBALL.meta;
export const demoFixtures=n=>DEMO_FOOTBALL.fixtures.filter(f=>f.round===n);
const byPlayer=new Map(DEMO_FOOTBALL.players.map(p=>[p.apiId,p]));
const identity=p=>({apiId:p.apiId,name:p.name,role:p.role,club:p.club,jersey:p.jersey});
export function demoRoster(teamIndex,counts){return Object.entries(counts).flatMap(([role,n])=>DEMO_FOOTBALL.players.filter(p=>p.role===role).slice(teamIndex*n,(teamIndex+1)*n).map((p,i)=>({...identity(p),slot:role+i})));}
export const demoMarketPlayers=()=>Array.from({length:40},(_,i)=>{const role='PDCA'[i%4],used={P:24,D:64,C:64,A:48}[role],p=DEMO_FOOTBALL.players.filter(p=>p.role===role)[used+Math.floor(i/4)];return {...identity(p),id:'mercato-'+i};});
export function demoSeason(p){const s=byPlayer.get(p.apiId);if(!s)return null;return {...s.stats,played:s.stats.played||0,avgVote:s.stats.avgVote??s.performance?.vote??null,avgFanta:s.stats.avgFanta??s.performance?.fantavote??null,goals:s.stats.goals||0,assists:s.stats.assists||0,status:s.availability||{type:'ok'}};}
export function demoPerformance(p,n,state){
 if(n!==DEMO_FOOTBALL.meta.round||!['calcolata','in-corso'].includes(state))return null;
 const s=byPlayer.get(p.apiId),f=demoFixtures(n).find(f=>[f.teams.home.name,f.teams.away.name].includes(p.club)),home=f?.teams.home.name===p.club;
 const base={id:p.id,...identity(p),opponent:f?.teams[home?'away':'home'].name||'',home,sourceRound:n,ai:null};
 return s?.performance?{...structuredClone(s.performance),...base}:{...base,status:'sv',minutes:0,vote:null,fantavote:null,events:{},stats:[],why:'Nessun voto disponibile nell’archivio di questa giornata.'};
}
export function demoLineups(f){
 const final=['FT','AET','PEN'].includes(f.status),started=final||['1H','HT','2H','LIVE'].includes(f.status);
 const convert=(p,starter)=>{const performance=f.round===DEMO_FOOTBALL.meta.round?byPlayer.get(p.id)?.performance:null,events={...(performance?.events||{})},entry=(f.events||[]).find(e=>e.type==='subst'&&e.assist?.id===p.id),exit=(f.events||[]).find(e=>e.type==='subst'&&e.player?.id===p.id),clock=e=>e?Number(e.time?.elapsed||0)+Number(e.time?.extra||0):null;
  for(const [kind,filter]of Object.entries({goals:e=>e.type==='Goal'&&e.player?.id===p.id&&!/own|missed|disallow|cancel/i.test(e.detail||''),assists:e=>e.type==='Goal'&&e.assist?.id===p.id&&!/own|missed|disallow|cancel/i.test(e.detail||''),ownGoals:e=>e.type==='Goal'&&e.player?.id===p.id&&/own/i.test(e.detail||''),yellow:e=>e.type==='Card'&&e.player?.id===p.id&&/yellow/i.test(e.detail||'')&&!/second/i.test(e.detail||''),red:e=>e.type==='Card'&&e.player?.id===p.id&&/red|second yellow/i.test(e.detail||'')}))events[kind]=Math.max(events[kind]||0,(f.events||[]).filter(filter).length);
  return {id:p.id,name:p.name,jersey:p.number,role:p.pos,grid:p.grid,probability:starter?100:0,probabilityKind:'official',...(started?{status:performance?.status,grade:performance?.vote,fantagrade:performance?.fantavote,minutes:performance?.minutes,events,substitution:{in:clock(entry),out:clock(exit)}}:{})};
 };
 return {kind:'official',started,updatedAt:DEMO_FOOTBALL.meta.exportedAt,teams:(f.lineups||[]).map(t=>({team:f.teams.home.id===t.team.id?f.teams.home.name:f.teams.away.name,formation:t.formation,players:(t.startXI||[]).map(({player:p})=>convert(p,true)),bench:(t.substitutes||[]).map(({player:p})=>convert(p,false))}))};
}
export function demoMatchData(f){
 const events=(f.events||[]).map(e=>({kind:e.type==='Goal'?'goal':e.type==='Card'?(/red/i.test(e.detail)?'red':'yellow'):e.type==='subst'?'substitution':'var',minute:String(e.time?.elapsed??'')+(e.time?.extra?'+'+e.time.extra:'')+'′',team:e.team?.name,side:e.team?.id===f.teams.home.id?'home':'away',players:[e.player?.name].filter(Boolean),detail:e.detail,...(e.type==='subst'?{incoming:e.assist?.name}:{})}));
 const playerStats=DEMO_FOOTBALL.players.filter(p=>p.performance?.sourceRound===f.round&&[f.teams.home.name,f.teams.away.name].includes(p.club)).map(p=>({name:p.name,team:p.club,side:p.club===f.teams.home.name?'home':'away',minutes:p.performance.minutes,...p.performance.events}));
 return {home:f.teams.home.name,away:f.teams.away.name,homeId:f.teams.home.id,awayId:f.teams.away.id,score:[f.goals.home,f.goals.away],status:f.status,events,lineups:demoLineups(f),details:{complete:true,source:'DB snapshot',updatedAt:demoFootballMeta.exportedAt,matchInfo:{teams:f.teams},events,statistics:f.statistics||[],playerStats}};
}
