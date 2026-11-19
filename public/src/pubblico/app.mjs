// Controllore dell'area pubblica: pagina iniziale, accesso, registrazione, link delle email, scelta della demo.
// mountPublic(root, { api, onDemo, onLoggedIn }) — onDemo('fanta'|'bar') apre la demo, onLoggedIn(result) entra nell'app.
// Indirizzi: #accedi, #registrati, #recupera, #conferma, #demo, #invito=CODICE (o /invito/CODICE),
// e i link delle email #action=verify&token=… / #action=reset&token=… (oggi gestiti da account.html).
import { renderLanding, renderDemoChooser } from './landing.mjs';
import { renderAuth, errorsFor, isValid } from './accesso.mjs';
import {passwordStrength,PASSWORD_MIN} from './convalida.mjs';
import {checkEmail,checkUsername} from './convalida.mjs';
import {socialButtons} from './social.mjs';
import {rememberEntry,entryIntent,clearEntry} from '../acquisition-intent.mjs';
import {readAppRoute,isSubmissionRoute} from '../routes.mjs';

const ROUTES = { '#accedi': 'login', '#registrati': 'register', '#recupera': 'forgot', '#conferma': 'resend', '#accesso': 'login', '#reinvia': 'resend' };
const HASH_OF = { login: '#accedi', register: '#registrati', forgot: '#recupera', resend: '#conferma' };
const COOLDOWN = 60000;

export function mountPublic(root, { api, onDemo = () => {}, onLoggedIn = () => {} }) {
  const s = { view: 'landing', screen: 'login', values: {}, touched: {}, submitted: false, errors: {}, busy: false, showPassword: false, invite: null, sheet: null, barDemo:true };
  let tick = null, alive = true, epoch = 0; const lifecycle = new AbortController(), signal = lifecycle.signal;
  if(new URLSearchParams(location.search).get('entry')==='fanta')rememberEntry(localStorage);
  const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal});
  try { const saved=JSON.parse(localStorage.getItem('qdq:invite')||'null'); if(saved?.code&&Date.now()-saved.at<7*864e5) s.invite={code:saved.code,info:null};  } catch {}

  // ----- Indirizzo → schermata -----
  function route() {
    epoch++; const h = location.hash, params = new URLSearchParams(h.slice(1));
    const path = location.pathname.match(/^\/invito\/([A-Za-z0-9_-]{3,40})\/?$/);
    const code = params.get('invito') || new URLSearchParams(location.search).get('invito') || path?.[1] || s.invite?.code;
    if (code) loadInvite(code);
    if(h==='#social'){show('auth','social');loadSocial(epoch);return;}
    if(params.has('social-error')){history.replaceState(null,'',location.pathname+location.search+'#accedi');return show('auth','login',{formError:params.get('social-error')==='cancelled'?'Accesso annullato. Puoi riprovare oppure usare email e password.':'Non siamo riusciti a completare l’accesso social. Riprova oppure usa email e password.'});}
    if (params.get('action') === 'verify' || params.get('action') === 'reset') {
      return show('auth', params.get('action'), { token: params.get('token') || '' });
    }
    if (h === '#demo') { s.sheet = 'demo'; show('landing');window.scrollTo({top:0,behavior:'smooth'});return; }
    if (ROUTES[h]) return show('auth', ROUTES[h]);
    if(isSubmissionRoute(readAppRoute(h)))return show('auth','login');
    show('landing');
  }

  async function loadInvite(code) {
    if (s.invite?.code === code && s.invite.info !== null) return;
    s.invite = { code, info: null };
    try { localStorage.setItem('qdq:invite', JSON.stringify({ code, at: Date.now() })); } catch {}
    const info = await api.inviteInfo(code); if(!alive||s.invite?.code!==code)return; s.invite.info = info; if(s.view==='landing')render();
  }

  function show(view, screen, extra = {}) {
    if(!alive)return;
    const changed = view !== s.view || screen !== s.screen;
    s.view = view;
    if (screen) s.screen = screen;
    if (changed) Object.assign(s, { touched: {}, submitted: false, errors: {}, formError: null, formAction: '', message: null, done: false, busy: false });
    Object.assign(s, extra);
    render();
    if (changed) { scrollTo(0, 0); focusFirst(); }
  }

  function go(screen) {
    epoch++;
    const hash = HASH_OF[screen];
    if (hash && location.hash !== hash) history.pushState(null, '', hash);
    show('auth', screen);
  }

  const focusFirst = () => {
    if (s.view !== 'auth' || matchMedia('(pointer:coarse)').matches) return; // sul telefono niente tastiera che salta su da sola
    root.querySelector('.pb-form input')?.focus();
  };

  // ----- Disegno (senza perdere il campo in cui si sta scrivendo) -----
  function render() {
    if(!alive)return;
    const a = document.activeElement, id = root.contains(a) && a.id, sel = id && a.selectionStart;
    s.errors = s.view === 'auth' ? errorsFor(s.screen, s.values, s.touched, s.submitted) : {};
    s.entry=entryIntent(localStorage);root.innerHTML = s.view === 'landing' ? renderLanding({ invite: s.invite, barDemo: s.barDemo }) : renderAuth(s);
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(sel ?? el.value.length, sel ?? el.value.length); } catch {} } }
    renderSheet();
    clearInterval(tick);
    if (s.view === 'auth' && s.screen === 'check-email' && s.cooldownUntil > Date.now()) tick = setInterval(() => { render(); if (Date.now() > s.cooldownUntil) clearInterval(tick); }, 1000);
  }

  function renderSheet() {
    let el = document.getElementById('pb-sheet');
    if (!s.sheet) { el?.remove(); document.body.classList.remove('pb-sheet-open'); return; }
    if (!el) { el = document.createElement('div'); el.id = 'pb-sheet'; document.body.append(el); el.addEventListener('click', onClick); }
    el.innerHTML = `<div class="pb-backdrop" data-go="close"></div><div class="pb-sheet" role="dialog" aria-modal="true" aria-labelledby="pb-sheet-title">${renderDemoChooser({ barDemo: s.barDemo })}</div>`;
    document.body.classList.add('pb-sheet-open');
    el.querySelector('.pb-choice')?.focus();
  }

  // Keep native input nodes intact while typing: replacing a password input interrupts
  // secure keyboards, password managers, IME composition and the caret on mobile.
  function updateFields(){
    s.errors=errorsFor(s.screen,s.values,s.touched,s.submitted);
    for(const input of root.querySelectorAll('.pb-form input[name]')){
      const v=input.value,error=s.errors[input.name],meter=input.name==='password'&&!!root.querySelector('.pb-meter'),counting=meter&&v&&v.length<PASSWORD_MIN&&!s.submitted;
      input.setAttribute('aria-invalid',String(!!error&&!counting));input.closest('.pb-field')?.classList.toggle('has-error',!!error&&!counting);
      const msg=root.querySelector('#'+input.id+'-msg');
      if(msg){msg.classList.toggle('is-error',!!error&&!counting);msg.textContent=error&&!counting?error:meter?(counting?`Ancora ${PASSWORD_MIN-v.length} per arrivare a ${PASSWORD_MIN}`:v?`${passwordStrength(v).label} · va bene`:`Almeno ${PASSWORD_MIN} caratteri. Una frase che ricordi è perfetta.`):msg.dataset.hint||'';}
    }
    const meter=root.querySelector('.pb-meter i');if(meter)meter.className='s'+passwordStrength(s.values.password||'').score;
    if(!s.formError)root.querySelector('.pb-alert')?.remove();
  }

  // ----- Azioni -----
  async function submitForm(kind) {
    if(s.busy||!alive)return; const mine=epoch;
    // Autofill may not emit input; read the form itself before validating/submitting.
    for(const input of root.querySelectorAll('.pb-form input[name]'))s.values[input.name]=input.value;
    s.submitted = true;
    if(kind==='social'){s.errors={};if(s.social?.requiresUsername)s.errors.username=checkUsername(s.values.username);if(s.social?.requiresEmail)s.errors.email=checkEmail(s.values.email);if(s.social?.requiresPassword&&!s.values.password)s.errors.password='Scrivi la password del tuo account';if(Object.values(s.errors).some(Boolean)){render();root.querySelector('[aria-invalid="true"]')?.focus();return;}}
    else if (kind !== 'verify' && !isValid(kind, s.values)) { render(); root.querySelector('[aria-invalid="true"]')?.focus(); return; }
    s.busy = true; s.formError = null; s.formAction = ''; render();
    const v = {...s.values};
    try {
      if(kind==='social'){
        const result=await api.socialComplete({...(s.social?.requiresUsername?{username:v.username}:{}),...(s.social?.requiresEmail?{email:v.email}:{}),...(s.social?.requiresPassword?{password:v.password}:{})});
        if(!alive||mine!==epoch)return;
        if(result.needsLink){s.busy=false;s.social={...s.social,email:result.email,ready:false,requiresEmail:false,requiresPassword:true};render();return;}
        if(result.pendingVerification)return show('auth','check-email',{sentTo:result.identity,values:{identity:result.identity},mailPurpose:'verify',cooldownUntil:Date.now()+COOLDOWN});
        history.replaceState(null,'',location.pathname+location.search+'#accedi');return await onLoggedIn({...result,invite:result.invite||s.invite?.code});
      }
      if (kind === 'register') {
        const result = await api.register({ email: v.email, password: v.password,...(s.entry?{entry:'fanta'}:{}),...(s.editRegistration?{correctEmail:true,previousEmail:s.registrationEmail}:{}) }); if(!alive||mine!==epoch)return;
        Object.assign(s, { editRegistration:false,registrationEmail:v.email.trim(),sentTo: v.email.trim(), mailPurpose: 'verify', cooldownUntil: Date.now() + COOLDOWN, values: { ...v, password: '' } });
        history.pushState(null, '', '#email-inviata');
        return show('auth', 'check-email');
      }
      if (kind === 'login') {
        const result = await api.login({ username: v.identity, password: v.password });
        if(!alive||mine!==epoch)return;
        if(result.pendingVerification){s.values.identity=result.identity||v.identity;return show('auth','check-email',{sentTo:result.identity||'l’email del tuo account',mailPurpose:'verify',cooldownUntil:0,message:'Conferma l’email per entrare. Puoi richiedere qui un nuovo link.'});}
        return await onLoggedIn({...result,invite:s.invite?.code});
      }
      if (kind === 'forgot' || kind === 'resend') {
        const r = await (kind === 'forgot' ? api.forgotPassword(v.identity) : api.resendVerification(v.identity));
        if(!alive||mine!==epoch)return; const sentTo = v.identity.includes('@') ? v.identity.trim() : 'l\'email del tuo account';
        Object.assign(s, { sentTo, mailPurpose: kind === 'forgot' ? 'reset' : 'verify', cooldownUntil: Date.now() + COOLDOWN });
        return show('auth', 'check-email', { message: r.message });
      }
      if (kind === 'verify') { const result=await api.activate(s.token); if(!alive||mine!==epoch)return; s.busy=false; if(result.ok&&result.loggedIn)return await onLoggedIn({...result,intent:s.intent,invite:s.invite?.code}); s.done=true; return render(); }
      if (kind === 'reset') { await api.resetPassword(s.token, v.password); if(!alive||mine!==epoch)return; s.busy = false; s.done = true; return render(); }
    } catch (e) {
      if(!alive||mine!==epoch)return; s.busy = false;
      s.formError = e.message;
      // Il messaggio porta direttamente alla soluzione.
      if (kind === 'login' && e.status === 403) s.formAction = ' <a href="#conferma" data-go="resend">Mandami un nuovo link</a>';
      else if (kind === 'login') s.formAction = ' <a href="#recupera" data-go="forgot">Hai dimenticato la password?</a>';
      else if (kind === 'register' && /non disponibile/i.test(e.message)) s.formAction = ' <a href="#accedi" data-go="login">Accedi</a> · <a href="#recupera" data-go="forgot">Recupera l\'account</a>';
      render();
    }
  }

  let loadingSocial=false;
  async function loadSocial(mine){
    if(loadingSocial||!api.socialStatus)return;loadingSocial=true;s.busy=true;render();
    try{const info=await api.socialStatus();if(!alive||mine!==epoch)return;s.social=info;s.busy=false;if(info.entry==='fanta')rememberEntry(localStorage);render();if(info.ready)await submitForm('social');}
    catch(e){if(alive&&mine===epoch){s.busy=false;s.formError=e.message;render();}}
    finally{loadingSocial=false;if(alive&&mine!==epoch&&location.hash==="#social")queueMicrotask(()=>loadSocial(epoch));}
  }
  async function startSocial(provider){
    if(s.busy||!alive||!s.providers?.includes(provider))return;const mine=epoch;s.busy=true;s.socialStarting=provider;s.formError=null;render();
    try{const out=await api.socialStart({provider,invite:s.invite?.code,entry:s.entry?'fanta':undefined});if(!alive||mine!==epoch)return;const url=new URL(out.authorizationUrl);if(url.protocol!=='https:'||!['accounts.google.com','www.facebook.com','appleid.apple.com'].includes(url.hostname))throw Error('Collegamento di accesso non valido');location.assign(url.href);}
    catch(e){if(alive&&mine===epoch){s.busy=false;s.socialStarting=null;s.formError=e.message;render();}}
  }

  async function resendMail() {
    if (!alive || s.resending || Date.now() < (s.cooldownUntil || 0)) return; const mine=epoch; s.resending=true;
    s.cooldownUntil = Date.now() + COOLDOWN; render();
    try {
      const r = await (s.mailPurpose === 'reset' ? api.forgotPassword(s.values.identity || s.sentTo) : api.resendVerification(s.values.email || s.values.identity || s.sentTo));
      if(alive&&mine===epoch)s.message = r.message || 'Email rimandata.';
    } catch (e) { if(alive&&mine===epoch)s.message = e.message; } finally {s.resending=false;}
    if(alive&&mine===epoch)render();
  }

  function onClick(e) {
    const t = e.target.closest('[data-go],[data-pb-eye],[data-pb-resend],[data-social-provider]');
    if (!t) return;
    if(t.dataset.socialProvider){e.preventDefault();startSocial(t.dataset.socialProvider);return;}
    if (t.dataset.pbEye) { e.preventDefault();s.showPassword = !s.showPassword;const input=root.querySelector('#'+t.dataset.pbEye),start=input?.selectionStart,end=input?.selectionEnd;if(input){input.type=s.showPassword?'text':'password';t.textContent=s.showPassword?'Nascondi':'Mostra';t.setAttribute('aria-label',(s.showPassword?'Nascondi':'Mostra')+' la password');t.setAttribute('aria-pressed',String(s.showPassword));input.focus({preventScroll:true});try{input.setSelectionRange(start,end);}catch{}}return; }
    if (t.dataset.pbResend !== undefined) { resendMail(); return; }
    const where = t.dataset.go;
    e.preventDefault();
    if (where === 'close') { s.sheet = null; if (location.hash === '#demo') history.replaceState(null, '', location.pathname); return renderSheet(); }
    if (where === 'home') { if(s.entry&&!s.invite){location.assign('/prendi-squadra.html'+location.search);return;}epoch++;history.pushState(null, '', location.pathname + (s.invite ? '#invito=' + s.invite.code : '')); s.sheet = null; return show('landing'); }
    if(where==='demo'){if(!s.barDemo)return onDemo('fanta');s.sheet='demo';return renderSheet();}
    if (where === 'demo-bar' && !s.barDemo)return;
    if (where === 'demo-fanta' || where === 'demo-bar') { s.sheet = null; renderSheet(); return onDemo(where.slice(5)); }
    if (where === 'register-edit') { s.editRegistration=true;s.values.password = ''; go('register'); document.getElementById('pb-email')?.focus(); return; }
    s.sheet = null; renderSheet();
    go(where);
  }

  listen(root,'click', onClick);
  listen(root,'input', e => {
    if (!e.target.name) return;
    s.values[e.target.name] = e.target.value;
    if (s.formError) { s.formError = null; s.formAction = ''; }
    updateFields();
  });
  // Un campo mostra l'errore solo dopo che lo si lascia (non mentre si inizia a scrivere).
  listen(root,'focusout', e => {
    if (!e.target.name || s.touched[e.target.name] || !e.target.value) return;
    s.touched[e.target.name] = true;
    updateFields();
  });
  listen(root,'submit', e => { e.preventDefault(); submitForm(e.target.dataset.pbForm); });
  const caps = e => { if (e.target.type === 'password' || e.target.name === 'password') document.getElementById('pb-caps')?.toggleAttribute('hidden', !e.getModifierState?.('CapsLock')); };
  listen(root,'keydown', caps);
  listen(root,'keyup', caps);
  listen(window,'popstate', route); listen(window,'hashchange',route);
  listen(window,'keydown', e => { if (e.key === 'Escape' && s.sheet) { s.sheet = null; renderSheet(); } });

  api.features().then(f => { if(!alive)return; s.barDemo = f.barDemo!==false;s.providers=(f.socialProviders||[]).filter(p=>['google','facebook','apple'].includes(p));if(s.view==='landing')render();else{const slot=root.querySelector('[data-social-buttons]');if(slot)slot.innerHTML=socialButtons(s);} }).catch(()=>{});
  route();
  return {route, destroy(){alive=false;epoch++;lifecycle.abort();clearInterval(tick);document.getElementById('pb-sheet')?.remove();document.body.classList.remove('pb-sheet-open');}};
}
