import {createHash,randomUUID} from 'node:crypto';
import {fail} from './game.mjs';
import {joinLinkedTeam} from '../fanta/league-creation.mjs';

export const MAX_LEAGUE_REQUESTS=3;
const contact=u=>u&&!u.demo&&!u.adminOnly&&u.emailVerified===true;
const isAdmin=(league,uid)=>league.admin===uid||league.admins?.includes(uid);
const available=league=>league&&!league.demo&&!league.disabledAt;
const member=(league,uid)=>league.members.some(m=>m.uid===uid);
const name=u=>u?.name||u?.username||'Giocatore';
const normalize=value=>value.trim().normalize('NFKC').toLocaleLowerCase('it');
const full=league=>{
 const cap=Object.hasOwn(league,'accessMax')?league.accessMax:league.nativeFantaLink?.maxMembers??league.fantaCreation?.size;
 return Number.isInteger(cap)&&league.members.length>=cap;
};
function canJoin(league,uid){
 if(league.removedMembers?.some(m=>m.uid===uid))fail('Il presidente deve riattivare la tua partecipazione alla lega.',403);
}

export function leagueDirectory(s,user){
 const entries=(s.leagueAccess||[]).filter(x=>x.kind==='request'&&x.uid===user.id);
 const byLeague=new Map(entries.map(x=>[x.league,x.status]));
 const players=new Map(s.users.map(u=>[u.id,name(u)]));
 const leagues=s.leagues.filter(available).map(l=>({
  id:l.id,name:l.name,nicknames:l.members.map(m=>players.get(m.uid)||'Giocatore'),
  joined:member(l,user.id),full:full(l),request:byLeague.get(l.id)||null,
 }));
 leagues.sort((a,b)=>a.name.localeCompare(b.name,'it'));
 return {leagues,remaining:Math.max(0,MAX_LEAGUE_REQUESTS-new Set(entries.map(x=>x.league)).size)};
}

export function leagueAccessInbox(s,user){
 const leagues=new Map(s.leagues.filter(available).map(l=>[l.id,l]));
 const users=new Map(s.users.map(u=>[u.id,u]));
 return (s.leagueAccess||[]).flatMap(e=>{
  const league=leagues.get(e.league),player=users.get(e.uid);
  if(!league||e.status!=='pending'||e.recipient!==user.id||!contact(player)||member(league,e.uid))return [];
  if(e.kind==='request'&&!isAdmin(league,user.id))return [];
  return [{id:e.id,kind:e.kind,league:league.name,...(e.kind==='request'?{player:{nickname:name(player),email:player.email,avatar:player.avatar}}:{})}];
 });
}

async function notify(c,{id,uid,title,body,now}){
 if(!c)return null;
 const key=createHash('sha256').update(id+':'+uid+':'+title).digest('hex');
 await c.query(`INSERT INTO fanta.notifications(id,user_id,kind,data,expires_at)
  VALUES($1,$2,'leagueAccess',$3,$4) ON CONFLICT DO NOTHING`,[key,uid,
  JSON.stringify({title,body,kind:'league-access',url:'/?accesso-lega=1'}),
  new Date(now+24*3600000).toISOString()]);
 return key;
}

export async function addLeagueMember(c,s,league,user){
 canJoin(league,user.id);
 const team=c?await joinLinkedTeam(c,league,user):undefined;
 if(!member(league,user.id))league.members.push({uid:user.id,initial:league.rules.initial,credits:league.rules.initial,points:0,joinedAt:new Date().toISOString()});
 return team;
}

export async function leagueAccessAction(c,s,user,kind,p,now=Date.now()){
 if(!contact(user))fail('Accedi e conferma la tua email per continuare.',403);
 if(!p||typeof p!=='object'||Array.isArray(p))fail('Richiesta non valida.');
 const all=s.leagueAccess??=[];
 if(kind==='respond'){
  const e=all.find(x=>x.id===p.id&&x.recipient===user.id);
  const league=s.leagues.find(l=>l.id===e?.league),player=s.users.find(u=>u.id===e?.uid);
  if(!e||!available(league)||!contact(player)||e.kind==='request'&&!isAdmin(league,user.id))fail('Richiesta non disponibile.',404);
  if(!['accept','reject'].includes(p.decision))fail('Scegli se accettare o rifiutare.');
  const status=p.decision==='accept'?'accepted':'rejected';
  if(e.status===status)return {data:{ok:true,status,...(e.kind==='invite'&&status==='accepted'&&member(league,user.id)?{league:league.id}:{})}};
  if(e.status!=='pending')fail('La richiesta è già stata aggiornata.',409);
  if(status==='accepted'){
   await addLeagueMember(c,s,league,player);
   for(const item of all)if(item!==e&&item.league===e.league&&item.uid===e.uid&&item.status==='pending')item.status='superseded';
  }
  e.status=status;
  e.decidedAt=new Date(now).toISOString();
  const notice=status==='accepted'&&e.kind==='request'?await notify(c,{id:e.id,uid:player.id,title:'Richiesta approvata',body:'Ora fai parte di '+league.name+'.',now}):null;
  return {data:{ok:true,status,...(status==='accepted'&&e.kind==='invite'?{league:league.id}:{})},accessNotice:notice};
 }

 const league=s.leagues.find(l=>l.id===p.league);
 if(!available(league))fail('Lega non disponibile.',404);
 let player=user,recipient=league.admin;
 if(kind==='invite'){
  if(!isAdmin(league,user.id))fail('Solo l’admin può inviare un invito.',403);
  if(typeof p.identity!=='string'||!p.identity.trim()||p.identity.length>254)fail('Inserisci un nickname o un’email.');
  const identity=normalize(p.identity);
  const matches=s.users.filter(u=>contact(u)&&(identity.includes('@')?normalize(u.email||'')===identity:normalize(u.name||'')===identity));
  if(matches.length>1)fail('Più giocatori usano questo nickname. Inserisci l’indirizzo email.',409);
  if(!matches.length)fail('Giocatore non trovato.',404);
  player=matches[0];recipient=player.id;
 }else if(kind!=='request')fail('Operazione non disponibile.',404);
 if(member(league,player.id))fail('Il giocatore fa già parte della lega.',409);
 const prior=all.find(x=>x.kind===kind&&x.league===league.id&&x.uid===player.id&&x.status==='pending');
 if(prior)return {data:{ok:true,status:'pending'}};
 if(kind==='request'){
  const requested=new Set(all.filter(x=>x.kind==='request'&&x.uid===user.id).map(x=>x.league));
  if(requested.has(league.id))fail('Chiedi un nuovo invito all’admin di questa lega.',409);
  if(requested.size>=MAX_LEAGUE_REQUESTS)fail('Hai raggiunto il limite di tre leghe. Contatta l’assistenza.',429);
  if(!contact(s.users.find(u=>u.id===recipient)))fail('L’admin della lega non è disponibile.',409);
 }
 canJoin(league,player.id);
 if(c){
  const cap=(await c.query(`SELECT l.max_members FROM fanta.bar_links b JOIN fanta.leagues l ON l.id=b.fanta_league_id
   WHERE b.bar_league_id=$1 AND b.active AND l.rules->>'disabledAt' IS NULL`,[league.id])).rows[0]?.max_members;
  if(Number.isInteger(cap)&&league.members.length>=cap)fail('La lega è al completo.',409);
 }
 const id=randomUUID();
 all.push({id,kind,league:league.id,uid:player.id,recipient,status:'pending',createdAt:new Date(now).toISOString()});
 const title=kind==='invite'?'Invito a una lega':'Nuova richiesta di ingresso';
 const body=kind==='invite'?'Ti hanno invitato in '+league.name+'.':'Un giocatore chiede di entrare in '+league.name+'.';
 const accessNotice=await notify(c,{id,uid:recipient,title,body,now});
 return {data:{ok:true,status:'pending'},accessNotice};
}

export function updateNickname(user,value){
 const name=typeof value==='string'?value.trim():'';
 if(!name||name.length>60)fail('Soprannome non valido');
 if(user.name!==name)delete user.nicknameSuggested;
 user.name=name;
 return name;
}
