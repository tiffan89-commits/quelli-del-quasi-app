import {playBadge} from './formazione-studio.mjs';
import {shirt} from './maglie.mjs';
import {goalkeeperShirt} from './maglie-portieri.mjs';
export function playerVisual(player){return `<span class="ux-player-visual">${player.role==='P'?goalkeeperShirt(player.club):shirt(player.club)}${playBadge(player)}</span>`;}
