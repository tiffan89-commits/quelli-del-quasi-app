import {DEFAULT_RULES,validateLineup} from './rules.mjs';
import {createHash} from 'node:crypto';
import {identityKey} from './player-identities.mjs';
const unavailable=p=>p.active===false||['injured','suspended','unavailable'].includes(p.status?.type);
export function coachScore(p){
 const probability=Number.isFinite(p.startProbability)?p.startProbability/100:Number.isFinite(p.probability)?p.probability/100:.65;
 const form=p.stats?.recentFanta??p.stats?.avgFanta??p.fm??p.avgFanta??6;
 return Math.max(0,Math.min(1,probability))*4+(Number.isFinite(form)?form:6);
}
export function chooseAutoLineup(roster,rules=DEFAULT_RULES){
 const available=roster.filter(p=>!unavailable(p)),rank=(a,b)=>coachScore(b)-coachScore(a)||a.id.localeCompare(b.id),byRole=Object.fromEntries(['P','D','C','A'].map(r=>[r,available.filter(p=>p.role===r).sort(rank)]));
 let best=null;
 for(const formation of rules.formations){const need={P:1,...Object.fromEntries(['D','C','A'].map((r,i)=>[r,Number(formation.split('-')[i])]))};if(Object.keys(need).some(r=>byRole[r].length<need[r]))continue;
  const starters=Object.keys(need).flatMap(r=>byRole[r].slice(0,need[r])),score=starters.reduce((n,p)=>n+coachScore(p),0);
  if(!best||score>best.score||score===best.score&&formation<best.formation)best={formation,starters:starters.map(p=>p.id),score};
 }
 if(!best)return null;const used=new Set(best.starters),bench=available.filter(p=>!used.has(p.id)).sort(rank).map(p=>p.id);
 return validateLineup({...best,bench},roster,rules);
}
export function applyStoredForecasts(roster,forecasts){
 return roster.map(p=>{const teams=forecasts.flatMap(f=>f?.teams||[]).filter(t=>identityKey(t.team)===identityKey(p.club)),names=[p.name,p.fullName,...(p.aliases||[])].filter(Boolean).map(identityKey),matching=q=>names.includes(identityKey(q.name)),rows=teams.flatMap(t=>[...(t.players||[]),...(t.bench||[])]).filter(matching),blocked=teams.flatMap(t=>t.unavailable||[]).filter(matching).find(q=>/infortun|squalificat|indisponibil|injur|suspend/i.test(q.status||''));return {...p,...(rows.length===1&&Number.isFinite(rows[0].probability)?{startProbability:rows[0].probability}:{}),...(blocked?{status:{type:'unavailable'}}:{})};});
}
export function balancedPilotRosters(players,{teams=10,budget=500,slots=DEFAULT_RULES.roster,seed=''}={}){
 const roster=Array.from({length:teams},()=>[]),spent=Array(teams).fill(0),used=new Set(),roles=['P','D','C','A'];
 const tie=p=>seed?createHash('sha256').update(seed+':'+p.id).digest('hex'):p.id;
 for(const role of roles){const pool=players.filter(p=>p.role===role&&p.active!==false&&Number.isInteger(p.value)&&p.value>=1).sort((a,b)=>b.value-a.value||tie(a).localeCompare(tie(b)));
  for(let round=0;round<slots[role];round++){
   const order=Array.from({length:teams},(_,i)=>i).sort((a,b)=>roster[a].filter(p=>p.role===role).reduce((n,p)=>n+p.value,0)-roster[b].filter(p=>p.role===role).reduce((n,p)=>n+p.value,0)||(round%2?b-a:a-b));
   for(const i of order){const remaining=slots[role]-roster[i].filter(p=>p.role===role).length-1,roleReserve=role==='P'?.90:role==='D'?.72:role==='C'?.44:0,max=budget-spent[i]-remaining-Math.floor(budget*roleReserve),p=pool.find(p=>!used.has(p.id)&&p.value<=max);
    if(!p)throw Error('Listone insufficiente per il numero di rose richiesto nel budget');used.add(p.id);spent[i]+=p.value;roster[i].push({...p,price:p.value});
   }
  }
 }
 if(roster.some(r=>r.length!==Object.values(slots).reduce((a,b)=>a+b,0)||r.reduce((n,p)=>n+p.price,0)>budget))throw Error('Rose pilota fuori budget');return roster;
}
// Random leagues distribute the strongest available tier in each role. Prices
// are synthetic assignment costs, scaled equally so no roster exceeds budget.
export function balancedRandomRosters(players,{teams,budget=500,slots=DEFAULT_RULES.roster,seed=''}={}){
 if(!Number.isInteger(teams)||teams<2||teams>20)throw Error('Numero di squadre non valido');
 const rosters=Array.from({length:teams},()=>[]),used=new Set(),rank=id=>createHash('sha256').update(seed+':'+id).digest('hex');
 for(const role of ['P','D','C','A']){
  const pool=players.filter(p=>p.role===role&&p.active!==false&&Number.isFinite(p.value)&&p.value>=1&&!used.has(p.id)).sort((a,b)=>b.value-a.value||rank(a.id).localeCompare(rank(b.id)));
  if(new Set(pool.map(p=>p.id)).size<teams*slots[role])throw Error('Giocatori insufficienti nel ruolo '+role+' per '+teams+' rose');
  for(let tier=0;tier<slots[role];tier++){
   const totals=r=>r.filter(p=>p.role===role).reduce((n,p)=>n+p.value,0),all=r=>r.reduce((n,p)=>n+p.value,0);
   const order=rosters.map((_,i)=>i).sort((a,b)=>totals(rosters[a])-totals(rosters[b])||all(rosters[a])-all(rosters[b])||rank(tier+':'+a).localeCompare(rank(tier+':'+b)));
   for(const i of order){const p=pool.find(p=>!used.has(p.id));used.add(p.id);rosters[i].push({...p});}
  }
 }
 const maximum=Math.max(...rosters.map(r=>r.reduce((n,p)=>n+p.value,0))),factor=Math.min(1,(budget-Object.values(slots).reduce((a,b)=>a+b,0))/maximum);
 return rosters.map(r=>r.map(p=>({...p,price:Math.max(1,Math.floor(p.value*factor))})));
}
