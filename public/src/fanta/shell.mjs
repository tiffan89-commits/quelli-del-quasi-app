import {presidentEntry} from '../president-panel.mjs';
import {leagueActions} from '../league-actions.mjs';
import {leagueEmblem} from '../league-theme.mjs';
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
export const FANTA_TABS=[['oggi','Oggi'],['schedine','Schedina'],['classifica','Classifica'],['squadra','Squadra'],['lega','Lega']];

export function topBar({ mode, league, credits,slipCredits,user,hideCredits=false }) {
  const chip = league
    ? `<button type="button" class="v2-league-chip fanta-league-chip" data-action="leagues" aria-haspopup="dialog" title="Cambia lega, entra o crea una lega">
        ${leagueEmblem(league)}
        <span class="v2-league-name">${esc(league.name.replace(/^Random League/i,'Lega pilota'))}</span>
        <span class="auction-index-dot" data-auction-indicator="*" aria-label="Asta in corso" hidden></span>
        <span class="league-add" aria-hidden="true">+</span>
      </button>`
    : '<span></span>';
  return `<header class="v2-top fanta-top">${chip}<div class="ux-controls">${modeSwitch(mode)}<div class="ux-balances">${Number.isFinite(slipCredits)?`<div class="v2-credits"><b>${slipCredits}</b><span>crediti schedina</span></div>`:''}${Number.isFinite(credits)?`<div class="v2-credits"><b>${credits}</b><span>crediti asta</span></div>`:''}</div>${presidentEntry('data-tab="impostazioni"')}</div><p class="ux-mode-label">Fanta · la tua squadra e le sfide della lega</p></header>`;
}

export function tabBar(active) {
  return `<nav class="v2-tabbar" aria-label="Navigazione Fanta">${FANTA_TABS.map(([id, label]) =>
    `<button type="button" class="v2-tab${id === active ? ' is-active' : ''}" data-tab="${id}"${id === active ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><span>${label}</span>${id==='lega'?'<b class="league-unread" data-chat-badge hidden></b>':''}
    </button>`).join('')}</nav>`;
}

export function leagueSheet(leagues, activeId) {
  return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div>
  <div class="v2-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title">
    <div class="v2-sheet-handle"></div>
<h2 id="fanta-sheet-title">Le tue leghe Fanta</h2>
    ${leagues.map(l => `<button type="button" class="v2-league-row${l.id === activeId ? ' is-active' : ''}" data-league="${esc(l.id)}">
      ${leagueEmblem(l)}
      <span class="v2-league-info"><b>${esc(/^Random League/i.test(l.name)?l.name.replace(/^Random League/i,'Lega pilota'):l.name)}<span class="auction-index-tag" data-auction-indicator="${esc(l.id)}" hidden>ASTA</span></b><small>${esc(l.teamName)} · ${esc(l.season)}</small></span>
      ${l.role === 'admin' ? '<span class="v2-role is-admin">ADMIN</span>' : ''}
    </button>`).join('')}
    ${leagueActions({bridge:true})}
  </div>`;
}
