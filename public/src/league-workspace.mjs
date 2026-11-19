import {presidentBarBridge} from './president-workspace.mjs';
import {askConfirmation} from './site-confirm.mjs';
import {esc} from './fanta/formato.mjs';
import {teamLogo} from './fanta/team-logo.mjs';
import {avatarSvg} from './avatar.mjs';
import {showQuasi} from './quasi-scene.mjs';
import {hubTile} from './league-hub.mjs';
import {leagueActions} from './league-actions.mjs';
import {barHomeInvite} from './bar-home-invite.mjs';
import {presidentEntry} from './president-panel.mjs';
import {backButton} from './back-navigation.mjs';
import {withMembershipProgress} from './membership-progress.mjs';

const personCount=members=>members.filter(m=>m.uid).length;
const workspaceData=(data,view)=>view==='manage'&&data?{...data,members:data.members.filter(m=>m.uid)}:data;
export function renderLeagueHub({bar,fanta,isAdmin,members},mode,inviteBar=bar){
 const barMode=mode==='bar',id=bar?.id,viewer=members.find(m=>m.isMe);
 const fantaAction=tab=>barMode?`data-league-fanta="${tab}" data-native-league="${esc(fanta.id)}"`:`data-go="${tab}"`;
 const hasTools=fanta?.isCoach&&fanta.kind!=='pilot';
 const auctionStatus=fanta?.auction==='running'?'In corso':fanta?.auction==='scheduled'?'Programmata':'Conclusa';
 const tiles=[
  (isAdmin||fanta?.isAdmin)?hubTile('gear','Pannello del presidente','',{action:id&&isAdmin?(barMode?'data-bar-page="admin"':presidentBarBridge):fantaAction('presidente'),admin:true,arrow:true}):'',
  hubTile('people',`Partecipanti · ${personCount(members)}`,'',{action:barMode?'data-bar-page="partecipanti"':'data-go="partecipanti"',arrow:true}),
  id?hubTile('rules','Regolamento del Bar','',{action:`${barMode?'':'data-mode="bar" '}data-bar-page="regolamento"`,arrow:true}):'',
  fanta?.isCoach?hubTile('rules','Regolamento del Fanta','',{action:fantaAction('regolamento'),arrow:true}):'',
  hasTools?hubTile('competition','Competizioni','',{action:fantaAction('competizioni'),arrow:true}):'',
  hasTools&&['scheduled','running','ended'].includes(fanta.auction)?hubTile('auction','Asta',auctionStatus,{action:fantaAction('asta'),arrow:true}):'',
  fanta?.isCoach?hubTile('trade','Scambi','',{action:fantaAction('scambi'),arrow:true}):'',
  id?hubTile('chat','Chat della lega','',{action:(barMode?'data-league-chat':'data-fanta-chat')+' aria-controls="league-chat-widget"'}):'',
  bar?.code&&inviteBar?barHomeInvite({...inviteBar,members:inviteBar.members||members.filter(m=>m.uid)},viewer?{id:viewer.uid}:null,esc):'',
 ];
 return `<div class="league-section-title"><h1>Lega</h1>${presidentEntry(barMode?'data-bar-page="impostazioni"':'data-tab="impostazioni"')}</div><div class="lega-hub">${tiles.join('')}</div>${leagueActions({bridge:!barMode})}`;
}

export function renderParticipantRows({members,isAdmin}){
 if(!members.length)return '<p role="status">Nessun partecipante.</p>';
 return `<ul class="participants-list">${members.map((m,i)=>{
  const name=m.name||m.team?.name||'Giocatore',own=m.isMe?'<small class="participant-tag is-me">Tu</small>':'',admin=m.isAdmin?'<small class="participant-tag">Admin</small>':'';
  const crest=m.team?`<button type="button" class="participant-art" data-participant-zoom="logo" aria-label="Ingrandisci lo stemma di ${esc(m.team.name)}">${teamLogo(m.team)}</button>`:'<span aria-hidden="true"></span>';
  const portrait=m.uid?`<button type="button" class="participant-art participant-avatar" data-participant-zoom="quasi" aria-label="Ingrandisci il Quasi di ${esc(name)}">${avatarSvg(m.avatar)}</button>`:'<span aria-hidden="true"></span>';
  return `<li class="participant-record"><div class="participant-row" data-participant-row="${i}">
   ${portrait}${crest}
   <div class="participant-copy"><div class="participant-line"><b>${esc(name)}</b>${own}${admin}${m.email?`<span class="participant-email">${esc(m.email)}</span>`:''}
    ${m.uid&&m.team?`<small class="participant-team">${esc(m.team.name)}</small>`:m.uid?'':'<small class="participant-team">Computer</small>'}</div>
   </div>
   ${isAdmin&&m.uid&&!m.isAdmin&&!m.isMe?`<button type="button" class="secondary participant-remove" data-participant-remove aria-label="Rimuovi ${esc(name)}">Rimuovi</button>`:''}
  </div></li>`;
 }).join('')}</ul>`;
}

export function leagueWorkspace({id,mode,view='hub',back='',fallback}){
 const participants=view==='participants',management=view==='manage';
 return `${participants?`<header class="participants-heading" data-os-header>${backButton(back,'Torna alla lega')}<h1>Partecipanti</h1></header>`:''}
 <div ${management?'':'data-os-content'} data-league-workspace data-league-id="${esc(id)}" data-league-mode="${mode}" data-league-view="${view}">
  ${fallback?((participants||management)?renderParticipantRows({...workspaceData(fallback,view),isAdmin:management&&fallback.isAdmin}):renderLeagueHub(fallback,mode)):'<p role="status">Caricamento…</p>'}
 </div>`;
}

function zoomLogo(team){
 const dialog=document.createElement('dialog');
 dialog.className='participant-logo-dialog';
 dialog.setAttribute('aria-label','Stemma di '+team.name);
 dialog.innerHTML=`<button type="button" class="secondary" aria-label="Chiudi">×</button>${teamLogo(team,{eager:true})}<h2>${esc(team.name)}</h2>`;
 dialog.querySelector('button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 document.body.append(dialog);
 dialog.showModal();
}

export function bindLeagueWorkspace(node,{load,remove,initial,onRemoved=()=>{},onPaint=()=>{}}){
 if(!node||node.dataset.bound)return null;
 node.dataset.bound='true';
 const {leagueId:id,leagueMode:mode,leagueView:view}=node.dataset;
 let data=workspaceData(initial,view),revision=0,activeRemoval=false;
 function paint(next){
  data=workspaceData(next,view);
  node.innerHTML=view==='hub'?renderLeagueHub(data,mode,initial?.bar||data.bar):renderParticipantRows({...data,isAdmin:view==='manage'&&data.isAdmin});
  onPaint();
 }
 async function refresh({strict=false}={}){
  const version=++revision;
  try{
   const value=await load(id,mode);
   if(node.isConnected&&version===revision)paint(value);
   return true;
  }catch(error){
   if(!node.isConnected||version!==revision)return;
   if(error.status===403||!data){
    data=null;
    node.innerHTML=`<p role="alert">${esc(error.message)}</p><button class="secondary" type="button" data-participants-retry>Riprova</button>`;
   }
   if(strict)throw Error('Partecipante rimosso. Ricarica la lega per aggiornare i dati.');
   return false;
  }
 }
 node.addEventListener('click',async event=>{
  const retry=event.target.closest('[data-participants-retry]');
  if(retry){void refresh();return;}
  const element=event.target.closest('[data-participant-row]');
  const member=element&&data?.members[Number(element.dataset.participantRow)];
  if(!member)return;
  const zoom=event.target.closest('[data-participant-zoom]')?.dataset.participantZoom;
  if(zoom==='quasi'){showQuasi(member);return;}
  if(zoom==='logo'){zoomLogo(member.team);return;}
  const button=event.target.closest('[data-participant-remove]');
  if(view!=='manage'||!button||activeRemoval||!member.uid||!data.isAdmin||member.isMe||member.isAdmin)return;
  const bar=data.bar;
  activeRemoval=true;
  node.querySelector('[data-participants-error]')?.remove();
  try{
   if(!await askConfirmation({title:'Rimuovi partecipante',message:'Vuoi rimuovere '+member.name+' dalla lega?',confirmLabel:'Rimuovi',danger:true})||!node.isConnected)return;
   button.disabled=true;
   await withMembershipProgress(node.ownerDocument,'Rimozione del partecipante…',async()=>{
    await remove({id,bar,mode,uid:member.uid});
    if(node.isConnected&&data)paint({...data,members:data.members.filter(m=>m.uid!==member.uid)});
    if(load)await refresh({strict:true});
    await onRemoved({bar});
   });
  }catch(error){
   if(node.isConnected){
    const message=document.createElement('p');message.dataset.participantsError='';
    message.setAttribute('role','alert');message.textContent=error.message;node.prepend(message);
   }
  }finally{activeRemoval=button.disabled=false;}
 });
 const ready=load?refresh():Promise.resolve(true);
 return {refresh,ready};
}

export function barLeagueFallback(bar,viewer){
 return {bar,isAdmin:bar.admin===viewer,fanta:null,members:bar.members.filter(m=>!m.removed).map(m=>({...m,isMe:m.uid===viewer,isAdmin:m.uid===bar.admin}))};
}
export function fantaLeagueFallback(view,bar,viewer){
 if(!view)return null;
 const fanta={id:view.league.id,kind:view.league.kind,auction:view.auction.status,isCoach:true,isAdmin:view.isAdmin};
 if(bar?.members)return {...barLeagueFallback(bar,viewer),fanta};
 return {bar,isAdmin:view.isAdmin,fanta,members:view.members.map(m=>m.human?{uid:m.isMe?viewer:m.team.id,name:m.team.manager,team:m.team,isMe:m.isMe,isAdmin:m.isAdmin}:{team:m.team})};
}
