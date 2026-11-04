import {randomUUID} from 'node:crypto';
import {fail,standings} from './rules.mjs';
export const COMPETITION_TYPES={league:'Campionato',groups:'Coppa a gironi',knockout:'Coppa a eliminazione'};
export function roundRobin(ids,{twice=false}={}){
 const ring=[...ids];if(ring.length%2)ring.push(null);const rounds=[];
 for(let n=0;n<ring.length-1;n++){const matches=[];for(let i=0;i<ring.length/2;i++){let a=ring[i],b=ring[ring.length-1-i];if(n%2&&i===0)[a,b]=[b,a];if(a&&b)matches.push({home:a,away:b});}rounds.push(matches);ring.splice(1,0,ring.pop());}
 return twice?[...rounds,...rounds.map(ms=>ms.map(m=>({home:m.away,away:m.home})))]:rounds;
}
export function knockoutStage(ids,number=1){
 let size=1;while(size<ids.length)size*=2;const slots=[...ids,...Array(size-ids.length).fill(null)],pairs=[],byes=[];
 for(let i=0;i<size/2;i++){const a=slots[i],b=slots[size-1-i];if(a&&b)pairs.push({home:a,away:b,seed:i});else if(a||b)byes.push({team:a||b,seed:i});}
 return {number,matches:pairs.map(m=>({...m,stage:'knockout',label:size===2?'Finale':size===4?'Semifinale':size===8?'Quarti di finale':'Turno eliminatorio'})),byes};
}
export function planCompetition(ids,kind,{groups=2,qualify=2,twice=false}={}){
 if(kind==='league')return {plan:roundRobin(ids,{twice}).map((matches,i)=>({number:i+1,matches:matches.map(m=>({...m,stage:'league'}))})),groups:[]};
 if(kind==='knockout'){const first=knockoutStage(ids);return {plan:[first],groups:[],seeds:ids};}
 if(![2,4].includes(groups)||ids.length<groups*2||![1,2].includes(qualify)||Math.floor(ids.length/groups)<=qualify)fail('Numero di gironi o qualificati non valido');
 const buckets=Array.from({length:groups},(_,i)=>({id:String.fromCharCode(65+i),teams:[]}));ids.forEach((id,i)=>buckets[Math.floor(i/groups)%2?groups-1-i%groups:i%groups].teams.push(id));
 const schedules=buckets.map(g=>roundRobin(g.teams,{twice})),n=Math.max(...schedules.map(s=>s.length));
 return {plan:Array.from({length:n},(_,i)=>({number:i+1,matches:buckets.flatMap((g,k)=>(schedules[k][i]||[]).map(m=>({...m,stage:'group',group:g.id})))})),groups:buckets,qualify,seeds:ids};
}
export function readyRosters(s){return s.teams.length===s.league.maxMembers&&s.teams.every(t=>{const roles={P:0,D:0,C:0,A:0};for(const p of t.roster)roles[p.role]++;return t.roster.length===25&&roles.P===3&&roles.D===8&&roles.C===8&&roles.A===6&&t.roster.reduce((n,p)=>n+p.price,0)<=s.rules.budget;});}
export const sizeLocked=s=>(s.competitions||[]).some(c=>c.status!=='draft');
export function cupTables(s){return (s.competition?.data?.groups||[]).map(g=>({...g,standings:standings(s.teams.filter(t=>g.teams.includes(t.id)),s.results.filter(r=>r.official&&s.matchups.find(m=>m.id===r.matchup_id)?.data?.group===g.id).map(r=>r.data))}));}
export async function competitionAction(s,c,input,uid,kind,now=Date.now()){
 if(s.league.adminUid!==uid)fail('Solo il presidente può gestire le competizioni',403);
 if(kind==='configure'){
  const size=Number(input.size);if(![4,6,8,10,12].includes(size)||size<s.teams.length)fail('Scegli una taglia valida, almeno pari alle squadre presenti');
  if(sizeLocked(s)&&size!==s.league.maxMembers)fail('La taglia della lega è bloccata: la competizione è già avviata',409);
  await c.query('UPDATE fanta.leagues SET max_members=$2 WHERE id=$1',[s.league.id,size]);return {ok:true,size};
 }
 if(kind==='create'){
  const name=String(input.name||'').trim(),type=input.kind;if(name.length<2||name.length>60||!COMPETITION_TYPES[type])fail('Nome o tipo di competizione non valido');if((s.competitions||[]).length>=12)fail('Puoi creare fino a 12 competizioni');
  const id='comp:'+randomUUID();await c.query('INSERT INTO fanta.competitions(id,league_id,name,kind) VALUES($1,$2,$3,$4)',[id,s.league.id,name,type]);return {id,name,kind:type,status:'draft'};
 }
 if(kind==='start'){
  const comp=s.competition;if(!comp||comp.status!=='draft')fail('Questa competizione è già stata avviata',409);
  if(!readyRosters(s))fail(`Completa e salva tutte le ${s.league.maxMembers} rose: 3 P, 8 D, 8 C e 6 A per squadra`,409);
  const start=Number(input.startRound);if(!Number.isInteger(start)||start<1||start>38)fail('Scegli la giornata di Serie A iniziale');
  const fixture=s.fixtures.filter(f=>f.round===start&&f.kickoff).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff))[0];if(!fixture||Date.parse(fixture.kickoff)<=now)fail('Scegli una giornata futura con calendario disponibile');
  const data=planCompetition(s.teams.map(t=>t.id),comp.kind,{groups:Number(input.groups||2),qualify:Number(input.qualify||2),twice:!!input.twice});
  const needed=data.plan.length+(comp.kind==='groups'?Math.log2(Number(input.groups||2)*Number(input.qualify||2)):comp.kind==='knockout'?Math.ceil(Math.log2(s.teams.length))-1:0);
  if(start+needed-1>38)fail('Le giornate rimaste non bastano per questa competizione');
  data.startedAt=new Date(now).toISOString();await c.query("UPDATE fanta.competitions SET status='active',start_round=$2,data=$3 WHERE id=$1",[comp.id,start,JSON.stringify(data)]);await materializeCalendar(c,{...comp,start_round:start,data},s.league.season);return {ok:true,id:comp.id,status:'active'};
 }
 fail('Operazione non valida');
}
export async function materializeCalendar(c,comp,season){
 const existing=new Set((await c.query('SELECT number FROM fanta.rounds WHERE competition_id=$1',[comp.id])).rows.map(r=>r.number)),fixtures=new Map((await c.query('SELECT round,min(kickoff) AS deadline,count(*)::int AS n FROM fanta.fixtures WHERE season=$1 AND kickoff IS NOT NULL GROUP BY round',[season])).rows.map(r=>[r.round,r]));
 let added=0;for(const round of comp.data?.plan||[]){const seriea=comp.start_round+round.number-1;if(seriea>38||existing.has(round.number))continue;
  const fixture=fixtures.get(seriea);if(!fixture?.deadline||fixture.n!==10)continue;
  const inserted=await c.query('INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline,competition_id,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING number',[comp.league_id,round.number,seriea,fixture.deadline,comp.id,JSON.stringify({stage:round.matches[0]?.stage,label:round.matches[0]?.label,byes:round.byes||[]})]);added+=inserted.rows.length;
  for(const [i,m]of round.matches.entries())await c.query('INSERT INTO fanta.matchups(id,league_id,round,home_id,away_id,competition_id,data) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[comp.id+':'+round.number+':'+i,comp.league_id,round.number,m.home,m.away,comp.id,JSON.stringify(m)]);
 }return added;
}
export async function extendCalendars({connect}){const c=await connect();try{await c.query('BEGIN');const rows=(await c.query("SELECT c.*,l.season FROM fanta.competitions c JOIN fanta.leagues l ON l.id=c.league_id WHERE l.rules->>'disabledAt' IS NULL AND c.status='active' AND c.data?'plan' FOR UPDATE OF c")).rows;let added=0;for(const comp of rows)added+=await materializeCalendar(c,comp,comp.season);await c.query('COMMIT');return added;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function advanceCup(s,c){
 const comp=s.competition;if(!comp||comp.status!=='active'||!['groups','knockout'].includes(comp.kind)||!comp.data?.plan?.length)return false;
 const last=comp.data.plan.at(-1),r=s.rounds.find(r=>r.number===last.number);if(!r?.official)return false;
 const data=structuredClone(comp.data);let ids;
 if(last.matches[0]?.stage==='group'){
  const tables=cupTables(s);ids=[];for(let place=0;place<data.qualify;place++)for(const g of tables)if(g.standings[place])ids.push(g.standings[place].team.id);
 }else{
  const winners=last.byes?.map(b=>({...b}))||[];
  for(const [i,m]of last.matches.entries()){const match=s.matchups.find(x=>x.round===last.number&&x.home_id===m.home&&x.away_id===m.away),result=match&&s.results.find(x=>x.matchup_id===match.id&&x.official)?.data;if(!result)return false;
   const home=result.home,away=result.away;let winner=home.goals!==away.goals?(home.goals>away.goals?m.home:m.away):home.points!==away.points?(home.points>away.points?m.home:m.away):data.seeds.indexOf(m.home)<data.seeds.indexOf(m.away)?m.home:m.away;
   winners.push({team:winner,seed:m.seed??i});
  }ids=winners.sort((a,b)=>a.seed-b.seed).map(w=>w.team);
 }
 if(ids.length===1){data.winner=ids[0];await c.query("UPDATE fanta.competitions SET status='finished',data=$2 WHERE id=$1",[comp.id,JSON.stringify(data)]);return true;}
 if(comp.start_round+last.number>38){data.needsReview='Giornate di Serie A terminate: serve una decisione del presidente.';await c.query('UPDATE fanta.competitions SET data=$2 WHERE id=$1',[comp.id,JSON.stringify(data)]);return false;}
 data.plan.push(knockoutStage(ids,last.number+1));await c.query('UPDATE fanta.competitions SET data=$2 WHERE id=$1',[comp.id,JSON.stringify(data)]);await materializeCalendar(c,{...comp,data},s.league.season);return true;
}
