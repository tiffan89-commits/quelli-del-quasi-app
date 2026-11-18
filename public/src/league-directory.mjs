import {esc} from './fanta/formato.mjs';

export function bindLeagueDirectory(root,{api,onJoined,onSupport}){
 let selected=null,leagues=[],query='',nextOffset=null,remaining=0;
 let loaded=false,loading=false,submitting=false,limited=false,message='',generation=0,searchTimer,scroll=0;
 const action=(name,label,attrs='')=>`<button type="button" class="${name==='request'?'primary':'secondary'}" data-directory-action="${name}" ${attrs}>${label}</button>`;
 root.innerHTML=`<form class="league-directory-search" role="search">
  <label class="field">Cerca una lega<input type="search" name="q" maxlength="80" placeholder="Nome della lega" autocomplete="off"></label>
  <button type="submit" class="secondary">Cerca</button>
 </form><div data-directory-list></div><div data-directory-detail class="league-directory-detail" hidden></div>`;
 const search=root.querySelector('form'),field=root.querySelector('input'),list=root.querySelector('[data-directory-list]'),detail=root.querySelector('[data-directory-detail]');
 const scroller=root.closest('main');

 function paint(){
  if(!root.isConnected)return;
  search.hidden=list.hidden=!!selected;
  detail.hidden=!selected;
  const status=message?`<p role="status">${esc(message)}</p>`:'';
  if(selected){
   const league=selected;
   detail.innerHTML=`${action('list','‹ Tutte le leghe')}<h2 tabindex="-1">${esc(league.name)}</h2>
    <h3>Partecipanti</h3><ul class="league-directory-members">${league.nicknames.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
    ${league.joined?action('enter','Apri la lega'):league.request==='pending'?'<p>Richiesta in attesa di approvazione.</p>':league.request==='rejected'?'<p>Puoi chiedere un nuovo invito all’admin.</p>':league.full?'<p>La lega è al completo.</p>':action('request','Unisciti a questa Lega',submitting?'disabled':'')}
    ${status}${limited?action('support','Contatta l’assistenza'):''}`;
   return;
  }
  list.innerHTML=`${leagues.length?`<ul class="league-directory-list">${leagues.map(l=>`<li><button type="button" class="secondary" data-directory-league="${esc(l.id)}"><strong>${esc(l.name)}</strong><small>${l.joined?'La tua lega':l.request==='pending'?'In attesa':l.full?'Al completo':l.nicknames.length===1?'1 partecipante':l.nicknames.length+' partecipanti'}</small><span aria-hidden="true">›</span></button></li>`).join('')}</ul>`:loaded&&!message?'<p>Nessuna lega trovata.</p>':''}
   ${status}${loading?'<p role="status">Caricamento…</p>':''}
   ${!loading&&(nextOffset!==null||message)?`<div class="league-directory-more">${action(message?'retry':'more',message?'Riprova':'Carica altre')}</div>`:''}`;
 }

 async function load({append=false}={}){
  if(!root.isConnected)return;
  const previousTotal=leagues.length,offset=append?nextOffset:0;
  if(offset===null)return;
  const version=++generation;
  if(!append){leagues=[];nextOffset=null;loaded=false;}
  loading=true;message='';paint();
  try{
   const params=new URLSearchParams({q:query,offset:String(offset)});
   const data=await api('league-directory?'+params);
   if(version!==generation)return;
   const current=new Set(leagues.map(l=>l.id));
   leagues.push(...data.leagues.filter(l=>!current.has(l.id)));
   nextOffset=data.nextOffset??null;remaining=data.remaining;loaded=true;
  }catch(err){if(version===generation)message=err.message;}
  finally{
   if(version===generation){
    loading=false;paint();
    if(append&&!message&&!selected)list.querySelectorAll('[data-directory-league]')[previousTotal]?.focus({preventScroll:true});
   }
  }
 }

 function searchNow(){
  clearTimeout(searchTimer);
  const value=field.value.trim();
  if(value===query&&loaded)return;
  query=value;void load();
 }
 search.addEventListener('submit',e=>{e.preventDefault();searchNow();});
 field.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchNow,220);});
 root.addEventListener('click',async event=>{
  const b=event.target.closest('button');
  if(!b||submitting)return;
  const id=b.dataset.directoryLeague,kind=b.dataset.directoryAction;
  if(id){scroll=scroller?.scrollTop||0;selected=leagues.find(l=>l.id===id);limited=false;message='';paint();if(scroller)scroller.scrollTop=0;detail.querySelector('h2')?.focus();return;}
  if(kind==='list'){
   const previous=selected.id;
   selected=null;message='';limited=false;paint();
   [...list.querySelectorAll('[data-directory-league]')].find(button=>button.dataset.directoryLeague===previous)?.focus({preventScroll:true});
   if(scroller)scroller.scrollTop=scroll;
   return;
  }
  if(kind==='more'||kind==='retry'){if(!loading)void load({append:nextOffset!==null});return;}
  if(kind==='support'){onSupport();return;}
  if(kind==='enter'){await onJoined(selected.id);return;}
  if(kind!=='request')return;
  if(remaining===0){message='Hai raggiunto il limite di tre leghe. Contatta l’assistenza.';limited=true;paint();return;}
  submitting=true;message='';b.disabled=true;
  try{
   await api('league-access-request',{league:selected.id});
   selected.request='pending';
   remaining=Math.max(0,remaining-1);
  }catch(err){message=err.message;limited=err.status===429;}
  finally{submitting=false;paint();}
 });
 return load;
}
