import {esc} from './formato.mjs';
import {whatsappInvite} from '../league-invite.mjs';

export function linkedInvite(league,bars=[]){
 if(league?.role!=='admin'||!(league.availableTeams>0))return null;
 const bar=bars.find(b=>b.nativeFantaLink?.leagueId===league.id);
 return bar?.code?{...bar,url:'https://quellidelquasi.com/invito/'+encodeURIComponent(bar.code)}:null;
}

export function renderLeagueInvite(league,bar,{copied=false}={}){
 if(league?.role!=='admin'||!(league.availableTeams>0)||!bar?.code)return '';
 return `<section class="fanta-block fanta-home-invite" aria-label="Invita nella lega"><span class="eyebrow">Al bancone c’è posto</span><h2>Invita nella lega</h2><p>${league.humanMembers}/${league.maxMembers} allenatori in carne e ossa. Il computer cede volentieri la panchina.</p><div class="fanta-lg-invite-actions">${whatsappInvite(bar,esc)}<button type="button" class="secondary" data-lega-invite="share">Condividi invito</button><button type="button" class="secondary" data-lega-invite="copy">${copied?'Link copiato ✓':'Copia link'}</button></div><small>Codice lega: <b>${esc(bar.code)}</b></small></section>`;
}
