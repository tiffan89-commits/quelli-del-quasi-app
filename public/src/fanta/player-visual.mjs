import {playBadge} from './formazione-studio.mjs';
import {shirt} from './maglie.mjs';
import {goalkeeperShirt,shirtBack} from './maglie-portieri.mjs';
import {playerJersey,playerSurname} from '../player-label.mjs';
// Maglia della partita del giocatore (chi gioca fuori usa la trasferta se si confonde). Sul campo ({back:true}) si vede da dietro, con il numero.
function kitOf(p,back,nameOnShirt){
 const vs=p.next?.opponent??p.opponent,home=p.next?.home??p.home,goalkeeper=p.role==='P';
 if(back){
  const number=playerJersey(p),name=nameOnShirt?playerSurname(p):'';
  return goalkeeper||name?shirtBack(p.club,number,name,{goalkeeper,wideName:nameOnShirt,vs,home}):shirt(p.club,{back:true,number,vs,home});
 }
 return goalkeeper?goalkeeperShirt(p.club):shirt(p.club,{vs,home});
}
export function playerVisual(player,{back=false,nameOnShirt=false}={}){
 const live=['playing','voted','sv'].includes(player.status);
 return `<span class="ux-player-visual">${kitOf(player,back,nameOnShirt)}${live?'':playBadge(player)}</span>`;
}
