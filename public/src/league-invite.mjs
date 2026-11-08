export const whatsappIcon = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6a12 12 0 0 0 5.8 1.5c6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.4ZM12 21.9a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.3-.4a10 10 0 1 1 8.5 4.6Zm5.5-7.4c-.3-.1-1.8-.9-2.1-1s-.5-.1-.7.2-.8 1-.9 1.1-.3.2-.6.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.6 1.1 3 1.3 3.2 2.2 3.4 5.3 4.7l1.8.7c.8.2 1.5.2 2 .1.6-.1 1.8-.8 2-1.5s.3-1.4.2-1.5-.3-.2-.6-.4Z"/></svg>`;
function leagueShareData(league){
  const link = `https://quellidelquasi.com/invito/${encodeURIComponent(league.code)}`;
  const message = `Ti aspetto su Quelli del Quasi! ⚽\n\nEntra nella lega «${league.name}»: ${link}\n\nCrei l'account in un minuto e sei già dentro.\n(Codice lega, se serve: ${league.code})\nLe scuse le porti tu.`;
  return {title:'Invito a '+league.name,text:message};
}
export async function shareLeagueInvite(league,{navigator=globalThis.navigator,open=(...args)=>globalThis.open?.(...args)}={}){
  if(!league?.code)return;
  const data=leagueShareData(league);
  if(typeof navigator?.share==='function'){
    try{await navigator.share(data);return;}
    catch(error){if(error?.name==='AbortError')return;}
  }
  open?.('https://wa.me/?text='+encodeURIComponent(data.text),'_blank','noopener,noreferrer');
}
export function whatsappInvite(league, esc, {iconOnly=false}={}) {
  const {text}=leagueShareData(league);
  return `<a class="whatsapp-invite secondary" href="${esc('https://wa.me/?text='+encodeURIComponent(text))}" target="_blank" rel="noopener noreferrer" aria-label="Invita con WhatsApp">${whatsappIcon}${iconOnly?'':'<span>Invita con WhatsApp</span>'}</a>`;
}

export function leagueInviteCapacity(bar, fanta){
  const link=bar?.nativeFantaLink;
  const size=Number(link?.maxMembers||bar?.fantaCreation?.size||fanta?.maxMembers||bar?.maxMembers)||null;
  const members=new Set([...(bar?.members||[]).map(m=>m.uid),...(link?.coachIds||[])].filter(Boolean));
  const count=Math.max(members.size,fanta?.humanMembers??0);
  return {size,count,full:size!==null?count>=size:fanta?.availableTeams===0};
}

export function compactLeagueInvite(bar, esc, {size,count,mode}){
  return `<section class="home-league-invite" data-home-league-invite aria-label="Invita nella lega"><button type="button" class="home-league-invite-main" ${mode==='fanta'?'data-go="presidente"':'data-bar-page="admin"'} data-president-group="persone"><b>Invita nella lega</b>${size?`<small>${esc(`${count}/${size} iscritti`)}</small>`:''}<span aria-hidden="true">→</span></button>${whatsappInvite(bar,esc,{iconOnly:true})}</section>`;
}
