import {esc} from './formato.mjs';
import {shirt} from './maglie.mjs';
import {playerSurname} from '../player-label.mjs';
export function renderReleases(a,ui){
 const query=(ui.releaseQuery||'').toLocaleLowerCase('it'),list=(ui.releasePlayers||[]).filter(p=>[p.name,p.club,p.team.name].join(' ').toLocaleLowerCase('it').includes(query)),p=a.table;
 return `<div class="fanta-asta"><header class="fanta-sq-head"><span class="eyebrow">Asta di riparazione</span><h1>Prima facciamo spazio.</h1><p>Svincoli aperti: gli acquisti iniziano dopo.</p></header>
 ${a.isAdmin?`<section class="fanta-lg-card"><label>Cerca tra gli assegnati<input id="fanta-release-query" type="search" value="${esc(ui.releaseQuery||'')}" placeholder="Calciatore, club o squadra"></label><div class="fanta-release-list">${list.slice(0,50).map(p=>`<button type="button" class="secondary" data-m-table="${esc(p.id)}">${shirt(p.club)}<span><b>${esc(p.name)}</b><small>${esc(p.club)} · ${esc(p.team.name)} · ${p.price} cr</small></span></button>`).join('')||'<p>Nessun giocatore trovato.</p>'}</div></section>`:''}
 ${p?`<section class="fanta-a-lot" data-release-table><div class="fanta-a-player"><span class="fanta-a-shirt">${shirt(p.club)}</span><div><h2>${esc(p.name)}</h2><p>${esc(p.ownerTeam?.name)} · pagato ${p.price} crediti</p></div></div>${a.isAdmin?`<button type="button" class="primary" data-release="${esc(p.id)}">Svincola calciatore</button><button type="button" class="secondary" data-m-clear="1">Scegli un altro</button>`:''}</section>`:''}
 ${ui.error?`<p role="alert" class="fanta-note is-alert">${esc(ui.error)}</p>`:''}
 <section class="fanta-block"><h2>Registro degli svincoli</h2><ul class="fanta-rule-list">${(a.releases||[]).slice().reverse().map(r=>`<li><span><b>${esc(r.player.name)}</b> · ${esc(a.teams.find(t=>t.team.id===r.team)?.team.name)}<small>${r.undone?'Annullato':r.refund+' crediti restituiti'}</small></span>${a.isAdmin&&!r.undone&&r.batch===a.releaseBatchId?`<button type="button" class="secondary" data-release-undo="${esc(r.player.id)}">Annulla svincolo</button>`:''}</li>`).join('')||'<li>Nessuno svincolo per ora.</li>'}</ul></section>
 ${a.isAdmin?'<div class="fanta-a-admin-controls"><button type="button" class="primary" data-releases-done="1">Svincoli fatti: inizia l’asta</button><button type="button" class="secondary" data-asta-close="1">Chiudi asta</button></div>':''}</div>`;
}
export function renderReleaseConfirm(a){const p=a.table;if(!p)return '';return `<div class="fanta-ps-head"><h2 id="fanta-sheet-title">Svincolare ${esc(p.name)}?</h2><button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div><p>${esc(p.ownerTeam?.name)} · prezzo pagato ${p.price} cr</p><form data-release-form data-release-player="${esc(p.id)}" data-paid="${p.price}" class="fanta-lg-form"><fieldset><legend>Crediti da restituire</legend>${[['one','1 credito'],['zero','Niente'],['half','Metà ('+Math.floor(p.price/2)+')'],['custom','Importo libero']].map(([v,label])=>`<label class="fanta-choice"><input type="radio" name="refundKind" value="${v}" ${(p.price>=1?v==='one':v==='zero')?'checked':''} ${v==='one'&&p.price<1?'disabled':''}><span>${label}</span></label>`).join('')}</fieldset><label>Importo libero<input name="refund" type="number" min="0" max="${p.price}" value="0" step="1"></label><p data-refund-preview>${esc(p.ownerTeam?.name)} riavrà ${Math.min(1,p.price)} crediti.</p><button type="submit" class="primary">Conferma svincolo</button><p class="fanta-note" data-form-error role="alert"></p></form>`;}
export function refundFor(form){const p=new FormData(form),paid=Number(form.dataset.paid);return ({one:Math.min(1,paid),zero:0,half:Math.floor(paid/2)})[p.get('refundKind')]??Number(p.get('refund'));}
const searchHint='Scrivi almeno quattro lettere del cognome.';
const normalizeSurname=value=>String(value).toLocaleLowerCase('it').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}]/gu,'');

export function bindRosterPlayerSearch(form,loadPlayers){
 const input=form.querySelector('[data-roster-search]');
 if(!input)return;
 const results=form.querySelector('[data-roster-results]'),status=form.querySelector('[data-roster-status]');
 const submit=form.querySelector('button[type="submit"]');
 let catalog,searchVersion=0;
 input.addEventListener('input',async()=>{
  const version=++searchVersion,query=normalizeSurname(input.value);
  results.replaceChildren();
  results.hidden=true;
  submit.disabled=true;
  status.textContent=searchHint;
  if(query.length<4)return;
  status.textContent='Cerco i calciatori liberi…';
  try{
   catalog??=loadPlayers().then(players=>players.map(player=>({
    player,
    surname:normalizeSurname(player.surname||player.lastName||player.lastname||player.last_name||playerSurname(player))
   }))).catch(error=>{catalog=null;throw error;});
   const entries=await catalog;
   if(!form.isConnected||version!==searchVersion)return;
   const matches=entries.filter(entry=>entry.surname.includes(query));
   results.innerHTML=matches.slice(0,20).map(({player})=>`<label class="fanta-choice"><input type="radio" name="playerId" value="${esc(player.id)}" required><span><b>${esc(player.name)}</b><small>${esc(player.role)} · ${esc(player.club)}</small></span></label>`).join('');
   results.hidden=!matches.length;
   status.textContent=!matches.length?'Nessun calciatore libero trovato.':matches.length>20?'Affina la ricerca per trovare il tuo calciatore.':'Seleziona il calciatore da aggiungere.';
  }catch{
   if(form.isConnected&&version===searchVersion)status.textContent='Ricerca non disponibile. Modifica il cognome per riprovare.';
  }
 });
 results.addEventListener('change',()=>{submit.disabled=!results.querySelector('input:checked');});
}

export function renderRosterAdmin(data,league,ui={}){
 const labels={add:'Aggiungi un giocatore libero',remove:'Togli dalla rosa',price:'Correggi il prezzo',move:'Sposta in un’altra squadra'};
 const kind=ui.rosterKind||'price',adding=kind==='add';
 const playerControl=adding
  ? `<label>Cognome del calciatore<input type="search" data-roster-search autocomplete="off" aria-describedby="roster-search-status"></label>
     <p id="roster-search-status" data-roster-status role="status" class="fanta-note">${searchHint}</p>
     <fieldset data-roster-results aria-label="Calciatori liberi" hidden></fieldset>`
  : `<label>Calciatore<select name="playerId" required>${data.roster.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${p.role} · ${esc(p.club)} · ${p.price} cr</option>`).join('')}</select></label>`;
 return `<details class="fanta-block"${ui.rosterKind?' open':''}><summary>Correggi questa rosa</summary>${data.rosterLocked?'<p class="fanta-note">C’è un’asta aperta o programmata: usa gli strumenti dell’asta.</p>':`<form class="fanta-lg-form" data-roster-form data-team="${esc(data.team.id)}"><label>Operazione<select name="kind" data-roster-kind>${Object.entries(labels).map(([v,l])=>`<option value="${v}" ${v===kind?'selected':''}>${l}</option>`).join('')}</select></label>${playerControl}${kind!=='remove'?'<label>Prezzo<input type="number" name="price" min="0" max="500" step="1" value="1" required></label>':''}${kind==='move'?`<label>Destinazione<select name="toTeamId">${league.members.filter(m=>m.team.id!==data.team.id).map(m=>`<option value="${esc(m.team.id)}">${esc(m.team.name)}</option>`).join('')}</select></label>`:''}<button type="submit" class="primary"${adding?' disabled':''}>Controlla e conferma</button><p data-form-error role="alert" class="fanta-note"></p></form>`}<details><summary>Registro delle correzioni</summary><ol class="fanta-rule-list">${(ui.rosterAudit||[]).map(r=>`<li>${esc(new Date(r.created_at).toLocaleString('it-IT'))} · ${esc(r.username||r.actor||'')} · ${esc(({add:'Aggiunta',remove:'Rimozione',price:'Prezzo corretto',move:'Trasferimento',release:'Svincolo','release-undo':'Svincolo annullato'})[r.kind]||r.kind)} · ${esc(r.data?.changes?.[0]?.after?.name||r.data?.changes?.[0]?.before?.name||r.data?.input?.playerId||'')}</li>`).join('')||'<li>Nessuna correzione.</li>'}</ol></details></details>`;
}

export function renderMarketConfirm(title,description,attribute){return `<div class="fanta-ps-head"><h2 id="fanta-sheet-title">${esc(title)}</h2><button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div><p>${esc(description)}</p><div class="fanta-a-admin-controls"><button type="button" class="secondary" data-action="close-sheet">Annulla</button><button type="button" class="primary" ${attribute}="1">Conferma</button></div>`;}
