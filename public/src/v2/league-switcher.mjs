import {leagueEmblem,leagueName,linkedLeagueIdentity} from '../league-theme.mjs';
import {roundAvailability,slipWaitingForPrevious,sourceOf} from '../slip-state.mjs';
import {paintAuctionBadges} from '../auction-index.mjs';
import {openSiteOverlay} from '../site-overlay.mjs';
import {unreadLabel} from '../chat-badges.mjs';

export const isLeagueAdmin=(league,uid)=>league?.admin===uid||(Array.isArray(league?.admins)&&league.admins.includes(uid));

export function attentionOf(league,uid,now=Date.now()){
 const broken=league.fantasyConnections?.some(c=>c.server&&c.status&&c.status!=='connected');
 if(broken&&isLeagueAdmin(league,uid))return {level:'warn',text:'Collegamento da rinnovare'};
 const rounds=(league.rounds||[]).filter(r=>sourceOf(r)==='seriea'&&!r.archived);
 const next=rounds.find(r=>roundAvailability(r,now)==='aperta'&&!slipWaitingForPrevious(r,rounds,now));
 if(!next)return {level:'ok',text:'Nessuna schedina aperta'};
 return next.slip?{level:'ok',text:'Schedina campionato salvata'}:{level:'todo',text:'Schedina campionato da compilare'};
}
export function leagueChip(league,attributes,esc,mode='bar'){
 if(!league)return '';
 return `<button type="button" class="v2-league-chip" ${attributes} aria-haspopup="dialog" aria-label="Cambia lega, ${esc(leagueName(league))}">
  ${leagueEmblem(league,mode)}<span class="shell-league-copy"><small>Lega</small><span class="shell-league-name-line"><span class="v2-league-name">${esc(leagueName(league))}</span><span class="league-chat-dot" data-league-chat-dot="${esc(league.id||'')}" role="img" ${league.chat?.unread?'aria-label="'+unreadLabel(league.chat.unread)+'"':'hidden'}></span></span></span>
  <span class="shell-chevron" aria-hidden="true">⌄</span><span class="auction-index-dot" data-auction-indicator="*" aria-label="Asta in corso" hidden></span>
 </button>`;
}
export function renderLeagueChip(league,uid,esc,fmt,mode=''){
 return league?`<header class="v2-top shell-compact">${leagueChip(league,'id="v2-open-leagues"',esc)}${mode}</header>`:'';
}

export function leagueSheetRows(bars,fantas,uid,mode){
 const rows=bars.map(bar=>({bar,fanta:fantas.find(item=>item.id===bar.nativeFantaLink?.leagueId)}));
 rows.push(...fantas.filter(fanta=>!rows.some(row=>row.fanta?.id===fanta.id)).map(fanta=>({fanta})));
 return rows.map(({bar,fanta})=>{
  const entrant=bar?.members?.find(m=>m.uid===uid);
  const rank=entrant?1+bar.members.filter(m=>Number(m.points||0)>Number(entrant.points||0)).length:null;
  return {identity:mode==='fanta'&&fanta?linkedLeagueIdentity(fanta,bars):bar||fanta,id:mode==='bar'?(bar?.id||fanta?.id):(fanta?.id||bar?.id),
   barId:bar?.id,fantaId:fanta?.id||bar?.nativeFantaLink?.leagueId,rank,fantaRank:fanta?.position,
   chatUnread:bar?.chat?.unread||0,pending:bar?attentionOf(bar,uid).level==='todo':false,lineupPending:!!fanta?.lineupPending};
 });
}
const rankLine=({barId,rank,fantaId,fantaRank})=>[
 barId?'Bar'+(rank?' '+rank+'°':''):'',
 fantaId?'Fanta'+(fantaRank?' '+fantaRank+'°':''):'',
].filter(Boolean).join(' · ');

export function renderLeagueSheet(leagues,activeId,uid,esc,{fantas=[],mode='bar'}={}){
 const rows=leagueSheetRows(leagues,fantas,uid,mode);
 return `<dialog class="social-league-sheet" aria-labelledby="social-league-title">
  <div class="sheet-top"><div class="v2-sheet-handle" aria-hidden="true"></div>
  <h2 id="social-league-title">Le tue leghe</h2><button type="button" data-close-leagues class="sheet-close" aria-label="Chiudi le leghe" autofocus>×</button></div>
  <div class="social-league-list" data-overlay-scroll>${rows.map(({identity,id,pending,lineupPending,...row})=>`<button type="button" class="v2-league-row${id===activeId?' is-active':''}" data-league-choice="${esc(id)}"${id===activeId?' aria-current="true"':''}>
    ${leagueEmblem(identity,mode)}<span class="v2-league-info"><span class="shell-league-name-line"><b>${esc(leagueName(identity))}</b><span class="league-chat-dot" data-league-chat-dot="${esc(row.barId||id)}" role="img" aria-label="${unreadLabel(row.chatUnread)}" ${row.chatUnread?'':'hidden'}></span></span><small data-league-position>${esc(rankLine(row))}</small></span>
    <span class="sheet-indicators"><span class="auction-index-tag" data-auction-indicator="${esc(row.fantaId||'')}" hidden>ASTA</span>
    <span data-league-pending class="sheet-pending" ${pending||lineupPending?'':'hidden'} role="img" aria-label="${pending&&lineupPending?'Schedina e formazione da consegnare':pending?'Schedina da consegnare':'Formazione da consegnare'}"></span>
    ${id===activeId?'<span aria-hidden="true">✓</span>':''}</span>
  </button>`).join('')}</div>
  <div class="social-league-actions"><button type="button" class="secondary" data-league-entry="create-league">Crea lega</button><button type="button" class="secondary" data-league-entry="join-league">Leghe disponibili</button></div>
 </dialog>`;
}

export function fantaHomeStatus(home,now=Date.now()){
 const phase=home?.nextLineup||home?.round;
 return {fantaRank:home?.me?.position,lineupPending:!!phase&&phase.open!==false&&Date.parse(phase.deadline)>now&&(home.nextLineup?!phase.savedAt:phase.state==='da-schierare')};
}

export function openLeagueSheet({leagues,fantas=[],mode='bar',activeId,uid,esc,onSelect,onEntry,readFanta,readLeagues,trigger}){
 const root=trigger.ownerDocument.createElement('template');
 root.innerHTML=renderLeagueSheet(leagues,activeId,uid,esc,{fantas,mode});
 const dialog=root.content.firstElementChild;
 let rows=leagueSheetRows(leagues,fantas,uid,mode);
 const close=openSiteOverlay(dialog,trigger);
 const paintBadges=()=>{paintAuctionBadges(dialog);trigger.ownerDocument.dispatchEvent(new Event('quasi:chat-badges'));};
 paintBadges();
 dialog.querySelector('[data-close-leagues]').onclick=close;
 dialog.onclick=event=>{
  const entry=event.target.closest('[data-league-entry]');
  if(entry){close();onEntry(entry.dataset.leagueEntry);return;}
  const button=event.target.closest('[data-league-choice]');
  if(button){const row=rows.find(r=>r.id===button.dataset.leagueChoice);close();if(row?.id!==activeId)onSelect(row);}
 };
 if(readFanta||readLeagues)void (async()=>{
  if(readLeagues){
   try{
    const other=await readLeagues();
    if(!dialog.open)return;
    const next=leagueSheetRows(leagues,other,uid,mode);
    if(next.length!==rows.length){
     const template=trigger.ownerDocument.createElement('template');
     template.innerHTML=renderLeagueSheet(leagues,activeId,uid,esc,{fantas:other,mode});
     const list=dialog.querySelector('.social-league-list'),choice=trigger.ownerDocument.activeElement?.dataset.leagueChoice;
     list.replaceChildren(...template.content.querySelector('.social-league-list').children);
     if(choice)[...list.children].find(button=>button.dataset.leagueChoice===choice)?.focus({preventScroll:true});
     paintBadges();
    }
    rows=next;
   }catch{}
  }
  if(!readFanta)return;
  const buttons=[...dialog.querySelectorAll('[data-league-choice]')];
  const enrich=async(row,index)=>{
   if(!dialog.open||!row.fantaId)return;
   try{
    const status=await readFanta(row.fantaId);
    if(!dialog.open||!status)return;
    buttons[index].querySelector('[data-league-position]').textContent=rankLine({...row,...status});
    const dot=buttons[index].querySelector('[data-league-pending]');
    dot.hidden=!(row.pending||status.lineupPending);
    dot.setAttribute('aria-label',row.pending?(status.lineupPending?'Schedina e formazione da consegnare':'Schedina da consegnare'):'Formazione da consegnare');
   }catch{}
  };
  for(let i=0;i<rows.length&&dialog.open;i+=3)await Promise.all(rows.slice(i,i+3).map((row,j)=>enrich(row,i+j)));
 })();
}

export function bindLeagueSwitcher({leagues,activeId,uid,esc,onSelect,onEntry,readFanta,readLeagues,onFanta}){
 for(const trigger of document.querySelectorAll('#v2-open-leagues,[data-open-leagues]')){
  trigger.onclick=()=>openLeagueSheet({leagues,activeId,uid,esc,onSelect:row=>row.barId?onSelect(row.barId):onFanta(row.fantaId),onEntry,readFanta,readLeagues,trigger});
 }
}
