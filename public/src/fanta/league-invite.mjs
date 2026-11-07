import {esc} from './formato.mjs';
import {whatsappInvite,compactLeagueInvite,leagueInviteCapacity} from '../league-invite.mjs';

export function linkedInvite(league,bars=[]){
 if(!league)return null;
 const bar=bars.find(b=>b.nativeFantaLink?.leagueId===league.id);
 return bar?.code?{...bar,url:'https://quellidelquasi.com/invito/'+encodeURIComponent(bar.code)}:null;
}

export function renderLeagueInvite(league,bar,{copied=false,always=false}={}){
 if(!league||!bar?.code)return '';
 const capacity=leagueInviteCapacity(bar,league);
 if(!always)return capacity.full?'':compactLeagueInvite(bar,esc,{...capacity,mode:'fanta'});
 return `<section class="fanta-block fanta-home-invite" aria-label="Invita nella lega"><h2>Invita nella lega</h2><p>${capacity.size?`${capacity.count}/${capacity.size} iscritti. `:''}${capacity.full?'La lega è al completo.':''}</p><div class="fanta-lg-invite-actions">${whatsappInvite(bar,esc)}<button type="button" class="secondary" data-lega-invite="share">Condividi invito</button><button type="button" class="secondary" data-lega-invite="copy">${copied?'Link copiato ✓':'Copia link'}</button></div><small>Codice lega: <b>${esc(bar.code)}</b></small></section>`;
}
