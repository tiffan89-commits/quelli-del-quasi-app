const pending=new WeakMap(),installed=new WeakSet();let interaction=null;
export function loadingLabel(button){const text=button?.textContent||'';return /accedi|accesso|entra in amministrazione/i.test(text)?'Accesso in corso…':/registr/i.test(text)?'Registrazione in corso…':/invia|ricevi|reinvia/i.test(text)?'Invio in corso…':/salva|conferma (schedina|modifiche)|formazione/i.test(text)?'Salvataggio in corso…':/elimina|cancella|rimuovi/i.test(text)?'Operazione in corso…':'Caricamento…';}
export function beginButtonFeedback(button,{label,restoreDisabled=true}={}){
 if(!button?.setAttribute)return ()=>{};
 let state=pending.get(button);
 if(state){state.count++;return ()=>finish(button,state);}
 state={count:1,disabled:button.disabled,html:button.innerHTML,label:label||loadingLabel(button),aria:button.getAttribute('aria-label'),form:button.form||button.closest('form'),restoreDisabled};pending.set(button,state);
 button.disabled=true;button.setAttribute('aria-busy','true');button.classList.add('is-busy');button.textContent=state.label;
 if(state.form)state.form.dataset.actionBusy=String(Number(state.form.dataset.actionBusy||0)+1);
 return ()=>finish(button,state);
}
function finish(button,state){if(pending.get(button)!==state||--state.count>0)return;pending.delete(button);if(button.textContent===state.label)button.innerHTML=state.html;button.removeAttribute('aria-busy');button.classList.remove('is-busy');if(state.restoreDisabled)button.disabled=state.disabled;if(state.form){const count=Number(state.form.dataset.actionBusy||1)-1;if(count)state.form.dataset.actionBusy=String(count);else delete state.form.dataset.actionBusy;}}
export async function withButtonFeedback(button,job,options){if(pending.has(button))return;const done=beginButtonFeedback(button,options);try{return await job();}finally{done();}}
export function beginRequestFeedback(){return beginButtonFeedback(interaction?.button);}
export function installActionFeedback(doc=globalThis.document){
 if(!doc?.addEventListener||installed.has(doc))return;installed.add(doc);
 const capture=event=>{
  const button=event.type==='submit'?(event.submitter||event.target.querySelector('button[type="submit"],button:not([type])')):event.target.closest?.('button,input[type="submit"]');if(!button)return;
  const form=button.form||button.closest('form');
  if(pending.has(button)||form?.dataset.actionBusy){event.preventDefault();event.stopImmediatePropagation();return;}
  const current={button};interaction=current;
  queueMicrotask(()=>{
   if(interaction===current)interaction=null;
   // Legacy handlers that disable before awaiting file reading or rendering get the same feedback.
   if(button.disabled&&!pending.has(button)&&typeof MutationObserver!=='undefined'){
    const done=beginButtonFeedback(button,{restoreDisabled:false});const observer=new MutationObserver(()=>{if(!button.disabled){observer.disconnect();done();}});observer.observe(button,{attributes:true,attributeFilter:['disabled']});
   }
  });
 };
 doc.addEventListener('click',capture,true);doc.addEventListener('submit',capture,true);
}
installActionFeedback();
