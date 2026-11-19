import {esc} from './fanta/formato.mjs';
import {LEAGUE_COLORS,VIVID_LEAGUE_COLORS,leagueAccent,leagueMonogram} from './league-theme.mjs';

const accentField=mode=>mode==='fanta'?'fantaAccent':'accent';
const labels={bar:'Bar',fanta:'Fanta'};

export function leagueIdentityForm(league,{standalone=false}={}){
 const modes=standalone?['fanta']:['bar','fanta'],first=modes[0];
 const name=league.name,emblem=leagueMonogram(league),initial=leagueAccent(league,first);
 return `<form id="branding-form" class="league-identity-form" style="--identity-preview:${initial}">
  <div class="league-identity-preview">
   <span class="league-emblem" data-identity-monogram aria-hidden="true">${esc(emblem)}</span>
   <strong data-identity-name>${esc(name)}</strong>
  </div>
  <div class="league-identity-fields">
   <label class="field">Nome della lega<input name="name" value="${esc(name)}" maxlength="160" required></label>
   <label class="field">Sigla<input name="emblem" value="${esc(emblem)}" maxlength="8" required></label>
  </div>
  <label class="field">Motto<input name="motto" value="${esc(league.branding?.motto||'')}" maxlength="200"></label>
  ${standalone?'':`<div class="league-identity-tabs" role="tablist" aria-label="Colore per modalità">${modes.map(mode=>`<button type="button" role="tab" id="identity-tab-${mode}" aria-controls="identity-panel-${mode}" aria-selected="${mode===first}" tabindex="${mode===first?0:-1}" data-identity-tab="${mode}">${labels[mode]}</button>`).join('')}</div>`}
  ${modes.map(mode=>{
   const accent=leagueAccent(league,mode);
   const colors=VIVID_LEAGUE_COLORS.some(([value])=>value===accent)?VIVID_LEAGUE_COLORS:
    [LEAGUE_COLORS.find(([value])=>value===accent)||[accent,'Colore attuale'],...VIVID_LEAGUE_COLORS];
   return `<div id="identity-panel-${mode}" data-identity-panel="${mode}" ${standalone?'':`role="tabpanel" aria-labelledby="identity-tab-${mode}"`} ${mode===first?'':'hidden'}>
     <fieldset class="theme-palette league-identity-palette"><legend>Colore ${labels[mode]}</legend>
      ${colors.map(([value,label])=>`<label class="theme-option">
       <input type="radio" name="${standalone?'accent':accentField(mode)}" value="${value}" ${value===accent?'checked':''}>
       <span class="theme-swatch" style="--swatch:${value}" aria-hidden="true"></span><span>${esc(label)}</span>
      </label>`).join('')}
     </fieldset>
    </div>`;
  }).join('')}
  <button type="submit" class="primary">Salva identità</button><p role="status" class="league-identity-status"></p>
 </form>`;
}

export function bindLeagueIdentityForm(form,save){
 if(!form)return;
 const tabs=[...form.querySelectorAll('[data-identity-tab]')];
 let mode=tabs[0]?.dataset.identityTab||'fanta';
 const status=form.querySelector('[role="status"]'),submit=form.querySelector('[type="submit"]');
 const preview=form.querySelector('.league-identity-preview');
 const paint=()=>{
  form.style.setProperty('--identity-preview',form.elements[tabs.length?accentField(mode):'accent'].value);
  preview.querySelector('[data-identity-name]').textContent=form.elements.name.value;
  preview.querySelector('[data-identity-monogram]').textContent=form.elements.emblem.value.toLocaleUpperCase('it');
 };
 const select=tab=>{
  mode=tab.dataset.identityTab;
  for(const button of tabs){
   button.setAttribute('aria-selected',String(button===tab));
   button.tabIndex=button===tab?0:-1;
  }
  for(const panel of form.querySelectorAll('[data-identity-panel]'))panel.hidden=panel.dataset.identityPanel!==mode;
  paint();
 };
 for(const [index,tab] of tabs.entries()){
  tab.onclick=()=>select(tab);
  tab.onkeydown=event=>{
   const next={ArrowLeft:tabs[(index+tabs.length-1)%tabs.length],ArrowRight:tabs[(index+1)%tabs.length],Home:tabs[0],End:tabs.at(-1)}[event.key];
   if(!next)return;
   event.preventDefault();select(next);next.focus();
  };
 }
 form.oninput=paint;
 form.onsubmit=async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  submit.disabled=true;status.textContent='Salvataggio…';
  try{
   await save(Object.fromEntries(new FormData(form)));
   status.textContent='Identità salvata.';
  }catch(error){status.textContent=error.message;}
  finally{submit.disabled=false;}
 };
}
