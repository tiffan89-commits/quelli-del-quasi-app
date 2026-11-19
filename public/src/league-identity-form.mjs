import {esc} from './fanta/formato.mjs';
import {leagueAccent,leagueDisplayAccent,leagueMonogram} from './league-theme.mjs';
import {bindLeagueColorPicker,leagueColorPicker} from './league-color-picker.mjs';

const accentField=mode=>mode==='fanta'?'fantaAccent':'accent';
const labels={bar:'Bar',fanta:'Fanta'};

export function leagueIdentityForm(league,{standalone=false}={}){
 const modes=standalone?['fanta']:['bar','fanta'],first=modes[0];
 const name=league.name,emblem=leagueMonogram(league),initial=leagueAccent(league,first);
 return `<form id="branding-form" class="league-identity-form" style="--identity-preview:${initial};--identity-display:${leagueDisplayAccent(initial)}">
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
  ${modes.map(mode=>`<div id="identity-panel-${mode}" data-identity-panel="${mode}" ${standalone?'':`role="tabpanel" aria-labelledby="identity-tab-${mode}"`} ${mode===first?'':'hidden'}>
    ${leagueColorPicker(standalone?'accent':accentField(mode),labels[mode],leagueAccent(league,mode))}
   </div>`).join('')}
  <button type="submit" class="primary">Salva identità</button><p role="status" class="league-identity-status"></p>
 </form>`;
}

export function bindLeagueIdentityForm(form,save){
 if(!form)return;
 const tabs=[...form.querySelectorAll('[data-identity-tab]')];
 const panels=[...form.querySelectorAll('[data-identity-panel]')];
 let mode=tabs[0]?.dataset.identityTab||'fanta';
 const status=form.querySelector('[role="status"]'),submit=form.querySelector('[type="submit"]');
 const preview=form.querySelector('.league-identity-preview');
 const paintColor=()=>{
  const color=form.elements[tabs.length?accentField(mode):'accent'].value;
  form.style.setProperty('--identity-preview',color);
  form.style.setProperty('--identity-display',leagueDisplayAccent(color));
 };
 form.oninput=()=>{
  preview.querySelector('[data-identity-name]').textContent=form.elements.name.value;
  preview.querySelector('[data-identity-monogram]').textContent=form.elements.emblem.value.toLocaleUpperCase('it');
 };
 const resetColors=panels.map(panel=>bindLeagueColorPicker(panel.querySelector('.league-identity-palette'),paintColor));
 const select=tab=>{
  mode=tab.dataset.identityTab;
  for(const button of tabs){
   button.setAttribute('aria-selected',String(button===tab));
   button.tabIndex=button===tab?0:-1;
  }
  for(const [index,panel] of panels.entries()){
   panel.hidden=panel.dataset.identityPanel!==mode;
   if(panel.hidden)resetColors[index]();
  }
  paintColor();
 };
 for(const [index,tab] of tabs.entries()){
  tab.onclick=()=>select(tab);
  tab.onkeydown=event=>{
   const next={ArrowLeft:tabs[(index+tabs.length-1)%tabs.length],ArrowRight:tabs[(index+1)%tabs.length],Home:tabs[0],End:tabs.at(-1)}[event.key];
   if(!next)return;
   event.preventDefault();select(next);next.focus();
  };
 }
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
