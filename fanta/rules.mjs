export const DEFAULT_RULES={version:'classic-v1',budget:500,roster:{P:3,D:8,C:8,A:6},minRaise:1,formations:['3-4-3','3-5-2','4-3-3','4-4-2','4-5-1','5-3-2','5-4-1'],benchMax:null,maxSubstitutions:null,substitutionsSameRoleOnly:true,minMinutes:15,bonus:{goals:3,assists:1,yellow:-.5,red:-1,ownGoals:-3,conceded:-1,penSaved:3,penMissed:-3},callSeconds:30,openSeconds:30,raiseSeconds:10,finalSeconds:3,finalStretch:5,lastRound:38};
export const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function validateLineup(input,roster,rules=DEFAULT_RULES){
 if(!rules.formations.includes(input.formation)||!Array.isArray(input.starters)||input.starters.length!==11||!Array.isArray(input.bench))fail('Scegli un modulo valido e undici titolari');
 const ids=[...input.starters,...input.bench];if(ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length)fail('Ogni giocatore può comparire una sola volta');
 const owned=new Map(roster.map(p=>[p.id,p]));if(ids.some(id=>!owned.has(id)))fail('Puoi schierare solo giocatori della tua rosa');
 const expected={P:1,...Object.fromEntries(['D','C','A'].map((r,i)=>[r,Number(input.formation.split('-')[i])]))};
 for(const role of ['P','D','C','A'])if(input.starters.filter(id=>owned.get(id).role===role).length!==expected[role])fail('I ruoli dei titolari non corrispondono al modulo');
 if(rules.benchMax!=null&&input.bench.length>rules.benchMax)fail('Troppi giocatori in panchina');
 return {formation:input.formation,starters:[...input.starters],bench:[...input.bench]};
}
export function bonuses(events={},role,rules=DEFAULT_RULES){return Object.entries(rules.bonus).filter(([k])=>k!=='conceded'||role==='P').flatMap(([k,n])=>Number(events[k])?[{key:k,label:({goals:'Gol',assists:'Assist',yellow:'Ammonizione',red:'Espulsione',ownGoals:'Autogol',conceded:'Gol subiti',penSaved:'Rigori parati',penMissed:'Rigori sbagliati'})[k],delta:round2(n*events[k])}]:[]);}
export const hasVote=p=>Number.isFinite(p?.vote);
export function defenseModifier(players,formation){
 const rule='Portiere e tre migliori difensori, sui soli voti base',bands=[{from:0,to:5.9999,bonus:0},{from:6,to:6.4999,bonus:1},{from:6.5,to:6.9999,bonus:2},{from:7,to:null,bonus:3}];
 const ds=players.filter(p=>p.role==='D'&&hasVote(p)).sort((a,b)=>b.vote-a.vote),g=players.find(p=>p.role==='P'&&hasVote(p));
 if(Number(formation.split('-')[0])<4||ds.length<4||!g)return {applies:false,bonus:0,reason:'Servono il portiere e almeno quattro difensori con voto',rule,pending:players.some(p=>p.status==='playing'||p.status==='to-play')};
 const chosen=[g,...ds.slice(0,3)],average=chosen.reduce((n,p)=>n+p.vote,0)/4;
 return {applies:true,bonus:average<6?0:average<6.5?1:average<7?2:3,average:round2(average),players:chosen.map(({id,name,role,vote})=>({id,name,role,vote})),bands,rule};
}
export const goalsFor=points=>points<66?0:1+Math.floor((points-66)/6);
export function scoreLineup(lineup,players,rules=DEFAULT_RULES){
 const byId=new Map(players.map(p=>[p.id,p])),bench=lineup.bench.map(id=>byId.get(id)).filter(Boolean).map(p=>({...p})),substitutions=[],used=new Set();
 const starters=lineup.starters.map(id=>({...byId.get(id)}));
 const active=starters.map(p=>{
  if(hasVote(p)||p.status==='playing'||p.status==='to-play')return p;
  if(rules.maxSubstitutions!=null&&substitutions.length>=rules.maxSubstitutions)return p;
  const incoming=bench.find(x=>x.role===p.role&&hasVote(x)&&!used.has(x.id));if(!incoming)return p;
  used.add(incoming.id);p.replacedBy=incoming.name;incoming.enteredFor=p.name;substitutions.push({out:p.id,in:incoming.id});return incoming;
 });
 const modifier=defenseModifier(active,lineup.formation),fantapoints=round2(active.reduce((n,p)=>n+(p.fantavote??0),0)),total=round2(fantapoints+modifier.bonus);
 return {formation:lineup.formation,savedAt:lineup.savedAt,starters,bench,substitutions,fantapoints,modifier,total,goals:goalsFor(total),withVote:active.filter(hasVote).length};
}
export function standings(teams,results){
 const rows=new Map(teams.map(t=>[t.id,{team:t,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,points:0,fantapoints:0,form:[]}]));
 for(const result of results){if(!result.official)continue;for(const [me,other]of [[result.home,result.away],[result.away,result.home]]){const row=rows.get(me.team.id);if(!row)continue;const outcome=me.goals>other.goals?'V':me.goals<other.goals?'P':'N';row.played++;row[{V:'won',N:'drawn',P:'lost'}[outcome]]++;row.points+=({V:3,N:1,P:0})[outcome];row.fantapoints=round2(row.fantapoints+me.points);row.goalsFor+=me.goals;row.goalsAgainst+=other.goals;row.form.push(outcome);}}
 const direct=(a,b)=>results.filter(r=>r.official&&[r.home.team.id,r.away.team.id].includes(a)&&[r.home.team.id,r.away.team.id].includes(b)).reduce((sum,r)=>{const m=r.home.team.id===a?r.home:r.away,o=r.home.team.id===a?r.away:r.home;return sum+(m.goals>o.goals?3:m.goals<o.goals?0:1);},0);
 // Mini-table for all teams tied on both league points and fantasy points is transitive.
 const list=[...rows.values()],head=row=>list.filter(x=>x.points===row.points&&x.fantapoints===row.fantapoints&&x!==row).reduce((n,x)=>n+direct(row.team.id,x.team.id),0);
 return list.sort((a,b)=>b.points-a.points||b.fantapoints-a.fantapoints||head(b)-head(a)||a.team.id.localeCompare(b.team.id)).map((r,i,all)=>({...r,position:i+1,form:r.form.slice(-5),playoffRequired:all.some(x=>x!==r&&x.points===r.points&&x.fantapoints===r.fantapoints&&head(x)===head(r))}));
}
