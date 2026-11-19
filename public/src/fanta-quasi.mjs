// Fantacalcio del Quasi: pagina di pre-lancio (app a parte) per la stagione 2027/28.
// La prenotazione viene salvata dal server e notificata al proprietario via email.
export const FANTA_SEASON = '2027/28';
const WA = 'https://wa.me/?text=' + encodeURIComponent('Il prossimo anno giochiamo il fantacalcio su Quelli del Quasi: senza pubblicità, per sempre. ⚽ https://quellidelquasi.com');

export function fantaQuasiTeaser(esc) {
  return '<section class="fq-teaser" aria-label="Fantacalcio del Quasi"><div><span class="eyebrow">LEGA PILOTA · SI GIOCA</span><h2>Il Fantacalcio del Quasi.</h2><p>Una squadra vera, un allenatore quasi. Scegli la tua nella lega pilota: formazioni, voti e classifica restano salvati.</p></div><button type="button" class="primary" data-app-mode="fanta">Scegli la tua squadra <span aria-hidden="true">→</span></button></section>';
}

export function composeWaitlistMessage(f) {
  return ['Lista d’attesa Fantacalcio ' + FANTA_SEASON, 'Ruolo: ' + f.role, 'Dimensione lega: ' + f.size, f.note ? 'Note: ' + f.note : ''].filter(Boolean).join('\n');
}

export function fantaQuasiPage(league, user, esc) {
  const canSignUp = user && !user.demo && user.emailVerified;
  const inList = canSignUp && user.fantacalcioWaitlistSeason === FANTA_SEASON;
  const step = (when, title, text, now) => '<li class="' + (now ? 'is-now' : '') + '"><b>' + when + '</b><div><strong>' + title + '</strong><p>' + text + '</p></div></li>';
  const pillar = (title, text, live) => '<article class="fq-pillar"><span class="fq-badge ' + (live ? 'is-live' : '') + '">' + (live ? 'Già attivo' : 'In costruzione') + '</span><h3>' + title + '</h3><p>' + text + '</p></article>';
  const form = !canSignUp
    ? '<p class="notice" role="status">Per metterti in lista serve un account con email verificata. Dalla demo non è possibile.</p>'
    : inList
      ? '<div class="fq-done" role="status"><strong>Sei in lista ✓</strong><p>Ti scriviamo noi quando parte l’anteprima dell’app. Intanto porta dentro la tua compagnia.</p><a class="secondary" href="' + WA + '" target="_blank" rel="noopener noreferrer">Invita la tua lega su WhatsApp</a></div>'
      : '<form id="fq-form" class="fq-form"><fieldset><legend>Sei…</legend><label class="fq-choice"><input type="radio" name="role" value="Presidente di lega" checked> Presidente: gestisco la lega</label><label class="fq-choice"><input type="radio" name="role" value="Giocatore"> Giocatore</label></fieldset><label class="field">Quanti siete in lega?<select name="size" required><option>4–6</option><option selected>8</option><option>10</option><option>12 o più</option><option>Non lo so ancora</option></select></label><label class="field">Il tuo messaggio<textarea name="note" required maxlength="500" rows="3" placeholder="Raccontaci della tua lega o lasciaci un’idea per il nuovo bar."></textarea></label><button class="primary" type="submit">Mettimi in lista</button><p id="fq-status" role="status" aria-live="polite" class="tiny muted"></p></form>';
  return '<section class="fq-hero"><span class="eyebrow">STAGIONE ' + FANTA_SEASON + '</span><h1>Il fantacalcio che si gioca al bar.</h1><p>Lo stiamo costruendo per l’anno prossimo come app a parte: asta, formazioni e risultati. E siccome i dati sono tutti nostri, le sfide arrivano da sole nelle schedine di Quelli del Quasi.</p><div class="fq-chips"><span>Crediti solo virtuali</span><span>Niente pubblicità</span></div></section>' +
    '<section class="fq-block"><div class="dash-section-head"><div><h2>Cosa ci troverai</h2></div></div><div class="fq-pillars">' +
    pillar('Scommesse sulle sfide', 'Schedine virtuali sulle partite della tua lega di Fantacalcio e sulla Lega A, già oggi.', true) +
    pillar('L’app del Fantacalcio', 'Lega, asta, rose e formazioni in un’app dedicata, fatta apposta per giocare con la tua compagnia.', false) +
    pillar('Dati già in casa', 'Niente collegamenti con siti esterni: formazioni e risultati delle vostre leghe finiscono da soli nelle schedine.', false) +
    '</div></section>' +
    '<section class="fq-block"><div class="dash-section-head"><div><h2>Il percorso</h2><small>Tempi indicativi</small></div></div><ol class="fq-roadmap">' +
    step('Oggi', 'Scegli una squadra', 'Entra nella lega pilota e prova il nostro Fanta con salvataggi veri.', true) +
    step('Primavera 2027', 'App in anteprima', 'Le prime leghe provano l’app Fantacalcio del Quasi e ci aiutano a limarla.', false) +
    step('Estate 2027', 'Lancio', 'App pronta per l’asta e per la stagione ' + FANTA_SEASON + '; le sfide compaiono qui in automatico.', false) +
    '</ol></section>' +
    '<section class="fq-block fq-signup"><div class="dash-section-head"><div><h2>Vuoi esserci?</h2><small>Mettiti in lista: ti avvisiamo appena parte l’anteprima.</small></div></div>' + form + '</section>';
}

export function bindFantaQuasi({ api, user, notify, onDone }) {
  const form = document.getElementById('fq-form');
  if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault();
    if(form.dataset.sending==='true')return;
    const button = form.querySelector('button[type=submit]'), status = document.getElementById('fq-status');
    try {
      const data = new FormData(form),note=String(data.get('note')||'').trim();
      if(!note)throw Error('Scrivi un messaggio prima di metterti in lista.');
      form.dataset.sending='true';button.disabled = true;status.textContent = 'Il postino del bar sta partendo…';
      const result=await api('fantacalcio-waitlist', {role:data.get('role'),size:data.get('size'),note});
      if(!result?.ok)throw Error('Non siamo riusciti a registrarti. Riprova tra poco.');
      user.fantacalcioWaitlistSeason=FANTA_SEASON;
      status.textContent=result.message||'Sei in lista!';
      notify?.('Sei in lista per il Fantacalcio ' + FANTA_SEASON + '.');
      onDone?.();
    } catch (error) {
      status.textContent = error.message || 'Non siamo riusciti a registrarti. Riprova tra poco.';
      button.disabled = false;
    } finally {
      form.dataset.sending='false';
    }
  };
}
