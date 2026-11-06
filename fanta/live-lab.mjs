import {matchTimeline} from './statistical-votes/presence.mjs';
import {officialLineups} from '../lib/official-lineups.mjs';
import {normalizeFixture,calculateVote} from './votes.mjs';
import {DEFAULT_RULES} from './rules.mjs';
import {funnyTeamNames} from './team-names.mjs';
export function labAuction(catalog,seed){
 const names=funnyTeamNames(4,{seed});
 return {league:{id:'lab:'+seed,name:'Il bar di prova',adminUid:'lab-player'},rules:{...structuredClone(DEFAULT_RULES),rosterMode:'empty'},teams:names.map((name,i)=>({id:'lab-team-'+i,name,manager:i?'Computer':'Tu',userId:i?null:'lab-player',color:['#83caf0','#d4e89b','#f4c06d','#d8a2d7'][i],roster:[]})),players:catalog.map(p=>({...p,active:true,value:Math.max(1,Math.min(160,Number(p.value)||({P:12,D:10,C:25,A:40}[p.role]))),stats:p.stats||{},status:p.status||{type:'ok'},fm:Number(p.stats?.avgFanta??p.fm)||6})),auction:{status:'none',mode:'live',phase:'bidding',version:1,log:[],order:[],lot:null,table:null}};
}
const clock=e=>Number(e.time?.elapsed||0)+Number(e.time?.extra||0);
const goal=e=>e.type==='Goal'&&!/missed|disallow|cancel|shootout/i.test(e.detail||'');
function replayRaw(source,minute){
 if(minute>=99)return structuredClone(source);
 const r=structuredClone(source),events=(r.events||[]).filter(e=>clock(e)<=minute),goals={home:0,away:0};
 for(const e of matchTimeline(source).goals.filter(e=>clock(e)<=minute)){const side=e.scoring===r.teams.home.id?'home':'away';goals[side]++;}
 r.events=events;r.goals=goals;r.fixture.status={short:minute<45?'1H':minute<48?'HT':'2H',elapsed:Math.min(90,minute)};
 // Only dated facts are replayed. Untimestamped final statistics are not leaked into live votes.
 r.statistics=[];
 for(const t of r.players||[])for(const row of t.players||[]){
  const old=row.statistics?.[0]||{},id=row.player.id,starter=(r.lineups||[]).find(l=>l.team.id===t.team.id)?.startXI.some(x=>x.player.id===id),entry=events.find(e=>e.type==='subst'&&e.assist?.id===id),exit=events.find(e=>e.type==='subst'&&e.player?.id===id),start=starter?0:entry?clock(entry):null,end=exit?clock(exit):Math.min(90,minute);
  row.statistics=[{games:{position:old.games?.position,number:old.games?.number,substitute:!starter,minutes:start==null?0:Math.max(0,end-start),rating:null},goals:{total:events.filter(e=>goal(e)&&e.player?.id===id&&!/own/i.test(e.detail)).length,assists:events.filter(e=>goal(e)&&e.assist?.id===id).length},cards:{yellow:events.filter(e=>e.type==='Card'&&e.player.id===id&&/yellow/i.test(e.detail)).length,red:events.filter(e=>e.type==='Card'&&e.player.id===id&&/red/i.test(e.detail)).length}}];
 }
 return r;
}
export function replayMatch(source,minute){
 const raw=replayRaw(source,minute),final=minute>=99,normalized=normalizeFixture(raw),votes=normalized.map(p=>({...calculateVote(p),id:p.id,name:p.name,role:p.role,club:p.club,opponent:p.opponent,home:p.fixture.teamSide==='home',kickoff:p.fixture.kickoff,score:[raw.goals.home,raw.goals.away]}));
 const official=officialLineups(raw),teams=(official?.teams||[]).map(t=>{
  const enrich=(p,starter)=>{const v=votes.find(v=>v.id===p.id),apiId=Number(p.apiId),entry=raw.events?.find(e=>e.type==='subst'&&e.assist?.id===apiId),exit=raw.events?.find(e=>e.type==='subst'&&e.player?.id===apiId);return {...p,role:v?.role||p.position,status:v?.status,minutes:v?.minutes,events:v?.events,club:v?.club,name:v?.name||p.name,grade:v?.vote,fantagrade:v?.fantavote,substitution:{in:entry?clock(entry):null,out:exit?clock(exit):null},starter};};
  return {...t,started:true,players:t.players.map(p=>enrich(p,true)),bench:t.bench.map(p=>enrich(p,false))};
 });
 return {id:String(raw.fixture.id),home:raw.teams.home.name,away:raw.teams.away.name,status:final?'FT':'LIVE',clock:final?'Finale':Math.min(90,minute)+"′",score:[raw.goals.home,raw.goals.away],originalDate:source.fixture.date,lineups:{kind:'official',started:true,teams},players:votes,
  details:{matchInfo:{teams:raw.teams},statistics:raw.statistics||[],playerStats:votes.filter(p=>p.minutes>0).map(p=>({name:p.name,side:normalized.find(n=>n.id===p.id)?.fixture.teamSide,minutes:p.minutes,...p.events})),events:(raw.events||[]).map(e=>({minute:clock(e),kind:e.type,detail:e.detail,team:e.team?.name,player:e.player?.name,assist:e.assist?.name}))}};
}
export function replaySnapshot(fixtures,phase){return {version:phase,at:new Date().toISOString(),replay:true,matches:fixtures.map((r,i)=>replayMatch(r,Math.min(99,phase+i*11)))};}
