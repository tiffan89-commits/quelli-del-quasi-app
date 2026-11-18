import {esc} from './fanta/formato.mjs';

export function bindLeagueDirectory(root,{api,onJoined,onSupport}){
 let selected=null,listing=null,busy=false,message='',limited=false;
 const action=(name,label,attrs='')=>`<button type="button" class="${name==='request'?'primary':'secondary'}" data-directory-action="${name}" ${attrs}>${label}</button>`;
 function paint(){
  if(!root.isConnected)return;
  const league=listing?.leagues.find(l=>l.id===selected);
  if(league){
   root.innerHTML=`${action('list','‹ Tutte le leghe')}<h3 tabindex="-1">${esc(league.name)}</h3>
    <h4>Partecipanti</h4><ul class="league-directory-members">${league.nicknames.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
    ${league.joined?action('enter','Apri la lega'):league.request==='pending'?'<p>Richiesta in attesa di approvazione.</p>':league.request==='rejected'?'<p>Puoi chiedere un nuovo invito all’admin.</p>':league.full?'<p>La lega è al completo.</p>':action('request','Unisciti a questa Lega',busy?'disabled':'')}
    ${message?`<p role="status">${esc(message)}</p>`:''}${limited?action('support','Contatta l’assistenza'):''}`;
  }else if(listing){
   root.innerHTML=`<h3 tabindex="-1">Scegli una lega</h3>
    ${listing.leagues.length?`<ul class="league-directory-list">${listing.leagues.map((l,i)=>`<li><button type="button" class="secondary" data-directory-league="${i}"><strong>${esc(l.name)}</strong><small>${l.joined?'La tua lega':l.request==='pending'?'In attesa':l.full?'Al completo':l.nicknames.length+' partecipanti'}</small><span aria-hidden="true">›</span></button></li>`).join('')}</ul>`:'<p>Nessuna lega disponibile.</p>'}`;
  }else root.innerHTML=message?`<p role="alert">${esc(message)}</p>${action('reload','Riprova')}`:'<p role="status">Carichiamo le leghe…</p>';
 }
 async function load(){
  if(busy)return;
  busy=true;message='';paint();
  try{listing=await api('league-directory');}catch(err){message=err.message;}
  finally{busy=false;paint();}
 }
 root.addEventListener('click',async event=>{
  const b=event.target.closest('button');
  if(!b||busy)return;
  const index=b.dataset.directoryLeague,kind=b.dataset.directoryAction;
  if(index!==undefined){selected=listing.leagues[Number(index)].id;limited=false;message='';paint();root.querySelector('h3')?.focus();return;}
  if(kind==='list'){selected=null;message='';limited=false;paint();root.querySelector('h3')?.focus();return;}
  if(kind==='reload'){void load();return;}
  if(kind==='support'){onSupport();return;}
  if(kind==='enter'){await onJoined(selected);return;}
  if(kind!=='request')return;
  if(listing.remaining===0){message='Hai raggiunto il limite di tre leghe. Contatta l’assistenza.';limited=true;paint();return;}
  busy=true;message='';b.disabled=true;
  try{
   await api('league-access-request',{league:selected});
   listing.leagues.find(l=>l.id===selected).request='pending';
   listing.remaining=Math.max(0,listing.remaining-1);
  }catch(err){message=err.message;limited=err.status===429;}
  finally{busy=false;paint();}
 });
 return load;
}
