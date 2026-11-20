import {leagueCreationFields} from './league-create-form.mjs';
import {quasiBanner} from './quasi-scene.mjs';
import {esc} from './fanta/formato.mjs';
import {backButton} from './back-navigation.mjs';

export const isLeagueEntryPage=page=>['join-league','create-league','activate-fanta'].includes(page);

export function renderLeagueOnboarding({user}){
 return `<section class="league-onboarding" aria-label="Scegli come entrare in una lega">
   ${user?`<div class="dash-hero league-wizard-quasi">${quasiBanner(user.avatar,user.name,{welcome:true})}<h1>Benvenuto, ${esc(user.name)}</h1></div>`:''}
   <div class="card league-onboarding-card">
     <div class="league-onboarding-option"><p>Cerchi una lega?</p><button type="button" class="primary" data-bar-page="join-league">Entra in una lega</button></div>
     <div class="league-onboarding-option"><p>Sei l’admin?</p><button type="button" class="secondary" data-bar-page="create-league">Crea una lega</button></div>
   </div>
 </section>`;
}

export function renderLeagueEntry({page,verified,league}){
 const join=page==='join-league',attach=page==='activate-fanta'&&!!league;
 const title=join?'Leghe disponibili':attach?'Attiva il Fanta':'Crea lega · Bar + Fanta';
 const back=attach?'admin':league?'barleague':'lega';
 const verification='<p class="notice">Conferma l’email per continuare. <button type="button" class="secondary" data-bar-page="profilo">Impostazioni account</button></p>';
 return `<section class="league-onboarding league-entry">
   <header class="league-entry-heading">${backButton(`data-bar-page="${back}"`)}<h1 tabindex="-1">${title}</h1></header>
   ${!verified?verification:join?'<div class="card league-onboarding-card" data-league-directory></div>':`<form class="card league-onboarding-card" id="create">
     ${leagueCreationFields(attach?{name:league.name,size:Math.max(2,league.members.length),locked:true}:{})}
     <button type="submit" class="primary">${attach?'Attiva Fanta':'Crea Bar e Fanta'}</button>
   </form>`}
 </section>`;
}
