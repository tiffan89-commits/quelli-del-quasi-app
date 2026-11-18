import {esc} from './formato.mjs';

const ROLES=['P','D','C','A'];
const STATUS={pending:'In attesa',rejected:'Rifiutata',expired:'Scaduta'};
const formatDate=new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'});
const localDateTime=value=>{
 if(!value)return '';
 const d=new Date(value);
 return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
const sameIds=(a,b)=>a.length===b.length&&a.every(id=>b.includes(id));
const ids=players=>players.map(p=>p.id);
const button=(action,label,style='secondary',attrs='')=>`<button type="button" class="${style}" data-trade-action="${action}" ${attrs}>${label}</button>`;

function terms(request){
 return {offer:ids(request.want),want:ids(request.offer),credits:-request.credits};
}

function roster(team,name,picked){
 const players=[...(team?.roster||[])].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||a.name.localeCompare(b.name,'it'));
 return `<fieldset class="trade-roster"><legend>${name==='offer'?'Giocatori che offri':'Giocatori che ricevi'}</legend>
  <div class="trade-players" role="group" tabindex="0" aria-label="Giocatori di ${esc(team?.name||'questa squadra')}">${players.map(p=>`<label><input type="checkbox" name="${name}" value="${esc(p.id)}"${picked.includes(p.id)?' checked':''}><b>${esc(p.role)}</b><span>${esc(p.name)}</span></label>`).join('')||'Rosa vuota'}</div>
 </fieldset>`;
}

function renderForm(data,draft,request){
 const mine=data.teams.find(t=>t.id===data.teamId), target=data.teams.find(t=>t.id===draft.recipient);
 const changed=request&&different(draft,terms(request));
 return `<form class="card trade-form" data-trade-form>
  <h2 tabindex="-1">${request?'Controproposta':'Proponi scambi'}</h2>
  ${request?`<p>${esc(target?.name||request.sender.name)}</p>`:`<label class="field">Squadra<select name="recipient" data-native-select required>
   <option value="">Scegli una squadra</option>${data.teams.filter(t=>t!==mine).map(t=>`<option value="${esc(t.id)}"${t===target?' selected':''}>${esc(t.name)} · ${esc(t.manager)}</option>`).join('')}
  </select></label>`}
  ${target?`<p class="muted trade-balance">Ogni rosa deve avere 3 P, 8 D, 8 C e 6 A.</p><div class="trade-rosters">${roster(mine,'offer',draft.offer)}${roster(target,'want',draft.want)}</div>
   <div class="trade-credit-fields">
    <label class="field">Crediti<select name="creditDirection" data-native-select><option value="0">Nessun credito</option><option value="1"${draft.direction===1?' selected':''}>Offri crediti</option><option value="-1"${draft.direction===-1?' selected':''}>Richiedi crediti</option></select></label>
    <label class="field" data-trade-credit-amount ${draft.direction?'':'hidden'}>Importo<input name="creditAmount" type="number" inputmode="numeric" min="1" max="2147483647" step="1" value="${esc(draft.amount)}" ${draft.direction?'required':'disabled'}></label>
   </div>
   <p class="muted trade-balance">${esc(mine.name)} · ${mine.credits} crediti disponibili<br>${esc(target.name)} · ${target.credits} crediti disponibili</p>`:''}
  <div class="trade-actions">
   ${target?`<button class="primary" type="submit" data-trade-submit>${request?(changed?'Invia controproposta':'Accetta'):'Invia proposta'}</button>`:''}
   ${button('cancel','Annulla')}
  </div>
 </form>`;
}

const teamTerms=(team,players,payment)=>`<div><b>${esc(team.name)} cede</b><ul>${players.map(p=>`<li>${esc(p.role)} · ${esc(p.name)}</li>`).join('')}${payment>0?`<li>${payment} crediti</li>`:''}</ul></div>`;

function renderRequest(request,open,editing){
 const {sender,recipient,offer,want,credits,id,incoming,status}=request;
 return `<article class="card trade-request">
  <header><h3>${incoming?'Da '+esc(sender.name):'A '+esc(recipient.name)}</h3><span>${STATUS[status]}</span></header>
  <div class="trade-terms">${teamTerms(incoming?recipient:sender,incoming?want:offer,incoming?-credits:credits)}${teamTerms(incoming?sender:recipient,incoming?offer:want,incoming?credits:-credits)}</div>
  ${open&&incoming&&status==='pending'&&!editing?`<div class="trade-actions" data-trade-id="${esc(id)}">${button('accept','Accetta','primary')}${button('reject','Rifiuta')}${button('edit','Controproposta')}</div>`:''}
 </article>`;
}

function renderHistory(history){
 return `<section class="trade-requests"><h2>Storico scambi</h2>
  ${history.length?history.map(({sender,recipient,offer,want,credits,acceptedAt})=>`<article class="card trade-request"><header>
   <h3>${esc(sender.name)} ↔ ${esc(recipient.name)}</h3><time datetime="${esc(acceptedAt)}">${formatDate.format(new Date(acceptedAt))}</time></header>
   <div class="trade-terms">${teamTerms(sender,offer,credits)}${teamTerms(recipient,want,-credits)}</div>
  </article>`).join(''):'<p class="muted">Nessuno scambio finalizzato.</p>'}</section>`;
}

function scheduleForm(start,end){
 return `<form class="card trade-schedule" data-trade-schedule><h2>Programma gli scambi</h2>
  <label class="field">Inizio<input name="startsAt" type="datetime-local" required value="${esc(start)}"></label>
  <label class="field">Fine<input name="endsAt" type="datetime-local" required value="${esc(end)}"></label>
  <div class="trade-actions"><button class="primary" type="submit">Salva orari</button>${button('cancel-schedule','Annulla')}</div>
 </form>`;
}
function windowText({canOpen,isAdmin,window}){
 if(window.phase==='scheduled')return 'Scambi programmati dal '+formatDate.format(new Date(window.startsAt))+' al '+formatDate.format(new Date(window.endsAt))+'.';
 if(window.phase==='open')return window.endsAt?'Scambi aperti fino al '+formatDate.format(new Date(window.endsAt))+'.':'Scambi aperti.';
 if(window.phase==='ended')return 'La finestra di scambio è terminata.';
 return isAdmin&&!canOpen?'Chiudi l’asta per aprire gli scambi.':'Gli scambi sono chiusi.';
}

function different(draft,original){
 return !sameIds(draft.offer,original.offer)||!sameIds(draft.want,original.want)||draft.credits!==original.credits
  ||(draft.direction!==0&&(!Number.isSafeInteger(draft.credits)||draft.credits===0));
}

export function createTradePanel({root,api,context,signal,onRosterChange}){
 let league=null,data=null,draft=null,schedule=null,busy=false,error='',readJob=null,epoch=0,windowTimer;
 signal.addEventListener('abort',()=>clearTimeout(windowTimer),{once:true});
 const statuses=new Map();
 const current=()=>context().id;
 const live=()=>context().active&&!signal.aborted;
 const requestFor=id=>data?.requests.find(r=>r.id===id);
 const panel=()=>root.querySelector('[data-trades-body]');

 function switchLeague(){
  if(league===current())return;
  league=current();data=null;draft=null;schedule=null;busy=false;error='';readJob=null;epoch++;clearTimeout(windowTimer);
 }
 function paintBadges(){
  const count=statuses.get(current())?.pending||0;
  for(const badge of root.querySelectorAll('[data-trade-badge]')){
   badge.hidden=!count;
   badge.textContent=count>9?'9+':String(count);
   badge.setAttribute('aria-label',count===1?'1 richiesta di scambio in attesa':count+' richieste di scambio in attesa');
  }
 }
 function paint(){
  paintBadges();
  const node=panel();
  if(!node)return;
  const notice=error?`<p role="alert" class="notice">${esc(error)}</p>`:'';
  if(!data){
   node.innerHTML=notice+(error?button('reload','Riprova'):'<p role="status">Carichiamo gli scambi…</p>');
   return;
  }
  const {open,isAdmin,canOpen,teams,requests,history,window}=data,request=requestFor(draft?.id);
  const editor=draft?renderForm(data,draft,request):'';
  const otherRequests=requests.filter(r=>r.id!==request?.id);
  const scheduled=window.phase==='scheduled';
  const openControl=isAdmin&&!schedule?(scheduled?button('close-window','Annulla programmazione'):button(open?'close-window':'open-window',open?'Chiudi gli scambi':'Apri adesso',open?'secondary':'primary',!open&&!canOpen?'disabled':''))+(open?'':button('schedule',scheduled?'Modifica orari':'Programma gli scambi','secondary',!canOpen?'disabled':'')):'';
  const propose=open&&!draft&&teams.length>1?button('compose','Proponi scambi','primary'):'';
  node.innerHTML=`${notice}<div class="trade-actions trade-toolbar">${propose}${openControl}</div>
   <p>${windowText(data)}</p>${open&&teams.length<2?'<p>Serve un’altra squadra con un allenatore.</p>':''}
   ${schedule?scheduleForm(schedule.startsAt,schedule.endsAt):''}${editor}
   ${(!request||otherRequests.length)?`<section class="trade-requests"><h2>Richieste di scambio</h2>
    ${otherRequests.map(r=>renderRequest(r,open,!!draft)).join('')||'<p class="muted">Nessuna richiesta.</p>'}
   </section>`:''}${renderHistory(history)}`;
  if(busy)for(const control of node.querySelectorAll('button,input,select'))control.disabled=true;
 }

 function watchWindow({window,serverNow}){
  clearTimeout(windowTimer);
  const next=window.phase==='scheduled'?window.startsAt:window.phase==='open'?window.endsAt:null;
  if(!next)return;
  windowTimer=setTimeout(()=>void check({force:true}),Math.max(20,Math.min(2147483647,Date.parse(next)-serverNow+20)));
 }

 function load(){
  if(!live()||!league||!panel()||!api.trades)return;
  if(readJob)return readJob;
  const id=league,version=epoch;
  readJob=api.trades(id).then(next=>{
   if(!live()||current()!==id||epoch!==version)return;
   data=next;watchWindow(next);
   const request=requestFor(draft?.id);
   if(!data.open||draft?.id&&(!request?.incoming||request.status!=='pending'||request.revision!==draft.revision))draft=null;
   paint();
  }).catch(err=>{if(live()&&current()===id&&epoch===version){error=err.message;paint();}}).finally(()=>{if(epoch===version)readJob=null;});
  return readJob;
 }

 async function check({refresh=true,localAccept=false,force=false}={}){
  switchLeague();
  if(!live()||!league||!api.tradeStatus)return;
  const id=league,version=epoch;
  try{
   const next=await api.tradeStatus(id);
   if(!live()||id!==current()||epoch!==version)return;
   const previous=statuses.get(id);
   statuses.set(id,next);
   watchWindow(next);paintBadges();
   if(!localAccept&&previous&&previous.latestAccepted!==next.latestAccepted)onRosterChange(id);
   if(refresh&&!busy&&panel()&&!schedule&&(force||!data||data.open!==next.open||!draft&&!panel().contains(document.activeElement)))await load();
  }catch{/* Keep the last badge until the next check. */}
 }

 async function save(kind,payload){
  if(!live()||busy)return;
  busy=true;error='';epoch++;readJob=null;
  const id=league,version=epoch;
  paint();
  let accepted=false;
  try{
   await api.tradeAction(id,kind,payload);
   if(current()!==id||signal.aborted||epoch!==version)return;
   draft=null;schedule=null;
   accepted=kind==='accept';
   if(accepted)onRosterChange(id);
  }catch(err){if(current()===id&&epoch===version)error=err.message;}
  finally{
   if(current()===id&&epoch===version){
    busy=false;
    await Promise.all([load(),check({refresh:false,localAccept:accepted})]);
    paint();
   }
  }
 }

 function compose(request){
  const proposed=request?terms(request):{offer:[],want:[],credits:0};
  draft={...proposed,id:request?.id,proposalId:request?null:crypto.randomUUID(),revision:request?.revision,
   recipient:request?.sender.id||'',direction:Math.sign(proposed.credits),amount:Math.abs(proposed.credits)||''};
  error='';paint();panel()?.querySelector('[data-trade-form] h2')?.focus();
 }

 root.addEventListener('click',event=>{
  const control=event.target.closest('[data-trade-action]');
  if(!control||!panel()?.contains(control)||busy||!live())return;
  const action=control.dataset.tradeAction, request=requestFor(control.closest('[data-trade-id]')?.dataset.tradeId);
  if(action==='compose'||action==='edit')compose(request);
  if(action==='cancel'){draft=null;error='';paint();panel()?.querySelector('[data-trade-action="compose"]')?.focus();}
  if(action==='reload'){error='';paint();void load();}
  if(action==='open-window')void save('window',{open:true});
  if(action==='close-window'&&(!data.open||window.confirm('Chiudere gli scambi? Le richieste in attesa scadranno.')))void save('window',{open:false});
  if(action==='schedule'){schedule={startsAt:localDateTime(data.window.startsAt),endsAt:localDateTime(data.window.endsAt)};paint();panel()?.querySelector('[name="startsAt"]')?.focus();}
  if(action==='cancel-schedule'){schedule=null;error='';paint();panel()?.querySelector('[data-trade-action="schedule"]')?.focus();}
  if(request&&(action==='accept'||action==='reject'))void save(action,{id:request.id,revision:request.revision});
 },{signal});

 root.addEventListener('input',event=>{
  if(schedule&&event.target.closest('[data-trade-schedule]')){schedule[event.target.name]=event.target.value;return;}
  const form=event.target.closest('[data-trade-form]');
  if(!form||!draft)return;
  const fields=new FormData(form);
  if(event.target.name==='recipient'){
   draft.recipient=fields.get('recipient');draft.want=[];paint();panel()?.querySelector('[name="recipient"]')?.focus();return;
  }
  draft.offer=fields.getAll('offer');draft.want=fields.getAll('want');
  draft.direction=Number(fields.get('creditDirection'));draft.amount=form.elements.creditAmount.value;
  draft.credits=draft.direction*Number(draft.amount);
  const amount=form.elements.creditAmount;
  amount.disabled=!draft.direction;amount.required=!!draft.direction;
  amount.closest('label').hidden=!draft.direction;
  const request=requestFor(draft.id);
  if(request)form.querySelector('[data-trade-submit]').textContent=different(draft,terms(request))?'Invia controproposta':'Accetta';
 },{signal});

 root.addEventListener('submit',event=>{
  if(event.target.matches('[data-trade-schedule]')){
   event.preventDefault();
   const fields=event.target.elements,start=new Date(fields.startsAt.value),end=new Date(fields.endsAt.value);
   if(end>start){void save('window',{startsAt:start.toISOString(),endsAt:end.toISOString()});}
   else{error='La fine deve essere successiva all’inizio.';paint();}
   return;
  }
  if(!event.target.matches('[data-trade-form]'))return;
  event.preventDefault();
  if(!draft||busy)return;
  const request=requestFor(draft.id);
  const kind=request?(different(draft,terms(request))?'counter':'accept'):'propose';
  void save(kind,{id:draft.id||draft.proposalId,revision:draft.revision,recipient:draft.recipient,offer:draft.offer,want:draft.want,credits:draft.credits});
 },{signal});

 return {render(){
  return `<section class="fanta-trades"><header class="president-heading"><button type="button" class="secondary league-settings-back" data-go="lega" aria-label="Torna alla lega">‹</button><h1>Scambi</h1></header><div data-trades-body></div></section>`;
 },attach(){
  switchLeague();paint();
  if(panel()&&!data)void load();
 },check,enter(){
  switchLeague();draft=null;schedule=null;error='';paint();
  if(!busy)void load();
 }};
}
