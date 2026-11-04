import {quasiScene} from './quasi-scene.mjs';
import {barBetTiles} from './bar-slips.mjs';
import {esc} from './fanta/formato.mjs';
import {predictionStatus} from '../prediction.mjs';
import {isClosed} from './slip-state.mjs';
export function rivalry(data,a,b) {
  const days=(data?.history||[]).map(r=>({title:r.title,a:r.players.find(p=>p.uid===a),b:r.players.find(p=>p.uid===b)})).filter(r=>r.a&&r.b);
  return {days,aWins:days.filter(r=>r.a.points>r.b.points).length,bWins:days.filter(r=>r.b.points>r.a.points).length,draws:days.filter(r=>r.a.points===r.b.points).length};
}
export function recapForRound(data,round){
 if(!round||data?.recap?.round===round.id)return data?.recap||null;
 if(!round.settled)return null;
 const players=data?.history?.find(h=>h.id===round.id)?.players||[];
 if(!players.length)return null;
 const points=Math.max(...players.map(p=>Number(p.points)||0));
 const almost=players.filter(p=>p.wrong===1).flatMap(p=>{
  const match=round.matches.find(m=>!m.void&&predictionStatus(m,p.picks?.[m.id],true)?.winning===false);
  return match?[{...p,match:match.home+' – '+match.away,pick:p.picks[match.id],potential:p.odds?Math.round(p.odds*p.stake*100)/100:null}]:[];
 });
 return {round:round.id,title:round.title,points,winners:players.filter(p=>Number(p.points)===points).map(p=>p.uid),participants:players.length,almost,surprise:null};
}
export function communityView(league,source,user,opponent,esc,fmt,competitionKey,round) {
  const data=source==='fantacalcio'?league.community?.competitions?.[competitionKey]:league.community?.seriea, recap=recapForRound(data,round),waiting=round&&isClosed(round)&&!recap;
  const name=id=>league.members.find(m=>m.uid===id)?.name || 'Giocatore';
  const badge=league.branding?.emblem || 'Q';
  const members=league.members.filter(m=>m.uid!==user.id);
  const rival=members.find(m=>m.uid===opponent)||members[0];
  const vs=rival ? rivalry(data,user.id,rival.uid) : null;
  return `<section class="bar-intro"><div class="league-emblem" aria-hidden="true">${esc(badge)}</div><div><div class="eyebrow">LA MEMORIA DEL BAR</div><h1>Le prove restano.</h1><p class="muted">${esc(league.branding?.motto || 'Il “la sapevo” vale soltanto se lo hai scritto prima.')}</p></div></section>
  <div class="community-grid"><article class="card verdict"><div class="eyebrow">IL VERDETTO DEL BAR</div>${recap ? `<h2>${esc(recap.title)}</h2><p class="verdict-winner">${recap.winners.map(id=>esc(name(id))).join(' · ')}</p><p>${fmt(recap.points)} punti · ${recap.participants} schedine a confronto</p>${recap.surprise?`<div class="notice"><b>La sorpresa della giornata</b><br>${esc(recap.surprise.match)} · ${recap.surprise.score.join('–')}<br>${recap.surprise.correct} su ${recap.surprise.total} hanno previsto l’esito.${recap.surprise.heroes.length===1?` Solo ${esc(name(recap.surprise.heroes[0]))} l’aveva vista arrivare.`:''}</div>`:''}<button class="secondary" id="share-verdict">Apri la cartolina ↗</button>` : waiting?`<h2>${esc(round.title)} · in corso</h2><p class="muted">Le nuove scelte sono pubbliche. Il verdetto arriverà dopo i risultati della giornata.</p>`:'<h2>Il primo verdetto arriverà.</h2><p class="muted">Qui troverai protagonisti e sorprese dopo la prima giornata liquidata con schedine salvate.</p>'}</article>
  <article class="card almost-card"><div class="eyebrow">IL QUASI DELLA SETTIMANA</div><h2>Mancava solo quella.</h2>${recap?.almost.length ? recap.almost.map(a=>`<div class="almost-row"><strong>${esc(name(a.uid))}</strong><span>${a.correct}/${a.total} esiti corretti</span><p class="muted">${esc(a.match)} · scelta ${esc(a.pick)}</p>${a.potential!==null?`<small>Ritorno virtuale sfiorato: ${fmt(a.potential)} crediti</small>`:''}</div>`).join('') : '<p class="muted">Nessuna schedina persa per un solo evento nell’ultima giornata disponibile. Per questa volta il palo riposa.</p>'}</article></div>
  <section class="card rivalry"><div class="section-title"><div><div class="eyebrow">FACCIA A FACCIA</div><h2>Le vostre certezze, a confronto.</h2></div></div>${rival?`<label class="field">Scegli il rivale<select id="rival-switch">${members.map(m=>`<option value="${esc(m.uid)}" ${m.uid===rival.uid?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><div class="duel"><div><span>${esc(user.name)}</span><strong>${vs.aWins}</strong><small>giornate vinte</small></div><div class="duel-middle">VS<small>${vs.draws} pari</small></div><div><span>${esc(rival.name)}</span><strong>${vs.bWins}</strong><small>giornate vinte</small></div></div><p class="muted tiny">Solo le ${vs.days.length} giornate concluse in cui avete giocato entrambi. Vince chi totalizza più punti nella singola giornata.</p>${vs.days.length?`<div class="rival-history">${vs.days.slice(-6).map(r=>`<div class="row"><span>${esc(r.title)}</span><b>${fmt(r.a.points)} – ${fmt(r.b.points)}</b></div>`).join('')}</div>`:''}`:'<p class="muted">Invita un amico nella lega per iniziare un confronto.</p>'}</section>
  <section class="card"><div class="eyebrow">ALBO DEL BAR</div><h2>La stagione lascia il segno.</h2><div class="honours-grid">${(data?.honours||[]).map(p=>`<div class="honour"><strong>${esc(name(p.uid))}</strong><span>${p.total ? Math.round(p.correct/p.total*100) : 0}% esiti corretti · ${p.days} giornate</span><div class="risk-history">${p.perfect?`<span>✦ ${p.perfect} schedine perfette</span>`:''}${p.almost?`<span>↗ ${p.almost} volte “quasi”</span>`:''}</div></div>`).join('')||'<p class="muted">I riconoscimenti si basano sui risultati delle giornate concluse.</p>'}</div></section>`;
}
export function createVerdictCard(league,source,competitionKey,selected,roundId){
 const data=source==='fantacalcio'?league.community?.competitions?.[competitionKey]:league.community?.seriea;
 const round=league.rounds?.find(r=>r.id===(roundId||data?.recap?.round)),recap=recapForRound(data,round);if(!recap||!round||!isClosed(round))return '<p>La cartolina arriva con i risultati della giornata.</p>';
 const winners=recap.winners||[],uid=winners.includes(selected)?selected:winners[0],member=league.members.find(m=>m.uid===uid),row=data.history?.find(h=>h.id===round.id)?.players?.find(p=>p.uid===uid),slip=round.publicSlips?.find(p=>p.uid===uid)||row;
 const number=n=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(Number(n)||0);
 return '<article class="verdict-postcard"><span class="eyebrow">LA CARTOLINA DEL BAR</span><h2>'+esc(league.name)+'</h2><p>'+esc(round.title)+'</p>'+(winners.length>1?'<div class="v2-chips">'+winners.map(id=>'<button type="button" class="v2-chip" data-verdict-player="'+esc(id)+'" aria-pressed="'+(id===uid)+'">'+esc(league.members.find(m=>m.uid===id)?.name||'Giocatore')+'</button>').join('')+'</div>':'')+'<div class="postcard-winner"><div class="postcard-quasi">'+quasiScene(member?.avatar,member?.name||'Il protagonista',{eager:true})+'</div><h3>'+esc(member?.name||'Il protagonista')+'</h3><p class="postcard-quip">«'+esc(postcardQuip())+'»</p></div><p class="postcard-score">'+number(row?.points??recap.points)+' punti · '+number(row?.correct)+'/'+number(row?.total)+' prese</p><div class="bar-stub"><div class="bar-stub-head"><span>SCHEDINA VINCENTE</span><span>'+number(slip?.stake??row?.stake)+' cr</span></div><div class="bar-bets postcard-bets">'+barBetTiles(round,slip||{picks:{}},number,{interactive:false})+'</div></div><div class="postcard-totals"><span>Puntata <b>'+number(slip?.stake??row?.stake)+' cr</b></span><span>Ritorno <b>'+number(slip?.prize??row?.prize)+' cr</b></span></div><small>Solo crediti virtuali. Le prove restano al bar.</small></article>';
}
const POSTCARD_QUIPS=['Ha indovinato la schedina. Ora cercherà di spiegarci anche la fusione nucleare.','Una giornata da fenomeno, dodici screenshot nel gruppo. Il vero malus è sopportarlo.','La modestia l’ha lasciata in panchina. Naturalmente ha fatto doppietta.','Il bar ha chiesto il controllo antidoping. Cercavano solo il tovagliolo con i pronostici.','Aveva studiato tutto. Soprattutto dove tenere il cornetto portafortuna.','Ha battuto tutti. Tranne il record di minuti passati a dire «ve l’avevo detto».','Per una volta il pallone era rotondo dalla sua parte. Adesso vuole il monumento.','Il Nobel per la schedina non esiste. Ha già mandato un reclamo.','Oggi oracolo, ieri chiedeva se il pareggio si giocasse con la X.','Ha previsto tutto. Tranne che nessuno gli offrirà da bere dopo questa sceneggiata.','Mettetevi comodi: il discorso di ringraziamento dura più dei recuperi.','È passato da quasi fenomeno a fenomeno quasi insopportabile.'];
let lastQuip=-1;
export function postcardQuip(random=Math.random){let i=Math.floor(random()*POSTCARD_QUIPS.length);if(i===lastQuip)i=(i+1)%POSTCARD_QUIPS.length;lastQuip=i;return POSTCARD_QUIPS[i];}
