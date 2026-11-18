import {avatarSvg} from './avatar.mjs';
import {esc} from './fanta/formato.mjs';

function sheet(label,html){
 const dialog=document.createElement('dialog');
 dialog.className='league-access-sheet';
 dialog.setAttribute('aria-label',label);
 dialog.innerHTML=html;
 document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 return dialog;
}

export function showLeagueInvite({api,league}){
 if(document.querySelector('.league-access-sheet[open]'))return;
 const dialog=sheet('Invita un giocatore',`<h2>Invita un giocatore</h2>
  <form class="league-access-invite">
   <label class="field">Nickname o email<input name="identity" required maxlength="254" autocomplete="off" autocapitalize="none"></label>
   <div class="league-access-actions"><button class="primary">Invia invito</button><button type="button" class="secondary" data-close-invite>Chiudi</button></div>
   <p role="status"></p>
  </form>`);
 const form=dialog.querySelector('form'),button=form.querySelector('button'),status=form.querySelector('[role=status]');
 dialog.querySelector('[data-close-invite]').onclick=()=>dialog.close();
 form.onsubmit=async event=>{
  event.preventDefault();
  if(button.disabled)return;
  button.disabled=true;status.textContent='';
  try{await api('league-access-invite',{league,identity:form.elements.identity.value});form.reset();status.textContent='Invito inviato.';}
  catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 };
 dialog.showModal();
}

export function createLeagueAccessPrompts({api,userId,onJoined}){
 let dialog=null,checking=null,current=null;
 function close(){const prior=dialog;dialog=null;if(prior?.open)prior.close();}
 function show(entry,uid){
  const request=entry.kind==='request';
  dialog=sheet(request?'Richiesta di ingresso':'Invito a una lega',`
   <h2>${request?'Richiesta di ingresso':'Invito a una lega'}</h2>
   ${request?`<div class="league-access-player"><span class="league-access-portrait" aria-hidden="true">${avatarSvg(entry.player.avatar)}</span><div><b>${esc(entry.player.nickname)}</b><span>${esc(entry.player.email)}</span></div></div>`:''}
   <p>${request?'Vuole entrare in ':'Vuoi entrare in '}<strong>${esc(entry.league)}</strong>?</p>
   <p role="alert" data-access-error></p>
   <div data-access-choice class="league-access-actions"><button type="button" class="primary" data-access-decision="accept">${request?'Approva':'Accetta'}</button><button type="button" class="secondary" data-access-reject>Rifiuta</button></div>
   <div data-access-confirm hidden><p>${request?'Il giocatore dovrà ricevere un nuovo invito.':'Dovrai chiedere all’admin un nuovo invito per entrare.'}</p>
    <div class="league-access-actions"><button type="button" class="secondary" data-access-cancel>Torna indietro</button><button type="button" class="primary" data-access-decision="reject">Conferma rifiuto</button></div>
   </div>`);
  const shown=dialog;
  shown.addEventListener('cancel',e=>e.preventDefault());
  const choice=shown.querySelector('[data-access-choice]'),confirm=shown.querySelector('[data-access-confirm]'),error=shown.querySelector('[data-access-error]');
  shown.querySelector('[data-access-reject]').onclick=()=>{choice.hidden=true;confirm.hidden=false;confirm.querySelector('button').focus();};
  shown.querySelector('[data-access-cancel]').onclick=()=>{confirm.hidden=true;choice.hidden=false;shown.querySelector('[data-access-reject]').focus();};
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
   if(uid===current&&uid===userId()&&!dialog&&!document.hidden&&!document.querySelector('dialog[open]')&&entries?.[0])show(entries[0],uid);
  }).catch(()=>{}).finally(()=>{if(checking?.job===job)checking=null;});
  checking={uid,job};
  return job;
 }
 return {check,close};
}
