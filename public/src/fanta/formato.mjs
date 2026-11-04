// Piccole utilità di formattazione condivise dalle schermate del Fanta.

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Fantapunti con la virgola: 74,5 · 68 → "68,0" solo se decimals=1 forzato.
export const pts = (n, decimals = 1) => n==null||!Number.isFinite(Number(n))?'–':Number(n).toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const odd = n => Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "1g 04:12" oppure "04:12:09" sotto le 24 ore; null se la scadenza è passata.
export function countdown(iso, now = Date.now()) {
  let s = Math.floor((Date.parse(iso) - now) / 1000);
  if (!(s > 0)) return null;
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const two = v => String(v).padStart(2, '0');
  return d ? `${d}g ${two(h)}:${two(m)}` : `${two(h)}:${two(m)}:${two(s)}`;
}

export const dayTime = iso => !iso?'In attesa':!Number.isFinite(Date.parse(iso))?String(iso):new Date(iso).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',timeZone:'Europe/Rome' });
export const fixtureTime = iso => !iso?'In attesa':!Number.isFinite(Date.parse(iso))?String(iso):new Date(iso).toLocaleString('it-IT',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
export const timeAgo = (iso, now = Date.now()) => {
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} ${h === 1 ? 'ora' : 'ore'} fa` : dayTime(iso);
};

export const OUTCOME = { V: 'Vittoria', N: 'Pareggio', P: 'Sconfitta' };

export function extremeClass(rows,key,value){const values=rows.map(r=>r[key]).filter(Number.isFinite);if(!values.length)return '';const hi=Math.max(...values),lo=Math.min(...values);return hi===lo?'':value===hi?'is-best-score':value===lo?'is-worst-score':'';}

// Current round first, then upcoming rounds, followed by the archive (newest first).
export function orderRounds(rows,current,key='number'){const rank=x=>x[key]===current?0:x[key]>current?1:2;return [...rows].sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?b[key]-a[key]:a[key]-b[key]));}
