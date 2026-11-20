import {backButton} from '../back-navigation.mjs';
import {openSiteOverlay} from '../site-overlay.mjs';
import {esc} from './formato.mjs';
import {rosterView} from './squadra.mjs';
import {teamLogo} from './team-logo.mjs';

const emptyLineup={slots:{},bench:[]};
const keyOf=(team,player)=>JSON.stringify([team,player]);
const normalize=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('it');
const labels={remove:'Svincolo',price:'Correzione prezzo',add:'Aggiunta'};
const orderDate=new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeStyle:'short'});
const valueOf=p=>Number(p.value)||0;
const indexCatalog=players=>players.map(p=>({...p,search:normalize(`${p.name} ${p.club||''}`)}))
 .sort((a,b)=>valueOf(b)-valueOf(a)||a.name.localeCompare(b.name,'it'));
const action=(kind,label,player='',extra='')=>`<button type="button" ${extra} data-roster-edit="${kind}"${player?` data-roster-player="${esc(player)}"`:''}>${label}</button>`;

function project(team,changes){
 const roster=team.roster.map(p=>{
  const change=changes.get(keyOf(team.team.id,p.id));
  if(change?.kind==='remove')return {...p,removing:true};
  if(change?.kind==='price')return {...p,price:change.price,priceDraft:true};
  return p;
 });
 for(const change of changes.values())if(change.teamId===team.team.id&&change.kind==='add'){
  const p=change.player;
  roster.push({...p,price:change.price,adding:true});
 }
 return roster;
}
function balance(team,roster,snapshot){
 const current=roster.filter(p=>!p.removing);
 const credits=snapshot.budget+(team.creditAdjustment||0)-current.reduce((total,p)=>total+p.price,0);
 const excess=Object.entries(snapshot.limits).filter(([role,max])=>current.filter(p=>p.role===role).length>max).map(([role])=>role);
 return {credits,excess,count:current.length,slots:Math.max(0,25-current.length)};
}
const recapLabel=changes=>`Vai al riepilogo${changes.size?` (${changes.size})`:''}`;
const balanceLabel=({count,credits})=>`${count}/25 in rosa · ${credits} crediti disponibili`;

export function createRosterEditor({api,context,render,navigate,onSaved}){
 const sessions=new Map();
 let openDialog=null;
 const current=()=>{
  const info=context();if(!info)return null;
  if(!sessions.has(info.id))sessions.set(info.id,{snapshot:null,changes:new Map(),catalog:null});
  return {...info,session:sessions.get(info.id)};
 };
 const refresh=session=>{if(current()?.session===session)render();};
 const teamOf=(snapshot,id)=>snapshot?.teams.find(row=>row.team.id===id);
 const close=()=>openDialog?.close();
 const invalidateCatalog=session=>{
  session.catalog=null;
  session.catalogRead=null;
  session.prefetched=false;
 };

 function read(info,{reload=false}={}){
  const {session,id}=info;
  if(session.loading||session.saving)return;
  session.error=null;
  if(reload)invalidateCatalog(session);
  session.loading=true;
  void api.rosterEditor(id).then(snapshot=>{session.snapshot=snapshot;}).catch(error=>{session.error=error.message;}).finally(()=>{session.loading=false;refresh(session);});
 }
 function catalog(info){
  const {session,id}=info;
  if(session.catalog)return Promise.resolve(session.catalog);
  if(session.catalogRead)return session.catalogRead;
  const load=()=>api.rosterPlayers(id);
  const job=load().catch(error=>{
   if(error.status&&error.status<500)throw error;
   return load();
  }).then(players=>{
   const indexed=indexCatalog(players);
   if(session.catalogRead===job)session.catalog=indexed;
   return indexed;
  }).finally(()=>{if(session.catalogRead===job)session.catalogRead=null;});
  session.catalogRead=job;
  return job;
 }
 function sync(){
  const info=current();
  if(openDialog&&(openDialog.session!==info?.session||openDialog.teamId!==info?.teamId||openDialog.orders!==info?.orders||info.review))close();
  if(!info)return;
  const {session,teamId,review,orders}=info;
  if(!session.snapshot&&!session.error)read(info);
  if(orders&&!session.orders&&!session.ordersError)void loadOrders(info);
  if(teamId&&!review&&!orders&&session.snapshot&&!session.loading&&!session.snapshot.locked&&!session.catalog&&!session.catalogRead&&!session.prefetched){
   session.prefetched=true;
   void catalog(info).catch(()=>{});
  }
 }
 function put(session,teamId,player,kind,price){
  const key=keyOf(teamId,player.id),previous=session.changes.get(key);
  if(kind==='undo'||kind==='remove'&&previous?.kind==='add'||kind==='price'&&price===(previous?.previousPrice??player.price)&&previous?.kind!=='add')session.changes.delete(key);
  else session.changes.set(key,{teamId,playerId:player.id,player:previous?.player||player,kind:previous?.kind==='add'?'add':kind,
   ...(previous?.kind!=='add'&&kind!=='add'?{previousPrice:previous?.previousPrice??player.price}:{}),...(kind!=='remove'?{price}:{})});
  session.receipt=null;session.saved=false;session.error=null;
  session.rejected=session.rejected?.filter(issue=>issue.teamId!==teamId||issue.playerId!==player.id);
 }

 async function loadOrders({session,id},more=false){
  if(session.ordersLoading||session.undoing)return;
  session.ordersLoading=true;session.ordersError=null;
  try{
   const page=await api.rosterOrders(id,more?session.nextOrder:null);
   session.orders=more?[...session.orders,...page.orders]:page.orders;
   session.nextOrder=page.next;
  }catch(error){session.ordersError=error.message;}
  finally{session.ordersLoading=false;refresh(session);}
 }

 function ordersPage(session){
  const {snapshot,orders,ordersError,ordersLoading,ordersMessage,nextOrder}=session;
  const cards=(orders||[]).map(order=>{
   const items=order.changes.map(change=>{
    const player=change.after||change.before;
    const team=teamOf(snapshot,change.teamId)?.team.name;
    const price=change.kind==='price'?`${change.before.price} → ${change.after.price} cr`:`${player.price} cr`;
    return `<li><div><b>${esc(player.name)}</b><small>${esc([team,labels[change.kind],price].filter(Boolean).join(' · '))}</small></div></li>`;
   }).join('');
   return `<article class="roster-order"><h2>Ordine ${esc(order.id)}</h2><small class="muted">${esc(orderDate.format(new Date(order.createdAt)))}</small>
    <ul class="roster-editor-review-list">${items}</ul>${action('undo-order','Annulla','',`class="secondary" data-order-id="${esc(order.id)}" aria-label="Annulla ordine ${esc(order.id)}" ${!snapshot||snapshot.locked||ordersLoading?'disabled':''}`)}</article>`;
  }).join('');
  return `${ordersMessage?`<p class="fanta-note" role="status">${esc(ordersMessage)}</p>`:''}
  ${snapshot?.locked?`<p class="fanta-note">${esc(snapshot.lockMessage)}</p>`:''}${cards}${orders&&!orders.length&&!nextOrder?'<p class="fanta-note">Nessuna correzione da mostrare.</p>':''}
  ${ordersLoading||!orders&&!ordersError?'<p class="fanta-loading" role="status">Caricamento correzioni…</p>':''}
  ${ordersError?`<p class="fanta-note is-alert" role="alert">${esc(ordersError)}</p>`:''}
  ${!ordersLoading&&(nextOrder||ordersError)?action(orders?'more-orders':'retry-orders',ordersError?'Riprova':'Correzioni precedenti','','class="secondary"'):''}`;
 }

 function page(){
  const info=current();if(!info)return '';
  const {session,teamId,review,orders,back}=info,{snapshot,changes,error,saving,checking,loading,saved}=session;
  const row=teamOf(snapshot,teamId);
  const title=orders?'Ordini di correzione':review?'Riepilogo correzioni':row?.team.name||'Correggi rose';
  const backAttrs=orders||teamId&&!review?'data-roster-edit="back-teams"':review?'data-roster-edit="back-review"':back;
  const header=`<header class="participants-heading roster-editor-heading" data-os-header>${backButton(backAttrs,orders||teamId&&!review?'Torna alle squadre':review?'Torna alla rosa':'Torna al pannello del presidente')}${!review&&!orders&&row?teamLogo(row.team):''}<h1 id="roster-editor-title" tabindex="-1">${esc(title)}</h1></header>`;
  const status=error?`<p class="fanta-note is-alert" role="alert">${esc(error)}</p>${action('reload','Ricarica le rose','','class="secondary"'+(loading?' disabled':''))}`:'';
  const recap=action('review',checking?'Verifica in corso…':recapLabel(changes),'',`class="secondary roster-editor-recap" ${checking||loading||!changes.size?'disabled':''}${checking?' aria-busy="true"':''}`);
  let body;
  if(orders)body=ordersPage(session);
  else if(!snapshot)body=status||'<p class="fanta-loading" role="status">Caricamento rose…</p>';
  else if(review){
   const groups=snapshot.teams.filter(t=>[...changes.values()].some(c=>c.teamId===t.team.id));
   const details=groups.map(team=>{
    const state=balance(team,project(team,changes),snapshot),bad=state.credits<0||state.excess.length>0||state.count>25;
    return `<section class="roster-editor-review-team"><h2>${teamLogo(team.team)}${esc(team.team.name)}</h2>
     <p class="${bad?'fanta-note is-alert':'muted'}">${balanceLabel(state)}${state.excess.length?` · Posti superati: ${state.excess.join(', ')}`:''}</p>
     <ul class="roster-editor-review-list">${[...changes.values()].filter(change=>change.teamId===team.team.id).map(change=>`<li><div><b>${esc(change.player.name)}</b><small>${labels[change.kind]} · ${change.kind==='price'?`${change.previousPrice} → ${change.price} cr`:change.kind==='add'?`${change.price} cr`:`${change.previousPrice} cr restituiti`}</small></div>
     ${action('undo','Annulla',change.playerId,`class="secondary" data-review-team="${esc(team.team.id)}" ${saving?'disabled':''}`)}</li>`).join('')}</ul></section>`;
   }).join('');
   body=`${saved?'<p class="fanta-note" role="status">Modifiche salvate.</p>':''}${status}${snapshot.locked&&changes.size?`<p class="fanta-note">${esc(snapshot.lockMessage)}</p>`:''}${details||(!saved?'<p class="fanta-note">Nessuna modifica in bozza.</p>':'')}
    ${changes.size?action('save',saving?'Salvataggio…':'Salva tutte le modifiche','',`class="primary" ${saving||loading?'disabled':''}${saving?' aria-busy="true"':''}`):''}`;
  }else if(row){
   const roster=project(row,changes),totals=balance(row,roster,snapshot);
   const availability=snapshot.locked?'disabled':'';
   const controls=p=>{
    if(p.removing||snapshot.locked)return `<span class="fanta-roster-price">${p.price}<small>cr</small></span>${p.removing?`<div class="roster-editor-row-actions">${action('undo','Annulla svincolo',p.id,`class="secondary" ${checking?'disabled':''}`)}</div>`:''}`;
    const rangeId=`roster-range-${encodeURIComponent(p.id)}`;
    const expanded=session.openPrice===keyOf(teamId,p.id);
    return `<div class="roster-price-stepper">
     ${action('price-down','−',p.id,`class="secondary" aria-label="Riduci prezzo di ${esc(p.name)}" ${checking||p.price<=0?'disabled':''}`)}
     ${action('toggle-price',`<b data-roster-price-value>${p.price}</b> cr`,p.id,`class="secondary${p.priceDraft||p.adding?' is-draft-price':''}" ${checking?'disabled':''} aria-label="Regola prezzo di ${esc(p.name)}, ${p.price} crediti" aria-expanded="${expanded}" aria-controls="${rangeId}"`)}
     ${action('price-up','+',p.id,`class="secondary" aria-label="Aumenta prezzo di ${esc(p.name)}" ${checking||p.price>=snapshot.budget?'disabled':''}`)}
    </div><div class="roster-editor-row-actions">${action('remove','Svincola',p.id,`class="roster-release" ${checking?'disabled':''} aria-label="Svincola ${esc(p.name)}"`)}</div>
    <label class="roster-price-range" id="${rangeId}" ${expanded?'':'hidden'}><span class="sr-only">Prezzo di ${esc(p.name)}</span><input type="range" min="0" max="${snapshot.budget}" step="1" value="${p.price}" data-roster-price-range="${esc(p.id)}" ${checking?'disabled':''}></label>`;
   };
   const affected=(session.rejected||[]).filter(issue=>issue.teamId===teamId&&issue.playerId).map(issue=>changes.get(keyOf(teamId,issue.playerId))).filter(Boolean);
   const fixes=affected.length?`<div class="roster-editor-fixes">${action('reload','Ricarica le rose','','class="secondary"')}${affected.map(change=>action('undo',`Annulla modifica: ${esc(change.player.name)}`,change.playerId,'class="secondary"')).join('')}</div>`:'';
   body=`<div class="roster-editor-toolbar">${action('add','<span aria-hidden="true">+</span>', '',`class="primary roster-editor-add" ${availability||(!totals.slots||checking?'disabled':'')} aria-label="Aggiungi calciatori liberi"`)}${recap}</div>
    <p class="muted" data-roster-balance>${balanceLabel(totals)}</p>${status}${snapshot.locked?`<p class="fanta-note">${esc(snapshot.lockMessage)}</p>`:!totals.slots?'<p class="fanta-note">Rosa al completo. Svincola un calciatore per liberare un posto.</p>':''}${fixes}${rosterView({roster},emptyLineup,controls)}`;
  }else if(teamId)body='<p class="fanta-note" role="alert">Squadra non trovata.</p>';
  else body=`${status}${saved?'<p class="fanta-note" role="status">Modifiche salvate.</p>':''}<div class="roster-editor-toolbar">${recap}${action('orders','Ordini di correzione','','class="secondary"')}</div><nav class="president-operation-list" aria-label="Squadre">${snapshot.teams.map(({team,roster})=>action('team',`${teamLogo(team)}<span class="roster-editor-team-copy"><strong>${esc(team.name)}</strong><small>${roster.length} in rosa</small></span><span aria-hidden="true">›</span>`,'',`class="secondary president-operation roster-editor-team" data-roster-team="${esc(team.id)}"`)).join('')}</nav>`;
  return `${header}<div class="roster-editor" data-os-content data-os-flow role="region" aria-labelledby="roster-editor-title" tabindex="0">${body}</div>`;
 }

 function showDialog(info,trigger,title,content){
  close();
  const dialog=trigger.ownerDocument.createElement('dialog');
  dialog.className='v2-sheet fanta-sheet roster-editor-sheet';
  dialog.setAttribute('aria-labelledby','roster-editor-sheet-title');
  dialog.innerHTML=`<div class="v2-sheet-handle" data-sheet-grip aria-hidden="true"></div><div class="fanta-ps-head"><h2 id="roster-editor-sheet-title">${title}</h2><button type="button" class="fanta-close" data-roster-close aria-label="Chiudi">×</button></div>${content}`;
  const dismiss=openSiteOverlay(dialog,trigger);
  openDialog={close:dismiss,session:info.session,teamId:info.teamId,orders:info.orders};
  dialog.querySelector('[data-roster-close]').onclick=dismiss;
  dialog.addEventListener('close',()=>{if(openDialog?.close===dismiss)openDialog=null;});
  return {dialog,dismiss};
 }

 function priceRow(info,source,player,price){
  const {session,teamId}=info;
  if(!Number.isInteger(price)||price<0||price>session.snapshot.budget||player.price===price)return;
  put(session,teamId,player,'price',price);
  const row=source.closest('.fanta-roster-row'),editor=source.closest('.roster-editor');
  const toggle=row.querySelector('[data-roster-edit="toggle-price"]');
  toggle.querySelector('[data-roster-price-value]').textContent=price;
  toggle.setAttribute('aria-label',`Regola prezzo di ${player.name}, ${price} crediti`);
  toggle.classList.toggle('is-draft-price',session.changes.has(keyOf(teamId,player.id)));
  row.querySelector('[data-roster-price-range]').value=price;
  row.querySelector('[data-roster-edit="price-down"]').disabled=price===0;
  row.querySelector('[data-roster-edit="price-up"]').disabled=price===session.snapshot.budget;
  const team=teamOf(session.snapshot,teamId);
  editor.querySelector('[data-roster-balance]').textContent=balanceLabel(balance(team,project(team,session.changes),session.snapshot));
  editor.querySelector('[data-roster-edit="review"]').textContent=recapLabel(session.changes);
  editor.querySelector('[data-roster-edit="review"]').disabled=!session.changes.size;
 }
 function changePrice(event){
  const input=event.target,id=input.dataset.rosterPriceRange;
  if(!id)return;
  const info=current();if(!info||info.session.saving||info.session.checking||info.session.snapshot?.locked)return;
  const row=teamOf(info.session.snapshot,info.teamId);
  const player=row&&project(row,info.session.changes).find(p=>p.id===id&&!p.removing);
  if(player)priceRow(info,input,player,input.valueAsNumber);
 }

 function addSheet(info,trigger,slots){
  const {session,teamId}=info,budget=session.snapshot.budget;
  const selected=new Map(),unavailable=new Set([...session.changes.values()].filter(c=>c.kind==='add').map(c=>c.playerId));
  const roles=[['','Tutti'],['P','P'],['D','D'],['C','C'],['A','A']];
  const {dialog,dismiss}=showDialog(info,trigger,'Aggiungi calciatori liberi',`<form class="roster-catalog"><label class="field">Cerca nel listone<input type="search" name="query" placeholder="Nome, cognome o club" autocomplete="off"></label>
   <div class="v2-chips fanta-filter" aria-label="Filtra per ruolo">${roles.map(([role,name])=>`<button type="button" class="v2-chip" data-catalog-role="${role}" aria-pressed="${role===''}">${name}</button>`).join('')}</div>
   <div class="roster-catalog-scroll" data-overlay-scroll><div class="fanta-pick-list" data-catalog-rows role="region" aria-label="Calciatori liberi"></div><button type="button" class="secondary" data-catalog-more hidden>Mostra altri</button></div>
   <p data-catalog-status role="status" class="fanta-note">Caricamento listone…</p><button type="button" class="secondary" data-catalog-retry hidden>Riprova</button>
   <p data-catalog-capacity class="muted">${slots===1?'1 posto libero':`${slots} posti liberi`}</p>
   <button class="primary" type="submit" disabled>Aggiungi alla bozza</button></form>`);
  const form=dialog.querySelector('form'),rows=form.querySelector('[data-catalog-rows]'),scroll=rows.parentElement;
  const status=form.querySelector('[data-catalog-status]'),retry=form.querySelector('[data-catalog-retry]'),more=form.querySelector('[data-catalog-more]'),submit=form.querySelector('[type=submit]');
  let players=null,byId,role='',limit=50;
  const updateSubmit=()=>{
   submit.disabled=!selected.size||selected.size>slots||[...selected.values()].some(p=>p===''||!Number.isInteger(+p)||+p<0||+p>budget);
   submit.textContent=selected.size?`Aggiungi ${selected.size} alla bozza`:'Aggiungi alla bozza';
   form.querySelector('[data-catalog-capacity]').textContent=`Selezionati ${selected.size} su ${slots} posti liberi`;
   for(const checkbox of rows.querySelectorAll('[data-catalog-pick]'))checkbox.disabled=!checkbox.checked&&selected.size>=slots;
  };
  function paint({reset=false}={}){
   if(!players)return;
   const query=normalize(form.elements.query.value).trim().split(/\s+/).filter(Boolean);
   const matches=players.filter(p=>(!role||p.role===role)&&query.every(term=>p.search.includes(term)));
   rows.innerHTML=matches.slice(0,limit).map(p=>{
    const checked=selected.has(p.id);
    return `<div class="roster-catalog-row"><label class="fanta-choice"><input type="checkbox" data-catalog-pick="${esc(p.id)}" ${checked?'checked':''}><span class="fanta-role is-${esc(p.role)}">${esc(p.role)}</span><span class="fanta-p-name"><b>${esc(p.name)}</b><small>${esc(p.club||'')}</small></span><span class="fanta-roster-stats"><b>${valueOf(p)}</b><small>Valore</small></span></label>
     <label class="roster-catalog-price" ${checked?'':'hidden'}>Prezzo in crediti<input type="number" min="0" max="${budget}" step="1" data-catalog-price="${esc(p.id)}" value="${esc(selected.get(p.id)??1)}" aria-label="Prezzo di ${esc(p.name)}" ${checked?'required':'disabled'}></label></div>`;
   }).join('');
   more.hidden=matches.length<=limit;
   status.textContent=matches.length?`${matches.length} calciatori · ordinati per valore`:'Nessun calciatore libero trovato.';
   updateSubmit();
   if(reset)scroll.scrollTop=0;
  }
  async function load(){
   retry.hidden=true;status.textContent='Caricamento listone…';
   try{
    players=(await catalog(info)).filter(p=>!unavailable.has(p.id));
    if(!dialog.open)return;
    byId=new Map(players.map(p=>[p.id,p]));paint();
   }catch(error){if(dialog.open){status.textContent=error.message;retry.hidden=false;}}
  }
  retry.onclick=load;
  more.onclick=()=>{limit+=50;paint();};
  form.onclick=event=>{
   const chip=event.target.closest('[data-catalog-role]');if(!chip)return;
   role=chip.dataset.catalogRole;limit=50;
   for(const button of form.querySelectorAll('[data-catalog-role]'))button.setAttribute('aria-pressed',String(button===chip));
   paint({reset:true});
  };
  form.oninput=event=>{
   const input=event.target;
   if(input===form.elements.query){limit=50;paint({reset:true});}
   if(input.dataset.catalogPrice){selected.set(input.dataset.catalogPrice,input.value);updateSubmit();}
  };
  form.onchange=event=>{
   const input=event.target,id=input.dataset.catalogPick;if(!id)return;
   const label=input.closest('.roster-catalog-row').querySelector('.roster-catalog-price'),price=label.querySelector('input');
   if(input.checked)selected.set(id,price.value);else selected.delete(id);
   label.hidden=price.disabled=!input.checked;price.required=input.checked;updateSubmit();
  };
  form.onsubmit=event=>{
   event.preventDefault();if(submit.disabled)return;
   for(const [id,price] of selected)put(session,teamId,byId.get(id),'add',Number(price));
   dismiss();refresh(session);
  };
  void load();
 }

 const samePage=info=>{
  const active=current();return active?.session===info.session&&active.teamId===info.teamId&&active.review===info.review&&active.orders===info.orders;
 };
 function batch(session){
  session.receipt??=crypto.randomUUID();
  const changes=[...session.changes.values()].map(({player,...change})=>change);
  return {requestId:session.receipt,changes};
 }
 function showIssues(info,root,error){
  if(!samePage(info)){refresh(info.session);return;}
  const {session}=info;
  const issues=error.issues?.length?error.issues:[{message:error.message||'Verifica non riuscita. Riprova tra poco.'}];
  session.rejected=issues;
  const affected=issues.find(issue=>teamOf(session.snapshot,issue.teamId))?.teamId;
  const teamId=affected||info.teamId||session.changes.values().next().value?.teamId;
  if(info.review||teamId!==info.teamId)navigate({teamId,replace:true});
  else refresh(session);
  const trigger=root.querySelector('.roster-editor [data-roster-edit="review"],.roster-editor-heading button');
  if(!trigger)return;
  const items=issues.map(issue=>{
   const team=teamOf(session.snapshot,issue.teamId)?.team.name;
   const player=session.changes.get(keyOf(issue.teamId,issue.playerId))?.player.name;
   const subject=[team,player].filter(Boolean).join(' · ');
   return `<li>${subject?`<strong>${esc(subject)}</strong> `:''}${esc(issue.message)}</li>`;
  }).join('');
  const {dialog,dismiss}=showDialog(current(),trigger,'Correzioni da rivedere',`<ul class="roster-editor-issues">${items}</ul><button type="button" class="primary" data-close-issues>Torna alla modifica</button>`);
  dialog.querySelector('[data-close-issues]').onclick=dismiss;
 }
 async function verify(info,root){
  const {session,id,teamId}=info;
  if(session.checking||session.saving||!session.changes.size)return;
  const input=batch(session);
  session.checking=true;refresh(session);
  let error;
  try{await api.checkRosterBatch(id,input);session.rejected=null;}
  catch(failure){error=failure;}
  finally{session.checking=false;}
  if(error)showIssues(info,root,error);
  else if(samePage(info))navigate({teamId,review:true});
  else refresh(session);
 }
 async function save(info,root){
  const {session,id}=info;
  if(session.saving||!session.changes.size)return;
  const input=batch(session);
  session.saving=true;session.error=null;refresh(session);
  let error;
  try{
   session.snapshot=await api.saveRosterBatch(id,input);
   session.changes.clear();invalidateCatalog(session);session.receipt=null;session.saved=true;session.rejected=null;
   session.orders=null;session.ordersError=null;session.ordersMessage=null;session.nextOrder=null;
   onSaved(id);
  }catch(failure){error=failure;}
  finally{session.saving=false;}
  if(error)showIssues(info,root,error);
  else if(samePage(info))navigate({replace:true});
  else refresh(session);
 }
 function confirmUndo(info,trigger,orderId){
  const {session,id}=info,order=session.orders?.find(entry=>entry.id===orderId);
  if(!order||session.undoing||session.ordersLoading||!session.snapshot||session.snapshot.locked)return;
  const {dialog,dismiss}=showDialog(info,trigger,'Annullare la correzione?',`<p>Verranno ripristinate tutte le modifiche dell’ordine ${esc(orderId)}.</p>
   <div class="roster-order-confirm"><button type="button" class="secondary" data-close-order>Indietro</button><button type="button" class="primary" data-confirm-undo>Conferma annullamento</button></div><p role="alert" data-undo-error></p>`);
  dialog.querySelector('[data-close-order]').onclick=dismiss;
  const confirm=dialog.querySelector('[data-confirm-undo]');
  confirm.onclick=async()=>{
   if(session.undoing)return;
   session.undoing=true;confirm.disabled=true;confirm.setAttribute('aria-busy','true');
   const status=dialog.querySelector('[data-undo-error]');status.textContent='';
   try{
    session.snapshot=await api.undoRosterOrder(id,orderId);
    session.orders=session.orders.filter(entry=>entry.id!==orderId);
    session.ordersMessage=`Ordine ${orderId} annullato.`;
    invalidateCatalog(session);onSaved(id);dismiss();refresh(session);
   }catch(error){
    const messages=error.issues?.map(issue=>issue.message);
    status.textContent=messages?.join(' ')||error.message;
   }finally{session.undoing=false;confirm.disabled=false;confirm.removeAttribute('aria-busy');}
  };
 }
 function handle(event){
  const button=event.target.closest('[data-roster-edit]'),info=current();
  if(!button||button.disabled||!info)return;
  const {session,teamId,review}=info,{rosterEdit,rosterPlayer,rosterTeam,reviewTeam,orderId}=button.dataset;
  if(rosterEdit==='orders'){navigate({orders:true});return;}
  if(rosterEdit==='more-orders'||rosterEdit==='retry-orders'){void loadOrders(info,rosterEdit==='more-orders');refresh(session);return;}
  if(rosterEdit==='undo-order'){confirmUndo(info,button,orderId);return;}
  if(rosterEdit==='team'){navigate({teamId:rosterTeam});return;}
  if(rosterEdit==='review'){void verify(info,event.currentTarget);return;}
  if(rosterEdit==='back-review'||rosterEdit==='back-teams'){navigate({teamId:review?teamId:null,back:true});return;}
  if(rosterEdit==='reload'){read(info,{reload:true});refresh(session);return;}
  if(rosterEdit==='save'){void save(info,event.currentTarget);return;}
  if(session.saving||session.checking)return;
  const target=reviewTeam||teamId;
  if(rosterEdit==='undo'){const change=session.changes.get(keyOf(target,rosterPlayer));if(change){put(session,target,change.player,'undo');refresh(session);}return;}
  if(!session.snapshot||session.snapshot.locked)return;
  const row=teamOf(session.snapshot,target),roster=row&&project(row,session.changes);
  if(rosterEdit==='add'&&row){const {slots}=balance(row,roster,session.snapshot);if(slots)addSheet(info,button,slots);return;}
  const player=roster?.find(p=>p.id===rosterPlayer);
  if(!player||player.removing)return;
  if(rosterEdit==='toggle-price'){
   const key=keyOf(teamId,player.id),expanded=session.openPrice!==key;
   const editor=button.closest('.roster-editor');
   for(const active of editor.querySelectorAll('[data-roster-edit="toggle-price"][aria-expanded="true"]')){
    active.setAttribute('aria-expanded','false');active.closest('.fanta-roster-row').querySelector('.roster-price-range').hidden=true;
   }
   session.openPrice=expanded?key:null;
   if(expanded){button.setAttribute('aria-expanded','true');button.closest('.fanta-roster-row').querySelector('.roster-price-range').hidden=false;}
  }
  if(rosterEdit==='price-down'||rosterEdit==='price-up')priceRow(info,button,player,player.price+(rosterEdit==='price-up'?1:-1));
  if(rosterEdit==='remove'){put(session,target,player,'remove');refresh(session);}
 }
 return {page,sync,handle,changePrice,close};
}
