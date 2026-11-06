import {avatarSvg} from '../avatar.mjs';
// Pagina iniziale pubblica: cosa è Quelli del Quasi (Fanta + Bar), demo senza registrarsi, registrazione e accesso.
// Funzione pura: opzioni → HTML. Le "schermate" nella vetrina sono pezzi finti ma fedeli dell'app.
import { esc } from '../fanta/formato.mjs';
import { shirt } from '../fanta/maglie.mjs';

const PRINCIPLES = [
  ['Crediti solo virtuali', 'Al Bar si gioca con crediti finti: non si comprano e non si vincono soldi.'],
];

const FAQ = [
  ['Ci sono pubblicità?', 'No, e non ce ne saranno mai: né banner né video. I crediti del Bar sono finti: non si comprano e non si vincono soldi.'],
  ['Quanti amici possono giocare in una lega?', 'Fino a 12. Chi crea la lega è l\'admin e invita gli altri con un link.'],
  ['Il Fanta è già disponibile?', 'È in prova con una lega pilota. Intanto puoi provarlo nella demo, senza registrarti: niente viene salvato.'],
  ['Da dove arrivano i voti?', 'Dalle statistiche vere di ogni partita di Serie A, con una formula pubblica. Ogni voto ha la sua spiegazione: «Perché 6,5?».'],
];

// Vetrina: tre pezzi d'app che si capiscono al volo.
function showcase() {
  return `<div class="pb-show" aria-hidden="true">
    <div class="pb-card pb-vote">
      <div class="pb-vote-head"><span class="pb-shirt">${shirt('Atalanta')}</span><div><b>Éderson</b><small>C · Atalanta · esempio di voto</small></div>
        <div class="pb-vote-n"><small>Voto</small><strong>6,5</strong></div><div class="pb-vote-n is-fv"><small>FV</small><strong>9,5</strong></div></div>
      <p class="pb-why"><b>Perché 6,5?</b> Nell’esempio, Éderson dà ritmo all’Atalanta e trova la rete. Una prova convincente, con il gol a darle sostanza.</p>
    </div>
    <div class="pb-card pb-auction">
      <span class="pb-live">ASTA LIVE</span>
      <div class="pb-auction-row"><span class="pb-shirt">${shirt('Juventus')}</span><div><b>Kenan Yıldız</b><small>C · Juventus · esempio d’asta</small></div>
        <strong class="pb-bid">41</strong><span class="pb-ring"><i>7</i></span></div>
      <div class="pb-raises"><span>+1</span><span>+5</span><span>+10</span><span class="is-pass">Passo</span></div>
    </div>
    <div class="pb-card pb-slip">
      <span class="pb-tag">AL BAR</span>
      <div class="pb-slip-row"><span>SamBuca – Real Gin</span><b>1 · 2,05</b><i class="ok">✓</i></div>
      <div class="pb-slip-row"><span>Fly – AC Ciaccola</span><b>Over · 1,90</b><i class="ko">✕</i></div>
      <div class="pb-slip-foot"><span>Puntata 20</span><strong>+41 crediti</strong></div>
    </div>
  </div>`;
}

function inviteBanner(invite) {
  if (!invite) return '';
  const who = invite.info?.inviter ? `<b>${esc(invite.info.inviter)}</b> ti invita` : 'Sei stato invitato';
  const where = invite.info?.league ? ` in <b>${esc(invite.info.league)}</b>` : ' in una lega';
  return `<section class="pb-invite" aria-labelledby="pb-invite-title">
    <span class="eyebrow">Invito</span>
    <h2 id="pb-invite-title">${who}${where}</h2>
    ${invite.info ? `<p>${esc(invite.info.members)}${Number.isFinite(invite.info.maxMembers)?'/'+invite.info.maxMembers:''} amici già dentro. Codice <code>${esc(invite.code)}</code></p>` : `<p>Codice <code>${esc(invite.code)}</code></p>`}
    <div class="pb-actions">
      <a class="pb-btn is-primary" href="#registrati" data-go="register">Crea l'account ed entra <span aria-hidden="true">→</span></a>
      <a class="pb-btn" href="#accedi" data-go="login">Ho già un account</a>
    </div>
  </section>`;
}

export function renderLanding({ invite = null, barDemo = false } = {}) {
  return `<div class="pb-landing" id="inizio">
    <header class="pb-top">
      <a class="pb-brand" href="#inizio" data-go="home"><img src="/league-logo.svg" alt="" width="26" height="30">QUELLI DEL <b>QUASI.</b></a>
      <a class="pb-btn is-small" href="#accedi" data-go="login">Accedi</a>
    </header>

    ${inviteBanner(invite)}

    <section class="pb-hero" aria-labelledby="pb-title">
      <div class="pb-hero-copy">
        <span class="eyebrow">Una lega di amici · due giochi</span>
        <h1 id="pb-title">Il fanta dei tuoi amici. <em>Con il bar dentro.</em></h1>
        <p>Schieri la formazione, segui i voti in diretta spiegati riga per riga e fai l'asta online o dal vivo. Al Bar scommetti crediti virtuali sulla Serie A. </p>
        <div class="pb-actions">
          <a class="pb-btn is-primary" href="#registrati" data-go="register">Crea il tuo account <span aria-hidden="true">→</span></a>
          <button type="button" class="pb-btn" data-go="demo">Guarda la demo <small>senza registrarti</small></button>
        </div>
        <ul class="pb-pills"><li>Niente pubblicità, per sempre</li></ul>
      </div>
      ${showcase()}
    </section>

    <section class="pb-games" aria-labelledby="pb-games-title">
      <h2 id="pb-games-title" class="pb-h2">Due giochi, una lega</h2>
      <div class="pb-game-grid">
        <article class="pb-game is-fanta">
          <span class="pb-badge">In prova · guarda la demo</span>
          <h3>Fanta</h3>
          <p>Il fantacalcio vero, fatto bene.</p>
          <ul>
            <li><b>Voti spiegati</b>: per ogni giocatore, da dove arriva il voto.</li>
            <li><b>Formazione col dito</b>: trascini i giocatori sul campo, con le maglie dei club.</li>
            <li><b>Asta online o dal vivo</b>: a turni con il timer, oppure tutti insieme con il banditore.</li>
            <li><b>Diretta</b>: voti e punteggi che si muovono durante le partite.</li>
          </ul>
          <button type="button" class="pb-link" data-go="demo-fanta">Prova la demo del Fanta <span aria-hidden="true">→</span></button>
        </article>
        <article class="pb-game is-bar">
          <span class="pb-badge is-on">Disponibile</span>
          <h3>Bar</h3>
          <p>Schedine sulla Serie A, con crediti virtuali e prese in giro vere.</p>
          <ul>
            <li><b>Scommetti sulle partite vere</b> della Serie A.</li>
            <li><b>Il tuo Quasi</b>: un personaggio da vestire con i premi che vinci.</li>
            <li><b>Classifica crediti</b>, chat della lega e i profili da pronosticatore.</li>
          </ul>
          ${barDemo ? '<button type="button" class="pb-link" data-go="demo-bar">Prova la demo del Bar <span aria-hidden="true">→</span></button>' : ''}
        </article>
      </div>
    </section>

    <section class="pb-steps" aria-labelledby="pb-steps-title">
      <h2 id="pb-steps-title" class="pb-h2">Come si comincia</h2>
      <ol>
        <li><b>Crea l'account</b><span>Email e password: un minuto.</span></li>
        <li><b>Crea la lega o entra con un invito</b><span>Fino a 12 amici. L'admin li invita con un link su WhatsApp.</span></li>
        <li><b>Gioca</b><span>Formazione, asta, schedine al Bar. Sul telefono, come un'app.</span></li>
      </ol>
    </section>

    <section class="pb-principles" aria-label="I nostri principi">
      ${PRINCIPLES.map(([t, d]) => `<div><b>${t}</b><p>${d}</p></div>`).join('')}
    </section>

    <section class="pb-faq" aria-labelledby="pb-faq-title">
      <h2 id="pb-faq-title" class="pb-h2">Domande</h2>
      ${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
    </section>

    <section class="pb-quasi-preview" aria-label="Il tuo Quasi"><div class="pb-quasi-art"><img src="/assets/rooms-v2/base-room-01.webp" alt="Lo spogliatoio del Quasi" loading="lazy"><div>${avatarSvg({})}</div></div><div><h2>Il tuo Quasi ha già preso posto.</h2><p>Personaggio, spogliatoio e premi. Al bar si riconosce il tuo stile.</p></div></section><section class="pb-final">
      <h2>Avevi quasi ragione. <em>Dimostralo.</em></h2>
      <div class="pb-actions">
        <a class="pb-btn is-primary" href="#registrati" data-go="register">Crea il tuo account <span aria-hidden="true">→</span></a>
        <a class="pb-btn" href="#accedi" data-go="login">Accedi</a>
      </div>
    </section>

    <nav class="pb-guide-links" aria-label="Scopri Quelli del Quasi"><a href="/fantacalcio-tra-amici.html">Il fantacalcio tra amici</a><a href="/asta-fantacalcio.html">Asta online e dal vivo</a><a href="/schedine-virtuali.html">Le schedine virtuali</a></nav>
    <footer class="pb-foot"><span>Solo crediti virtuali. Nessun acquisto, nessun premio in denaro.</span></footer>
  </div>`;
}

// Scelta della demo: Fanta (sempre) e Bar (solo se attiva sul server).
export function renderDemoChooser({ barDemo }) {
  return `<div class="pb-sheet-head"><h2 id="pb-sheet-title">Quale demo vuoi provare?</h2><button type="button" class="pb-close" data-go="close" aria-label="Chiudi">×</button></div>
    <p class="pb-muted">Nessuna registrazione. È tutto finto e niente viene salvato.</p>
    <button type="button" class="pb-choice is-fanta" data-go="demo-fanta"><b>Fanta</b><span>Formazione, voti spiegati, asta. Sei l'allenatore di una squadra di prova.</span></button>
    ${barDemo ? '<button type="button" class="pb-choice is-bar" data-go="demo-bar"><b>Bar</b><span>Schedine di Serie A, crediti finti e il tuo Quasi.</span></button>' : ''}`;
}
