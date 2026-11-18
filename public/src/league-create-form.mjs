const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function leagueCreationFields({name=''}={}){
 return `<h3 class="league-form-title">Una lega. Due modi di avere ragione.</h3>
 <div class="league-create-grid">
  <label class="field">Nome della lega<input name="name" required maxlength="80" autocomplete="off" value="${esc(name)}"></label>
  <label class="field">Numero di squadre<input name="size" type="number" min="2" max="12" value="8" step="1" required inputmode="numeric"></label>
 </div>
 <fieldset class="league-roster-choice"><legend>Come partono le rose?</legend>
  <label><input type="radio" name="rosterMode" value="empty" checked><span><b>Rose vuote</b><small>Giocatori da scegliere all’asta</small></span></label>
  <label><input type="radio" name="rosterMode" value="random"><span><b>Rose casuali equilibrate</b><small>Giocatori assegnati automaticamente</small></span></label>
 </fieldset>`;
}

export function leagueJoinFields(){
 return `<h3 class="league-form-title">Gli amici ti hanno tenuto il posto</h3>
 <label class="field">Codice lega<input name="code" required placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>`;
}

export function leagueCreationPayload(form){form.dataset.requestId||=crypto.randomUUID();const data=Object.fromEntries(new FormData(form));return {...data,size:Number(data.size),requestId:form.dataset.requestId};}
