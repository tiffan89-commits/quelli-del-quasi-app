// Chiamate dell'area pubblica (pagina iniziale, accesso, registrazione).
// - createPublicApi(): le rotte che il sito ha già (/api/register, /api/login, …), stessa forma di oggi.
// - createFakePublicApi(): per l'anteprima, risponde in memoria e non fa chiamate di rete.

import {requestJson} from '../live-channel.mjs';
const attempts=new Map();
async function post(path,data){
 let body=data;if(path!=='login'){const key=path+'\n'+JSON.stringify(data),prev=attempts.get(key);const record=prev&&Date.now()-prev.at<60000?prev:{at:Date.now(),id:crypto.randomUUID()};attempts.clear();attempts.set(key,record);body={...data,requestId:record.id};}
 return requestJson('/api/'+path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),timeoutMs:25000});
}

export function createPublicApi() {
  return {
    // Il soprannome si sceglie dopo: all'inizio è uguale allo username (il server lo richiede).
    register: ({ email, username, password,correctEmail=false }) => post('register', { ...(correctEmail?{correctEmail:true}:{}),name: username.trim(), email: email.trim(), username: username.trim().toLowerCase(), password }),
    login: ({ username, password }) => post('login', { username: username.trim(), password }),
    forgotPassword: identity => post('forgot-password', { identity: identity.trim() }),
    resendVerification: identity => post('resend-verification', { identity: identity.trim() }),
    activate: token => post('activate', { token }),
    resetPassword: (token, password) => post('reset-password', { token, password }),
    inviteInfo: code => fetch('/api/invite-info?code=' + encodeURIComponent(code)).then(r => r.ok ? r.json() : null).catch(() => null),
    features:()=>fetch('/api/features').then(r=>r.ok?r.json():{barDemo:true}),
  };
}

// ---------- Anteprima ----------
const wait = (ms = 450) => new Promise(r => setTimeout(r, ms));
const fail = (msg, status = 400) => { throw Object.assign(Error(msg), { status }); };

export function createFakePublicApi({ barDemo = false } = {}) {
  const users = [{ username: 'ilprofeta', email: 'profeta@esempio.it', password: 'quasiquasi10', verified: true }];
  return {
    async register({ email, username, password }) {
      await wait();
      const u = username.trim().toLowerCase(), e = email.trim().toLowerCase();
      if (users.some(x => x.username === u || x.email === e)) fail('Username o indirizzo email non disponibile. Se sei già registrato, accedi o recupera l\'account.');
      users.push({ username: u, email: e, password, verified: false });
      return { pendingVerification: true, message: `Ti abbiamo scritto a ${e}` };
    },
    async login({ username, password }) {
      await wait();
      const id = username.trim().toLowerCase(), u = users.find(x => x.username === id || x.email === id);
      if (!u || u.password !== password) fail('Username o password non corretti', 401);
      if (!u.verified) fail('Devi ancora confermare l\'email: apri il link che ti abbiamo mandato.', 403);
      return { ok: true, user: { username: u.username } };
    },
    async forgotPassword() { await wait(); return { message: 'Se l\'account esiste, ti abbiamo mandato un link valido 30 minuti.' }; },
    async resendVerification() { await wait(); return { message: 'Se l\'account è da confermare, ti abbiamo mandato un nuovo link valido 24 ore.' }; },
    async activate(token) { await wait(); if (token === 'scaduto') fail('Link non valido o scaduto. Richiedine uno nuovo.'); return { message: 'Account attivo: ora puoi accedere.' }; },
    async resetPassword(token, password) { await wait(); if (token === 'scaduto') fail('Link non valido o scaduto. Richiedine uno nuovo.'); return { message: 'Password cambiata: accedi con quella nuova.' }; },
    async inviteInfo(code) { await wait(200); return /^[A-Z0-9-]{4,}$/i.test(code) ? { code, league: 'Lega dei Quasi', inviter: 'Il Geometra', members: 8, maxMembers: 12 } : null; },
    async features() { return { barDemo }; },
  };
}
