import {esc} from './formato.mjs';
const types={league:'Campionato',groups:'Coppa a gironi',knockout:'Coppa a eliminazione'};
export function competitionSwitcher(list,current){return list?.length>1?`<label class="fanta-competition-switch"><span>Competizione</span><select data-competition-switch aria-label="Scegli la competizione">${list.map(c=>`<option value="${esc(c.id)}" ${c.id===current?'selected':''}>${esc(c.name)} · ${types[c.kind]||'Campionato'}</option>`).join('')}</select></label>`:'';}

function competitionCards(competitions,selected){
 return `<div class="fanta-competition-cards">${competitions.map(c=>`<button type="button" data-competition-open="${esc(c.id)}" class="${c.id===selected?.id?'is-active':''}"><small>${types[c.kind]}</small><strong>${esc(c.name)}</strong><span>${c.status==='draft'?'Da avviare':c.status==='finished'?'Conclusa':'In corso'}${c.start_round?' · dalla '+c.start_round+'ª di campionato':''}</span></button>`).join('')}</div>`;
}
export function renderCompetitions(l){
 const selected=l.competition;
 return `<section class="fanta-competitions">${competitionCards(l.competitions||[],selected)}
 ${selected?.data?.seeds?.length?`<details class="fanta-block"><summary>Teste di serie</summary><ol>${selected.data.seeds.map(id=>`<li>${esc(l.members.find(m=>m.team.id===id)?.team.name||'Squadra')}</li>`).join('')}</ol></details>`:''}
 ${selected?.kind!=='league'?'<p class="fanta-note">Eliminazione diretta: a parità di gol passa chi ha più fantapunti. In caso di parità perfetta vale l’ordine delle teste di serie mostrato nel calendario iniziale.</p>':''}</section>`;
}
export function renderCompetitionManagement(l,tool){
 if(!l.isAdmin)return '';
 const selected=l.competition,drafts=(l.competitions||[]).filter(c=>c.status==='draft');
 if(tool==='dimensione')return l.sizeLocked?`<p>La dimensione è bloccata a ${l.league.maxMembers} squadre perché c’è una competizione già avviata.</p>`:
  `<form data-league-size-form class="card fanta-lg-form"><label>Numero di squadre<select name="size">${[4,6,8,10,12].filter(n=>n>=l.members.length).map(n=>`<option value="${n}" ${n===l.league.maxMembers?'selected':''}>${n} squadre</option>`).join('')}</select></label><button type="submit" class="primary">Salva dimensione</button></form>`;
 if(tool==='crea-competizione')return `<form data-competition-create-form class="card fanta-lg-form"><label>Nome<input name="name" required minlength="2" maxlength="60"></label><label>Formato<select name="kind">${Object.entries(types).map(([id,n])=>`<option value="${id}">${n}</option>`).join('')}</select></label><button type="submit" class="primary">Crea competizione</button></form>`;
 if(tool==='schedine-fanta')return `<form data-fanta-slips-form class="card fanta-lg-form"><label><input type="checkbox" name="enabled" ${l.league.slipsEnabled?'checked':''}> Abilita le schedine Fanta</label><button type="submit" class="primary">Salva</button></form>`;
 if(tool!=='avvia-competizione')return '';
 if(!drafts.length)return '<p>Nessuna competizione da avviare.</p>';
 return `${competitionCards(drafts,selected)}
 ${selected?.status==='draft'?`<form data-competition-start-form class="card fanta-lg-form"><h2>${esc(selected.name)}</h2><label>Giornata iniziale del campionato<input name="startRound" type="number" min="1" max="38" required></label>
 ${selected.kind==='groups'?'<label>Gironi<select name="groups"><option value="2">2 gironi</option><option value="4">4 gironi</option></select></label><label>Qualificati per girone<select name="qualify"><option value="2">Primi 2</option><option value="1">Solo il primo</option></select></label>':''}
 ${selected.kind!=='knockout'?'<label><input name="twice" type="checkbox"> Andata e ritorno</label>':''}
 <button type="submit" class="primary" ${l.readyToStart?'':'disabled'}>Avvia competizione</button>
 ${!l.readyToStart?'<p>Per avviare la competizione servono tutte le rose complete.</p>':''}</form>`:'<p>Scegli una competizione da avviare.</p>'}`;
}
