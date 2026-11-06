import {renderLineup,bindLineupPitch} from './lineup-pitch.mjs';
import {footballStatistics,bindFootballStatistics} from './football-statistics.mjs';
import {pitchEvents} from './pitch-events.mjs';
import {renderPlayerSheet} from './fanta/giornata.mjs';
import {renderAsta,renderListoneRows,tickAuction} from './fanta/asta.mjs';
import {esc} from './fanta/formato.mjs';
const root=document.getElementById('lab'),dialog=document.getElementById('lab-player'),socket=window.io({path:'/laboratorio/socket.io',transports:['websocket'],withCredentials:true});
let feed=null,auction=null,catalog=null,tab='live',selected=null,signature=null,busy=false,picking=null,query='',role='tutti',amount='',offset=0,player=null;
root.innerHTML=`<header class="lab-head"><a href="/">QUELLI DEL QUASI</a><span id="lab-connection">Collegamento…</span><h1>Il VAR del divano</h1><p>Prova isolata · risultati ed episodi reali in replay, asta contro il computer. Le tue leghe restano come sono.</p><nav><button data-tab="live" aria-pressed="true">Dirette</button><button data-tab="auction">Asta single player</button><button data-tab="model">Il nuovo voto</button></nav></header><main><section id="lab-live"><div class="lab-replay-controls"><button data-cmd="replay:restart">↶ Riparti</button><button data-cmd="replay:pause" id="lab-pause">Pausa</button><button data-cmd="replay:final">Vai ai finali</button></div><p class="lab-replay-note">Gli eventi seguono i minuti originali. Le statistiche complete e i rating arrivano al finale del replay; nessun dato finale viene anticipato nei voti live.</p><div id="lab-match-rail"></div><article id="lab-match"></article></section><section id="lab-auction" hidden></section><section id="lab-model" hidden><h2>Il portiere non è un contatore di parate</h2><p>Frosinone–Como 2–0: 7 parate, 2,12 xG e 8 tiri in porta avversari, rating 10. Nel nuovo modello Palmisani prende <b>9</b>.</p><button class="primary" data-case>Apri la pagella di Palmisani</button><div class="lab-neutral"><b>80% di passaggi riusciti, riferimento 85%</b><p>Giallo: prestazione in linea, nessuna penalità per questo scarto.</p></div><details><summary>Cosa cambia</summary><p>Scarti vicini al ruolo neutrali, contributi in passi di 0,05 e valori minimi azzerati. Il sostegno per le parate nella vittoria e quello per la porta inviolata sono alternativi, fino a mezzo punto. Gli xG misurano la pressione, il rating e l’efficacia corroborano l’incisività; non vengono inventate misure xGOT assenti.</p></details></section></main><p id="lab-message" role="status"></p>`;
const $=q=>root.querySelector(q);
const preserve=el=>({open:[...el.querySelectorAll('details')].map((d,i)=>[d.querySelector('summary')?.textContent||String(i),d.open]),tab:el.querySelector('[data-pitch-tab][aria-selected="true"]')?.dataset.pitchTab,scroll:el.querySelector('.pitch-slides')?.scrollLeft});
function restore(el,s){for(const d of el.querySelectorAll('details')){const v=s.open.find(([k])=>k===d.querySelector('summary')?.textContent);if(v)d.open=v[1];}if(s.tab)el.querySelector('[data-pitch-tab="'+s.tab+'"]')?.click();}
function notify(text){$('#lab-message').textContent=text;}
function send(kind,input={}){
 if(busy||!socket.connected)return;busy=true;root.querySelectorAll('[data-cmd],[data-bid],[data-asta-nominate],[data-call-player]').forEach(b=>b.disabled=true);
 socket.timeout(7000).emit('lab:command',{id:crypto.randomUUID(),kind,input,version:auction?.version},(error,result)=>{busy=false;if(error||!result?.ok)notify(result?.error||'Collegamento interrotto. Riprova.');else notify('');if(auction&&tab==='auction')renderAuction();else for(const b of root.querySelectorAll('[data-cmd]'))b.disabled=false;});
}
function matchView(){
 if(!feed)return;selected=feed.matches.some(m=>m.id===selected)?selected:feed.matches[0].id;const m=feed.matches.find(m=>m.id===selected),el=$('#lab-match');
 const rail=$('#lab-match-rail'),scroll=rail.scrollLeft,old=new Map([...rail.querySelectorAll('[data-select-match]')].map(e=>[e.dataset.selectMatch,e.dataset.score]));
 rail.innerHTML=feed.matches.map(x=>`<button data-select-match="${x.id}" data-score="${x.score.join('-')}" aria-pressed="${x.id===selected}" class="${old.has(x.id)&&old.get(x.id)!==x.score.join('-')?'lab-goal':''}"><small>${x.status==='LIVE'?'● LIVE · '+esc(x.clock):'FINALE'}</small><span>${esc(x.home)} <b>${x.score[0]}</b></span><span>${esc(x.away)} <b>${x.score[1]}</b></span></button>`).join('');rail.scrollLeft=scroll;
 const structure=JSON.stringify([m.id,m.lineups.teams.map(t=>[t.players.map(p=>p.id),t.bench.filter(p=>p.substitution?.in).map(p=>p.id)])]);
 if(signature!==structure){const state=preserve(el);el.innerHTML=`<div class="lab-score"><div><h2>${esc(m.home)}–${esc(m.away)}</h2><small>${new Date(m.originalDate).toLocaleDateString('it-IT')} · replay</small></div><strong data-lab-score></strong><span data-lab-clock></span></div><div data-lab-lineups>${renderLineup(m)}</div><details class="match-statistics"><summary>Dettagli della partita</summary><div data-lab-events></div><div data-lab-statistics></div></details>`;bindLineupPitch(el);restore(el,state);signature=structure;}
 el.querySelector('[data-lab-score]').textContent=m.score.join(' – ');el.querySelector('[data-lab-clock]').textContent=m.status==='LIVE'?'LIVE · '+m.clock:'Finale';
 for(const t of m.lineups.teams)for(const p of [...t.players,...t.bench])for(const card of el.querySelectorAll('[data-fantasy-player="'+p.id+'"]')){
  const grade=card.querySelector('[data-fantasy-grade="pitch"]');if(grade){grade.hidden=false;grade.textContent=Number.isFinite(p.grade)?'V '+p.grade+(Number.isFinite(p.fantagrade)?' · FV '+p.fantagrade:''):p.status==='sv'?'s.v.':'—';}
  const ring=card.querySelector('[data-pitch-events]');if(ring)ring.outerHTML=pitchEvents(p);card.querySelector('.player-probability')?.remove();
 }
 const detail=el.querySelector('[data-lab-events]');detail.innerHTML=m.details.events.map(e=>`<p><b>${e.minute}′</b> ${esc(e.player||'')} · ${esc(e.detail||e.kind)}${e.assist?' · '+esc(e.assist):''}</p>`).join('');
 const numbers=el.querySelector('[data-lab-statistics]'),content=footballStatistics(m);if(numbers.dataset.content!==content){const state=preserve(numbers);numbers.innerHTML=content;numbers.dataset.content=content;bindFootballStatistics(numbers);restore(numbers,state);}
 $('#lab-pause').textContent=feed.paused?'Riprendi':'Pausa';
}
function renderAuction(){
 if(!auction)return;const el=$('#lab-auction'),focus=document.activeElement?.id,cursor=document.activeElement?.selectionStart;
 const notice=`<div class="lab-single-note"><b>Tu contro il computer</b><p>Le altre squadre simulano chiamate e rilanci: considerano forma recente, valore, infortuni, reparto e crediti. Un infortunio lungo abbassa molto l’interesse. Crediti esclusivamente virtuali.</p>${auction.status!=='running'?'<button class="primary" data-cmd="auction:start">Avvia asta single player</button>':'<button data-cmd="auction:skip">Salta l’attesa · solo nella prova</button>'}<button data-cmd="auction:reset">Azzera questa prova</button></div>`;
 el.innerHTML=notice+renderAsta(auction,{amount,mq:query,mrole:role},catalog)+(auction.status==='running'&&!auction.lot&&auction.caller===auction.me?`<section class="lab-listone"><h2>Chi chiami?</h2><input type="search" id="lab-search" placeholder="Cerca un giocatore" value="${esc(query)}"><div class="lab-roles">${['tutti','P','D','C','A'].map(r=>`<button data-lab-role="${r}" aria-pressed="${role===r}">${r==='tutti'?'Tutti':r}</button>`).join('')}</div>${catalog?renderListoneRows(catalog,auction,{query,role,picking}):'<p>Carichiamo i calciatori…</p>'}${picking?'<button class="primary lab-call" data-call-player="'+esc(picking)+'">Chiama a 1 credito</button>':''}</section>`:'');
 el.querySelectorAll('[data-asta-mode],[data-lega-auction],[data-lega-open],[data-tab="lega"]').forEach(b=>b.hidden=true);
 if(['lab-search','fanta-a-amount'].includes(focus)){const input=el.querySelector('#'+focus);input?.focus({preventScroll:true});if(cursor!=null)input?.setSelectionRange(cursor,cursor);}
 if(busy)el.querySelectorAll('button,[type=submit]').forEach(b=>b.disabled=true);tickAuction(el,offset);
}
socket.on('connect',()=>{$('#lab-connection').textContent='● Push collegato';});socket.on('disconnect',()=>{$('#lab-connection').textContent='Ricollegamento…';});socket.on('connect_error',e=>notify(e.message));
socket.on('sports:update',data=>{feed=data;if(tab==='live')matchView();});
socket.on('auction:update',data=>{if(auction&&data.version<auction.version)return;auction=data;offset=Date.parse(data.serverTime)-Date.now();if(tab==='auction')renderAuction();});
socket.on('lab:catalog',data=>{catalog=data;if(tab==='auction')renderAuction();});
socket.on('player:update',p=>{player=p;const state=preserve(dialog),scroll=dialog.scrollTop;dialog.innerHTML=renderPlayerSheet(p,{official:p.status==='voted'});restore(dialog,state);dialog.scrollTop=scroll;if(!dialog.open)dialog.showModal();});
root.addEventListener('submit',e=>{if(!e.target.matches('[data-bid-form]'))return;e.preventDefault();if(!auction?.lot||!/^[0-9]+$/.test(amount))return;send('auction:bid',{lotId:auction.lot.id,amount:Number(amount)});amount='';});
root.addEventListener('input',e=>{if(e.target.id==='fanta-a-amount')amount=e.target.value;if(e.target.id==='lab-search'){query=e.target.value;renderAuction();}});
root.addEventListener('click',e=>{const t=e.target.closest('button,[data-fantasy-player]');if(!t)return;const d=t.dataset;
 if(d.tab&&['live','auction','model'].includes(d.tab)){tab=d.tab;for(const k of ['live','auction','model'])$('#lab-'+k).hidden=k!==tab;root.querySelectorAll('.lab-head [data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));if(tab==='live')matchView();if(tab==='auction'){if(!catalog)socket.emit('lab:catalog');renderAuction();}return;}
 if(d.selectMatch){selected=d.selectMatch;signature=null;matchView();return;}
 if(d.cmd){send(d.cmd);return;}if(d.case!==undefined){socket.emit('lab:player','case');return;}
 if(d.labRole){role=d.labRole;renderAuction();return;}if(d.astaPick){picking=d.astaPick;renderAuction();return;}
 if(d.callPlayer){send('auction:nominate',{playerId:d.callPlayer,amount:1});picking=null;return;}
 if(d.bid){send('auction:bid',{lotId:auction.lot.id,amount:Number(d.bid)});return;}
 if(d.pass!==undefined||d.astaPass!==undefined){send('auction:pass',{lotId:auction.lot.id});return;}
 if(d.astaCancel){send('auction:cancel',{lotId:auction.lot?.id});return;}if(d.astaClose){send('auction:close');return;}
 if(d.fantasyPlayer){socket.emit('lab:player',{match:selected,id:d.fantasyPlayer});}
});
dialog.addEventListener('click',e=>{if(e.target.closest('[data-action="close-sheet"]')){dialog.close();socket.emit('lab:player',null);}});dialog.addEventListener('cancel',()=>socket.emit('lab:player',null));
setInterval(()=>{if(tab==='auction')tickAuction($('#lab-auction'),offset);},200); // local clock only, no requests
