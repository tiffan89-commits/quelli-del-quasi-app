export const barAccessible=(league,uid)=>league?.barEnabled!==false||league.admin===uid;
export const fantaAccessible=(league,uid)=>league?.fantaEnabled!==false||(league.fantaAdminUid??league.admin)===uid;
export const nativeFantaAccessible=(league,uid)=>league?.accessEnabled!==false||league.role==='admin'||!!uid&&league.adminUid===uid;
export const leagueGameSettings=league=>({
 barEnabled:league?.barEnabled!==false,
 fantaEnabled:league?.fantaEnabled!==false,
 fantaSlipsEnabled:league?.fantaSlipsEnabled!==false,
});

export function leagueGameAccessForm(league,{bar=true,fanta=true}={}){
 const settings=leagueGameSettings(league);
 const toggle=(key,label)=>`<label class="account-toggle"><span>${label}</span>
  <input type="checkbox" role="switch" class="fanta-switch" name="${key}" ${settings[key]?'checked':''}></label>`;
 return `<section class="card league-game-access" data-league-game-access>
  <h2>Accesso al gioco</h2>
  ${bar?toggle('barEnabled','Bar'):''}
  ${fanta?toggle('fantaEnabled','Fanta')+`<div class="league-game-access-sub">${toggle('fantaSlipsEnabled','Schedine del Fanta')}</div>`:''}
  <p class="muted league-game-access-status" role="status"></p>
 </section>`;
}

export function bindLeagueGameAccess(panel,save,notify){
 if(!panel)return;
 const switches=[...panel.querySelectorAll('input')],status=panel.querySelector('[role="status"]');
 panel.onchange=async ({target})=>{
  if(!switches.includes(target)||panel.getAttribute('aria-busy')==='true')return;
  const enabled=target.checked;
  panel.setAttribute('aria-busy','true');
  switches.forEach(input=>{input.disabled=true;});
  status.textContent='Salvataggio…';
  try{await save({key:target.name,enabled});status.textContent=enabled?'Attivato':'Disattivato';}
  catch(error){target.checked=!enabled;status.textContent=error.message;notify?.(error.message);}
  finally{panel.removeAttribute('aria-busy');switches.forEach(input=>{input.disabled=false;});}
 };
}
