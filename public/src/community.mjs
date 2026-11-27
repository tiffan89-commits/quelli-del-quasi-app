import {quasiHomeBackdrop,quasiMascot} from './quasi-scene.mjs';
import {barBetTiles} from './bar-slips.mjs';
import {esc} from './fanta/formato.mjs';
import {predictionStatus} from '../prediction.mjs';
import {isClosed} from './slip-state.mjs';
import {stableHash} from './reward-catalog.mjs';
function settledPlayers(data,round){
 const published=data?.history?.find(h=>h.id===round.id);
 if(published)return published.players||[];
 if(!round.settled)return [];
 const matches=(round.matches||[]).filter(m=>!m.void);
 if(!matches.length||matches.some(m=>m.status&&m.status!=='FT'||!Array.isArray(m.score)))return [];
 return (round.publicSlips||[]).filter(s=>(s.pointsSettled||s.settled)&&Number.isFinite(s.points)).map(s=>{
  const correct=matches.filter(m=>predictionStatus(m,s.picks?.[m.id],true)?.winning).length;
  return {...s,correct,total:matches.length,wrong:matches.length-correct};
 });
}

export function recapForRound(data,round){
 if(!round||data?.recap?.round===round.id)return data?.recap||null;
 if(!round.settled)return null;
 const players=settledPlayers(data,round);
 if(!players.length)return null;
 const points=Math.max(...players.map(p=>Number(p.points)||0));
 const almost=players.filter(p=>p.wrong===1).flatMap(p=>{
  const match=round.matches.find(m=>!m.void&&predictionStatus(m,p.picks?.[m.id],true)?.winning===false);
  return match?[{...p,match:match.home+' – '+match.away,pick:p.picks[match.id],potential:p.odds?Math.round(p.odds*p.stake*100)/100:null}]:[];
 });
 return {round:round.id,title:round.title,points,winners:players.filter(p=>Number(p.points)===points).map(p=>p.uid),participants:players.length,almost,surprise:null};
}

export function creditLeaders(data,round){
 if(!round?.settled||round.pointsOnly)return null;
 const players=settledPlayers(data,round).filter(player=>
  player.creditsSettled!==false&&Number.isFinite(player.prize)&&Number.isFinite(player.stake));
 const net=player=>Math.round((player.prize-player.stake)*100);
 const best=Math.max(0,...players.map(net));
 return best>0?{credits:best/100,winners:players.filter(player=>net(player)===best).map(player=>player.uid)}:null;
}

export function verdictWinnerTitle(category,count){
 return (count===1?'Vincitore':'Vincitori')+(category==='credits'?' ai crediti':' ai punti');
}

function verdictAward(category,winners,amount,unit,nickname,esc){
 const title=verdictWinnerTitle(category,winners.length);
 const strategy=category==='credits'?'<p class="verdict-award-note"><strong>'+(winners.length===1?'Lo stratega':'Gli strateghi')+' di Wall Street.</strong> Analisi da broker, bonus immaginario.</p>':'';
 return `<section class="verdict-award" data-verdict-award="${category}">
  <h3>${title}</h3>
  <p class="verdict-award-names">${winners.map(id=>esc(nickname(id))).join(' · ')}</p>
  <strong class="verdict-award-value">${amount} <small>${unit}</small></strong>
  ${strategy}
  <button type="button" class="secondary" data-verdict-card="${category}" aria-label="Apri la cartolina ${category==='credits'?'dei crediti':'dei punti'}">Apri la cartolina <span aria-hidden="true">↗</span></button>
 </section>`;
}

export function communityView(league,source,esc,fmt,competitionKey,round) {
  const data=source==='fantacalcio'?league.community?.competitions?.[competitionKey]:league.community?.seriea, recap=recapForRound(data,round),waiting=round&&isClosed(round)&&!recap;
  const name=id=>league.members.find(m=>m.uid===id)?.name || 'Giocatore';
  const badge=league.branding?.emblem || 'Q';
  const bar=source==='seriea';
  const credits=bar&&recap?creditLeaders(data,round??league.rounds?.find(r=>r.id===recap.round)):null;
  const awards=recap&&bar?`<p class="verdict-participants">${recap.participants===1?'1 schedina':recap.participants+' schedine a confronto'}</p>
   <div class="verdict-awards">
    ${verdictAward('points',recap.winners,fmt(recap.points),recap.points===1?'punto':'punti',name,esc)}
    ${credits?verdictAward('credits',credits.winners,'+'+fmt(credits.credits),'cr netti',name,esc):''}
   </div>`:'';
  const almost=recap?.almost?.length?`<section class="verdict-almost"><h3>Mancava solo quella</h3>${recap.almost.map(a=>`<div class="almost-row"><div class="almost-row-heading"><strong>${esc(name(a.uid))}</strong><span>${a.correct}/${a.total} esiti corretti</span></div><p class="muted">${esc(a.match)} · scelta ${esc(a.pick)}</p>${a.potential!==null?`<small>Ritorno virtuale sfiorato: ${fmt(a.potential)} crediti</small>`:''}</div>`).join('')}</section>`:'';
  const upset=recap?.surprise;
  const surprise=upset?`<section class="verdict-surprise"><h3>La sorpresa della giornata</h3><div class="almost-row">
   <div class="almost-row-heading"><strong>${esc(upset.match)}</strong><span>${upset.score.join('–')}</span></div>
   <p class="muted">${upset.correct} su ${upset.total} hanno previsto l’esito.${upset.heroes.length===1?` Solo ${esc(name(upset.heroes[0]))} l’aveva vista arrivare.`:''}</p>
  </div></section>`:'';
  return `<section class="bar-intro"><div class="league-emblem" aria-hidden="true">${esc(badge)}</div><div><div class="eyebrow">LA MEMORIA DEL BAR</div><h1>Le prove restano.</h1><p class="muted">${esc(league.branding?.motto || 'Il “la sapevo” vale soltanto se lo hai scritto prima.')}</p></div></section>
  <div class="community-grid"><article class="card verdict">${recap ? `<h2>${esc(recap.title)}</h2>${bar?awards:`<p class="verdict-winner">${recap.winners.map(id=>esc(name(id))).join(' · ')}</p><p>${fmt(recap.points)} punti · ${recap.participants} schedine a confronto</p>`}${almost}${surprise}${bar?'':'<button type="button" class="secondary" data-verdict-card="points">Apri la cartolina ↗</button>'}` : waiting?`<h2>${esc(round.title)} · in corso</h2><p class="muted">Il verdetto arriva dopo i risultati.</p>`:'<h2>Il primo verdetto arriverà.</h2><p class="muted">Serve una giornata conclusa con schedine salvate.</p>'}</article></div>
  <details class="card verdict-honours"><summary>Albo del Bar</summary><div class="honours-grid">${(data?.honours||[]).map(p=>`<div class="honour"><strong>${esc(name(p.uid))}</strong><span>${p.total ? Math.round(p.correct/p.total*100) : 0}% esiti corretti · ${p.days} giornate</span><div class="risk-history">${p.perfect?`<span>✦ ${p.perfect} schedine perfette</span>`:''}${p.almost?`<span>↗ ${p.almost} volte “quasi”</span>`:''}</div></div>`).join('')||'<p class="muted">I riconoscimenti si basano sui risultati delle giornate concluse.</p>'}</div></details>`;
}
export function createVerdictCard(league,source,competitionKey,selected,roundId,{embedded=false,category='points'}={}){
 const data=source==='fantacalcio'?league.community?.competitions?.[competitionKey]:league.community?.seriea;
 const round=league.rounds?.find(r=>r.id===(roundId||data?.recap?.round)),recap=recapForRound(data,round);if(!recap||!round||!isClosed(round))return '<p>La cartolina arriva con i risultati della giornata.</p>';
 const award=category==='credits'?creditLeaders(data,round):recap;
 const winners=award?.winners||[];
 if(!winners.length)return '<p>La cartolina arriva con i risultati della giornata.</p>';
 const uid=winners.includes(selected)?selected:winners[0],member=league.members.find(m=>m.uid===uid),row=settledPlayers(data,round).find(p=>p.uid===uid),slip=round.publicSlips?.find(p=>p.uid===uid)||row;
 const number=n=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(Number(n)||0);
 const quip=embedded?POSTCARD_QUIPS[stableHash([league.id,round.id,uid].join(':'))%POSTCARD_QUIPS.length]:postcardQuip();
 const picker=!embedded&&winners.length>1?`<div class="v2-chips">${winners.map(id=>`<button type="button" class="v2-chip" data-verdict-player="${esc(id)}" aria-pressed="${id===uid}">${esc(league.members.find(m=>m.uid===id)?.name||'Giocatore')}</button>`).join('')}</div>`:'';
 const name=member?.name||'Il protagonista',stake=number(slip?.stake??row?.stake);
 const points=row?.points??recap.points;
 const score=category==='credits'?'+'+number(award.credits)+' cr netti':number(points)+(points===1?' punto':' punti');
 return `<article class="verdict-postcard" data-verdict-award="${category}">
  <div class="postcard-winner">${quasiHomeBackdrop(member?.avatar)}
   <div class="postcard-copy">
    ${embedded?'':`<h2>${verdictWinnerTitle(category,winners.length)}</h2>`}
    <p class="postcard-context">${esc(league.name)} · ${esc(round.title)}</p>
    <p class="postcard-score">${score} <small>· ${number(row?.correct)}/${number(row?.total)} prese</small></p>
    <p class="postcard-quip">«${esc(quip)}»</p>
   </div>
   ${quasiMascot(member?.avatar,name,{editable:false})}
  </div>${picker}
  <div class="bar-stub"><div class="bar-stub-head"><span>Schedina vincente</span><span>Puntata ${stake} cr</span></div><div class="bar-bets postcard-bets">${barBetTiles(round,slip||{picks:{}},number,{interactive:false})}</div></div>
  <div class="postcard-totals"><small>Crediti virtuali</small><span>Ritorno <b>${number(slip?.prize??row?.prize)} cr</b></span></div>
 </article>`;
}
const POSTCARD_QUIPS=['Ha indovinato la schedina. Ora cercherà di spiegarci anche la fusione nucleare.','Una giornata da fenomeno, dodici screenshot nel gruppo. Il vero malus è sopportarlo.','La modestia l’ha lasciata in panchina. Naturalmente ha fatto doppietta.','Il bar ha chiesto il controllo antidoping. Cercavano solo il tovagliolo con i pronostici.','Aveva studiato tutto. Soprattutto dove tenere il cornetto portafortuna.','Ha battuto tutti. Tranne il record di minuti passati a dire «ve l’avevo detto».','Per una volta il pallone era rotondo dalla sua parte. Adesso vuole il monumento.','Il Nobel per la schedina non esiste. Ha già mandato un reclamo.','Oggi oracolo, ieri chiedeva se il pareggio si giocasse con la X.','Ha previsto tutto. Tranne che nessuno gli offrirà da bere dopo questa sceneggiata.','Mettetevi comodi: il discorso di ringraziamento dura più dei recuperi.','È passato da quasi fenomeno a fenomeno quasi insopportabile.'];
let lastQuip=-1;
export function postcardQuip(random=Math.random){let i=Math.floor(random()*POSTCARD_QUIPS.length);if(i===lastQuip)i=(i+1)%POSTCARD_QUIPS.length;lastQuip=i;return POSTCARD_QUIPS[i];}
