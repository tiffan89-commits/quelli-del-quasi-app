import {submitSupport} from './support.mjs';
import {fail} from './game.mjs';
import {createHash} from 'node:crypto';

export const WAITLIST_SEASON='2027/28';
export const WAITLIST_TO='tiffan89@gmail.com';
const roles=['Presidente di lega','Giocatore'];
const sizes=['4–6','8','10','12 o più','Non lo so ancora'];

export function submitFantasyWaitlist(s,u,p,env=process.env){
 if(!u||u.demo||u.adminOnly||!u.emailVerified||!u.email)fail('Accedi con un indirizzo email verificato',403);
 const role=String(p.role||''),size=String(p.size||''),note=String(p.note||'').trim();
 if(!roles.includes(role)||!sizes.includes(size))fail('Scegli il ruolo e quanti siete in lega');
 if(!note||note.length>500)fail('Scrivi un messaggio (massimo 500 caratteri)');
 const existing=s.supportMessages?.find(x=>x.uid===u.id&&x.waitlist?.season===WAITLIST_SEASON);
 if(existing){u.fantacalcioWaitlistSeason=WAITLIST_SEASON;return existing;}
 const record=submitSupport(s,u,{
  kind:'suggestion',requestId:'fantawaitlist-'+createHash('sha256').update(u.id+':'+WAITLIST_SEASON).digest('hex').slice(0,40),page:'fantaquasi',
  subject:'Fantacalcio '+WAITLIST_SEASON+': nuova iscrizione alla lista',
  message:['Il bar ha un nuovo aspirante fantallenatore. Il taccuino del mercato può aspettare, questa iscrizione no.',
   'Stagione: '+WAITLIST_SEASON,'Ruolo scelto: '+role,'Partecipanti in lega: '+size,'Messaggio: '+note].join('\n\n'),
 },{...env,SUPPORT_TO:WAITLIST_TO});
 record.waitlist={season:WAITLIST_SEASON,role,size,note};
 u.fantacalcioWaitlistSeason=WAITLIST_SEASON;
 return record;
}
