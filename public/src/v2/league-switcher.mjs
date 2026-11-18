import {presidentEntry} from '../president-panel.mjs';
import {leagueActions} from '../league-actions.mjs';
import {leagueEmblem} from '../league-theme.mjs';
// Selettore lega v2: chip in alto con ruolo e crediti, bottom sheet con tutte le leghe.
import { sourceOf, isClosed } from '../slip-state.mjs';
import {paintAuctionBadges} from '../auction-index.mjs';

export const isLeagueAdmin = (league, uid) =>
  league?.admin === uid || (Array.isArray(league?.admins) && league.admins.includes(uid)); // admins[]: co-admin, lato backend

export function attentionOf(league, uid, now = Date.now()) {
  const broken = (league.fantasyConnections || []).find(c => c.server && c.status && c.status !== 'connected');
  if (broken && isLeagueAdmin(league, uid)) return { level: 'warn', text: 'Collegamento da rinnovare' };
  const open = (league.rounds || []).filter(r => r.matches?.length && !isClosed(r, now));
  const fanta = open.find(r => sourceOf(r) === 'seriea');
  if (!fanta) return { level: 'ok', text: 'Nessuna schedina aperta' };
  const label = sourceOf(fanta) === 'fantacalcio' ? 'Schedina fanta' : 'Schedina Serie A';
  return fanta.slip ? { level: 'ok', text: label + ' salvata' } : { level: 'todo', text: label + ' da compilare' };
}

export function renderLeagueChip(league, uid, esc, fmt, mode='', account=null, caption='crediti', profileActive=false) {
  if (!league) return '';
  const admin = isLeagueAdmin(league, uid);
  const me = account || (league.members || []).find(m => m.uid === uid);
  return '<header class="v2-top"><button type="button" class="v2-league-chip" id="v2-open-leagues" aria-haspopup="dialog" title="Cambia lega, entra o crea una lega">' +
    leagueEmblem(league) +
    '<span class="v2-league-name">' + esc(league.name) + '</span>' +
    '<span class="auction-index-dot" data-auction-indicator="*" aria-label="Asta in corso" hidden></span><span class="league-add" aria-hidden="true">+</span></button><div class="ux-controls">' + mode +
    (me ? '<div class="v2-credits"><b>' + fmt(me.credits ?? 0) + '</b><span>'+esc(caption)+'</span></div>' : '') +
    presidentEntry('data-bar-page="impostazioni"',profileActive)+'</div><p class="ux-mode-label">Bar · partite vere di Serie A</p></header>';
}

export function renderLeagueSheet(leagues, activeId, uid, esc) {
  return '<div class="v2-sheet-backdrop" id="v2-sheet-close"></div>' +
    '<div class="v2-sheet" role="dialog" aria-modal="true" aria-label="Le tue leghe"><div class="v2-sheet-handle"></div>' +
    '<h2>Le tue leghe</h2>' +
    leagues.map(l => {
      const a = attentionOf(l, uid), admin = isLeagueAdmin(l, uid);
      return '<button type="button" class="v2-league-row' + (l.id === activeId ? ' is-active' : '') + '" data-v2-league="' + esc(l.id) + '">' +
        leagueEmblem(l) +
        '<span class="v2-league-info"><b>' + esc(l.name) + (l.nativeFantaLink?.leagueId?'<span class="auction-index-tag" data-auction-indicator="'+esc(l.nativeFantaLink.leagueId)+'" hidden>ASTA</span>':'') + '</b><small class="' + (a.level === 'warn' ? 'orange' : '') + '">' +
        ((l.members?.length || 0) === 1 ? '1 membro' : (l.members?.length || 0) + ' membri') + ' · ' + esc(a.text) + '</small></span>' +
        '<span class="v2-role' + (admin ? ' is-admin' : '') + '">' + (admin ? 'ADMIN' : 'MEMBRO') + '</span></button>';
    }).join('') +
    leagueActions()+'</div>';
}

export function bindLeagueSwitcher({ leagues, activeId, uid, esc, onSelect }) {
  const root = document.getElementById('v2-sheet-root');
  const close = () => { root.innerHTML = ''; root.hidden = true; };
  const openSheet = () => {
    root.hidden = false;
    root.innerHTML = renderLeagueSheet(leagues, activeId, uid, esc);
    paintAuctionBadges(root);
    root.querySelector('#v2-sheet-close').onclick = close;
    root.querySelectorAll('[data-v2-league]').forEach(b => b.onclick = () => { close(); onSelect(b.dataset.v2League); });
    root.querySelectorAll('[data-bar-page]').forEach(button=>button.onclick=close);
    addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc_); } });
  };
  document.querySelectorAll('#v2-open-leagues,[data-open-leagues]').forEach(button=>button.onclick=openSheet);
}
