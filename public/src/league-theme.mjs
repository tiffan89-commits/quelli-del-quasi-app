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
export function validEmblem(value) {
  return (
    LEAGUE_EMBLEMS.includes(value) ||
    /^[\p{L}\p{N}][\p{L}\p{N} .&_\-]{0,7}$/u.test(value)
  );
}

export function leagueAccent(league){return league?.branding?.accent||league?.accent||league?.color||'#7bc8f7';}
export function applyLeagueTheme(league){const accent=leagueAccent(league);document.documentElement.style.setProperty('--lime',accent);document.documentElement.style.setProperty('--league-accent',accent);}
export function linkedLeagueIdentity(league,bars=[]){if(!league)return league;const bar=bars.find(b=>b.nativeFantaLink?.leagueId===league?.id);return bar?{...league,branding:bar.branding,accent:leagueAccent(bar)}:league;}
export function leagueEmblem(league){
 const value=String(league?.branding?.emblem||'Q').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const color=leagueAccent(league).replace(/[^#a-z0-9(),. %-]/gi,'');
 return `<span class="league-emblem" style="--league-accent:${color}" aria-hidden="true">${value}</span>`;
}
