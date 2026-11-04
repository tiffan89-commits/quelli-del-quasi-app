import {MARKETS} from './game.mjs';
export const ODDS_POLICY='api-football-weekly-v1',ODDS_WEEK=7*86400000,ODDS_DISCOVERY=3*3600000,ODDS_HORIZON=14*86400000;
const ended=new Set(['FT','AET','PEN','LIVE','1H','HT','2H','ET','BT','P','INT','PST','SUSP','CANC','ABD','AWD','WO']);
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const valid=n=>Number.isFinite(n)&&n>1&&n<=1000;
const median=a=>{a=[...a].sort((x,y)=>x-y);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
const groups=[['1','X','2'],['1X','12','X2'],['Under 2.5','Over 2.5'],['Goal','No Goal']];
export function oddsPick(bet,value){
 const name=key(bet.name),v=key(value);
 if(name==='match winner')return {home:'1',draw:'X',away:'2'}[v]||null;
 if(name==='goals over/under')return {'under 2.5':'Under 2.5','over 2.5':'Over 2.5'}[v]||null;
 if(name==='both teams score')return {yes:'Goal',no:'No Goal'}[v]||null;
 if(name==='double chance')return {'home/draw':'1X','draw/home':'1X','home/away':'12','away/home':'12','draw/away':'X2','away/draw':'X2','1x':'1X','12':'12','x2':'X2'}[v.replace(/\s*(?:\/| or )\s*/g,'/')]||null;
 return null;
}
export function aggregateApiOdds(row,{now=Date.now(),kickoff,season}={}){
 const stamp=Date.parse(row.update),start=Date.parse(kickoff);
 if(Number(row.league?.id)!==135||Number(row.league?.season)!==Number(season)||!Number.isFinite(stamp)||!Number.isFinite(start)||stamp>=start||stamp>now+300000)return {};
 const books=new Map(),blocked=new Set();for(const b of row.bookmakers||[]){if(!Number.isInteger(Number(b.id))||!b.name||/exchange|betfair ex|matchbook/i.test(b.name))continue;
  if(blocked.has(String(b.id)))continue;const quotes=new Map();for(const bet of b.bets||[])for(const v of bet.values||[]){const pick=oddsPick(bet,v.value),odd=Number(v.odd);if(pick&&valid(odd)){const values=quotes.get(pick)||new Set();values.add(odd);quotes.set(pick,values);}}
  const complete={};for(const family of groups)if(family.every(p=>quotes.get(p)?.size===1))for(const p of family)complete[p]=[...quotes.get(p)][0];
  if(books.has(String(b.id))){if(JSON.stringify(books.get(String(b.id)).quotes)!==JSON.stringify(complete)){books.delete(String(b.id));blocked.add(String(b.id));}continue;}
  books.set(String(b.id),{id:'api-football:'+b.id,name:b.name,quotes:complete});
 }
 const frozen={};for(const p of MARKETS){const sources=[...books.values()].filter(b=>valid(b.quotes[p])).map(b=>({id:b.id,name:b.name,odd:b.quotes[p],updatedAt:new Date(stamp).toISOString()}));if(sources.length&&Math.round(median(sources.map(s=>s.odd))*100)/100>1)frozen[p]={value:Math.round(median(sources.map(s=>s.odd))*100)/100,sources,provider:'API-FOOTBALL',estimated:false,acquiredAt:new Date(now).toISOString()};}
 return frozen;
}
export function oddsCandidates(fixtures,state={},now=Date.now()){
 return fixtures.filter(f=>f.apiId&&Date.parse(f.kickoff)>now&&Date.parse(f.kickoff)<=now+ODDS_HORIZON&&!ended.has(f.status)).map(f=>{
  const saved=state.fixtures?.[f.id],missing=MARKETS.filter(p=>!saved?.covered?.includes(p));return {...f,refresh:!saved?.refreshedAt||now-Date.parse(saved.refreshedAt)>=ODDS_WEEK,missing};
 }).filter(f=>f.refresh||f.missing.length);
}
export function nextOddsAt(fixtures,state={},now=Date.now()){
 const times=[];for(const f of fixtures){const start=Date.parse(f.kickoff);if(!f.apiId||!Number.isFinite(start)||start<=now||ended.has(f.status))continue;
  const saved=state.fixtures?.[f.id],missing=MARKETS.some(p=>!saved?.covered?.includes(p));let at=start>now+ODDS_HORIZON?start-ODDS_HORIZON:missing?now+ODDS_DISCOVERY:Date.parse(saved?.refreshedAt)+ODDS_WEEK;
  if(!Number.isFinite(at))at=now+ODDS_DISCOVERY;if(at<start)times.push(Math.max(now+60000,at));
 }
 return times.length?new Date(Math.min(...times)).toISOString():null;
}
export function scheduleOdds(plan,{now=Date.now(),failed=false}={}){
 if(plan.odds?.policy!==ODDS_POLICY)return plan;
 const id='odds:api-football:next',prior=plan.jobs.find(j=>j.id===id);if(prior?.status==='running')return plan;
 const at=failed?new Date(now+ODDS_DISCOVERY).toISOString():nextOddsAt(plan.fixtures,plan.odds,now);
 if(!at){if(prior&&prior.status==='queued')prior.status='cancelled';return plan;}
 if(prior?.status==='queued'&&Date.parse(prior.at)>=now-20*60000)return plan;
 const j={id,kind:'odds',at,status:'queued',attempts:0};if(prior){j.lastCompletedAt=prior.completedAt||prior.lastCompletedAt;j.lastMetrics=prior.metrics||prior.lastMetrics;Object.keys(prior).forEach(k=>delete prior[k]);Object.assign(prior,j);}else plan.jobs.push(j);return plan;
}
export async function collectApiOdds(candidates,provider,{season,now=Date.now(),maxPages=12}={}){
 const wanted=new Set(candidates.map(f=>Number(f.apiId))),rows=new Map();let calls=0;
 const prefixes=candidates.length<=3?candidates.map(f=>'odds?fixture='+f.apiId):['odds?league=135&season='+Number(season)];
 for(const prefix of prefixes)for(let page=1,total=1;page<=total;page++){
  if(calls>=maxPages)throw Error('API-FOOTBALL: limite pagine quote raggiunto');
  const response=await provider.get(prefix+'&page='+page);calls++;total=Number(response.paging?.total)||1;if(!Number.isInteger(total)||total>maxPages)throw Error('API-FOOTBALL: paginazione quote non valida');
  for(const r of response.response){const id=Number(r.fixture?.id);if(wanted.has(id)&&Number(r.league?.id)===135&&Number(r.league?.season)===Number(season)){const old=rows.get(id);if(!old||Date.parse(r.update)>Date.parse(old.update))rows.set(id,r);else if(r.update===old.update)rows.set(id,{...old,bookmakers:[...(old.bookmakers||[]),...(r.bookmakers||[])]});}}
 }
 return {at:new Date(now).toISOString(),rows:[...rows.values()],calls};
}
export function patchQuote(match,quotes,{refresh=false}={}){
 const frozen={...match.frozen};for(const[p,q]of Object.entries(quotes))if(refresh||frozen[p]?.provider!=='API-FOOTBALL')frozen[p]=q;
 return {frozen,odds:Object.fromEntries(Object.entries(frozen).map(([p,q])=>[p,q.value])),oddsSource:'API-FOOTBALL',oddsAcquiredAt:new Date(Math.max(...Object.values(frozen).filter(q=>q.provider==='API-FOOTBALL').map(q=>Date.parse(q.acquiredAt)))).toISOString()};
}
