import {createHash} from 'node:crypto';
import {teamBudget} from './auction.mjs';
export const singlePlayerAvailable=s=>s.teams.filter(t=>t.userId).length===1&&s.teams.some(t=>!t.userId);
const random=(...values)=>parseInt(createHash('sha256').update(values.join(':')).digest('hex').slice(0,8),16)/0xffffffff;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function computerValuation(s,team,p,{now=Date.now()}={}){
 const budget=teamBudget(team,s.rules),role=budget.roles[p.role];if(!role||role.have>=role.max||!budget.maxBid)return {ceiling:0,interest:0,reason:'Reparto completo o crediti insufficienti'};
 const stats=p.stats||{},season=Number(stats.avgFanta??p.fm??p.avgFanta??6),recent=(p.recentPerformances||p.recent||[]).slice(-3),form=recent.length?recent.reduce((n,r)=>n+Number(r.vote??r.rating??6)+(r.goals||0)*.35+(r.assists||0)*.2,0)/recent.length:season;
 const pct=Number(p.play?.pct??p.playProbability??80),status=p.status?.type,returnAt=Date.parse(p.status?.returnAt||p.returnAt),days=Number.isFinite(returnAt)?Math.max(0,(returnAt-now)/86400000):Number(p.status?.daysOut??0),longInjury=status==='injured'&&(days>=28||/mesi|months|crociato|stagione|season|lungo/i.test(p.status?.note||''));
 const availability=longInjury?.08:status==='injured'?.32:status==='suspended'?.72:clamp(pct/100,.2,1),quality=clamp(.7+(season-6)*.28+(form-season)*.35,.3,1.9),personality=.82+random(s.league.id,team.id,p.id)*.36,need=.8+.4*(role.max-role.have)/role.max;
 const estimated=Number(p.value)>0?p.value:Math.max(2,s.rules.budget*({P:.025,D:.025,C:.055,A:.10}[p.role]||.025));
 const ceiling=Math.min(budget.maxBid,Math.max(1,Math.round(estimated*quality*availability*personality*need)));
 return {ceiling,interest:clamp(quality*availability,0,1),longInjury,form,reason:longInjury?'Infortunio lungo: interesse minimo':form>season+.3?'Forma recente in crescita':status==='injured'?'Indisponibilità: offerta prudente':'Valore, forma, reparto e crediti disponibili'};
}
// Returns a command, never mutates state or makes network/DB calls.
export function computerDecision(s,{now=Date.now()}={}){
 const a=s.auction;if(!a.singlePlayer||!singlePlayerAvailable(s)||a.status!=='running'||a.mode!=='live'||a.phase==='releases'||a.pausedUntil)return null;
 const key=a.lot?.history?.at(-1)?.at||a.callStartedAt||a.startsAt,wait=a.lot?2200+random(a.version,'wait')*1800:2200;
 const since=a.lot?Date.parse(key):Date.parse(a.callDeadline)-s.rules.callSeconds*1000;if(now-since<wait)return null;
 if(!a.lot){const bot=s.teams.find(t=>t.id===a.caller&&!t.userId);if(!bot)return null;const candidates=s.players.filter(p=>p.active!==false&&!s.teams.some(t=>t.roster.some(r=>r.id===p.id))).map(p=>({p,...computerValuation(s,bot,p,{now})})).filter(x=>x.ceiling>0).sort((a,b)=>b.interest-a.interest||b.ceiling-a.ceiling);const pick=candidates[Math.floor(random(bot.id,a.version)*Math.min(5,candidates.length))];return pick?{kind:'nominate',teamId:bot.id,input:{playerId:pick.p.id,amount:1}}:null;}
 const lot=a.lot;if(lot.closing)return null;
 const bots=s.teams.filter(t=>!t.userId&&t.id!==lot.leader&&!lot.passed.includes(t.id)&&!lot.autoPassed[t.id]).sort((a,b)=>random(a.id,lot.id,a.version)-random(b.id,lot.id,a.version));
 for(const bot of bots){const v=computerValuation(s,bot,lot.player,{now}),amount=lot.bid+s.rules.minRaise;if(v.ceiling>=amount)return {kind:'bid',teamId:bot.id,input:{lotId:lot.id,amount},reason:v.reason};return {kind:'pass',teamId:bot.id,input:{lotId:lot.id},reason:v.reason};}
 return null;
}
