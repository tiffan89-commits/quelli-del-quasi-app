import {esc} from './formato.mjs';
import {shirt} from './maglie.mjs';
import {teamLogo} from './team-logo.mjs';

const roles=['P','D','C','A'];
const roleBadge=role=>`<span class="fanta-role is-${esc(role)}">${esc(role)}</span>`;
function rosterByRole(team){
 return [...(team.releaseRoster||[])].sort((a,b)=>roles.indexOf(a.role)-roles.indexOf(b.role)||a.name.localeCompare(b.name,'it'));
}

function releaseRow(p,selected,busy){
 return `<li class="auction-release-player${selected?' is-selected':''}">
  <span class="fanta-mini-shirt">${shirt(p.club)}</span>${roleBadge(p.role)}
  <span class="auction-release-player-name"><strong>${esc(p.name)}</strong><small>${p.price} cr</small></span>
  <button type="button" class="secondary" data-release-toggle="${esc(p.id)}" aria-label="${selected?'Rimuovi dalla selezione':'Svincola'} ${esc(p.name)}" ${busy?'disabled':''}>${selected?'Rimuovi':'Svincola'}</button>
 </li>`;
}

function releaseSummary(teams,entries,busy){
 return `<section class="auction-release-summary" aria-labelledby="auction-release-summary-title">
  <h2 id="auction-release-summary-title">Riepilogo svincoli</h2>
  <p class="fanta-note">Giocatori in rosa dopo la conferma</p>
  <ul class="auction-release-teams">${teams.map(t=>{
   const pending=rosterByRole(t).filter(p=>entries.has(p.id));
   const counts=roles.map(role=>{
    const remaining=(t.roles[role]?.have||0)-pending.filter(p=>p.role===role).length;
    return `<span>${roleBadge(role)}<b>${remaining}</b></span>`;
   }).join('');
   return `<li><div class="auction-release-team">${teamLogo(t.team)}<strong>${esc(t.team.name)}</strong><div class="auction-release-counts">${counts}</div></div>
    ${pending.length?`<ul class="auction-release-pending">${pending.map(p=>`<li>${roleBadge(p.role)}<span>${esc(p.name)}</span>
     <label>Rimborso <input id="release-refund-${esc(p.id)}" type="number" inputmode="numeric" min="0" max="${p.price}" step="1" required data-release-refund="${esc(p.id)}" aria-label="Rimborso per ${esc(p.name)}" value="${esc(entries.get(p.id).refund)}" ${busy?'disabled':''}> cr</label></li>`).join('')}</ul>`:''}</li>`;
  }).join('')}</ul>
 </section>`;
}

function releaseEditor(a,draft){
 const {entries,teamId,busy,error,saved}=draft;
 const team=a.teams.find(t=>t.team.id===teamId)||a.teams[0];
 if(!team)return '<p class="fanta-note">Non ci sono squadre in questa asta.</p>';
 const roster=rosterByRole(team);
 return `<form class="auction-release-editor" data-release-batch-form>
  <section class="fanta-lg-card auction-release-roster">
   <label for="auction-release-team">Squadra</label>
   <select id="auction-release-team" data-release-team ${busy?'disabled':''}>
    ${a.teams.map(t=>`<option value="${esc(t.team.id)}"${team===t?' selected':''}>${esc(t.team.name)}</option>`).join('')}
   </select>
   ${roster.length?`<ul class="auction-release-players">${roster.map(p=>releaseRow(p,entries.has(p.id),busy)).join('')}</ul>`:'<p class="fanta-note">La squadra non ha calciatori in rosa.</p>'}
  </section>
  ${releaseSummary(a.teams,entries,busy)}
  <div class="auction-release-confirm">
   ${error?`<p role="alert" class="fanta-note is-alert">${esc(error)}</p>`:''}
   ${saved?'<p class="fanta-note" role="status">Svincoli confermati.</p>':''}
   <button type="submit" class="primary"${busy?' aria-busy="true"':''} ${busy||!entries.size?'disabled':''}>${busy?'Salvataggio…':`Conferma svincoli${entries.size?` (${entries.size})`:''}`}</button>
  </div>
 </form>`;
}

export function renderReleases(a,ui){
 const draft=ui.releaseDraft;
 return `<div class="fanta-asta"><header class="fanta-sq-head"><span class="eyebrow">Asta di riparazione</span><h1>Prima facciamo spazio.</h1><p>Svincoli aperti: gli acquisti iniziano dopo.</p></header>
 ${a.isAdmin&&draft?releaseEditor(a,draft):''}
 ${ui.error?`<p role="alert" class="fanta-note is-alert">${esc(ui.error)}</p>`:''}
 <section class="fanta-block"><h2>Registro degli svincoli</h2><ul class="fanta-rule-list">${(a.releases||[]).slice().reverse().map(r=>`<li><span><b>${esc(r.player.name)}</b> · ${esc(a.teams.find(t=>t.team.id===r.team)?.team.name)}<small>${r.undone?'Annullato':r.refund+' crediti restituiti'}</small></span>${a.isAdmin&&!draft?.busy&&!r.undone&&r.batch===a.releaseBatchId?`<button type="button" class="secondary" data-release-undo="${esc(r.player.id)}">Annulla svincolo</button>`:''}</li>`).join('')||'<li>Nessuno svincolo per ora.</li>'}</ul></section>
 ${a.isAdmin?`<div class="fanta-a-admin-controls"><button type="button" class="primary" data-releases-done="1" ${draft?.busy||draft?.entries.size?'disabled':''}>Svincoli fatti: inizia l’asta</button><button type="button" class="secondary" data-asta-close="1" ${draft?.busy?'disabled':''}>Chiudi asta</button></div>`:''}</div>`;
}

export function renderMarketConfirm(title,description,attribute){return `<div class="fanta-ps-head"><h2 id="fanta-sheet-title">${esc(title)}</h2><button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div><p>${esc(description)}</p><div class="fanta-a-admin-controls"><button type="button" class="secondary" data-action="close-sheet">Annulla</button><button type="button" class="primary" ${attribute}="1">Conferma</button></div>`;}
