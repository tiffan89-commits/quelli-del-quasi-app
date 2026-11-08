import {pitchPerformance,hasPitchPerformance,eventCounts,ballIcon,assistBootIcon} from '../pitch-events.mjs';
import {pitchFixture,playerSurname} from '../player-label.mjs';
import {renderPitchFlip} from '../lineup-pitch.mjs';
import {statNumber,formatStatNumber} from './stat-number.mjs';
import {playerVisual} from './player-visual.mjs';
// Pagina "Giornata": scelta della giornata e della sfida, formazioni con voti e fantavoti,
// modificatore difesa, totale; scheda del singolo giocatore con la scomposizione del voto.
// Funzioni pure: ricevono le risposte di api.round() / api.matchup() e restituiscono HTML.
import { esc, pts } from './formato.mjs';
import {compareStat} from './stat-comparison.mjs';

const ROLE_NAMES = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const STATE_LABEL = { 'calcolata': ['Ufficiale', 'is-official'], 'in-corso': ['Live · provvisoria', 'is-live'], 'schierata': ['Da giocare', 'is-todo'], 'da-schierare': ['Da giocare', 'is-todo'] };

const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + formatStatNumber(Math.abs(n));
export const formatPlayerStat=(value,unit='')=>formatStatNumber(value);
const vote = n => n == null ? '–' : pts(n, n % 1 ? 1 : 0);

function matchupRail(r, matchup, activeId, side) {
  return `<div class="fanta-mu-rail" aria-label="Sfide della giornata">${r.matchups.map(m => {
    const selected=m.id===activeId, score=selected&&matchup?matchup:m;
    const team=(key,i)=>{
      const data=score[key],entry=m[key];
      const value=data.total??data.points, label=key===side&&selected;
      return `<button type="button" class="fanta-mu-team${label?' is-side':''}" data-matchup="${esc(m.id)}" data-live-side="${key}" ${selected&&matchup?`data-pitch-tab="${i}" aria-selected="${label}" role="tab"`:`aria-pressed="${label}"`}>
        ${teamLogo(entry.team)}<b>${esc(entry.team.name)}</b>${Number.isFinite(value)?`<small class="live-mu-points">${pts(value)} FP</small>`:''}<strong>${data.goals??(entry.lineupSaved?'✓':'–')}</strong>
      </button>`;
    };
    return `<div class="fanta-mu${selected?' is-active':''}${m.isMine?' is-mine':''}" ${selected&&matchup?'role="tablist" aria-label="Formazioni della sfida"':''}>${team('home',0)}${team('away',1)}</div>`;
  }).join('')}</div>`;
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

// Vista "Campo": attacco in alto, porta in basso. Chi è entrato dalla panchina prende il posto del titolare senza voto.
function token(p, replaced) {
  const clickable = p.id!=null;
  const tag = clickable ? 'button' : 'div';
  const surname = playerSurname(p);
  const performance = replaced ? {...p,enteredFor:replaced} : p;
  const playing = hasPitchPerformance(performance);
  return `<${tag}${clickable ? ' type="button"' : ''} class="fanta-token is-${p.status}${replaced ? ' is-entered' : ''}"${clickable ? ` data-player="${esc(p.id)}" aria-haspopup="dialog"` : ''}
    title="${esc(p.name)}${replaced ? ' · entrato al posto di ' + esc(replaced) : ''}">
    <span class="fanta-token-shirt">${playerVisual(p,{back:true})}<span class="fanta-role is-${p.role}" title="${ROLE_NAMES[p.role]}">${p.role}</span></span>
    <b>${esc(surname)}</b>${playing?'':pitchFixture(p)}${pitchPerformance(performance,playing)}
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

function liveTeam(s,flipped){
  if(s.hidden)return `<div class="fanta-empty is-inline"><p>${esc(s.hiddenReason)}</p>${s.needsLineup?'<button type="button" class="primary" data-go="formazione">Schiera la formazione</button>':''}</div>`;
  const field=s.starters.length?pitch(s):'<p class="fanta-empty is-inline">Formazione non ancora salvata.</p>';
  const bench=`<div class="pitch-bench-room live-studio-bench"><div class="bench-room-label"><b>Panchina</b><span>${s.bench.length} giocatori</span></div>
    ${s.bench.length?`<div class="live-studio-reserves">${s.bench.map(p=>token(p,p.enteredFor)).join('')}</div>`:'<p class="muted">Panchina vuota.</p>'}</div>`;
  return renderPitchFlip(field,bench,'Panchina',flipped);
}

export function renderGiornata({round,matchup,matchupId,side='home',flips=new Set(),error}){
  const n=round?.round.number,[label,cls]=STATE_LABEL[round?.round.state]||STATE_LABEL['da-schierare'];
  const progress=round?.round.state==='in-corso'?` · ${round.round.matchesDone}/${round.round.matchesTotal} finite`:'';
  return `<section class="fs fanta-live-studio" aria-label="Studio Live">
    <header class="fs-head"><button type="button" class="fs-close" data-action="close-live-studio" aria-label="Chiudi Studio Live">×</button>
      <div class="fs-title"><h1>Studio Live${n?' · Giornata '+n:''}</h1>${n?`<small class="${cls}">${label}${progress}</small>`:''}</div>
      ${n?`<button type="button" class="fanta-step" data-round="${n-1}" ${n<=1?'disabled':''} aria-label="Giornata precedente">‹</button><button type="button" class="fanta-step" data-round="${n+1}" ${n>=round.rounds.length?'disabled':''} aria-label="Giornata successiva">›</button>`:''}
    </header>
    <div class="fs-stage">
      ${round?matchupRail(round,matchup,matchupId||matchup?.id,side):''}
      ${matchup?`<div class="studio-live-lineup lineup-paged"><div class="pitch-slides" aria-label="Formazioni e voti live">
        ${['home','away'].map((key,i)=>`<section class="pitch-team" data-pitch-team="${i}" aria-label="Formazione ${esc(matchup[key].team.name)}">${liveTeam(matchup[key],flips.has(i))}</section>`).join('')}
      </div></div>`:`<p class="fanta-loading" role="status">${esc(error||(round?(round.matchups.length?'Carichiamo la sfida…':'Nessuna sfida per questa giornata.'):'Carichiamo la giornata…'))}</p>`}
    </div>
  </section>`;
}

export function findPlayer(matchup,id,side) {
  for (const key of side?[side]:['home','away']) {
    const s = matchup?.[key];
    const p = s && !s.hidden && [...s.starters, ...s.bench].find(x => String(x.id) === String(id));
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
  if(!p.breakdown||!Array.isArray(p.breakdown.lines)||!Array.isArray(p.breakdown.bonus))return `${head}<div class="fanta-ps-body"><div class="fanta-ps-scores"><div><span>Voto</span><strong>${vote(p.vote)}</strong></div><div class="is-fv"><span>Fantavoto</span><strong>${vote(p.fantavote)}</strong></div></div>${events(p.events)}<p class="fanta-why">${esc(p.why||(hasPitchPerformance(p)?'I dettagli di questa prestazione non sono disponibili.':'Voto non ancora disponibile.'))}</p></div>`;
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
