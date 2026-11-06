const day=86400000,ratio=(a,b)=>b>0?a/b:null;
const round=n=>Math.round(n*10)/10;
export const currentRows=report=>(report?.rows||[]).filter(r=>!r.dateRange||r.dateRange==='current');
export const previousRows=report=>(report?.rows||[]).filter(r=>r.dateRange==='previous');
export function analyticsSummary(google){
 if(!google)return null;
 return {current:currentRows(google.summary)[0]||{},previous:previousRows(google.summary)[0]||{},quality:Object.values(google).filter(v=>v?.metadata).flatMap(v=>Object.entries(v.metadata).filter(([k,v])=>['thresholded','otherRow','truncated'].includes(k)&&v).map(([k])=>k))};
}
export function recommend(report){
 const suggestions=[],p=report.product,g=report.google,summary=analyticsSummary(g)?.current;
 const add=(id,title,priority,reason,action,evidence,metric=null)=>suggestions.push({id,title,priority,reason,action,evidence,metric});
 if(!g)add('connect-google','Collega i report Google',1,'Non abbiamo ancora un report Google verificato. Le visite non possono essere dedotte dalle richieste API.','Completare l’accesso di sola lettura alla proprietà Google Analytics.',[{label:'Stato Google',value:report.googleStatus||'Da collegare',source:'server'}]);
 if(g&&summary.sessions<100)add('collect-sample','Raccogli un campione più ampio',3,'Il numero di sessioni è ancora piccolo: variazioni di pochi utenti possono cambiare molto le percentuali.','Osservare almeno 100 sessioni prima di valutare cambiamenti di campagna o interfaccia.',[{label:'Sessioni negli ultimi 28 giorni completi',value:summary.sessions||0,source:'GA4'}]);
 if(p?.requests>=100&&p.errorRate>=.03)add('reduce-errors','Riduci gli errori nelle operazioni',1,'Almeno il 3% delle richieste registrate ha restituito un errore. Il dato include anche errori di validazione e accesso, non soltanto guasti.','Controllare prima accesso e salvataggi, distinguendo errori attesi da errori del server.',[{label:'Richieste registrate in 28 giorni',value:p.requests,source:'app'},{label:'Risposte con errore',value:p.errors,source:'app'},{label:'Quota errori (%)',value:round(p.errorRate*100),source:'app'}],'errorRate');
 const routeTotals={};
 for(const d of p?.days||[])for(const [name,r]of Object.entries(d.routes||{})){const t=routeTotals[name]??={calls:0,milliseconds:0};t.calls+=r.calls;t.milliseconds+=r.milliseconds;}
 const slow=Object.entries(routeTotals).filter(([,r])=>r.calls>=10&&r.milliseconds/r.calls>1500).sort((a,b)=>b[1].milliseconds/b[1].calls-a[1].milliseconds/a[1].calls)[0];
 if(slow)add('speed-'+slow[0],'Snellisci le operazioni più lente',1,'Una rotta supera 1,5 secondi di tempo medio registrato. La media può nascondere picchi e non equivale al tempo di caricamento della pagina.','Misurare la rotta indicata e verificare query, dimensione della risposta e attese di rete.',[{label:'Operazione',value:slow[0],source:'app'},{label:'Tempo medio registrato (ms)',value:Math.round(slow[1].milliseconds/slow[1].calls),source:'app'},{label:'Richieste nel campione',value:slow[1].calls,source:'app'}],'latency:'+slow[0]);
 if(p?.mail.failures24>0)add('check-mail','Verifica gli invii email',1,'Il registro recente contiene tentativi di invio falliti. Un tentativo fallito potrebbe essere già stato recuperato.','Controllare coda e risposta del provider; non reinviare messaggi già accettati.',[{label:'Tentativi falliti nelle ultime 24 ore',value:p.mail.failures24,source:'app'},{label:'Messaggi attualmente in coda',value:p.mail.pending,source:'app'}]);
 const devices=currentRows(g?.devices),mobile=devices.find(d=>d.deviceCategory==='mobile'),desktop=devices.find(d=>d.deviceCategory==='desktop');
 if(mobile?.sessions>=30&&desktop?.sessions>=30&&desktop.engagementRate-mobile.engagementRate>.2)add('mobile-journey','Controlla il percorso da smartphone',2,'Le sessioni coinvolte da mobile sono proporzionalmente meno di quelle desktop. Canali e pubblico differenti possono spiegare parte della differenza.','Provare demo, registrazione e prima formazione su schermi piccoli. Con Clarity cercare i punti di attrito.',[{label:'Sessioni mobile',value:mobile.sessions,source:'GA4'},{label:'Coinvolgimento mobile (%)',value:round(mobile.engagementRate*100),source:'GA4'},{label:'Coinvolgimento desktop (%)',value:round(desktop.engagementRate*100),source:'GA4'}],'engagementRate');
 if(summary?.sessions>=100&&summary.engagementRate<.35)add('landing-relevance','Rendi più chiaro il primo passo',2,'Meno del 35% delle sessioni è classificato da Google come coinvolto. La soglia è una regola di attenzione interna, non un benchmark del settore.','Allineare messaggio degli annunci, anteprima della demo e invito a provare l’app; cambiare un elemento alla volta.',[{label:'Sessioni',value:summary.sessions,source:'GA4'},{label:'Sessioni coinvolte (%)',value:round(summary.engagementRate*100),source:'GA4'}],'engagementRate');
 const events=currentRows(g?.events),requested=events.find(e=>e.eventName==='registration_requested')?.eventCount||0,activated=events.find(e=>e.eventName==='sign_up')?.eventCount||0;
 if(requested>=10&&activated<requested*.5)add('verify-signup','Controlla la conferma delle registrazioni',2,'Gli eventi di richiesta registrazione sono molti più degli eventi di attivazione. Non è un funnel per persona: ripetizioni, consensi e attivazioni successive possono incidere.','Verificare recapito della mail, chiarezza della conferma e ritorno all’app dopo l’attivazione.',[{label:'Eventi richiesta registrazione',value:requested,source:'GA4'},{label:'Eventi attivazione',value:activated,source:'GA4'}]);
 const c=report.clarity;
 if(c&&report.clarityStatus==='ready'&&!c.limited){
  const checks=[['scriptErrors',3,'clarity-errors','Verifica gli errori JavaScript','Aprire Clarity e verificare gli errori ripetuti, poi riprodurre il problema senza alterare dati del gioco.'],['rageClicks',3,'clarity-rage','Controlla i clic ripetuti','Provare i controlli più usati: verificare feedback immediato, stato di attesa e possibilità di riprovare.'],['deadClicks',10,'clarity-dead','Controlla i clic senza risposta','Verificare che gli elementi che sembrano cliccabili rispondano e che i salvataggi mostrino un esito chiaro.'],['quickbacks',15,'clarity-back','Controlla i ritorni immediati','Provare la navigazione dalle pagine di ingresso: cercare promesse poco chiare o passaggi inattesi.']];
  for(const [key,threshold,id,title,action]of checks){const s=c.friction?.[key];if(s?.sessions>=50&&s.affectedPct>=threshold)add(id,title,2,'Clarity segnala una quota di sessioni sopra la soglia di attenzione interna nelle ultime 72 ore. È un indizio da verificare, non la prova di un guasto o di una causa.',action,[{label:'Sessioni nel campione della metrica',value:s.sessions,source:'Clarity · 72 ore'},{label:'Sessioni interessate (%)',value:s.affectedPct,source:'Clarity · 72 ore'}]);}
 }
 return suggestions.sort((a,b)=>a.priority-b.priority).slice(0,8);
}
function completedWindow(rows,start,kind){
 const dates=Array.from({length:7},(_,i)=>new Date(start+i*day).toISOString().slice(0,10));
 const selected=dates.map(date=>rows.find(r=>(r.date?.includes('-')?r.date:r.date?.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'))===date));
 if(selected.some(r=>!r))return null;
 const route=kind.startsWith('latency:')?kind.slice(8):null;
 const denominator=selected.reduce((s,r)=>s+(route?(r.routes?.[route]?.calls||0):kind==='errorRate'?r.requests:r.sessions),0),numerator=selected.reduce((s,r)=>s+(route?(r.routes?.[route]?.milliseconds||0):kind==='errorRate'?r.errors:r.engagedSessions),0);
 return {from:dates[0],to:dates[6],sample:denominator,value:ratio(numerator,denominator),unit:route?'ms':'rate'};
}
export function evaluateImprovement(task,report,now=Date.now()){
 if(task.status!=='applied')return {state:task.status||'todo'};
 if(!task.metric)return {state:'applied',message:'Modifica dichiarata applicata. Non è disponibile un indicatore automatico sufficientemente specifico per provarne l’efficacia.'};
 // Match Google's property timezone for GA days; app counters explicitly use UTC.
 const latency=task.metric.startsWith('latency:'),operational=latency||task.metric==='errorRate';
 const timezone=operational?'UTC':report.google?.summary?.metadata?.timeZone||'Europe/Rome';
 const calendarDay=value=>{try{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return Date.parse(parts.year+'-'+parts.month+'-'+parts.day+'T00:00:00Z');}catch{return NaN;}};
 const appliedDay=calendarDay(task.appliedAt),afterStart=appliedDay+day;
 if(!Number.isFinite(afterStart)||calendarDay(now)<afterStart+8*day)return {state:'observing',message:'In osservazione: servono sette giornate complete dopo la modifica e il tempo di consolidamento dei dati.'};
 if(!operational&&analyticsSummary(report.google)?.quality?.length)return {state:'insufficient',message:'Il report Google segnala limitazioni: il confronto automatico non viene dichiarato conclusivo.'};
 // Exclude the application day from both windows: it mixes the old and new behavior.
 const rows=operational?report.product?.days||[]:report.google?.daily?.rows||[],before=completedWindow(rows,appliedDay-7*day,task.metric),after=completedWindow(rows,afterStart,task.metric);
 const minimum=latency?30:task.metric==='errorRate'?100:50;
 if(!before||!after||before.sample<minimum||after.sample<minimum)return {state:'insufficient',message:'Dati o campione insufficienti per confrontare due settimane complete.',before,after};
 if(latency){if(before.value<=0)return {state:'insufficient',message:'Il tempo medio precedente non è disponibile.'};const delta=(after.value-before.value)/before.value*100;return {state:Math.abs(delta)<10?'stable':delta<0?'improved':'worsened',before,after,relativeChangePct:round(delta),message:'Tempi medi della stessa operazione su due settimane complete. Il confronto non dimostra da solo la causa della variazione.'};}
 const delta=(after.value-before.value)*100,better=task.metric==='errorRate'?delta<0:delta>0;
 return {state:Math.abs(delta)<2?'stable':better?'improved':'worsened',before,after,deltaPoints:round(delta),message:'Confronto descrittivo prima/dopo, non prova di un effetto causale. Campagne, calendario e pubblico possono essere cambiati.'};
}
export function dashboard(report,workflow={},now=Date.now()){
 const detected=recommend(report),tasks=workflow.tasks||{},byId=new Map(detected.map(x=>[x.id,x]));
 for(const task of Object.values(tasks))if(!byId.has(task.id))byId.set(task.id,{...task.suggestion,signalCleared:true});
 const suggestions=[...byId.values()].map(s=>({...s,workflow:tasks[s.id]?{status:tasks[s.id].status,note:tasks[s.id].note||'',appliedAt:tasks[s.id].appliedAt||null}: {status:'todo'},assessment:evaluateImprovement(tasks[s.id]||{},report,now)}));
 return {...report,googleSummary:analyticsSummary(report.google),suggestions,method:{engine:'Analisi automatica con regole spiegabili · v1',generatedAI:false,automaticChanges:false,notice:'Le soglie servono a individuare verifiche utili. I suggerimenti non modificano app, campagne o dati e non dimostrano da soli una causa.'}};
}
