import {esc} from './fanta/formato.mjs';
import {backButton} from './back-navigation.mjs';
import {hubIcon} from './league-hub.mjs';
import {whatsappIcon} from './league-invite.mjs';
import {appRoute} from './routes.mjs';
import {roundAvailability} from './slip-state.mjs';

export function barReminder(league,uid,now=Date.now()){
 const reminder=league?.slipReminder;
 if(!reminder||league.admin!==uid||Date.parse(reminder.deadline)<=now)return null;
 const round=league.rounds.find(r=>r.id===reminder.round);
 if(!round||roundAvailability(round,now)!=='aperta')return null;
 return {...reminder,participants:league.members.filter(m=>!m.removed&&reminder.missing.includes(m.uid)).map(m=>m.name)};
}

export function fantaReminder(home,barMembers=[],now=Date.now()){
 const reminder=home?.lineupReminder;
 if(!reminder||home.league.role!=='admin'||Date.parse(reminder.deadline)<=now)return null;
 const nicknames=new Map(barMembers.map(m=>[m.uid,m.name]));
 return {...reminder,participants:reminder.missing.map(m=>nicknames.get(m.uid)||m.name)};
}

export function homeReminderBanner(mode,reminder){
 const count=reminder?.participants.length;
 if(!count)return '';
 const bar=mode==='bar';
 const title=bar?(count===1?'Manca 1 schedina':`Mancano ${count} schedine`):(count===1?'Manca 1 formazione':`Mancano ${count} formazioni`);
 return `<button type="button" class="home-reminder" ${bar?'data-bar-page':'data-go'}="solleciti">${hubIcon('bell')}<b>${title}</b><span aria-hidden="true">›</span></button>`;
}

export function reminderShareUrl(mode,league,reminder){
 const bar=mode==='bar';
 const link='https://quellidelquasi.com/'+appRoute(bar?{mode,page:'schedina',league,round:reminder.round}:
  {mode,page:'squadra',section:'studio',league,round:reminder.round,competition:reminder.competition});
 const text=`Manca poco e non hai ancora inserito la tua ${bar?'schedina':'formazione'}. Cosa aspetti? Sbrigati!`;
 return 'https://wa.me/?text='+encodeURIComponent(text+'\n\n'+link);
}

export function renderPresidentReminders(mode,league,reminder){
 const bar=mode==='bar',title=bar?'Schedine da consegnare':'Formazioni da consegnare';
 const back=bar?'data-bar-page="lega"':'data-go="oggi"';
 const players=reminder?.participants||[];
 return `<section class="president-reminders">
  <header class="participants-heading" data-os-header>${backButton(back,'Torna alla home')}<h1>${title}</h1></header>
  <div data-os-content data-os-flow class="president-reminder-scroll">${players.length?`
   <p class="fanta-note">Giornata ${esc(reminder.number||reminder.round)}</p>
   <ul class="reminder-players">${players.map(name=>`<li>${esc(name)}</li>`).join('')}</ul>
   <a class="whatsapp-invite secondary reminder-share" href="${esc(reminderShareUrl(mode,league,reminder))}" target="_blank" rel="noopener noreferrer">${whatsappIcon}<b>Condividi su WhatsApp</b></a>`
   :'<p role="status">Nessun partecipante da sollecitare in questo momento.</p>'}</div>
 </section>`;
}
