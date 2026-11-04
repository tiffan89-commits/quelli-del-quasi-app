import {KITS} from './fanta/maglie.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clubs=new Set(['atalanta','bologna','cagliari','como','fiorentina','frosinone','genoa','inter','juventus','lazio','lecce','milan','monza','napoli','parma','roma','sassuolo','torino','udinese','venezia']);
const aliases={'ac milan':'milan','as roma':'roma',internazionale:'inter','hellas verona':'verona'};
export function clubCrest(name){const raw=String(name||'').toLowerCase().trim(),club=aliases[raw]||raw;return clubs.has(club)?`<img class="slip-club-crest" src="/assets/club-crests/stemma-${club}.svg" alt="" width="25" height="28" loading="lazy" decoding="async">`:`<span class="slip-club-crest is-neutral" aria-hidden="true">${esc((KITS[name]?.code||name||'?').slice(0,3).toUpperCase())}</span>`;}
export function slipTeamLabel(name){return `<span class="slip-team-label">${clubCrest(name)}<span>${esc(name)}</span></span>`;}
