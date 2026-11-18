import {leagueCreationFields,leagueJoinFields} from './league-create-form.mjs';

export function renderLeagueOnboarding({verified,step}){
 const verification='<p class="notice">Conferma l’email per continuare. <button type="button" class="secondary" data-bar-page="profilo">Impostazioni account</button></p>';
 const form=(kind,fields,label)=>`<form id="${kind}" class="card league-onboarding-card" data-league-step="${kind}" ${step===kind?'':'hidden'}>
   <button type="button" class="text-button league-wizard-back" data-league-choice="">‹ Indietro</button>
   ${fields()}
   ${verified?`<button type="submit" class="primary">${label}</button>`:verification}
 </form>`;
 return `<section class="league-onboarding" data-league-onboarding aria-label="Scegli come entrare in una lega">
   <div class="card league-onboarding-card" data-league-step="" ${step?'hidden':''}>
     <div class="league-onboarding-option"><p>Hai già un codice?</p><button type="button" class="primary" data-league-choice="join">Entra in una lega</button></div>
     <div class="league-onboarding-option"><p>Sei l’admin?</p><button type="button" class="secondary" data-league-choice="create">Crea una lega</button></div>
   </div>
   ${form('join',leagueJoinFields,'Entra nella lega')}
   ${form('create',leagueCreationFields,'Crea Bar e Fanta')}
 </section>`;
}

export function bindLeagueOnboarding(root,onStep){
 if(!root)return;
 root.addEventListener('click',event=>{
  const choice=event.target.closest('[data-league-choice]');
  if(!choice)return;
  const step=choice.dataset.leagueChoice;
  const previous=choice.closest('[data-league-step]').dataset.leagueStep;
  for(const panel of root.querySelectorAll('[data-league-step]'))panel.hidden=panel.dataset.leagueStep!==step;
  onStep(step);
  const selector=step?`[data-league-step="${step}"] input`:`[data-league-choice="${previous}"]`;
  root.querySelector(selector)?.focus();
 });
}
