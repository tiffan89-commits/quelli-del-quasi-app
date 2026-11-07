import {pitchEvents,eventCounts,ballIcon,assistBootIcon} from '../pitch-events.mjs';
import {statNumber,formatStatNumber} from './stat-number.mjs';
import {playerVisual} from './player-visual.mjs';
// Pagina "Giornata": scelta della giornata e della sfida, formazioni con voti e fantavoti,
// modificatore difesa, totale; scheda del singolo giocatore con la scomposizione del voto.
// Funzioni pure: ricevono le risposte di api.round() / api.matchup() e restituiscono HTML.
import { esc, pts, timeAgo, fixtureTime } from './formato.mjs';
import { shirt } from './maglie.mjs';
import {compareStat} from './stat-comparison.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const ROLE_GROUPS = { P: 'Porta', D: 'Difesa', C: 'Centrocampo', A: 'Attacco' };
const STATE_LABEL = { 'calcolata': ['Ufficiale', 'is-official'], 'in-corso': ['Live · provvisoria', 'is-live'], 'schierata': ['Da giocare', 'is-todo'], 'da-schierare': ['Da giocare', 'is-todo'] };

const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + formatStatNumber(Math.abs(n));
export const formatPlayerStat=(value,unit='')=>formatStatNumber(value);
const vote = n => n == null ? '–' : pts(n, n % 1 ? 1 : 0);
const goalsLabel = g => g === 1 ? '1 gol' : `${g} gol`;

function roundHead(r) {
  const [label, cls] = STATE_LABEL[r.round.state] || STATE_LABEL['da-schierare'];
  const n = r.round.number, last = r.rounds.length;
  const detail = r.round.state === 'in-corso' ? ` · ${r.round.matchesDone} partite su ${r.round.matchesTotal} finite` : '';
  return `<header class="fanta-round-head">
    <button type="button" class="fanta-step" data-round="${n - 1}" ${n <= 1 ? 'disabled' : ''} aria-label="Giornata precedente">‹</button>
    <div class="fanta-round-title"><span class="eyebrow">Giornata</span><h1>${n}</h1>
      <span class="fanta-status ${cls}">${label}${detail}</span></div>
    <button type="button" class="fanta-step" data-round="${n + 1}" ${n >= last ? 'disabled' : ''} aria-label="Giornata successiva">›</button>
  </header>`;
}

function matchupRail(r, activeId) {
  const lineupMark = s => s.lineupSaved ? '<small class="fanta-mu-saved" title="Formazione schierata">✓</small>' : '<small class="fanta-mu-missing" title="Formazione non ancora schierata">…</small>';
  const side = s => `<span class="fanta-mu-team">${teamLogo(s.team)}<b>${esc(s.team.name)}</b>${s.goals != null ? `<strong>${s.goals}</strong>` : lineupMark(s)}</span>`;
  return `<div class="fanta-mu-rail" role="list" aria-label="Sfide della giornata">${r.matchups.map(m => `
    <button type="button" role="listitem" class="fanta-mu${m.id === activeId ? ' is-active' : ''}${m.isMine ? ' is-mine' : ''}" data-matchup="${esc(m.id)}" aria-pressed="${m.id === activeId}">
      ${m.isMine ? '<small class="fanta-mu-tag">La tua</small>' : ''}${side(m.home)}${side(m.away)}
    </button>`).join('')}</div>`;
}

function scoreboard(m, side) {
  const col = (s, key) => `<button type="button" class="fanta-sb-team${side === key ? ' is-active' : ''}" data-side="${key}" aria-pressed="${side === key}">
      ${teamLogo(s.team,{className:'is-medium'})}
      <b>${esc(s.team.name)}</b>
      <span class="fanta-sb-points">${s.total == null ? '–' : pts(s.total)}</span>
    </button>`;
  const known = m.home.goals != null && m.away.goals != null;
  return `<div class="fanta-sb">
    ${col(m.home, 'home')}
    <div class="fanta-sb-mid"><strong>${known ? `${m.home.goals}–${m.away.goals}` : 'vs'}</strong><small>${m.official ? 'Finale' : known ? 'provvisorio' : 'da giocare'}</small></div>
    ${col(m.away, 'away')}
  </div>
  <p class="fanta-sb-hint">Tocca una squadra per vedere la sua formazione.</p>`;
}

export function events(e = {}) {
  e=eventCounts(e);
  const out = [];
  for (let i = 0; i < e.goals; i++) out.push('<i class="ev ev-goal" role="img" aria-label="Gol" title="Gol">'+ballIcon()+'</i>');
  for(let i=0;i<Math.min(20,Number(e.assists)||0);i++)out.push('<i class="ev ev-assist" role="img" aria-label="Assist" title="Assist">'+assistBootIcon()+'</i>');
  if (e.yellow) out.push('<i class="ev ev-yellow" role="img" aria-label="Cartellino giallo" title="Ammonizione"></i>');
  if (e.red) out.push('<i class="ev ev-red" role="img" aria-label="Cartellino rosso" title="Espulsione"></i>');
  if(e.ownGoals)out.push('<i class="ev ev-own" role="img" aria-label="Autogol" title="Autogol">'+ballIcon(true)+'</i>');
  if (e.penSaved) out.push('<i class="ev ev-pen" title="Rigore parato">RP</i>');
  if (e.penMissed) out.push('<i class="ev ev-pen is-bad" title="Rigore sbagliato">RS</i>');
  if (e.conceded) out.push(`<i class="ev ev-conceded" title="Gol subiti">−${e.conceded}</i>`);
  return `<span class="fanta-events">${out.join('')}</span>`;
}

function playerRow(p) {
  const matchInfo = `${esc(p.club)} · ${p.home ? 'vs' : '@'} ${esc(p.opponent)}`;
  let right;
  if (p.status === 'to-play') right = `<span class="fanta-p-when">${esc(fixtureTime(p.kickoff))}</span>`;
  else if (p.status === 'sv') right = '<span class="fanta-p-fv">s.v.</span>';
  else right = `<span class="fanta-p-fv">${vote(p.fantavote)}</span>`;
  const note = p.replacedBy ? `<small class="fanta-p-sub is-out">Senza voto · entra ${esc(p.replacedBy)}</small>`
    : p.enteredFor ? `<small class="fanta-p-sub is-in">Entra al posto di ${esc(p.enteredFor)}</small>`
    : p.status === 'playing' ? `<small class="fanta-p-sub is-live">In campo · ${p.minutes}'</small>` : '';
  const clickable = p.status === 'voted' || p.status === 'playing' || p.status === 'sv';
  const tag = clickable ? 'button type="button"' : 'div';
  return `<${tag} class="fanta-p is-${p.status}${p.enteredFor ? ' is-entered' : ''}"${clickable ? ` data-player="${esc(p.id)}"` : ''}>
    <span class="fanta-role is-${p.role}" title="${ROLE_NAMES[p.role]}">${p.role}</span>
    <span class="fanta-p-name"><b><span>${esc(p.name)}</span>${events(p.events)}</b><small>${matchInfo}</small>${note}</span>
    ${right}
  </${tag.split(' ')[0]}>`;
}

// Vista "Campo": attacco in alto, porta in basso. Chi è entrato dalla panchina prende il posto del titolare senza voto.
function token(p, replaced) {
  const clickable = p.status === 'voted' || p.status === 'playing' || p.status === 'sv';
  const tag = clickable ? 'button' : 'div';
  const surname = p.name.includes('. ') ? p.name.split('. ').slice(1).join('. ') : p.name;
  const value = p.status === 'to-play' ? `<em class="is-when">${esc(fixtureTime(p.kickoff))}</em>`
    : p.status === 'sv' ? '<em class="is-sv">s.v.</em>'
    : `<em class="${p.status === 'playing' ? 'is-live' : ''}">${vote(p.fantavote)}</em>`;
  return `<${tag}${clickable ? ' type="button"' : ''} class="fanta-token is-${p.status}${replaced ? ' is-entered' : ''}"${clickable ? ` data-player="${esc(p.id)}"` : ''}
    title="${esc(p.name)}${replaced ? ' · entrato al posto di ' + esc(replaced) : ''}">
    <span class="fanta-token-shirt">${playerVisual(p)}<span class="fanta-role is-${p.role}" title="${ROLE_NAMES[p.role]}">${p.role}</span></span>
    <b>${esc(surname)}</b>${value}${pitchEvents(replaced?{...p,enteredFor:replaced}:p)}
  </${tag}>`;
}

function pitch(s) {
  const onField = s.starters.map(p => {
    const sub = p.replacedBy && s.bench.find(b => b.enteredFor === p.name);
    return sub ? { player: sub, replaced: p.name } : { player: p };
  });
  return `<div class="fanta-pitch" aria-label="Formazione in campo ${esc(s.formation)}">
    <div class="fanta-pitch-lines" aria-hidden="true"></div>
    ${'ACDP'.split('').map(role => `<div class="fanta-pitch-row">${onField.filter(x => x.player.role === role).map(x => token(x.player, x.replaced)).join('')}</div>`).join('')}
  </div>`;
}

function lineup(s, notStarted, view) {
  const toggle = `<div class="fanta-view" role="group" aria-label="Vista formazione">
    <button type="button" data-view="lista" aria-pressed="${view !== 'campo'}" class="${view !== 'campo' ? 'is-active' : ''}">Lista</button>
    <button type="button" data-view="campo" aria-pressed="${view === 'campo'}" class="${view === 'campo' ? 'is-active' : ''}">Campo</button>
  </div>`;
  const groups = view === 'campo' ? pitch(s) : 'PDCA'.split('').map(role => {
    const list = s.starters.filter(p => p.role === role);
    return list.length ? `<div class="fanta-group"><h4>${ROLE_GROUPS[role]}</h4>${list.map(playerRow).join('')}</div>` : '';
  }).join('');
  const benchUsed = s.bench.filter(p => p.enteredFor).length;
  return `<div class="fanta-lineup">
    ${notStarted && s.savedAt ? `<p class="fanta-saved">Formazione salvata ${esc(timeAgo(s.savedAt))} · visibile a tutta la lega, si può cambiare fino alla scadenza</p>` : ''}
    <div class="fanta-lineup-head"><h3>Titolari <span>${esc(s.formation)}</span></h3>${toggle}</div>
    ${view === 'campo' ? '' : '<div class="fanta-cols-row"><span class="fanta-cols"><span>Fantavoto</span></span></div>'}
    ${groups}
    ${s.bench.some(p=>p.enteredFor)?'<details class="fanta-bench" open><summary>Subentrati</summary>'+s.bench.filter(p=>p.enteredFor).map(playerRow).join('')+'</details>':''}
    ${s.bench.some(p=>!p.enteredFor)?'<details class="fanta-bench"><summary>A disposizione</summary>'+s.bench.filter(p=>!p.enteredFor).map(playerRow).join('')+'</details>':''}
  </div>`;
}

function modifierCard(mod) {
  if (!mod.applies) {
    return `<section class="fanta-mod is-off"><h3>Modificatore difesa</h3><p>${esc(mod.reason)}</p><p class="fanta-note">${esc(mod.rule)}</p></section>`;
  }
  // Fasce larghe uguali; la tacca si posiziona dentro la fascia attiva (le fasce estreme vanno da 5 e fino a 8).
  const width = 100 / mod.bands.length;
  const at = mod.bands.findIndex(b => b.bonus === mod.bonus), band = mod.bands[at];
  const lo = band.from ?? 5, hi = band.to ?? 8;
  const mark = (at + Math.min(1, Math.max(0, (mod.average - lo) / (hi - lo)))) * width;
  const bands = mod.bands.map((b, i) => {
    const label = b.from == null ? `sotto ${pts(b.to)}` : b.to == null ? `da ${pts(b.from)}` : `${pts(b.from)}–${pts(b.to)}`;
    return `<span class="fanta-band${i === at ? ' is-active' : ''}" style="left:${i * width}%;width:${width}%"><b>+${b.bonus}</b><small>${label}</small></span>`;
  }).join('');
  return `<section class="fanta-mod">
    <div class="fanta-mod-head"><h3>Modificatore difesa</h3><strong>+${mod.bonus}</strong></div>
    <ul class="fanta-mod-players">${mod.players.map(p => `<li><span class="fanta-role is-${p.role}">${p.role}</span>${esc(p.name)}<b>${vote(p.vote)}</b></li>`).join('')}</ul>
    <div class="fanta-bands" aria-label="Fasce del modificatore">${bands}<i class="fanta-band-mark" style="left:${mark}%"></i></div>
    <p class="fanta-mod-avg">Media <b>${pts(mod.average, 2)}</b> → <b>+${mod.bonus}</b></p>
    <p class="fanta-note">${esc(mod.rule)}</p>
  </section>`;
}

function totals(s, official) {
  return `<section class="fanta-total" aria-label="Totale ${esc(s.team.name)}">
    <div><span>Somma fantavoti <small>(${s.withVote} a voto)</small></span><b>${pts(s.fantapoints)}</b></div>
    <div><span>Modificatore difesa</span><b>${s.modifier.applies ? '+' + s.modifier.bonus : '–'}</b></div>
    <div class="is-sum"><span>Totale${official ? '' : ' provvisorio'}</span><b>${pts(s.total)}</b><em>${goalsLabel(s.goals)}</em></div>
    <p class="fanta-note">66 punti fanno 1 gol, poi un gol ogni 6 punti in più.</p>
  </section>`;
}

function teamPanel(m, side, view) {
  const s = m[side];
  if (s.hidden) {
    return `<div class="fanta-empty is-inline"><h2>${esc(s.team.name)}</h2><p>${esc(s.hiddenReason)}</p>
      ${s.needsLineup ? '<button type="button" class="primary" data-go="formazione">Schiera la formazione</button>' : ''}</div>`;
  }
  const started = [...s.starters, ...s.bench].some(p => p.status !== 'to-play');
  const notStarted = m.state === 'da-schierare' || m.state === 'schierata';
  return `${s.historical&&s.imported?'<p class="fanta-note">Voti storici archiviati</p>':''}${lineup(s, notStarted, view)}${started ? '<details class="fanta-block"><summary>Punti e dettagli</summary>'+totals(s, m.official) + modifierCard(s.modifier)+'</details>' : '<p class="fanta-note is-wait">Voti e punti compaiono quando iniziano le partite.</p>'}`;
}

export function renderGiornata({ round, matchup, side, view = 'campo' }) {
  if (!round) return '<div class="fanta-loading" role="status">Carichiamo la giornata…</div>';
  return `<div class="fanta-round">
    ${roundHead(round)}
    ${matchupRail(round, matchup?.id)}
    ${matchup ? scoreboard(matchup, side) + teamPanel(matchup, side, view) + comparison(matchup) : '<div class="fanta-loading" role="status">Carichiamo la sfida…</div>'}
  </div>`;
}

function comparison(m){
 const c=m.comparison;if(!c)return '';
 return `<details class="fanta-block"><summary>Il confronto del bar</summary>
 ${c.historical?'<p class="fanta-note">Risultato dell’archivio storico. Il confronto parte dalle giornate calcolate dal Quasi.</p>':''}
 <table class="fanta-table"><thead><tr><th>Squadra</th><th>Quasi</th><th>Leghe</th><th>Scarto</th></tr></thead><tbody>${['home','away'].map(k=>`<tr><td>${esc(m[k].team.name)}</td><td>${c[k].ours==null?'–':pts(c[k].ours)}</td><td>${c[k].points==null?'–':pts(c[k].points)}</td><td>${c[k].delta==null?'–':signed(c[k].delta)}</td></tr>`).join('')}</tbody></table></details>`;
}

export function findPlayer(matchup, id) {
  for (const key of ['home', 'away']) {
    const s = matchup?.[key];
    const p = s && !s.hidden && [...s.starters, ...s.bench].find(x => x.id === id);
    if (p) return p;
  }
  return null;
}

// Scheda del giocatore: dal 6 di partenza al voto, poi dal voto al fantavoto, con la spiegazione.
export function renderPlayerSheet(p, { official } = {}) {
  const head = `<div class="fanta-ps-head">
      <span class="fanta-role is-${p.role} lg">${p.role}</span>
      <div><h2 id="fanta-sheet-title">${esc(p.name)}</h2><small>${ROLE_NAMES[p.role]} · ${esc(p.club)} ${p.home ? 'vs' : '@'} ${esc(p.opponent)}${p.score ? ` ${p.score[0]}–${p.score[1]}` : ''}${p.minutes ? ` · ${p.minutes}'` : ''}</small></div>
      <button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button>
    </div>`;
  if (p.status === 'sv') {
    return `${head}<div class="fanta-ps-body"><p class="fanta-why">${esc(p.why||'Il voto per questa prestazione non è disponibile.')}</p>
      ${p.replacedBy ? `<p class="fanta-note">Al suo posto conta ${esc(p.replacedBy)}, dalla panchina.</p>` : ''}</div>`;
  }
  if(!p.breakdown||!Array.isArray(p.breakdown.lines)||!Array.isArray(p.breakdown.bonus))return `${head}<div class="fanta-ps-body"><div class="fanta-ps-scores"><div><span>Voto</span><strong>${vote(p.vote)}</strong></div><div class="is-fv"><span>Fantavoto</span><strong>${vote(p.fantavote)}</strong></div></div>${events(p.events)}<p class="fanta-why">I dettagli di questa prestazione non sono disponibili.</p></div>`;
  const row = (label, value, cls = '') => `<li class="${cls}"><span>${label}</span><b>${value}</b></li>`;
  const lines = p.breakdown.lines.map(l => row(
    l.kind === 'ai' ? `<em class="fanta-ai">AI</em>${esc(l.label)}` : esc(l.label), signed(l.delta), l.kind === 'ai' ? 'is-ai' : l.kind === 'context' ? 'is-context' : '')).join('');
  const bonus = p.breakdown.bonus.map(b => row(esc(b.label), signed(b.delta), b.delta > 0 ? 'is-plus' : 'is-minus')).join('');
  const stats = (Array.isArray(p.stats)?p.stats:[]).map(s => {
    const feature=p.individual?.features?.[s.key],rate=s.unit==='%',factor=rate?100:1;
    const comparison=s.comparison||compareStat(s.value,s.avg,{rate,scale:feature?.scale?feature.scale*factor*(rate?1:Math.sqrt(Math.max(.25,Math.min(1.5,(p.minutes||90)/90)))):0,policy:rate?{scaleFraction:.4,volumeFraction:.2,rateFloor:6}:undefined}).comparison;
    const state=comparison==='above'?'is-up':comparison==='below'?'is-down':comparison==='near'?'is-neutral':'';
    return `<div class="fanta-stat ${state}"><b>${formatPlayerStat(s.value,s.unit)}${s.unit||''}</b><span>${esc(s.label)}</span>${s.successes!=null&&s.attempts!=null?`<small>${s.successes} su ${s.attempts}</small>`:''}<small>${esc(s.referenceLabel||'riferimento')} ${formatPlayerStat(s.avg,s.unit)}${s.unit||''}</small>${comparison==='near'?'<small class="fanta-stat-neutral-note">In linea con il ruolo</small>':''}</div>`;
  }).join('');
  return `${head}
  <div class="fanta-ps-body">
    <div class="fanta-ps-scores">
      <div><span>Voto</span><strong>${vote(p.vote)}</strong></div>
      <div class="is-fv"><span>Fantavoto</span><strong>${vote(p.fantavote)}</strong></div>
    </div>
    ${p.status === 'playing' ? '<p class="fanta-status is-live">Partita in corso: il voto può cambiare</p>' : ''}
    ${p.confidence?`<p class="fanta-note">Copertura dei dati ${p.confidence.value>=.7?'alta':p.confidence.value>=.4?'media':'bassa'}</p>`:''}<section><h3>Perché ${vote(p.vote)}?</h3><p class="fanta-why">${esc(p.why)}</p></section>
    <details class="fanta-block"><summary>Come si arriva al voto</summary>
      <ul class="fanta-calc">${row('Base', pts(p.breakdown.start, 0), 'is-start')}${lines}${p.rawVote!=null?row('Voto grezzo',formatPlayerStat(p.rawVote)) : ''}${row('Voto', vote(p.vote), 'is-total')}</ul></details>
    <details class="fanta-block"><summary>Bonus e malus</summary>
      <ul class="fanta-calc">${row('Voto', vote(p.vote), 'is-start')}${bonus || '<li class="is-empty"><span>Nessun bonus o malus</span><b>±0</b></li>'}${row('Fantavoto', vote(p.fantavote), 'is-total')}</ul></details>
    <details class="fanta-block"><summary>I numeri della partita</summary><p class="fanta-note">Giallo: vicino al riferimento, senza penalità. Gli scarti oltre la fascia neutra pesano gradualmente.</p><div class="fanta-stats">${stats||'<p class="fanta-note">Statistiche non disponibili.</p>'}</div></details>
    <p class="fanta-note">${official ? 'Calcolo definitivo sui dati disponibili.' : 'Calcolo provvisorio: si aggiorna con i dati della partita.'}</p>
  </div>`;
}
import {teamLogo} from './team-logo.mjs';
