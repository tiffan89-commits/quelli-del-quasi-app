import {whatsappIcon} from './league-invite.mjs';
import {withButtonFeedback} from './action-feedback.mjs';

// Public invitation: deliberately independent of accounts, leagues and codes.
export const APP_INVITE_URL='https://quellidelquasi.com/#registrati';
export const APP_INVITE_TEXT='Ti aspetto su Quelli del Quasi! ⚽\nFantacalcio, schedine e amici al bar. Niente pubblicità, per sempre.\nLe scuse le porti tu.';
export const appShareData=()=>({title:'Quelli del Quasi',text:APP_INVITE_TEXT,url:APP_INVITE_URL});
export function appWhatsappInvite({data=appShareData(),iconOnly=false}={}){
 const href='https://wa.me/?text='+encodeURIComponent(data.text+'\n\n'+data.url);
 return `<a class="whatsapp-invite secondary" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Invita a usare l’app con WhatsApp">${whatsappIcon}${iconOnly?'':'<span>WhatsApp</span>'}</a>`;
}

export function renderAppInvite(){
 return `<section class="card app-invite" data-app-invite aria-label="Invita a usare l’app">
  <p class="muted">Al bancone c’è posto. Fai conoscere Quelli del Quasi ai tuoi amici.</p>
  <div class="league-invite-actions">
   <button type="button" class="secondary" data-app-invite-share>Invita a usare l’app</button>
   ${appWhatsappInvite()}
   <button type="button" class="secondary" data-app-invite-copy>Copia link</button>
  </div>
  <div class="app-invite-link" data-app-invite-fallback hidden><label>Link dell’app<input readonly aria-label="Link pubblico di Quelli del Quasi" value="${APP_INVITE_URL}"></label></div>
  <p class="tiny muted app-invite-status" data-app-invite-status role="status" aria-live="polite"></p>
 </section>`;
}

export const signupShareData=()=>({title:'Quelli del Quasi',text:'Al Bar manca quello che dice «l’avevo detto». Registrati a Quelli del Quasi: fantacalcio tra amici, schedine virtuali e scuse da fuoriclasse.',url:APP_INVITE_URL});

export async function performAppInvite(action,{navigator=globalThis.navigator,data=appShareData()}={}){
 if(action==='share'&&typeof navigator?.share==='function'){
  try{await navigator.share(data);return {message:'Invito condiviso.'};}
  catch(error){if(error?.name==='AbortError')return {message:''};}
 }
 try{if(typeof navigator?.clipboard?.writeText!=='function')throw Error('Clipboard unavailable');await navigator.clipboard.writeText(data.url);return {message:'Link dell’app copiato. Passalo al prossimo Quasi.'};}
 catch{return {manual:true,message:'Tieni premuto sul link e copialo.'};}
}

export function bindAppInvites(root=globalThis.document,{navigator=globalThis.navigator}={}){
 for(const panel of root?.querySelectorAll?.('[data-app-invite]')||[]){
  for(const [selector,action]of [['[data-app-invite-copy]','copy'],['[data-app-invite-share]','share']]){
   const button=panel.querySelector(selector);if(!button)continue;
   button.onclick=e=>{e.preventDefault();e.stopPropagation();void withButtonFeedback(button,async()=>{
    const result=await performAppInvite(action,{navigator}),status=panel.querySelector('[data-app-invite-status]');if(status)status.textContent=result.message;
    const fallback=panel.querySelector('[data-app-invite-fallback]');if(fallback){fallback.hidden=!result.manual;if(result.manual){const input=fallback.querySelector('input');input?.focus();input?.select();}}
   },{label:action==='copy'?'Copio il link…':'Apro la condivisione…'});};
  }
 }
}
