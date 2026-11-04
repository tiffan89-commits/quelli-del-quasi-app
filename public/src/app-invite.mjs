import {whatsappIcon} from './league-invite.mjs';
import {withButtonFeedback} from './action-feedback.mjs';

// Public invitation: deliberately independent of accounts, leagues and codes.
export const APP_INVITE_URL='https://quellidelquasi.com/';
export const APP_INVITE_TEXT='Ti aspetto su Quelli del Quasi! ⚽\nFantacalcio, schedine e amici al bar. Niente pubblicità, per sempre.\nLe scuse le porti tu.';
export const appShareData=()=>({title:'Quelli del Quasi',text:APP_INVITE_TEXT,url:APP_INVITE_URL});
const whatsappUrl='https://wa.me/?text='+encodeURIComponent(APP_INVITE_TEXT+'\n\n'+APP_INVITE_URL);

export function renderAppInvite({leagueMode=null}={}){
 const leagueAction=leagueMode==='bar'?'data-page="admin"':leagueMode==='fanta'?'data-invite-league="true"':null;
 return `<details class="card app-invite" data-app-invite><summary>Invita a usare l’app</summary>
  <p class="muted">Al bancone c’è posto. Fai conoscere Quelli del Quasi ai tuoi amici.</p>
  <div class="league-invite-actions">
   <a class="whatsapp-invite secondary" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="Invita a usare l’app con WhatsApp">${whatsappIcon}<span>WhatsApp</span></a>
   <button type="button" class="secondary" data-app-invite-copy>Copia link</button>
   <button type="button" class="secondary" data-app-invite-share hidden>Altre app</button>
  </div>
  <div class="app-invite-link" data-app-invite-fallback hidden><label>Link dell’app<input readonly aria-label="Link pubblico di Quelli del Quasi" value="${APP_INVITE_URL}"></label></div>
  <p class="tiny muted app-invite-status" data-app-invite-status role="status" aria-live="polite"></p>
  ${leagueAction?`<div class="app-invite-league"><p class="tiny muted">Sei il presidente? Puoi anche invitare un amico nella tua lega.</p><button type="button" class="secondary" ${leagueAction}>Invita nella lega</button></div>`:''}
 </details>`;
}

export async function performAppInvite(action,{navigator=globalThis.navigator}={}){
 if(action==='share'&&typeof navigator?.share==='function'){
  try{await navigator.share(appShareData());return {message:'Invito condiviso.'};}
  catch(error){if(error?.name==='AbortError')return {message:''};}
 }
 try{if(typeof navigator?.clipboard?.writeText!=='function')throw Error('Clipboard unavailable');await navigator.clipboard.writeText(APP_INVITE_URL);return {message:'Link dell’app copiato. Passalo al prossimo Quasi.'};}
 catch{return {manual:true,message:'Tieni premuto sul link e copialo.'};}
}

export function bindAppInvites(root=globalThis.document,{navigator=globalThis.navigator}={}){
 for(const panel of root?.querySelectorAll?.('[data-app-invite]')||[]){
  const share=panel.querySelector('[data-app-invite-share]');if(share)share.hidden=typeof navigator?.share!=='function';
  for(const [selector,action]of [['[data-app-invite-copy]','copy'],['[data-app-invite-share]','share']]){
   const button=panel.querySelector(selector);if(!button)continue;
   button.onclick=e=>{e.preventDefault();e.stopPropagation();void withButtonFeedback(button,async()=>{
    const result=await performAppInvite(action,{navigator}),status=panel.querySelector('[data-app-invite-status]');if(status)status.textContent=result.message;
    const fallback=panel.querySelector('[data-app-invite-fallback]');if(fallback){fallback.hidden=!result.manual;if(result.manual){const input=fallback.querySelector('input');input?.focus();input?.select();}}
   },{label:action==='copy'?'Copio il link…':'Apro la condivisione…'});};
  }
 }
}
