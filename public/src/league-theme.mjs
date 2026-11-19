export const PUBLIC_LEAGUE_ACCENT='#7bc8f7';
const MODE_DEFAULTS={bar:'#ffcf83',fanta:'#78e0ba'};
export const VIVID_LEAGUE_COLORS=[
 ['#ffb13d','Mandarino'],['#ffd649','Giallo sole'],['#c2f547','Lime acceso'],
 ['#49e891','Verde brillante'],['#3de8cf','Turchese acceso'],['#47d9ff','Azzurro elettrico'],
 ['#70a8ff','Blu vivo'],['#b699ff','Viola'],['#ff86ed','Fucsia vivo'],
 ['#ff7ca9','Rosa acceso'],['#ff826e','Rosso corallo'],['#ffa478','Arancio acceso'],
];
export const LEAGUE_COLORS = [
  ["#d6f77b", "Lime"],
  ["#9de4d0", "Menta"],
  ["#ffcf83", "Ambra"],
  ["#c8b6ff", "Lilla"],
  ["#ff9db4", "Rosa"],
  ["#ffab91", "Corallo"],
  ["#ffd966", "Oro"],
  ["#f5ef9b", "Limone"],
  ["#a8e6a1", "Prato"],
  ["#78e0ba", "Smeraldo"],
  ["#7ce3ed", "Turchese"],
  ["#8bd3ff", "Cielo"],
  ["#7bc8f7", "Blu"],
  ["#a9bdff", "Pervinca"],
  ["#e3b0ff", "Orchidea"],
  ["#f2a7df", "Fucsia"],
  ["#f4c4a1", "Pesca"],
  ["#e8d3b2", "Sabbia"],
  ["#e1e8ef", "Ghiaccio"],
  ["#b8d3c0", "Salvia"],
  ["#b9c9e7", "Avio"],
  ["#ffa6a6", "Rosso chiaro"],
  ["#d3b2df", "Malva"],
  ["#b8e3dc", "Acquamarina"],
  ["#f3e5bc", "Champagne"],
  ...VIVID_LEAGUE_COLORS,
];
export const LEAGUE_EMBLEMS = [
  "Q",
  "BQ",
  "QDQ",
  "FC",
  "BAR",
  "QUASI",
  "VAR",
  "XI",
  "1908",
  "1926",
  "⚽",
  "🏆",
  "🍺",
  "🔥",
  "🦅",
  "🐺",
  "🦁",
  "🐂",
  "🐉",
  "⭐",
  "⚡",
  "🎯",
  "👑",
  "🦊",
  "🐍",
  "🔱",
];
export const validMonogram=value=>typeof value==='string'&&/^[\p{L}\p{N}][\p{L}\p{N} .&_\-]{0,7}$/u.test(value);
export const validEmblem=value=>LEAGUE_EMBLEMS.includes(value)||validMonogram(value);
export const leagueName=league=>String(league?.name||'Lega').replace(/^Random League/i,'Lega pilota');
export function leagueMonogram(league){
 const stored=league?.branding?.emblem;
 if(stored&&validMonogram(stored))return stored;
 const initials=[...leagueName(league).matchAll(/(?:^|[^\p{L}\p{N}])([\p{L}\p{N}])[\p{L}\p{N}]*/gu)].slice(0,4).map(m=>m[1]).join('');
 return initials.toLocaleUpperCase('it')||'Q';
}
const hex=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value:null;
export function leagueAccent(league,mode='bar'){
 if(!league)return PUBLIC_LEAGUE_ACCENT;
 const branding=league.branding;
 return (mode==='fanta'?hex(branding?.fantaAccent):null)||hex(branding?.accent)||hex(league.accent)||hex(league.color)||MODE_DEFAULTS[mode]||PUBLIC_LEAGUE_ACCENT;
}
export function applyLeagueTheme(league,mode='bar',doc=globalThis.document){
 const accent=leagueAccent(league,mode);
 doc.documentElement.style.setProperty('--lime',accent);
 doc.documentElement.style.setProperty('--league-accent',accent);
}
export const leagueIdentityKey=league=>league&&JSON.stringify([league.name,league.branding?.emblem,league.branding?.accent,league.branding?.fantaAccent,league.branding?.motto,league.accent]);
export function paintLeagueIdentity(league,mode,doc=globalThis.document){
 applyLeagueTheme(league,mode,doc);
 const chip=doc.querySelector('#app-header .v2-league-chip');
 if(!chip||!league)return;
 const name=leagueName(league),emblem=chip.querySelector('.league-emblem');
 chip.setAttribute('aria-label','Cambia lega, '+name);
 chip.querySelector('.v2-league-name').textContent=name;
 emblem.textContent=leagueMonogram(league);
 emblem.style.setProperty('--league-accent',leagueAccent(league,mode));
}

export function linkedLeagueIdentity(league,bars=[]){
 if(!league)return league;
 const bar=bars.find(b=>b.nativeFantaLink?.leagueId===league.id);
 return bar?{...league,name:bar.name||league.name,branding:{...bar.branding,accent:leagueAccent(bar,'fanta')},accent:leagueAccent(bar,'fanta')}:league;
}
export function leagueEmblem(league,mode='bar'){
 const value=leagueMonogram(league).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const color=leagueAccent(league,mode);
 return `<span class="league-emblem" style="--league-accent:${color}" aria-hidden="true">${value}</span>`;
}
