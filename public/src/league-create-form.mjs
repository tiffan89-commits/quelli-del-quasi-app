const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function leagueCreationFields({name='',size=8,locked=false}={}){
 return `<h3 class="league-form-title">Una lega. Due modi di avere ragione.</h3>
 <div class="league-create-grid">
  <label class="field">Nome della lega<input name="name" required maxlength="80" autocomplete="off" value="${esc(name)}" ${locked?'readonly':''}></label>
  <label class="field">Numero di squadre<input name="size" type="number" min="2" max="12" value="${size}" ${locked?'readonly':''} step="1" required inputmode="numeric"></label>
 </div>
 <fieldset class="league-roster-choice"><legend>Come partono le rose?</legend>
  <label><input type="radio" name="rosterMode" value="empty" checked><span><b>Rose vuote</b><small>Giocatori da scegliere all’asta</small></span></label>
  <label><input type="radio" name="rosterMode" value="random"><span><b>Rose casuali equilibrate</b><small>Giocatori assegnati automaticamente</small></span></label>
 </fieldset>`;
}

export function leagueCreationPayload(form){form.dataset.requestId||=crypto.randomUUID();const data=Object.fromEntries(new FormData(form));return {...data,size:Number(data.size),requestId:form.dataset.requestId};}

export function bindLeagueCreation(form,onSubmit){
 if(!form)return;
 form.onsubmit=async event=>{
  event.preventDefault();
  if(form.dataset.submitting==='true')return;
  const buttons=[...form.querySelectorAll('button')];
  form.dataset.submitting='true';
  buttons.forEach(button=>button.disabled=true);
  try{await onSubmit(leagueCreationPayload(form));}
  finally{form.dataset.submitting='false';buttons.forEach(button=>button.disabled=false);}
 };
}
