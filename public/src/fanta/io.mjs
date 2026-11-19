// Pagina "Io" del Fanta e spiegazione della demo.
// Account, avatar (il Quasi) e privacy sono gli stessi del Bar: qui solo ciò che riguarda il Fanta.
import { esc } from './formato.mjs';

const NOTIFY = [
  ['lineupReminder', 'Promemoria formazione', '2 ore prima della scadenza, se non hai ancora schierato'],
  ['roundStart', 'Inizio giornata', 'Quando si chiudono le formazioni e iniziano le partite'],
  ['liveEvents', 'Gol e cartellini dei tuoi', 'In diretta, quando un tuo titolare segna, fa assist o viene ammonito'],
  ['results', 'Risultati e voti ufficiali', 'Quando la giornata è calcolata e i voti diventano definitivi'],
  ['auction', 'Asta', 'Quando un\'asta è programmata, quando si apre e quando tocca a te chiamare'],
];

export function renderFantaNotificationSettings(settings,{disabled=false,compact=false}={}) {
 const n=settings?.notify||{};
 return `<section class="fanta-block is-first${compact?' fanta-notify-compact':''}"><h2>Notifiche del Fanta</h2><ul class="fanta-io-toggles">${NOTIFY.map(([key,title,description])=>`<li><label><span><b>${title}</b><small${compact?' class="sr-only"':''}>${description}</small></span><input type="checkbox" role="switch" class="fanta-switch" data-notify="${key}" ${n[key]!==false?'checked':''} ${disabled?'disabled':''}></label></li>`).join('')}</ul></section>`;
}

export function renderIo(me, leagues, activeLeagueId, ui = {}, demo = false) {
  if (!me) return '<div class="fanta-loading" role="status">Carichiamo il tuo profilo…</div>';
  const notifications=renderFantaNotificationSettings(me.settings,{compact:ui.settingsOnly});
  if(ui.settingsOnly)return notifications;
  return `<div class="fanta-io">
    <header class="fanta-sq-head"><span class="eyebrow">Il tuo profilo</span><h1>${esc(me.user.name)}</h1>${me.user.username?`<p>@${esc(me.user.username)}</p>`:""}</header>
    ${demo ? `<section class="fanta-io-demo"><span class="eyebrow">Modalità demo</span><h2>Stai provando il Fanta</h2>
      <p>Calciatori e club di Lega A sono reali; squadre fantasy e aste sono simulate. Le tue modifiche restano durante la prova; ricaricando la pagina si riparte.</p>
      <button type="button" class="secondary" data-action="demo-info">Come funziona la demo</button></section>` : ''}
    ${notifications}
    <section class="fanta-block"><div class="dash-section-head"><div><h2>Le tue leghe Fanta</h2></div></div>
      <ul class="fanta-io-leagues">${leagues.map(l => `<li><button type="button" class="v2-league-row${l.id === activeLeagueId ? ' is-active' : ''}" data-league="${esc(l.id)}">
        <span class="v2-league-dot lg" style="background:${esc(l.accent)}"></span>
        <span class="v2-league-info"><b>${esc(l.name.replace(/^Random League/i,'Lega pilota'))}</b><small>${esc(l.teamName)} · ${esc(l.season)}</small></span>
        ${l.role === 'admin' ? '<span class="v2-role is-admin">ADMIN</span>' : ''}</button></li>`).join('')}</ul>
    </section>
    <button type="button" class="secondary" data-mode="bar" data-bar-page="logout">Logout</button>
    <section class="fanta-block"><div class="dash-section-head"><div><h2>Il tuo Quasi e l'account</h2><small>Sono gli stessi del Bar: un solo account per tutto</small></div></div>
      <button type="button" class="secondary fanta-io-bar" data-mode="bar" data-bar-page="profilo">Gestiscili nella parte Bar <span aria-hidden="true">→</span></button>
    </section>
  </div>`;
}

export function renderDemoInfo() {
  return `<div class="fanta-ps-head"><div><span class="eyebrow">Demo</span><h2 id="fanta-sheet-title">Benvenuto nel Fanta</h2></div>
      <button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>
    <div class="fanta-demo-info">
      <p>Questa è una <b>demo</b> del fantacalcio di Quelli del Quasi, per scoprire come funziona.</p>
      <ul>
        <li><b>Sei l'allenatore di SamBuca Juniors</b> in una lega di prova con 8 squadre. Sei anche l'admin, così puoi provare tutto.</li>
        <li><b>Puoi fare tutto</b>: schierare e salvare la formazione, trascinare i giocatori, guardare voti e bonus spiegati, giocare un'asta contro squadre simulate o fare il banditore di un'asta dal vivo.</li>
        <li><b>Niente resta salvato davvero</b>: le modifiche restano durante la prova, anche passando dal Fanta al Bar. Ricaricando la pagina si riparte. Nessun altro le vede.</li>
        <li><b>Calciatori e club di Lega A sono reali</b>. I risultati e i voti della giornata 10 provengono dall’archivio; le squadre fantasy, le altre giornate e la diretta dimostrativa sono simulate.</li>
      </ul>
      <section class="fanta-block"><h3>Prova una giornata</h3><p>Scegli il momento della stagione da esplorare.</p><div class="fanta-today-tabs"><button type="button" class="secondary" data-demo-scenario="da-schierare">Prima del fischio</button><button type="button" class="secondary" data-demo-scenario="in-corso">In diretta</button><button type="button" class="secondary" data-demo-scenario="calcolata">Giornata calcolata</button></div></section>
      <button type="button" class="primary" data-action="demo-ok">Ho capito, proviamo</button>
    </div>`;
}
