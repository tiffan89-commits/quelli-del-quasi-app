import {esc} from './fanta/formato.mjs';
import {backButton} from './back-navigation.mjs';
import {hubIcon} from './league-hub.mjs';
import {whatsappIcon} from './league-invite.mjs';
import {submissionPath} from './routes.mjs';
import {roundAvailability} from './slip-state.mjs';

export function barReminder(league,uid,now=Date.now()){
 const reminder=league?.slipReminder;
 if(!reminder||league.admin!==uid||Date.parse(reminder.deadline)<=now)return null;
 const round=league.rounds.find(r=>r.id===reminder.round);
 if(!round||roundAvailability(round,now)!=='aperta')return null;
 const recipients=league.members.filter(m=>!m.removed&&reminder.missing.includes(m.uid)).map(({uid,name})=>({uid,name}));
 return {...reminder,recipients,participants:recipients.map(m=>m.name)};
}

export function fantaReminder(home,barMembers=[],now=Date.now()){
 const reminder=home?.lineupReminder;
 if(!reminder||home.league.role!=='admin'||Date.parse(reminder.deadline)<=now)return null;
 const nicknames=new Map(barMembers.map(m=>[m.uid,m.name]));
 const recipients=reminder.missing.map(m=>({uid:m.uid,name:nicknames.get(m.uid)||m.name}));
 return {...reminder,recipients,participants:recipients.map(m=>m.name)};
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
 const link='https://quellidelquasi.com'+submissionPath(mode,league,reminder);
 const text=`Manca poco e non hai ancora inserito la tua ${bar?'schedina':'formazione'}. Cosa aspetti? Sbrigati!`;
 return 'https://wa.me/?text='+encodeURIComponent(text+'\n\n'+link);
}

export function renderPresidentReminders(mode,league,reminder){
 const bar=mode==='bar',title=bar?'Schedine da consegnare':'Formazioni da consegnare';
 const back=bar?'data-bar-page="lega"':'data-go="oggi"';
 const players=reminder?.recipients||[];
 return `<section class="president-reminders" data-reminder-mode="${mode}" data-reminder-league="${esc(league)}" data-reminder-round="${esc(reminder?.round||'')}" data-reminder-competition="${esc(reminder?.competition||'')}">
  <header class="participants-heading" data-os-header>${backButton(back,'Torna alla home')}<h1>${title}</h1></header>
  <div data-os-content data-os-flow class="president-reminder-scroll">${players.length?`
   <p class="fanta-note">Giornata ${esc(reminder.number||reminder.round)}</p>
   <ul class="reminder-players">${players.map(({uid,name})=>`<li><div class="reminder-player-row" data-reminder-recipient="${esc(uid)}"><strong>${esc(name)}</strong><div>
     <button type="button" class="secondary" data-reminder-channel="email" aria-label="Invia email a ${esc(name)}">Email</button>
     <button type="button" class="secondary" data-reminder-channel="push" aria-label="Invia notifica a ${esc(name)}">Notifica</button>
    </div></div><small data-reminder-feedback role="status"></small></li>`).join('')}</ul>
   <a class="whatsapp-invite secondary reminder-share" href="${esc(reminderShareUrl(mode,league,reminder))}" target="_blank" rel="noopener noreferrer">${whatsappIcon}<b>Condividi su WhatsApp</b></a>`
   :'<p role="status">Nessun partecipante da sollecitare in questo momento.</p>'}</div>
 </section>`;
}

export function bindPresidentReminders(section,send){
 if(!section)return;
 section.onclick=async event=>{
  const button=event.target.closest('[data-reminder-channel]');
  if(!button||button.disabled)return;
  const row=button.closest('[data-reminder-recipient]'),status=row.parentElement.querySelector('[data-reminder-feedback]');
  const {reminderMode:mode,reminderLeague:league,reminderRound:round,reminderCompetition:competition}=section.dataset;
  const channel=button.dataset.reminderChannel;
  button.disabled=true;status.textContent='Invio…';
  try{
   await send({league,round:mode==='fanta'?Number(round):round,uid:row.dataset.reminderRecipient,channel,...(competition?{competition}:{})});
   status.textContent=channel==='email'?'Email inviata.':'Notifica inviata.';
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 };
}
