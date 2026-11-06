// Navigazione v2: 5 tab al posto delle 10 sezioni.
// Le pagine esistenti di app.mjs restano: qui le raggruppiamo.
export const TABS=[{id:'oggi',label:'Oggi',icon:'<path d="M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9"/>'},{id:'schedina',label:'Schedina',icon:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6"/>'},{id:'classifica',label:'Classifica',icon:'<path d="M4 21V10h5v11M10 21V4h5v17M16 21v-6h5v6"/>'},{id:'quasi',label:'Quasi',icon:'<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'},{id:'legainfo',label:'Lega',icon:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"/>'}];

// page (variabile di app.mjs) -> tab attiva
// "Oggi" è la home storica (pagina 'lega' di app.mjs): dashboard della lega con il tuo Quasi.
export const PAGE_TO_TAB = {
  lega: 'oggi',
  schedina: 'fanta',      // la sorgente decide fanta/seriea, vedi tabForPage
  calendario: 'fanta',
  seriea: 'seriea',
  altri: 'fanta',
  classifiche: 'lega', quasi: 'lega', chat: 'lega', storico: 'lega', regolamento: 'lega', admin: 'lega',
  fantaquasi: 'fanta',
  profilo: 'io',
};

// Sotto-sezioni della tab Lega. 'admin' compare solo se l'utente è admin della lega attiva.
export function legaSections(isAdmin) {
  const s=[['classifiche','Classifica'],['storico','Storico']];

  return s;
}

export function tabForPage(page){if(page==='admin')return null;return ({lega:'oggi',schedina:'schedina',altri:'schedina',calendario:'schedina',seriea:'schedina',classifiche:'classifica',storico:'classifica',quasi:'quasi',barleague:'legainfo',regolamento:'legainfo',profilo:'profilo'})[page]||'oggi';}
export function defaultSource(){return 'seriea';}
export function routeForTab(tab){return {page:({oggi:'lega',schedina:'schedina',classifica:'classifiche',quasi:'quasi',legainfo:'barleague',profilo:'profilo'})[tab]||'lega',sourceScope:'seriea'};}
export function renderTabBar(active, { hasFanta = true } = {}) {
  return '<nav class="v2-tabbar" aria-label="Navigazione principale">' +
    TABS.filter(t => t.id!=='profilo'&&(hasFanta || t.id !== 'fanta')).map(t =>
      '<button type="button" class="v2-tab' + (t.id === active ? ' is-active' : '') + '" data-v2-tab="' + t.id + '"' +
      (t.id === active ? ' aria-current="page"' : '') + '>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + t.icon + '</svg><span>' + t.label + '</span></button>'
    ).join('') + '</nav>';
}

export function bindTabBar(onTab) {
  document.querySelectorAll('[data-v2-tab]').forEach(b => { b.onclick = () => onTab(b.dataset.v2Tab); });
}

export function renderLegaSections(active, isAdmin, esc) {
  return '<div class="v2-chips" role="tablist">' + legaSections(isAdmin).map(([id, label]) =>
    '<button type="button" role="tab" class="v2-chip' + (id === active ? ' is-active' : '') + '" aria-selected="' + (id === active) + '" data-v2-lega="' + esc(id) + '">' + esc(label) + '</button>'
  ).join('') + '</div>';
}
