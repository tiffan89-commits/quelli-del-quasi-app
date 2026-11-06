# Microsoft Clarity · progetto z8vq8o76ja

Il tag pubblico è configurato in `public/src/analytics-config.mjs`. Non è un segreto né il token dell’API di esportazione.

## Raccolta facoltativa

- Nessun tag, ping o coda Clarity prima dell’accettazione esplicita del banner aggiornato.
- Il consenso è ora `qdq:analytics-consent:v2`. Un consenso Google-only v1 non viene esteso a Microsoft. Un rifiuto precedente resta valido; il sito continua a funzionare anche senza statistiche.
- Il tag è asincrono e parte nel caricamento differito delle statistiche. Non è parte del percorso di login/salvataggio e non richiede chiamate al nostro database.
- `analytics_Storage: granted`, `ad_Storage: denied`; nessuna chiamata a `identify` e nessun ID utente/lega personalizzato.
- Mascheramento ereditato da `html[data-clarity-mask=true]`, inclusi testi, immagini e viste aggiunte successivamente dalla SPA. Non aggiungere `data-clarity-unmask` a contenuti personali.
- Esclusi Admin, account, disattivazione promemoria, privacy, inviti, profili e URL con parametri privati. Sono ammessi soltanto parametri UTM con valori semplici e limitati.
- Alla revoca viene negato il consenso Clarity e fermato il relativo SDK; vengono eliminati i cookie `_clck` e `_clsk` accessibili al sito. La sessione dell’app non viene modificata. Riattivazione senza ricaricare la pagina e senza duplicare il tag.
- In locale, su `casa.quellidelquasi.com`, su host non autorizzati o con Global Privacy Control non viene caricato il progetto.

Il tag conserva nel DOM soltanto uno stato diagnostico (`data-qdq-clarity-status`: loaded/ready/disabled/paused/unavailable). Non contiene credenziali o contenuti delle registrazioni. La verifica dello stato ready non equivale alla conferma che tutti i dati siano già comparsi nel pannello Microsoft.

## Dashboard Admin

La scheda “Usabilità · Microsoft Clarity” legge l’esportazione dal backend. Il token `CLARITY_EXPORT_TOKEN` è conservato soltanto nel file privato `C:\ProgramData\QuelliDelQuasiServer\config\app.env`, con ACL riservata a proprietario, amministratori, SYSTEM e servizio locale. Nessun token nel frontend o nei log.

Per prepararlo: aprire il progetto in Clarity → Impostazioni → Esportazione dati / Data Export → Genera nuovo token API. Il token va conservato soltanto nella configurazione privata del server. Non inserirlo in JavaScript, HTML, file di build, log o repository.

`lib/admin-insights/clarity.mjs` interroga un solo endpoint Microsoft, senza dimensioni e senza paginazione: `project-live-insights?numOfDays=3`. Conserva solo totali numerici, segnali di attrito e classificazioni dispositivo/browser. Scarta URL, titoli delle pagine, referrer e ogni altro campo non necessario. Non importa registrazioni, contenuti del gioco o identità.

Il worker legge un report ogni **12 ore**. Un aggiornamento manuale non può anticiparlo prima di **6 ore** dalla precedente chiamata. La prenotazione del tentativo è persistita prima della chiamata, per rispettare il limite anche dopo errori/riavvii; dopo HTTP 429 attende 24 ore, anche con richiesta manuale. Nessun retry immediato. Il progetto dispone di 10 richieste/giorno: questo connettore ne usa normalmente 2, al massimo 4 in 24 ore con aggiornamenti manuali. Altri client del medesimo progetto potrebbero consumare la quota restante.

Il report è in cache persistente nel contenitore privato `quasi-admin-insights-v1`, dentro il volume dati del server. L’Admin legge il report già salvato, senza richieste Microsoft né polling aggiuntivo. Un errore del provider conserva l’ultima lettura valida con stato esplicito “precedente”. Il backup amministrativo include già report e configurazione privata.

Le finestre sono mobili (ultime 72 ore, UTC): ogni snapshot **sostituisce** quello precedente. Non vengono sommati per ricavare totali giornalieri o utenti unici. I totali Google e Clarity restano separati perché finestre e metodi sono diversi. Metriche mancanti sono sconosciute, non zero; il possibile limite di 1.000 righe è segnalato.

L’analisi usa almeno 50 sessioni nella metrica interessata e soglie interne spiegate: errori JavaScript e rage click dal 3%, clic senza risposta dal 10%, ritorni immediati dal 15%. Non attiva nuovi suggerimenti da report obsoleti o con limite di righe. Questi indizi richiedono verifica e non dimostrano cause. Non vengono usati per confronti automatici prima/dopo su finestre sovrapposte.

## Verifiche

`test/clarity.test.mjs` controlla consenso, rinnovo per il nuovo fornitore, rifiuto preesistente, revoca tra schede, tag caricato una sola volta, arresto del tag tardivo, mascheramento, esclusioni e soli eventi generici. I test Google esistenti verificano anche che la build condivida una sola istanza del controller.

`test/clarity-export.test.mjs` verifica endpoint e autenticazione server, minimizzazione, valori sconosciuti/zero, errori senza segreti, quota dopo riavvio, cache, concorrenza, conservazione dell’ultimo report, soglie dei suggerimenti e rendering sicuro nell’Admin.

Riferimenti ufficiali:

- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
