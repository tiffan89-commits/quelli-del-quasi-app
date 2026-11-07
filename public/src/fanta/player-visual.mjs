import {playBadge} from './formazione-studio.mjs';
import {shirt} from './maglie.mjs';
import {goalkeeperShirt} from './maglie-portieri.mjs';
// Live events and fantasy grades are rendered by the player cell, outside the shirt.
export function playerVisual(player){const live=['playing','voted','sv'].includes(player.status);return `<span class="ux-player-visual">${player.role==='P'?goalkeeperShirt(player.club):shirt(player.club)}${live?'':playBadge(player)}</span>`;}
