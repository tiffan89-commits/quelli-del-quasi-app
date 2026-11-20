import {teamBudget} from './auction.mjs';
import {fail} from './rules.mjs';
import {playerJersey} from '../public/src/player-label.mjs';

const kinds=new Set(['remove','price','add']);
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=200;
const price=value=>Number.isInteger(value)&&value>=0;
const signature=({teamId,playerId})=>JSON.stringify([teamId,playerId]);

export function rosterBatch({changes,requestId}={}){
 if(typeof requestId!=='string'||!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(requestId)||!Array.isArray(changes)||!changes.length||changes.length>1500)fail('Correzioni non valide');
 const seen=new Set();
 return {requestId,changes:changes.map(change=>{
  if(!change||typeof change!=='object')fail('Correzione non valida');
  const {kind,teamId,playerId,previousPrice,price:amount}=change;
  if(!kinds.has(kind)||!validId(teamId)||!validId(playerId)||kind!=='add'&&!price(previousPrice)||kind!=='remove'&&!price(amount))fail('Correzione non valida');
  const key=signature(change);
  if(seen.has(key))fail('La stessa rosa contiene più modifiche per lo stesso calciatore');
  seen.add(key);
  return {kind,teamId,playerId,...(kind!=='add'?{previousPrice}:{}),...(kind!=='remove'?{price:amount}:{})};
 })};
}

export const rosterLocked=state=>state.league.kind==='random'||['running','scheduled'].includes(state.auction.status);
const lockMessage=state=>state.league.kind==='random'?'La Lega random modifica le rose soltanto tramite aste di riparazione.':'Chiudi l’asta prima di correggere le rose.';
const roleLabels={P:'Portieri',D:'Difensori',C:'Centrocampisti',A:'Attaccanti'};
const rejectIssues=issues=>{
 if(issues.length)throw Object.assign(Error(issues.map(issue=>issue.message).join('\n')),{status:409,issues});
};

export function rosterEditorView(state){
 return {locked:rosterLocked(state),lockMessage:lockMessage(state),budget:state.rules.budget,limits:state.rules.roster,teams:state.teams.map(({id,name,manager,color,branding,creditAdjustment,roster})=>({
  team:{id,name,manager,color,branding},creditAdjustment,roster:roster.map(p=>({id:p.id,name:p.name,role:p.role,club:p.club,price:p.price,jersey:playerJersey(p),unmapped:p.unmapped})),
 }))};
}

export function applyRosterBatch(state,changes,{validateLimits=true,restoreSales=[]}={}){
 if(rosterLocked(state))fail(lockMessage(state),409);
 const teams=state.teams.map(team=>({...team,roster:[...team.roster]}));
 const byTeam=new Map(teams.map(team=>[team.id,team]));
 const catalog=new Map(state.players.map(player=>[player.id,player]));
 const touched=new Set();
 const audit=[],issues=[];
 // Release players first, so a valid batch can free both credits and slots.
 const inserting=change=>change.kind==='add'||change.kind==='restore';
 for(const change of [...changes.filter(c=>!inserting(c)),...changes.filter(inserting)]){
  const {teamId,playerId,kind,price,previousPrice}=change,team=byTeam.get(teamId);
  const issue=message=>issues.push({teamId,playerId,message});
  if(!team){issue('La squadra non è più disponibile.');continue;}
  touched.add(team);
  if(kind!=='remove'&&price>state.rules.budget){issue(`Il prezzo massimo è ${state.rules.budget} crediti.`);continue;}
  const index=team.roster.findIndex(p=>p.id===playerId),before=team.roster[index];
  let after=null;
  if(inserting(change)){
   const player=kind==='restore'?change.player:catalog.get(playerId);
   const assigned=!!before||!player?.unmapped&&teams.some(t=>t.roster.some(p=>p.id===playerId&&!p.unmapped));
   if(!player||kind==='add'&&player.active===false||assigned){issue('Il calciatore non è più disponibile tra i liberi.');continue;}
   after={...player,price};team.roster.push(after);
  }else{
   if(!before){issue('Il calciatore non è più in questa rosa.');continue;}
   if(before.price!==previousPrice){issue(`Il prezzo registrato è cambiato da ${previousPrice} a ${before.price} crediti. Ricarica la rosa prima di riprovare.`);continue;}
   if(kind==='remove')team.roster.splice(index,1);
   else {after={...before,price};team.roster[index]=after;}
  }
  audit.push({teamId,kind,playerId,before:before||null,after});
 }
 rejectIssues(issues);
 if(validateLimits)for(const team of touched){
  const issue=message=>issues.push({teamId:team.id,message});
  if(team.roster.length>25)issue(`La rosa ha ${team.roster.length} calciatori e può averne al massimo 25.`);
  const budget=teamBudget(team,state.rules);
  if(budget.credits<0)issue(`Budget superato di ${-budget.credits} crediti.`);
  for(const [role,{have,max}] of Object.entries(budget.roles))if(have>max)issue(`${roleLabels[role]} in rosa: ${have} su ${max} consentiti.`);
 }
 rejectIssues(issues);
 const ids=new Set(audit.filter(change=>!(change.before||change.after)?.unmapped).map(change=>change.playerId));
 const restored=new Set(restoreSales);
 const log=state.auction.log.map(sale=>!sale.undone&&ids.has(sale.player.id)?{...sale,released:!restored.has(sale.id)}:sale);
 return {state:{...state,teams,auction:{...state.auction,log,version:state.auction.version+1}},audit};
}

export const rosterOrderId=id=>typeof id==='string'&&/^[1-9]\d{0,18}$/u.test(id)&&BigInt(id)<=9223372036854775807n;

export function inverseRosterOrder(state,order){
 const catalog=new Map(state.players.map(player=>[player.id,player]));
 const entries=order.restore?.entries||[],rosters=order.restore?.rosters||[];
 const changes=order.changes.map(({kind,teamId,before,after})=>{
  if(kind==='add')return {kind:'remove',teamId,playerId:after.id,previousPrice:after.price};
  if(kind==='price')return {kind:'price',teamId,playerId:after.id,previousPrice:after.price,price:before.price};
  const original=catalog.get(before.id);
  const saved=entries.find(e=>e.team_id===teamId&&(e.player_id===before.id||!e.player_id&&e.source_id===before.id));
  const wasMapped=before.unmapped===false||before.unmapped===undefined&&!!original;
  const role=order.restore?(saved?.role||original?.role||before.role):before.role;
  const player={...original,...before,role,unmapped:!wasMapped,club:original?.club||saved?.data?.club||before.club||''};
  if(!order.restore){
   const playerId=wasMapped?before.id:null;
   if(wasMapped)rosters.push({team_id:teamId,player_id:playerId,price:before.price});
   entries.push({team_id:teamId,player_id:playerId,source_id:wasMapped?'native:'+playerId:before.id,name:before.name,role:before.role,price:before.price,data:{club:player.club,originalName:before.name,aliases:[]}});
  }
  return {kind:'restore',teamId,playerId:before.id,player,price:before.price};
 });
 const restore={entries,rosters,sales:order.restore?.sales||[]};
 const result=applyRosterBatch(state,changes,{restoreSales:restore.sales});
 return {...result,restore};
}
