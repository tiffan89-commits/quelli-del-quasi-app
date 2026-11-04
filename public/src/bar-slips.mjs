import {predictionStatus} from '../prediction.mjs';
import {quasiScene} from './quasi-scene.mjs';
import {inlineResultView} from './slip-results.mjs';
import {orderSlipMatches} from '../match-layout.mjs';
// "Le schedine del Bar": one table tile, one small tile per player (Quasi, name, mini-schedina, joke, profile button).
// The verdict texts load in a single request after the first paint; the tiles never wait for them.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CODES={inter:'INT',internazionale:'INT',juventus:'JUV',napoli:'NAP',roma:'ROM',asroma:'ROM',milan:'MIL',acmilan:'MIL',atalanta:'ATA',fiorentina:'FIO',bologna:'BOL',lazio:'LAZ',sslazio:'LAZ',udinese:'UDI',genoa:'GEN',parma:'PAR',torino:'TOR',como:'COM',lecce:'LEC',cagliari:'CAG',verona:'VER',hellasverona:'VER',sassuolo:'SAS',cremonese:'CRE',pisa:'PIS'};
export function teamCode(name){const key=String(name||'').toLowerCase().replace(/[^a-z]/g,'');return CODES[key]||String(name||'?').replace(/[^A-Za-zÀ-ú]/g,'').slice(0,3).toUpperCase()||'?';}
const PICKS={'Under 2.5':'U2,5','Over 2.5':'O2,5','No Goal':'NG',Goal:'GG'};
export const pickCode=p=>PICKS[p]||String(p??'—');
const ARCH_EMOJI={Conservativo:'🧯',Prudente:'📐',Random:'🎲',Incallito:'🔥','Amante del rischio':'🎰'};
export const riskTone=risk=>risk>=70?'hot':risk>=45?'mid':'cool';
export function barBetTiles(r,slip,fmt,{interactive=true}={}){
 const tag=interactive?'button':'div';
 return orderSlipMatches(r.matches.filter(m=>!m.void)).map(m=>{
  const p=slip.picks?.[m.id],f=predictionStatus(m,p,true),odd=m.odds?.[p];
  const state=f?(f.winning?'win':'lose'):'';
  return `<${tag} ${interactive?'type="button"':''} class="bar-bet ${state}" data-detail="${esc(m.id)}" data-result-row="${esc(m.id)}" data-saved-pick="${esc(p||'')}" data-result-score="${esc(JSON.stringify(m.status==='LIVE'?m.liveScore||null:m.score||null))}" aria-label="${esc(m.home)} – ${esc(m.away)}: ${esc(p||'nessuna scelta')}${odd?' a quota '+fmt(odd):''}${f?' · '+(f.winning?'Indovinata':'Sbagliata'):''}"><span class="bar-teams">${esc(teamCode(m.home))}<i>–</i>${esc(teamCode(m.away))}</span><strong data-result-pick class="${state}"><b>${esc(pickCode(p))}</b></strong><span class="bar-score" data-inline-result>${inlineResultView(m)}</span></${tag}>`;
 }).join('');
}
export function correctCount(r,slip){return r.matches.filter(m=>!m.void&&predictionStatus(m,slip.picks?.[m.id],true)?.winning).length;}
function tile({l,r,slip,me,fmt,analyzable,crown}){
 const player=l.members.find(x=>x.uid===slip.uid)||{},name=player.name||'Giocatore',total=r.matches.filter(m=>!m.void).length,right=correctCount(r,slip);
 const settled=r.matches.filter(m=>!m.void&&m.status==='FT').length;
 return `<article class="bar-tile ${me?'is-me':''}" data-bar-uid="${esc(slip.uid)}"><div class="bar-who"><button type="button" class="bar-quasi" data-quasi-member="${esc(slip.uid)}" aria-label="Guarda il Quasi di ${esc(name)}">${quasiScene(player.avatar,name,{compact:true})}</button><div class="bar-id"><h3>${esc(name)}${me?' <em>Tu</em>':''}</h3><span class="bar-archetype" data-bar-archetype>${analyzable?'Il bar sta scrivendo il verbale…':''}</span><span class="bar-risk" data-bar-risk hidden><i></i><b></b></span></div>${crown?'<span class="bar-crown" title="Più pronostici giusti della giornata">🏆</span>':''}</div>${analyzable?'<p class="bar-quip" data-bar-quip><span class="bar-skeleton"></span><span class="bar-skeleton short"></span></p>':''}<div class="bar-stub" aria-label="Schedina di ${esc(name)}"><div class="bar-stub-head"><span>SCHEDINA</span><span>${slip.stake} cr${slip.odds?' · quota '+fmt(slip.odds):''}</span></div><div class="bar-bets" data-slip-match-list>${barBetTiles(r,slip,fmt)}</div><div class="bar-stub-foot"><span>${settled?`<b>${right}</b>/${total} azzeccate`:'In attesa dei risultati'}</span><span>${slip.pointsSettled?'<b>'+fmt(slip.points)+'</b> pt':''}${slip.creditsSettled?' · ritorno <b>'+fmt(slip.prize)+'</b>':''}</span></div></div>${analyzable?`<button type="button" class="bar-profile" data-analyze="${esc(slip.uid)}" data-round="${esc(r.id)}"><span>Il profilo del pronosticatore</span><i aria-hidden="true">→</i></button>`:''}</article>`;
}
export function barSlipsView({l,r,uid,fmt,rounds,sourceOf}){
 const slips=[...(r.publicSlips||[])].sort((a,b)=>(b.uid===uid)-(a.uid===uid)||(b.points||0)-(a.points||0));
 const analyzable=!(r.pointsOnly||sourceOf(r)==='fantacalcio'),best=Math.max(0,...slips.map(s=>correctCount(r,s))),finished=r.matches.every(m=>m.void||m.status==='FT'),crowned=slips.filter(s=>finished&&best>0&&correctCount(r,s)===best&&slips.length>2);
 return `<section class="bar-table" aria-label="Le schedine del Bar"><header class="bar-head"><div><div class="eyebrow">LE SCHEDINE DEL BAR</div><h1>Ora si vede chi aveva detto <em>cosa.</em></h1><p>A giornata chiusa le previsioni diventano pubbliche. Anche quelle che avresti preferito dimenticare.</p></div><label class="bar-round">Giornata<select id="round-switch">${rounds.map(x=>`<option value="${esc(x.id)}" ${x.id===r.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label></header>${!r.closed?'<div class="notice">Le schedine degli altri e i loro profili si aprono al calcio d’inizio della prima partita della giornata.</div>':slips.length?`<div class="bar-grid">${slips.map(slip=>tile({l,r,slip,me:slip.uid===uid,fmt,analyzable,crown:crowned.includes(slip)})).join('')}</div>${analyzable?'<p class="bar-foot-note">Profili ironici costruiti sulle giocate, con crediti virtuali. Nessuna perizia medica.</p>':''}`:'<div class="notice">Nessuna schedina salvata per questa giornata.</div>'}</section>`;
}
// Fills the tiles as soon as the round verdicts arrive.
export function barVerdictPatch(root,players){
 if(!root)return;
 const max=Math.max(...players.map(p=>p.risk)),min=Math.min(...players.map(p=>p.risk));
 for(const p of players){
  const tileEl=root.querySelector(`[data-bar-uid="${CSS.escape(p.uid)}"]`);if(!tileEl)continue;
  const a=tileEl.querySelector('[data-bar-archetype]');if(a)a.textContent=`${ARCH_EMOJI[p.style]||'🎟️'} ${p.archetype}`;
  const q=tileEl.querySelector('[data-bar-quip]');if(q){q.textContent='«'+p.headline+'»';q.classList.add('is-ready');}
  const risk=tileEl.querySelector('[data-bar-risk]');if(risk){risk.hidden=false;risk.dataset.tone=riskTone(p.risk);risk.style.setProperty('--risk',p.risk+'%');risk.querySelector('b').textContent='Rischio '+p.risk;}
  const who=tileEl.querySelector('.bar-who');
  if(who&&players.length>2&&max!==min&&!who.querySelector('.bar-badge')){const badge=p.risk===max?['🎲','Il più spericolato']:p.risk===min?['🧯','Il pompiere']:null;if(badge){const b=document.createElement('span');b.className='bar-badge';b.title=badge[1];b.textContent=badge[0];who.append(b);}}
 }
}
export function barProfileView(p,{name,avatar,slip,fmt}){
 const bars=(p.history||[]).slice(-8).map(h=>`<span class="bar-hist ${h.round===p.round?'is-now':''}" title="${esc(h.title)} · rischio ${h.risk}/100"><i style="height:${Math.max(8,h.risk)}%" data-tone="${riskTone(h.risk)}"></i><small>${esc(String(h.title).replace(/^Giornata\s*/i,'G'))}</small></span>`).join('');
 const delta=p.delta?`<span class="bar-delta ${p.delta>0?'up':'down'}">${p.delta>0?'▲':'▼'} ${Math.abs(p.delta)}</span>`:'';
 const stats=[['Puntata',(slip?.stake??'—')+' cr'],['Azzeccate',p.pending?`${p.correct} su ${p.correct+p.wrong} giocate`:`${p.correct}/${p.correct+p.wrong}`],p.longshot?['Colpo più ardito',`${pickCode(p.longshot.pick)} · quota ${fmt(p.longshot.odd)}`]:null].filter(Boolean);
 return `<button type="button" class="secondary" id="close-modal">Chiudi ×</button><div class="bar-dossier"><div class="bar-dossier-top"><div class="bar-dossier-quasi">${quasiScene(avatar,name,{compact:true,eager:true})}</div><div><div class="eyebrow">IL FASCICOLO DEL BAR · ${esc(p.title)}</div><h2>${esc(p.archetype)}</h2><p class="bar-dossier-name">${esc(name)}</p></div></div><div class="bar-meter" data-tone="${riskTone(p.risk)}"><div><span>Indice di rischio</span><b>${p.risk}/100 ${delta}</b></div><div class="bar-meter-track"><i style="width:${p.risk}%"></i></div></div><blockquote class="bar-dossier-quip">«${esc(p.headline)}»</blockquote><p class="bar-dossier-text">${esc(p.short)}</p><dl class="bar-dossier-stats">${stats.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${p.evolution?`<p class="bar-dossier-evo"><b>L’evoluzione.</b> ${esc(p.evolution)}</p>`:''}${bars.length>1?`<h3>Come sta cambiando il personaggio</h3><div class="bar-hists">${bars}</div>`:''}<p class="tiny muted">${esc(p.disclaimer||'')}</p></div>`;
}
