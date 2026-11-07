import {playBadge} from './formazione-studio.mjs';
import {shirt} from './maglie.mjs';
import {goalkeeperShirt,shirtBack} from './maglie-portieri.mjs';
// Maglia della partita del giocatore (chi gioca fuori usa la trasferta se si confonde). Sul campo ({back:true}) si vede da dietro, con il numero.
const kitOf=(p,back)=>{const vs=p.next?.opponent??p.opponent,home=p.next?.home??p.home;return back?(p.role==='P'?shirtBack(p.club,p.jersey??'','',{goalkeeper:true}):shirt(p.club,{back:true,number:p.jersey??'',vs,home})):p.role==='P'?goalkeeperShirt(p.club):shirt(p.club,{vs,home});};
export function playerVisual(player,{back=false}={}){const live=['playing','voted','sv'].includes(player.status);return `<span class="ux-player-visual">${kitOf(player,back)}${live?'':playBadge(player)}</span>`;}
