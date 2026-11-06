import {pitchEvents} from '../pitch-events.mjs';
import {playBadge} from './formazione-studio.mjs';
import {shirt} from './maglie.mjs';
import {goalkeeperShirt} from './maglie-portieri.mjs';
export function playerVisual(player){const live=['playing','voted','sv'].includes(player.status);return `<span class="ux-player-visual">${player.role==='P'?goalkeeperShirt(player.club):shirt(player.club)}${live?pitchEvents(player)+'<small class="fs-badge is-pct is-actual is-vote" aria-label="Voto">'+(Number.isFinite(player.vote)?player.vote:player.status==='sv'?'s.v.':'–')+'</small>':playBadge(player)}</span>`;}
