import {compactLeagueInvite,leagueInviteCapacity} from './league-invite.mjs';

// Use already cached membership/capacity data; never load Fanta just for a banner.
export function barHomeInvite(league,user,esc){
 if(!league?.code||!league.members?.some(m=>m.uid===user?.id))return '';
 const link=league.nativeFantaLink;
 const cachedTeams=new Set((league.rounds||[]).filter(r=>link&&r.nativeFanta?.leagueId===link.leagueId).flatMap(r=>(r.matches||[]).flatMap(m=>[m.homeId||m.home,m.awayId||m.away])).filter(Boolean));
 const capacity=leagueInviteCapacity(league,{maxMembers:league.maxMembers||cachedTeams.size});
 return capacity.full?'':compactLeagueInvite(league,esc,capacity);
}
