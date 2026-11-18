import {leagueCreationFields} from './league-create-form.mjs';
import {quasiBanner} from './quasi-scene.mjs';
import {bindLeagueDirectory} from './league-directory.mjs';

export function renderLeagueOnboarding({verified,step,user}){
 const verification='<p class="notice">Conferma l’email per continuare. <button type="button" class="secondary" data-bar-page="profilo">Impostazioni account</button></p>';
 const form=(kind,fields,label)=>`<form id="${kind}" class="card league-onboarding-card" data-league-step="${kind}" ${step===kind?'':'hidden'}>
   <button type="button" class="text-button league-wizard-back" data-league-choice="">‹ Indietro</button>
   ${fields()}
   ${verified?`<button type="submit" class="primary">${label}</button>`:verification}
 </form>`;
 return `<section class="league-onboarding" data-league-onboarding aria-label="Scegli come entrare in una lega">
   ${user?`<div class="dash-hero league-wizard-quasi">${quasiBanner(user.avatar,user.name)}</div>`:''}
   <div class="card league-onboarding-card" data-league-step="" ${step?'hidden':''}>
     <div class="league-onboarding-option"><p>Cerchi una lega?</p><button type="button" class="primary" data-league-choice="join">Entra in una lega</button></div>
     <div class="league-onboarding-option"><p>Sei l’admin?</p><button type="button" class="secondary" data-league-choice="create">Crea una lega</button></div>
   </div>
   <section id="join" class="card league-onboarding-card" data-league-step="join" ${step==='join'?'':'hidden'}><button type="button" class="text-button league-wizard-back" data-league-choice="">‹ Indietro</button>${verified?'<div data-league-directory></div>':verification}</section>
   ${form('create',leagueCreationFields,'Crea Bar e Fanta')}
 </section>`;
}

export function bindLeagueOnboarding(root,{onStep,api,onJoined,onSupport}){
 if(!root)return;
 const directory=root.querySelector('[data-league-directory]');
 const load=directory?bindLeagueDirectory(directory,{api,onJoined,onSupport}):null;
 let loaded=false;
 function showDirectory(){
  if(!load||loaded)return;
  loaded=true;void load();
 }
 if(directory&&!directory.closest('[hidden]'))showDirectory();
 root.addEventListener('click',event=>{
  const choice=event.target.closest('[data-league-choice]');
  if(!choice)return;
  const step=choice.dataset.leagueChoice;
  const previous=choice.closest('[data-league-step]').dataset.leagueStep;
  for(const panel of root.querySelectorAll('[data-league-step]'))panel.hidden=panel.dataset.leagueStep!==step;
  onStep(step);
  if(step==='join')showDirectory();
  const selector=step==='join'?'[data-league-step="join"] [data-league-choice]':step?`[data-league-step="${step}"] input`:`[data-league-choice="${previous}"]`;
  root.querySelector(selector)?.focus();
 });
}
