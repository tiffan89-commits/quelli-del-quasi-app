import {leagueChip} from '../v2/league-switcher.mjs';
// Cornice comune: barra in alto (lega + interruttore Bar | Fanta) e barra delle tab del Fanta.
// Riusa le classi v2-* del sito; le aggiunte stanno in fanta.css con prefisso fanta-.
import { esc } from './formato.mjs';
import {modeSwitch} from '../mode-switch.mjs';
export {modeSwitch} from '../mode-switch.mjs';

const ICONS = {
  oggi: '<path d="M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9"/>',
  squadra: '<path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  schedine: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  lega: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"/>',
  classifica:'<path d="M4 21V10h5v11M10 21V4h5v17M16 21v-6h5v6"/>',
  io: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
export const FANTA_TABS=[['schedine','Schedina'],['classifica','Classifica'],['oggi','Oggi'],['squadra','Squadra'],['lega','Lega']];

export function topBar({mode,league}){
 return `<header class="v2-top fanta-top shell-compact">${leagueChip(league,'id="v2-open-fanta-leagues" data-action="leagues"',esc)}${modeSwitch(mode)}</header>`;
}

export function tabBar(active,{hasTrades=false}={}) {
  return `<nav class="v2-tabbar" aria-label="Navigazione Fanta">${FANTA_TABS.map(([id, label]) =>
    `<button type="button" class="v2-tab${id === active ? ' is-active' : ''}" data-tab="${id}"${id === active ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><span>${label}</span>${id==='lega'?'<b class="league-unread" data-chat-badge hidden></b>'+(hasTrades?'<b class="league-unread trade-tab-badge" data-trade-badge hidden></b>':''):''}
    </button>`).join('')}</nav>`;
}
