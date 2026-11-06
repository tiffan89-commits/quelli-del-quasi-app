import {whatsappInvite} from './league-invite.mjs';

// Use already cached membership/capacity data; never load Fanta just for a banner.
export function barHomeInvite(league,user,esc){
 if(!league?.code||!league.members?.some(m=>m.uid===user?.id))return '';
 const link=league.nativeFantaLink;
 const cachedTeams=new Set((league.rounds||[]).filter(r=>r.nativeFanta?.leagueId===link?.leagueId&&link).flatMap(r=>(r.matches||[]).flatMap(m=>[m.homeId||m.home,m.awayId||m.away])));
 const size=Number(link?.maxMembers||league.fantaCreation?.size||league.maxMembers||cachedTeams.size)||null;
 const humans=Array.isArray(link?.coachIds)?new Set(link.coachIds.filter(uid=>league.members.some(m=>m.uid===uid))).size:league.members.length;
 if(size&&humans>=size)return '';
 return '<section class="bar-home-invite" data-home-league-invite aria-label="Invita nella tua lega"><div><span class="eyebrow">AL BANCONE C’È POSTO</span><h2>Invita nella tua lega</h2><p>'+esc(size?humans+'/'+size+' '+(link?'allenatori':'giocatori')+' · porta gli amici al bancone.':'Porta gli amici al bancone. Le scuse le offriamo noi.')+'</p></div><div class="league-invite-actions">'+whatsappInvite(league,esc)+'<button type="button" class="secondary" data-bar-page="admin" data-president-group="persone">Link e codice</button></div></section>';
}
