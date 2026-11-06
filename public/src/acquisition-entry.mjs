import {campaignLinks,rememberEntry,clearEntry,cleanPreviewUrl} from './acquisition-intent.mjs';
import {requestJson} from './live-channel.mjs';
import {esc} from './fanta/formato.mjs';
cleanPreviewUrl(location,history);const root=document.getElementById('entry-root'),query=campaignLinks(location.search);let busy=false;
for(const a of document.querySelectorAll('[data-leave-entry]'))a.addEventListener('click',()=>clearEntry(localStorage));
const shell=(title,copy,actions)=>`<p class="acq-eyebrow">IL FANTA DEI QUASI</p><h1>${title}</h1><p class="acq-lead">${copy}</p><div class="acq-entry-actions">${actions}</div>`;
function ready(team){clearEntry(localStorage);const href='/#/fanta/squadra?lega='+encodeURIComponent(team.league);root.innerHTML=shell('Benvenuto,<br>mister.','La tua squadra è <strong>'+esc(team.name)+'</strong>. La rosa è pronta: adesso tocca a te.',`<a class="acq-primary" href="${href}">Schiera la prima formazione <span>↗</span></a><a class="acq-demo" href="/#/fanta/oggi?lega=${encodeURIComponent(team.league)}">Prima guardo la mia sfida →</a><p class="acq-micro">La squadra resta tua. I risultati precedenti restano nello storico.</p>`);}
async function load(){try{const status=await requestJson('/fanta-api/entry/status',{credentials:'same-origin',timeoutMs:15000});
 if(!status.enabled){root.innerHTML=shell('La panchina<br>si prepara.','Le iscrizioni alla prova sono in pausa. Intanto puoi esplorare il Fanta senza registrarti.','<a class="acq-primary" href="/#demo">Guarda la demo ↗</a><a class="acq-demo" data-leave-entry href="/">Vai all’app →</a>');return;}
 if(!status.signedIn){rememberEntry(localStorage);root.innerHTML=shell('Il tuo posto<br>al bancone.','Crea l’account e conferma l’email. Poi ti assegniamo una squadra libera nella lega di prova.',`<a class="acq-primary" href="/${query}#registrati">Crea l’account e gioca <span>↗</span></a><a class="acq-demo" href="/${query}#accedi">Ho già un account →</a><p class="acq-micro">La disponibilità della squadra viene controllata dopo l’accesso.</p>`);return;}
 if(status.owned){ready(status.owned);return;}
 if(!status.available){root.innerHTML=shell('Tutte occupate.<br>Per ora.','Le squadre di prova hanno già un allenatore. Torna a trovarci: stiamo preparando altre panchine.','<button class="acq-primary" data-retry>Ricontrolla i posti ↻</button><a class="acq-demo" data-leave-entry href="/">Vai alla tua app →</a>');return;}
 root.innerHTML=shell('Una squadra.<br>La tua.','La rosa è già pronta. Ti assegniamo una squadra libera: potrai schierare la formazione della prossima giornata.','<button class="acq-primary" data-claim>Assegna la mia squadra <span>↗</span></button><p class="acq-micro">Una squadra a testa nella prova. L’assegnazione resta salvata.</p>');
 }catch{root.innerHTML=shell('La panchina<br>fa le bizze.','Non riusciamo a controllare il tuo ingresso. Riprova: non perdi la tua squadra.','<button class="acq-primary" data-retry>Riprova ↻</button><a class="acq-demo" href="/prendi-squadra.html">Torna indietro →</a>');}}
root.addEventListener('click',async e=>{
 if(e.target.closest('[data-leave-entry]'))clearEntry(localStorage);
 const b=e.target.closest('[data-claim],[data-retry]');if(!b||busy)return;busy=true;b.disabled=true;b.setAttribute('aria-busy','true');b.textContent=b.hasAttribute('data-claim')?'Assegnazione in corso…':'Controllo in corso…';
 try{if(b.hasAttribute('data-claim')){const team=await requestJson('/fanta-api/entry/claim',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}',timeoutMs:20000});ready(team);}else await load();}
 catch(error){try{const s=await requestJson('/fanta-api/entry/status',{credentials:'same-origin',timeoutMs:15000});if(s.owned){ready(s.owned);return;}}catch{}root.innerHTML=shell('Un attimo,<br>mister.',esc(error.message||'Non siamo riusciti a completare l’ingresso.'),'<button class="acq-primary" data-retry>Controlla il mio ingresso ↻</button><a class="acq-demo" data-leave-entry href="/">Torna all’app →</a>');}finally{busy=false;}
});
load();
