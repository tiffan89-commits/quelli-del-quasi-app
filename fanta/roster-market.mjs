import {fail} from './rules.mjs';
import {teamBudget} from './auction.mjs';
export function rosterAction(state,kind,input,actor){
 if(state.league.adminUid!==actor)fail('Solo il presidente può modificare le rose',403);
 if(['running','scheduled'].includes(state.auction.status))fail('Chiudi l’asta prima di correggere le rose',409);
 const s=structuredClone(state),team=s.teams.find(t=>t.id===input.teamId),player=s.players.find(p=>p.id===input.playerId);if(!team||!player)fail('Squadra o giocatore non trovato',404);
 const owned=s.teams.find(t=>t.roster.some(p=>p.id===player.id)),old=team.roster.find(p=>p.id===player.id),price=input.price??old?.price;
 const validPrice=n=>Number.isInteger(n)&&n>=0&&n<=s.rules.budget;
 if(kind==='add'){if(owned)fail('Questo giocatore appartiene già a una squadra',409);if(!validPrice(price))fail('Prezzo non valido');team.roster.push({...player,price});}
 else{if(!old)fail('Il giocatore non appartiene a questa squadra',409);
  if(kind==='remove')team.roster=team.roster.filter(p=>p.id!==player.id);
  else if(kind==='price'){if(!validPrice(price))fail('Prezzo non valido');old.price=price;}
  else if(kind==='move'){const target=s.teams.find(t=>t.id===input.toTeamId);if(!target||target===team)fail('Scegli un’altra squadra della stessa lega');if(!validPrice(price))fail('Prezzo non valido');team.roster=team.roster.filter(p=>p.id!==player.id);target.roster.push({...old,price});}
  else fail('Operazione non disponibile',404);
 }
 for(const t of s.teams){const b=teamBudget(t,s.rules);if(b.credits<0||Object.values(b.roles).some(r=>r.have>r.max))fail('La modifica supera il budget o i posti disponibili per ruolo',409);}
 for(const sale of s.auction.log)if(sale.player.id===player.id&&!sale.undone)sale.released=true;s.auction.version++;
 return s;
}
