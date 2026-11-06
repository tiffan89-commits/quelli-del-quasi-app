// Accesso, registrazione e schermate dei link email (conferma, recupero, nuova password).
// Una cosa per schermata, il modulo subito in vista, errori sotto il campo mentre si scrive.
import { esc } from '../fanta/formato.mjs';
import { checkEmail, checkUsername, checkPassword, checkRequired, passwordStrength, mailboxFor, PASSWORD_MIN } from './convalida.mjs';
import {socialButtons} from './social.mjs';

export const FIELDS = {
  register: { email: checkEmail, password: checkPassword },
  login: { identity: checkRequired('Scrivi username o email'), password: checkRequired('Scrivi la password') },
  forgot: { identity: checkRequired('Scrivi la tua email o lo username') },
  resend: { identity: checkRequired('Scrivi la tua email o lo username') },
  reset: { password: checkPassword },
};

// Errori da mostrare: solo per i campi già toccati, o tutti dopo un tentativo di invio.
export function errorsFor(screen, values, touched, submitted) {
  const out = {};
  for (const [k, check] of Object.entries(FIELDS[screen] || {})) {
    const e = check(values[k]);
    if (e && (submitted || touched[k])) out[k] = e;
  }
  return out;
}
export const isValid = (screen, values) => Object.entries(FIELDS[screen] || {}).every(([k, check]) => !check(values[k]));

function field({ id, name, label, type = 'text', value = '', error, hint, autocomplete, inputmode, extra = '', after = '' }) {
  return `<div class="pb-field${error ? ' has-error' : ''}">
    <div class="pb-label-row"><label for="${id}">${label}</label>${extra}</div>
    <div class="pb-input-wrap">
      <input id="${id}" name="${name}" type="${type}" value="${esc(value)}" autocomplete="${autocomplete}"${inputmode ? ` inputmode="${inputmode}"` : ''} autocapitalize="none" spellcheck="false"
        ${name==='password'?'data-password-toggle="true"':''} aria-invalid="${!!error}" aria-describedby="${id}-msg">
      ${after}
    </div>
    <p class="pb-msg${error ? ' is-error' : ''}" id="${id}-msg" data-hint="${esc(hint||'')}">${error ? esc(error) : hint ? esc(hint) : ''}</p>
  </div>`;
}

function passwordField(s, { id = 'pb-password', label = 'Password', autocomplete, meter = false, extra = '' }) {
  const v = s.values.password || '', st = passwordStrength(v);
  const after = `<button type="button" class="pb-eye" data-pb-eye="${id}" aria-label="${s.showPassword ? 'Nascondi' : 'Mostra'} la password" aria-pressed="${!!s.showPassword}">${s.showPassword ? 'Nascondi' : 'Mostra'}</button>`;
  // Mentre la si scrive, "ancora N caratteri" è un aiuto, non un errore: diventa rosso solo se si prova a inviare.
  const counting = meter && v && v.length < PASSWORD_MIN && !s.submitted;
  return field({ id, name: 'password', label, type: s.showPassword ? 'text' : 'password', value: v, error: counting ? null : s.errors.password, autocomplete, extra, after,
    hint: meter ? (counting ? `Ancora ${PASSWORD_MIN - v.length} per arrivare a ${PASSWORD_MIN}` : v ? `${st.label} · va bene` : `Almeno ${PASSWORD_MIN} caratteri. Una frase che ricordi è perfetta.`) : '' })
    + (meter ? `<div class="pb-meter" aria-hidden="true"><i class="s${st.score}"></i></div>` : '')
    + `<p class="pb-caps" id="pb-caps" hidden>Attenzione: il blocco maiuscole è attivo</p>`;
}

function shell(s, title, sub, body) {
  return `<div class="pb-auth">
    <header class="pb-top is-auth">
      <a class="pb-back" href="#" data-go="home" aria-label="Torna alla pagina iniziale">←</a>
      <a class="pb-brand" href="#" data-go="home"><img src="/league-logo.svg" alt="" width="22" height="26">QUELLI DEL <b>QUASI.</b></a>
    </header>
    <main class="pb-auth-main">
      ${s.invite ? `<p class="pb-invite-chip">Invito${s.invite.info?.league ? ` in <b>${esc(s.invite.info.league)}</b>` : ''} · codice <code>${esc(s.invite.code)}</code>: entri appena hai l'account.</p>` : ''}
      ${s.entry&&!s.invite?'<p class="pb-invite-chip">LA TUA PANCHINA TI ASPETTA · Crea l’account, conferma l’email, entra nella prova.</p>':''}<h1>${title}</h1>
      ${sub ? `<p class="pb-sub">${sub}</p>` : ''}
      ${body}
    </main>
  </div>`;
}

const tabs = s => `<div class="pb-tabs" role="tablist">
  <a role="tab" href="#accedi" data-go="login" aria-selected="${s.screen === 'login'}" class="${s.screen === 'login' ? 'is-active' : ''}">Accedi</a>
  <a role="tab" href="#registrati" data-go="register" aria-selected="${s.screen === 'register'}" class="${s.screen === 'register' ? 'is-active' : ''}">Registrati</a>
</div>`;

const formError = s => s.formError ? `<div class="pb-alert" role="alert">${esc(s.formError)}${s.formAction || ''}</div>` : '';
const submit = (s, label, busyLabel) => `<button type="submit" class="pb-btn is-primary is-full"${s.busy ? ' disabled aria-busy="true"' : ''}>${s.busy ? busyLabel : label}</button>`;

function register(s) {
  const v = s.values;
  return shell(s, s.invite ? 'Crea l\'account ed entra' : 'Crea il tuo account', 'Bastano email e password. Il soprannome parte dalla tua email: puoi cambiarlo nel profilo.', `
    ${tabs(s)}
    <section data-social-buttons>${socialButtons(s)}</section>
    ${s.editRegistration?'<p class="pb-sub">Correggi l’email e conferma la password appena scelta.</p>':''}
    <form class="pb-form" data-pb-form="register" novalidate>
      ${formError(s)}
      ${field({ id: 'pb-email', name: 'email', label: 'Email', type: 'email', value: v.email, error: s.errors.email, autocomplete: 'email', inputmode: 'email', hint: 'Ti mandiamo un link per attivare l\'account.' })}
      ${passwordField(s, { autocomplete: 'new-password', meter: true })}
      ${submit(s, s.editRegistration?'Correggi l’email':'Crea l\'account', 'Invio in corso…')}
      <p class="pb-fine">Solo crediti virtuali: niente acquisti né premi in denaro. La password non viaggia mai per email.</p>
    </form>
    <p class="pb-switch">Hai già un account? <a href="#accedi" data-go="login">Accedi</a></p>`);
}

function login(s) {
  const v = s.values;
  return shell(s, 'Bentornato, mister', '', `
    ${tabs(s)}
    <section data-social-buttons>${socialButtons(s)}</section>
    <form class="pb-form" data-pb-form="login" novalidate>
      ${formError(s)}
      ${field({ id: 'pb-identity', name: 'identity', label: 'Email (o username del vecchio account)', value: v.identity, error: s.errors.identity, autocomplete: 'username' })}
      ${passwordField(s, { autocomplete: 'current-password', extra: '<a class="pb-forgot" href="#recupera" data-go="forgot">Password dimenticata?</a>' })}
      ${submit(s, 'Accedi', 'Accesso in corso…')}
    </form>
    <p class="pb-switch">Non hai un account? <a href="#registrati" data-go="register">Registrati</a></p>
    <button type="button" class="pb-link is-center" data-go="demo">Prima vuoi dare un'occhiata? Guarda la demo</button>`);
}

function checkEmailScreen(s, now) {
  const box = mailboxFor(s.sentTo), wait = Math.max(0, Math.ceil(((s.cooldownUntil || 0) - now) / 1000));
  return shell(s, 'Controlla la tua email', '', `
    <div class="pb-mail">
      <div class="pb-mail-icon" aria-hidden="true">✉</div>
      <p>Ti abbiamo scritto a <b>${esc(s.sentTo)}</b>. Apri il link nell'email per ${s.mailPurpose === 'reset' ? 'scegliere una nuova password' : 'attivare l\'account'}.</p>
      ${box ? `<a class="pb-btn is-primary is-full" href="${box.url}" target="_blank" rel="noopener">${box.label} <span aria-hidden="true">↗</span></a>` : ''}
      <ul class="pb-tips"><li>Non la trovi? Guarda in <b>Spam</b> o <b>Promozioni</b>.</li><li>Il link vale ${s.mailPurpose === 'reset' ? '30 minuti' : '24 ore'}.</li></ul>
      ${s.message ? `<p class="pb-ok" role="status">${esc(s.message)}</p>` : ''}
      <button type="button" class="pb-btn is-full" data-pb-resend ${wait ? 'disabled' : ''}>${wait ? `Reinvia tra ${wait} s` : 'Reinvia l\'email'}</button>
      ${s.mailPurpose === 'reset' ? '' : '<button type="button" class="pb-link is-center" data-go="register-edit">Ho sbagliato email</button>'}
      <button type="button" class="pb-link is-center" data-go="login">Vai all'accesso</button>
    </div>`);
}

function forgot(s) {
  return shell(s, 'Recupera la password', 'Scrivi email o username: ti mandiamo un link per sceglierne una nuova.', `
    <form class="pb-form" data-pb-form="forgot" novalidate>
      ${formError(s)}
      ${field({ id: 'pb-identity', name: 'identity', label: 'Email o username', value: s.values.identity, error: s.errors.identity, autocomplete: 'username' })}
      ${submit(s, 'Mandami il link', 'Invio in corso…')}
    </form>
    <p class="pb-switch">Te la sei ricordata? <a href="#accedi" data-go="login">Accedi</a></p>`);
}

function verify(s) {
  if (s.done) return shell(s, 'Account attivo!', 'Benvenuto nel bar. Ora accedi con email e password.', `
    <a class="pb-btn is-primary is-full" href="#accedi" data-go="login">Accedi <span aria-hidden="true">→</span></a>`);
  return shell(s, 'Conferma il tuo indirizzo', 'Un tocco e l\'account è attivo.', `
    <form class="pb-form" data-pb-form="verify">${formError(s)}${submit(s, 'Attiva l\'account', 'Attivazione in corso…')}</form>
    ${s.formError ? '<button type="button" class="pb-link is-center" data-go="resend">Mandami un nuovo link</button>' : ''}`);
}

function reset(s) {
  if (s.done) return shell(s, 'Password cambiata', 'Gli altri dispositivi sono stati scollegati. Accedi con la nuova password.', `
    <a class="pb-btn is-primary is-full" href="#accedi" data-go="login">Accedi <span aria-hidden="true">→</span></a>`);
  return shell(s, 'Scegli una nuova password', '', `
    <form class="pb-form" data-pb-form="reset" novalidate>
      ${formError(s)}
      ${passwordField(s, { label: 'Nuova password', autocomplete: 'new-password', meter: true })}
      ${submit(s, 'Salva la nuova password', 'Salvataggio…')}
    </form>
    ${s.formError ? '<button type="button" class="pb-link is-center" data-go="forgot">Richiedi un nuovo link</button>' : ''}`);
}

function resend(s) {
  return shell(s, 'Nuovo link di conferma', 'Scrivi email o username: ti rimandiamo il link per attivare l\'account.', `
    <form class="pb-form" data-pb-form="resend" novalidate>
      ${formError(s)}
      ${field({ id: 'pb-identity', name: 'identity', label: 'Email o username', value: s.values.identity, error: s.errors.identity, autocomplete: 'username' })}
      ${submit(s, 'Rimandami il link', 'Invio in corso…')}
    </form>`);
}

function social(s){
 const info=s.social;
 return shell(s,'Un ultimo passo',info?.requiresPassword?'Questa email ha già un account. Confermalo una volta con la sua password: conserverai tutti i tuoi dati.':info?.ready?'Ti riportiamo al bar.':'Scegli come ti chiameranno gli altri al bar.',`<form class="pb-form" data-pb-form="social" novalidate>${formError(s)}${!info?'<p role="status">Verifica dell’accesso in corso…</p>':`${info.email?`<p class="pb-sub">${esc(info.email)}</p>`:''}${info.requiresUsername?field({id:'pb-social-username',name:'username',label:'Username',value:s.values.username,error:s.errors.username,autocomplete:'username',hint:'Da 3 a 60 caratteri. Il soprannome lo puoi cambiare dopo.'}):''}${info.requiresEmail?field({id:'pb-social-email',name:'email',label:'Email',type:'email',value:s.values.email,error:s.errors.email,autocomplete:'email',hint:'Ti mandiamo un link per confermare l’indirizzo.'}):''}${info.requiresPassword?passwordField(s,{autocomplete:'current-password',extra:'<a href="#recupera" data-go="forgot">Password dimenticata?</a>'}):''}${submit(s,info.requiresPassword?'Collega e accedi':info.ready?'Accedi':'Entra nel bar','Accesso in corso…')}`}</form><button class="pb-link is-center" type="button" data-go="login">Torna all’accesso</button>`);
}
export function renderAuth(s, now = Date.now()) {
  return ({ register, login, forgot, verify, reset, resend, social, 'check-email': x => checkEmailScreen(x, now) })[s.screen]?.(s) ?? login(s);
}
