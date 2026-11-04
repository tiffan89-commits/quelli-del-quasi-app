import {leagueEmblem} from '../league-theme.mjs';
import {leagueCreationFields,leagueCreationPayload} from '../league-create-form.mjs';
// Selettore lega v2: chip in alto con ruolo e crediti, bottom sheet con tutte le leghe.
import { sourceOf, isClosed } from '../slip-state.mjs';

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
  return '<header class="v2-top"><button type="button" class="v2-league-chip" id="v2-open-leagues" aria-haspopup="dialog">' +
    leagueEmblem(league) +
    '<span class="v2-league-name">' + esc(league.name) + '</span>' +
    '<span class="v2-role' + (admin ? ' is-admin' : '') + '">' + (admin ? 'ADMIN' : 'MEMBRO') + '</span>' +
    '<span aria-hidden="true">▾</span></button><div class="ux-controls">' + mode +
    (me ? '<div class="v2-credits"><b>' + fmt(me.credits ?? 0) + '</b><span>'+esc(caption)+'</span></div>' : '') +
    '<button type="button" class="ux-profile" data-bar-page="profilo" aria-label="Apri profilo"'+(profileActive?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></button></div><p class="ux-mode-label">Bar · partite vere di Serie A</p></header>';
}

export function renderLeagueSheet(leagues, activeId, uid, esc) {
  return '<div class="v2-sheet-backdrop" id="v2-sheet-close"></div>' +
    '<div class="v2-sheet" role="dialog" aria-modal="true" aria-label="Le tue leghe"><div class="v2-sheet-handle"></div>' +
    '<h2>La tua lega</h2><div class="ux-league-actions"><button type="button" data-bar-page="regolamento">Regolamento del Bar</button><button type="button" data-bar-page="invita">Invita amici</button>'+((leagues.find(l=>l.id===activeId)&&isLeagueAdmin(leagues.find(l=>l.id===activeId),uid))?'<button type="button" data-bar-page="admin">Impostazioni lega</button>':'')+'</div><h3>Le tue leghe</h3>' +
    leagues.map(l => {
      const a = attentionOf(l, uid), admin = isLeagueAdmin(l, uid);
      return '<button type="button" class="v2-league-row' + (l.id === activeId ? ' is-active' : '') + '" data-v2-league="' + esc(l.id) + '">' +
        leagueEmblem(l) +
        '<span class="v2-league-info"><b>' + esc(l.name) + '</b><small class="' + (a.level === 'warn' ? 'orange' : '') + '">' +
        ((l.members?.length || 0) === 1 ? '1 membro' : (l.members?.length || 0) + ' membri') + ' · ' + esc(a.text) + '</small></span>' +
        '<span class="v2-role' + (admin ? ' is-admin' : '') + '">' + (admin ? 'ADMIN' : 'MEMBRO') + '</span></button>';
    }).join('') +
    '<div class="v2-sheet-actions"><button type="button" class="secondary" data-v2-action="join" aria-expanded="false" aria-controls="v2-form-join">Entra con codice</button>' +
    '<button type="button" class="secondary" data-v2-action="create" aria-expanded="false" aria-controls="v2-form-create">Crea una nuova lega · Bar + Fanta</button></div>' +
    (leagues.some(l=>l.id===activeId&&isLeagueAdmin(l,uid)&&!l.nativeFantaLink)?'<button type="button" class="secondary" data-v2-action="create" data-existing-bar="'+esc(leagues.find(l=>l.id===activeId).name)+'" data-existing-size="'+Math.max(2,leagues.find(l=>l.id===activeId).members?.length||2)+'">Attiva il Fanta di questa lega</button>':'') +
    '<form class="v2-sheet-form" id="v2-form-join" data-kind="join" hidden><label class="field">Codice lega<input name="code" required placeholder="ABC123" autocomplete="off" autocapitalize="characters"></label><button class="primary">Entra nella lega</button></form>' +
    '<form class="v2-sheet-form" id="v2-form-create" data-kind="create" hidden>' + leagueCreationFields() + '<button type="submit" class="primary">Crea Bar e Fanta</button><p data-create-error role="alert"></p></form></div>';
}

// onSelect(leagueId), onSubmit('join'|'create', payload) -> Promise<boolean>. Il sheet vive in un contenitore #v2-sheet-root.
export function bindLeagueSwitcher({ leagues, activeId, uid, esc, onSelect, onSubmit }) {
  const root = document.getElementById('v2-sheet-root');
  const close = () => { root.innerHTML = ''; root.hidden = true; };
  const open = document.getElementById('v2-open-leagues');
  if (open) open.onclick = () => {
    root.hidden = false;
    root.innerHTML = renderLeagueSheet(leagues, activeId, uid, esc);
    root.querySelector('#v2-sheet-close').onclick = close;
    root.querySelectorAll('[data-v2-league]').forEach(b => b.onclick = () => { close(); onSelect(b.dataset.v2League); });
    const forms = [...root.querySelectorAll('.v2-sheet-form')];
    root.querySelectorAll('[data-v2-action]').forEach(b => b.onclick = () => {
      const kind = b.dataset.v2Action, wasOpen = !b.dataset.existingBar&&!root.querySelector('#v2-form-' + kind).hidden;
      forms.forEach(f => { f.hidden = wasOpen || f.dataset.kind !== kind; });
      root.querySelectorAll('[data-v2-action]').forEach(x => x.setAttribute('aria-expanded', String(!wasOpen && x === b)));
      const createForm=root.querySelector('#v2-form-create'),nameField=createForm.querySelector('[name=name]'),sizeField=createForm.querySelector('[name=size]');
      if(b.dataset.existingBar){createForm.dataset.attachMode='true';nameField.value=b.dataset.existingBar;nameField.readOnly=true;sizeField.value=b.dataset.existingSize;sizeField.readOnly=true;}else if(createForm.dataset.attachMode){delete createForm.dataset.attachMode;nameField.value='';nameField.readOnly=false;sizeField.value='8';sizeField.readOnly=false;}
      if (!wasOpen) root.querySelector('#v2-form-' + kind + ' input').focus();
    });
    forms.forEach(f => f.onsubmit = async e => {
      e.preventDefault();
      if (f.dataset.busy === 'true') return;
      f.dataset.busy = 'true'; f.querySelectorAll('button').forEach(x => x.disabled = true);
      try{const payload=f.dataset.kind==='create'?leagueCreationPayload(f):Object.fromEntries(new FormData(f));const ok=await onSubmit?.(f.dataset.kind,payload);if(ok)close();}catch(err){const error=f.querySelector('[data-create-error]');if(error)error.textContent=err.message;}finally{f.dataset.busy='false';f.querySelectorAll('button').forEach(x=>x.disabled=false);}
    });
    addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc_); } });
  };
}
