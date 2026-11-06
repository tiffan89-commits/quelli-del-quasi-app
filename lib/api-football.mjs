import {officialLineups,sameOfficialLineups} from './official-lineups.mjs';
import {createHash} from 'node:crypto';
import {ensureCalendar,matchCalendarEvent,updateCalendarRounds} from './calendar.mjs';
import {recordExternal} from './platform-admin.mjs';

export const API_FOOTBALL_SOURCE='API-FOOTBALL';
export const apiFootballEnabled=(env=process.env)=>!!env.API_FOOTBALL_KEY?.trim();
const MIN=60000,HOUR=60*MIN;
const LIVE=['1H','HT','2H','ET','BT','P','LIVE','INT'];
const FINAL=['FT','AET','PEN'];
export function apiFootballClient({env=process.env,fetcher=fetch}={}) {
  const quota={calls:0};
  async function get(path) {
    if(!apiFootballEnabled(env))throw Error('API-FOOTBALL: chiave server non configurata');
    if(!/^(?:status|fixtures\/lineups\?fixture=\d+|fixtures(?:\?(?:league=135&season=\d{4}(?:&date=\d{4}-\d{2}-\d{2})?|ids=\d+(?:-\d+){0,19}))?|odds\?(?:league=135&season=\d{4}|fixture=\d+)&page=\d{1,3})$/.test(path))throw Error('API-FOOTBALL: endpoint non consentito');
    if(quota.remaining!=null&&quota.remaining<=10)throw Error('API-FOOTBALL: riserva giornaliera raggiunta');
    let r;quota.calls++;
    try{r=await fetcher('https://v3.football.api-sports.io/'+path,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY.trim()},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('API-FOOTBALL: servizio non raggiungibile');}
    recordExternal(API_FOOTBALL_SOURCE,path.split('?')[0],r.status);
    for(const [key,header]of [['remaining','x-ratelimit-requests-remaining'],['limit','x-ratelimit-requests-limit']]){
      const value=r.headers.get(header);if(value!=null&&/^\d+$/.test(value))quota[key]=Number(value);
    }
    if(!r.ok)throw Error('API-FOOTBALL: HTTP '+r.status);
    let data;try{data=await r.json();}catch{throw Error('API-FOOTBALL: risposta non valida');}
    if(data.errors&&Object.keys(data.errors).length)throw Error('API-FOOTBALL: verificare abbonamento, quota e stagione');
    if(!Array.isArray(data.response)&&path!=='status')throw Error('API-FOOTBALL: risposta non valida');
    return data;
  }
  return {get,quota};
}
export function apiFootballSeason(f){return Number(String(f.calendar?.season||'').slice(0,4));}
export function apiFootballMatch(f,e){
  const season=apiFootballSeason(f),time=Date.parse(e.fixture?.date);
  if(Number(e.league?.id)!==135||Number(e.league?.season)!==season||!/^\d+$/.test(String(e.fixture?.id))||
    !Number.isFinite(time)||time<Date.UTC(season,6,1)||time>=Date.UTC(season+1,6,1))return null;
  return matchCalendarEvent({football:f},{home_team:e.teams?.home?.name,away_team:e.teams?.away?.name})?.match||null;
}
export function apiFootballTimeline(e){
  const home=String(e.teams?.home?.id),away=String(e.teams?.away?.id),seen=new Set();
  return (e.events||[]).flatMap((x,index)=>{
    const type=String(x.type||'').toLowerCase(),detail=String(x.detail||'').toLowerCase(),side=String(x.team?.id)===home?'home':String(x.team?.id)===away?'away':null;
    let kind=type==='goal'?/disallow|cancel|overturn|no goal/i.test(detail)?'var':detail.includes('missed')?'penalty-missed':detail.includes('own')?'own-goal':'goal':
      type==='card'?/red|second yellow/.test(detail)?'red':'yellow':type==='subst'?'substitution':type==='var'?'var':null;
    if(!kind||!side)return [];
    if(kind==='penalty-missed'&&/saved/i.test(x.comments||''))kind='penalty-saved';
    const elapsed=Number(x.time?.elapsed),extra=Number(x.time?.extra||0),minute=Number.isFinite(elapsed)?elapsed+(extra?'+'+extra:'')+"'":'';
    const id=[kind,side,minute,x.player?.id||x.player?.name||'',x.assist?.id||x.assist?.name||''].join(':');
    if(seen.has(id))return [];seen.add(id);
    return [{id,kind,side,team:x.team?.name||'',minute,seconds:Number.isFinite(elapsed)?(elapsed+extra)*60:0,
      players:x.player?.name?[x.player.name]:[],playerId:x.player?.id||null,assist:x.assist?.name||null,
      incoming:kind==='substitution'?x.assist?.name||null:null,penalty:kind==='goal'&&detail==='penalty',
      detail:String(x.detail||''),note:x.comments?String(x.comments):null,order:index}];
  }).sort((a,b)=>a.seconds-b.seconds||a.order-b.order);
}
export function apiFootballPenalties(e){
  return (e.players||[]).flatMap(team=>(team.players||[]).flatMap(p=>{
    const stats=p.statistics?.[0],penalty=stats?.penalty;
    if(!penalty||!['scored','missed','saved','won','commited'].some(k=>Number(penalty[k])>0))return [];
    return [{team:team.team?.name,side:team.team?.id===e.teams?.home?.id?'home':'away',player:p.player?.name,
      playerId:p.player?.id,scored:penalty.scored??null,missed:penalty.missed??null,saved:penalty.saved??null,
      won:penalty.won??null,committed:penalty.commited??null}];
  }));
}
export function apiFootballPlayerStats(e){
  return (e.players||[]).flatMap(t=>(t.players||[]).map(p=>{
    const x=p.statistics?.[0]||{};
    return {id:p.player?.id,name:p.player?.name,team:t.team?.name,side:t.team?.id===e.teams?.home?.id?'home':'away',
      minutes:x.games?.minutes??null,rating:x.games?.rating??null,goals:x.goals?.total??null,assists:x.goals?.assists??null,
      saves:x.goals?.saves??null,yellow:x.cards?.yellow??null,red:x.cards?.red??null,penalty:x.penalty||null};
  }));
}
const validScore=x=>x!=null&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=40;
export function applyApiFootball(s,rows,at=new Date().toISOString(),{updateRounds=true,allowOfficialCorrection=false,finalVerification=false}={}){
  const f=s.football;ensureCalendar(s);
  const report={matched:0,updated:0,unchanged:0,conflicts:0,events:0,statistics:0,players:0,complete:0};
  for(const e of rows){
    const m=apiFootballMatch(f,e);if(!m)continue;report.matched++;
    const status=e.fixture.status.short,finished=FINAL.includes(status),live=LIVE.includes(status);
    const alreadyFinal=m.status==='FT',nextScore=[e.goals?.home,e.goals?.away];
    if(!['NS','TBD',...LIVE,...FINAL,'PST','CANC','SUSP','ABD','AWD','WO'].includes(status))continue;
    if(m.scoreUpdatedAt&&Date.parse(at)<Date.parse(m.scoreUpdatedAt)){report.conflicts++;continue;}
    if((live||finished)&&!nextScore.every(validScore))continue;
    // Completed game accounts cannot be recalculated by an import of a conflicting provider final.
    if(alreadyFinal&&(!finished||!allowOfficialCorrection&&(m.score&&m.score.join()!==nextScore.join()))){report.conflicts++;continue;}
    const official=officialLineups(e,at);
    if(official&&!sameOfficialLineups(m.lineups,official)){m.lineups=official;report.lineups=(report.lineups||0)+1;}
    const detailed=Array.isArray(e.events)&&Array.isArray(e.statistics)&&Array.isArray(e.players);
    if(finished)m.apiFootballFinalAt||=at;
    const finalWindow=finished&&(finalVerification||Date.parse(at)-Date.parse(e.fixture.date)>=4*HOUR||Date.parse(at)-Date.parse(m.apiFootballFinalAt)>=15*MIN);
    const digest=createHash('sha256').update(JSON.stringify([e,finalWindow])).digest('hex');
    if(m.apiFootballDigest===digest){report.unchanged++;continue;}
    m.apiFootballId=e.fixture.id;m.apiFootballDigest=digest;m.apiFootballCheckedAt=at;
    if(!alreadyFinal)m.kickoff=e.fixture.date;
    m.liveSource=API_FOOTBALL_SOURCE;m.scoreSource=API_FOOTBALL_SOURCE;m.scoreUpdatedAt=at;
    if(finished){m.status='FT';m.score=nextScore;m.liveScore=null;m.clock=null;m.phase='Finale';m.officialConfirmed=true;m.scoreVerifiedAt=at;}
    else if(live){m.status='LIVE';m.score=null;m.liveScore=nextScore;m.clock=status==='HT'||status==='BT'?'Intervallo':e.fixture.status.elapsed!=null?e.fixture.status.elapsed+(e.fixture.status.extra?'+'+e.fixture.status.extra:'')+"'":null;m.phase=e.fixture.status.long||'In corso';m.clockSource=API_FOOTBALL_SOURCE;m.clockUpdatedAt=at;}
    else if(!alreadyFinal){m.status=['PST','CANC','SUSP','ABD','AWD','WO'].includes(status)?status:'NS';m.liveScore=null;m.phase=e.fixture.status.long||'Da giocare';}
    if(detailed||Array.isArray(e.events)){
      const events=apiFootballTimeline(e),goals=events.filter(x=>['goal','own-goal'].includes(x.kind)).length;
      const hasStats=(e.statistics||[]).some(t=>t.statistics?.some(x=>x.value!=null)),hasPlayers=(e.players||[]).some(t=>t.players?.length);
      // Recent finals may still be receiving statistics. Missing coverage is never fabricated.
      const complete=detailed&&finalWindow&&goals===nextScore.reduce((a,b)=>a+Number(b),0)&&hasStats&&hasPlayers;
      m.details={source:API_FOOTBALL_SOURCE,updatedAt:at,complete,events,statistics:(e.statistics||[]).map(t=>({...t,side:t.team?.id===e.teams.home.id?'home':'away'})),players:e.players||[],
        penalties:apiFootballPenalties(e),playerStats:apiFootballPlayerStats(e),scoreBreakdown:e.score||null,sourceEvents:e.events,sourceLineups:e.lineups||[],
        matchInfo:{fixture:e.fixture,league:e.league,teams:e.teams}};
      report.events+=events.length;if(hasStats)report.statistics++;if(hasPlayers)report.players++;if(complete)report.complete++;
    }
    report.updated++;
  }
  if(report.updated){f.lastLiveSync=at;f.liveSource=API_FOOTBALL_SOURCE;}
  if(updateRounds)updateCalendarRounds(s);
  return report;
}
export function apiFootballCandidates(f,now=new Date()){
  return (f.calendar?.rounds.flatMap(r=>r.matches)||[]).filter(m=>{
    if(!m.kickoff)return false;const age=now-Date.parse(m.kickoff);
    if(m.status==='FT')return m.liveSource===API_FOOTBALL_SOURCE&&!m.details?.complete&&age<24*HOUR&&(!m.apiFootballCheckedAt||now-Date.parse(m.apiFootballCheckedAt)>=15*MIN);
    return !m.officialConfirmed&&age>=-5*MIN&&age<=4*HOUR;
  });
}
export function apiFootballDue(f,now=new Date()){
  return (!f.lastLiveAttempt||Math.floor(+now/MIN)>Math.floor(Date.parse(f.lastLiveAttempt)/MIN))&&apiFootballCandidates(f,now).length>0;
}
export async function collectApiFootball(f,client=apiFootballClient(),now=new Date()){
  if(!apiFootballDue(f,now))return null;
  const candidates=apiFootballCandidates(f,now),ids=new Set(candidates.map(m=>m.apiFootballId).filter(Boolean)),errors=[],matches=[];
  for(const date of new Set(candidates.filter(m=>!m.apiFootballId).map(m=>m.kickoff.slice(0,10)))){
    try{const data=await client.get(`fixtures?league=135&season=${apiFootballSeason(f)}&date=${date}`);for(const e of data.response)if(candidates.some(m=>apiFootballMatch(f,e)?.id===m.id))ids.add(e.fixture.id);}catch(e){errors.push(e.message);}
  }
  const list=[...ids];for(let i=0;i<list.length;i+=20){try{const data=await client.get('fixtures?ids='+list.slice(i,i+20).join('-'));matches.push(...data.response);}catch(e){errors.push(e.message);}}
  return {matches,errors:[...new Set(errors)],quota:client.quota,at:now.toISOString()};
}
