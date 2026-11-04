// Controlli dei campi di accesso e registrazione, mentre si scrive. Funzioni pure: valore → messaggio o null.
// Le stesse regole le applica il server (account.mjs): qui servono solo a dire subito cosa non va.

export const PASSWORD_MIN = 10;

export function checkEmail(v) {
  const s = String(v || '').trim();
  if (!s) return 'Scrivi la tua email';
  if (s.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)) return 'Controlla l\'email: manca qualcosa (es. nome@gmail.com)';
  return null;
}

export function checkUsername(v) {
  const s = String(v || '').trim();
  if (!s) return 'Scegli uno username';
  if (s.length < 3) return `Ancora ${3 - s.length} ${3 - s.length === 1 ? 'carattere' : 'caratteri'}: almeno 3`;
  if (s.length > 60) return 'Massimo 60 caratteri';
  if (s.toLowerCase()==='tiffano') return 'Username non disponibile';
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return 'Solo lettere, numeri, punto, trattino e trattino basso (niente spazi)';
  return null;
}

export function checkPassword(v) {
  const s = String(v || '');
  if (!s) return 'Scegli una password';
  if (s.length < PASSWORD_MIN) return `Ancora ${PASSWORD_MIN - s.length} ${PASSWORD_MIN - s.length === 1 ? 'carattere' : 'caratteri'}: almeno ${PASSWORD_MIN}`;
  if (s.length > 200) return 'Massimo 200 caratteri';
  return null;
}

export const checkRequired = label => v => String(v || '').trim() ? null : label;

// Robustezza indicativa (0–4) per la barra sotto la password. Non blocca: blocca solo la lunghezza minima.
export function passwordStrength(v) {
  const s = String(v || '');
  if (!s) return { score: 0, label: '' };
  let score = 0;
  if (s.length >= PASSWORD_MIN) score++;
  if (s.length >= 14) score++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
  if (/\d/.test(s) && /[^a-zA-Z0-9]/.test(s)) score++;
  if (/^(.)\1+$/.test(s) || /^(1234567890|password|qwerty)/i.test(s)) score = 1;
  if (s.length < PASSWORD_MIN) return { score: 1, label: 'Troppo corta' };
  score = Math.max(score, 1);
  return { score, label: ['', 'Debole', 'Discreta', 'Buona', 'Ottima'][score] };
}

// Dal dominio dell'email: pulsante per aprire la casella giusta dopo la registrazione.
export function mailboxFor(email) {
  const d = String(email || '').split('@')[1]?.toLowerCase() || '';
  if (/^(gmail|googlemail)\.com$/.test(d)) return { label: 'Apri Gmail', url: 'https://mail.google.com/mail/u/0/#search/quellidelquasi' };
  if (/^(outlook|hotmail|live|msn)\./.test(d)) return { label: 'Apri Outlook', url: 'https://outlook.live.com/mail/' };
  if (/^(yahoo|ymail)\./.test(d)) return { label: 'Apri Yahoo Mail', url: 'https://mail.yahoo.com/' };
  if (/^(libero|inwind|iol|blu)\.it$/.test(d)) return { label: 'Apri Libero Mail', url: 'https://login.libero.it/' };
  if (/^(icloud|me|mac)\.com$/.test(d)) return { label: 'Apri iCloud Mail', url: 'https://www.icloud.com/mail' };
  return null;
}
