import {askConfirmation} from './site-confirm.mjs';
import {avatarSvg} from './avatar.mjs';
import {esc} from './fanta/formato.mjs';
import {backButton} from './back-navigation.mjs';
import {bindSwipeBack} from './match-page.mjs';

function sheet(label,html){
 const dialog=document.createElement('dialog');
 dialog.className='league-access-sheet';
 dialog.setAttribute('aria-label',label);
 dialog.innerHTML=html;
 document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 return dialog;
}

export function createLeagueAccessPrompts({api,userId,onJoined,onRequests=()=>{}}){
 let dialog=null,checking=null,current=null;
 function close(){const prior=dialog;dialog=null;if(prior?.open)prior.close();}
 function show(entry,uid){
  dialog=sheet('Invito a una lega',`
   <h2>Invito a una lega</h2>
   <p>Vuoi entrare in <strong>${esc(entry.league)}</strong>?</p>
   <p role="alert" data-access-error></p>
   <div data-access-choice class="league-access-actions"><button type="button" class="primary" data-access-decision="accept">Accetta</button><button type="button" class="secondary" data-access-reject>Rifiuta</button></div>
   <div data-access-confirm hidden><p>Dovrai chiedere all’admin un nuovo invito per entrare.</p>
    <div class="league-access-actions">${backButton('data-access-cancel','Torna all’invito')}<button type="button" class="primary" data-access-decision="reject">Conferma rifiuto</button></div>
   </div>`);
  const shown=dialog;
  const choice=shown.querySelector('[data-access-choice]'),confirm=shown.querySelector('[data-access-confirm]'),error=shown.querySelector('[data-access-error]');
  const back=shown.querySelector('[data-access-cancel]');
  shown.addEventListener('cancel',e=>{e.preventDefault();if(!confirm.hidden)back.click();});
  bindSwipeBack(confirm,()=>back.click(),'both');
  shown.querySelector('[data-access-reject]').onclick=()=>{choice.hidden=true;confirm.hidden=false;confirm.querySelector('button').focus();};
  back.onclick=()=>{confirm.hidden=true;choice.hidden=false;shown.querySelector('[data-access-reject]').focus();};
  for(const control of shown.querySelectorAll('[data-access-decision]'))control.onclick=async()=>{
   if(control.disabled||userId()!==uid)return;
   for(const b of shown.querySelectorAll('button'))b.disabled=true;
   error.textContent='';
   try{
    const result=await api('league-access-respond',{id:entry.id,decision:control.dataset.accessDecision});
    if(userId()!==uid||shown!==dialog)return;
    close();
    if(result.league)await onJoined(result.league);
    void check();
   }catch(err){
    if(!shown.isConnected)return;
    if([404,409].includes(err.status)){
     const fresh=await api('league-access-inbox').catch(()=>null);
     if(fresh&&!fresh.some(item=>item.id===entry.id)){close();void check();return;}
    }
    error.textContent=err.message;for(const b of shown.querySelectorAll('button'))b.disabled=false;
   }
  };
  shown.showModal();
 }
 function check(){
  const uid=userId();
  if(uid!==current){close();current=uid;}
  if(!uid||document.hidden||navigator.onLine===false||dialog||document.querySelector('dialog[open]'))return;
  if(checking?.uid===uid)return checking.job;
  const job=api('league-access-inbox').then(entries=>{
   if(uid!==current||uid!==userId()||dialog||document.hidden||document.querySelector('dialog[open]'))return;
   const invite=entries?.find(entry=>entry.kind==='invite'),request=entries?.find(entry=>entry.kind==='request');
   if(request)onRequests(request);
   if(invite)show(invite,uid);
  }).catch(()=>{}).finally(()=>{if(checking?.job===job)checking=null;});
  checking={uid,job};
  return job;
 }
 return {check,close};
}

export function bindPresidentRequests(root,{api,league,onChanged}){
 let busy=false,items=[];
 async function load(){
  try{
   items=(await api('league-access-inbox')).filter(item=>item.kind==='request'&&item.leagueId===league);
   if(!root.isConnected)return;
   root.innerHTML=items.length?items.map(item=>`<article class="card president-access-request" data-request="${esc(item.id)}">
    <div class="league-access-player"><span class="league-access-portrait" aria-hidden="true">${avatarSvg(item.player.avatar)}</span><div><b>${esc(item.player.nickname)}</b><span>${esc(item.player.email)}</span></div></div>
    <div class="league-access-actions"><button type="button" class="primary" data-request-decision="accept">Approva</button><button type="button" class="secondary" data-request-decision="reject">Rifiuta</button></div>
    <p role="alert"></p></article>`).join(''):'<p>Nessuna richiesta in attesa.</p>';
  }catch(error){
   if(!root.isConnected)return;
   root.innerHTML='<p role="alert"></p><button type="button" class="secondary" data-retry-requests>Riprova</button>';
   root.querySelector('p').textContent=error.message;
   root.querySelector('button').onclick=load;
  }
 }
 root.addEventListener('click',async event=>{
  const button=event.target.closest('[data-request-decision]'),card=button?.closest('[data-request]');
  const item=card&&items.find(request=>request.id===card.dataset.request);
  if(!item||busy)return;
  busy=true;
  const decision=button.dataset.requestDecision;
  try{
   if(decision==='reject'&&!await askConfirmation({title:'Rifiuta richiesta',message:'Il giocatore avrà bisogno di un nuovo invito per entrare.',confirmLabel:'Rifiuta',danger:true}))return;
   if(!root.isConnected)return;
   await api('league-access-respond',{id:item.id,decision});
   await load();onChanged?.();
  }catch(error){card.querySelector('[role=alert]').textContent=error.message;}
  finally{busy=false;}
 });
 void load();
}
