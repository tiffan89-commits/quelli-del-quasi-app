import {createHash} from 'node:crypto';
import {computerTeamsActive,teamBudget} from './auction.mjs';
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
function computerTurn(s){
 const a=s.auction,lot=a.lot;
 if(!computerTeamsActive(s)||a.status!=='running'||['releases','lobby'].includes(a.phase)||a.pausedUntil||lot?.closing)return null;
 const deadline=Date.parse(lot?.endsAt||a.callDeadline);
 const since=lot?(Date.parse(lot.history.at(-1)?.at)||deadline-(s.rules.openSeconds-s.rules.finalSeconds+s.rules.finalStretch)*1000):deadline-s.rules.callSeconds*1000;
 if(!Number.isFinite(since)||!Number.isFinite(deadline))return null;
 const eligible=s.teams.filter(t=>!t.userId&&(lot?t.id!==lot.leader&&!lot.passed.includes(t.id)&&!lot.autoPassed[t.id]:t.id===a.caller));
 // Anchor each team's reaction to the last action so reconnects never restart its clock.
 const next=eligible.map(team=>({team,at:since+Math.round(2200+random(s.league.id,team.id,lot?.id||a.callDeadline,a.version)*(lot?4600:2000))})).sort((a,b)=>a.at-b.at)[0];
 return next&&next.at<deadline?next:null;
}
export const computerActionAt=s=>computerTurn(s)?.at??null;

// Commands use the same lot ID and amount contract as a click in the auction room.
export function computerDecision(s,{now=Date.now()}={}){
 const turn=computerTurn(s),a=s.auction,lot=a.lot;
 if(!turn||now<turn.at||now>=Date.parse(lot?.endsAt||a.callDeadline))return null;
 const bot=turn.team;
 if(!lot){const candidates=s.players.filter(p=>(!a.currentRole||a.currentRole===p.role)&&p.active!==false&&!s.teams.some(t=>t.roster.some(r=>r.id===p.id))).map(p=>({p,...computerValuation(s,bot,p,{now})})).filter(x=>x.ceiling>0).sort((a,b)=>b.interest-a.interest||b.ceiling-a.ceiling);const pick=candidates[Math.floor(random(bot.id,a.version)*Math.min(5,candidates.length))];return pick?{kind:'nominate',teamId:bot.id,input:{playerId:pick.p.id,amount:1}}:null;}
 const valuation=computerValuation(s,bot,lot.player,{now}),amount=lot.bid+s.rules.minRaise;
 return valuation.ceiling>=amount?{kind:'bid',teamId:bot.id,input:{lotId:lot.id,amount},reason:valuation.reason}:{kind:'pass',teamId:bot.id,input:{lotId:lot.id},reason:valuation.reason};
}
