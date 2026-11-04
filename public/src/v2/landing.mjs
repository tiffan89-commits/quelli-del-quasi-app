// Landing pubblica: il markup è statico in index.html (#landing) per SEO e anteprime.
// Questo modulo la mostra/nasconde e collega i pulsanti.
const SESSION_FLAG = 'qdq:hasSession';

export function markSession(on) { try { on ? localStorage.setItem(SESSION_FLAG, '1') : localStorage.removeItem(SESSION_FLAG); } catch {} }

export function showLanding() { const el = document.getElementById('landing'); if (el) el.hidden = false; document.body.classList.add('v2-landing-on'); }
export function hideLanding() { const el = document.getElementById('landing'); if (el) el.hidden = true; document.body.classList.remove('v2-landing-on'); }

// handlers: onImport, onCreate, onInvite, onDemo, onLogin
export function bindLanding(h) {
  const map = { import: h.onImport, create: h.onCreate, invite: h.onInvite, demo: h.onDemo, login: h.onLogin };
  document.querySelectorAll('[data-landing]').forEach(b => { b.onclick = (e) => { e.preventDefault(); hideLanding(); map[b.dataset.landing]?.(); }; });
}

// Codice invito dal link (/invito/CODICE, ?invito=CODICE o #invito=CODICE).
// Si conserva nel dispositivo per 7 giorni: il link di conferma email si apre in un'altra scheda.
const INVITE_KEY = 'qdq:invite';
export function pendingInvite() {
  const q = new URLSearchParams(location.search), hsh = new URLSearchParams(location.hash.slice(1));
  const path = location.pathname.match(/^\/invito\/([A-Za-z0-9_-]{3,40})\/?$/);
  const code = q.get('invito') || hsh.get('invito') || (path && path[1]) || null;
  try {
    if (code) {
      localStorage.setItem(INVITE_KEY, JSON.stringify({ code, at: Date.now() }));
      if (path) history.replaceState(null, '', '/');
      return code;
    }
    const saved = JSON.parse(localStorage.getItem(INVITE_KEY) || 'null');
    if (saved?.code && Date.now() - saved.at < 7 * 864e5) return saved.code;
    localStorage.removeItem(INVITE_KEY);
  } catch {}
  return code;
}
export function clearPendingInvite() { try { localStorage.removeItem(INVITE_KEY); sessionStorage.removeItem('qdq:invite'); } catch {} }
