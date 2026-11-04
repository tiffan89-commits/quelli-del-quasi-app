# Analytics e passaggio al PC — 4 novembre 2026

## Proprietà Google

Proprietà dedicata **Quelli del Quasi**, ID `562275036`, nell'account Analytics esistente. Stream web **Quelli del Quasi · sito e PWA**, ID `16268121759`, dominio `https://quellidelquasi.com`, identificativo pubblico `G-2C4R9NRYXZ`. Questi identificativi non sono credenziali.

[Apri Analytics](https://analytics.google.com/analytics/web/#/a286338255p562275036/reports/intelligenthome). Il pannello amministrativo dell'app contiene lo stesso collegamento.

La migrazione non richiede una nuova proprietà: conservare dominio, tag e consenso. La misura funziona sia con Netlify sia con il runtime Windows. Le anteprime localhost e trycloudflare sono escluse.

## Consenso e dati raccolti

Modalità di consenso di base: nessun tag, ping o coda di eventi a Google prima dell'accettazione. Il rifiuto e la chiusura valgono come mancato consenso. Scelta sul dispositivo per 180 giorni, revocabile dal footer o da `/privacy.html`. La revoca blocca nuovi invii e cancella i cookie `_ga*` accessibili al sito, preservando la sessione del gioco. GPC rispettato. Consensi scaduti non vengono riutilizzati.

Google Signals e personalizzazione pubblicitaria disabilitati nel tag. Misurazione avanzata dello stream disattivata per evitare raccolta automatica di moduli e doppi page view SPA. Page view manuali su un elenco finito di schermate, senza query private, token, username, lega o nomi delle squadre. Referrer ridotto alla sola origine. Consentiti solo parametri di campagna UTM con valori limitati. Nessuna foto, messaggio, giocata o formazione trasmessa ad Analytics.

Cookie Analytics fino a 180 giorni senza rinnovo automatico. Nella proprietà Google: eventi e dati utente a due mesi, reimpostazione per nuova attività disabilitata. I report aggregati hanno regole di conservazione diverse. L'informativa descrive esplicitamente il trattamento della connessione da parte di Google e non sostiene che un visitatore con cookie sia anonimo.

Contatti pubblici del titolare indicati su richiesta: Francesco D'Aniello, tiffan89@gmail.com.

## Eventi e prestazioni

Le azioni sono conteggiate dopo l'esito della richiesta effettiva, rispettando il blocco dei doppi invii già presente. Nessun evento per il polling risultati e nessuna lettura aggiuntiva dal DB.

| Evento | Significato |
|---|---|
| `page_view` | Schermata generica visitata |
| `login` | Login riuscita |
| `registration_requested` | Richiesta di registrazione accettata |
| `sign_up` | Attivazione dell'account riuscita |
| `password_recovery_requested` | Richiesta di recupero accettata |
| `slip_saved` | Salvataggio schedina riuscito |
| `lineup_saved` | Salvataggio formazione riuscito |
| `action_failed` | Fallimento di una delle azioni sopra, senza testo dell'errore o contenuto del modulo |

Dimensioni personalizzate: `operation`, `outcome`, `app_surface` (web/PWA). Metrica `duration_ms`: durata della richiesta dal browser, inclusa la rete. Non è la sola durata SQL. Le definizioni possono richiedere tempo per comparire nei report Google. La raccolta dipende dal consenso, dalla connessione e dagli eventuali blocchi del browser: non equivale al totale degli accessi del backend.

Il tag e il suo CSS sono differiti; la landing mantiene i due fogli di stile iniziali e non aspetta Google per caricarsi. App e avvio Analytics condividono un unico modulo nella build, così il consenso si applica anche agli eventi dei salvataggi.

## Confronto limitato delle latenze

Quattro richieste equivalenti a `/fanta-api/me` con una sessione inesistente e sola lettura SQL. Netlify: 1056, 282, 301, 312 ms. PC in loopback: 127, 43, 49, 46 ms. PC tramite tunnel pubblico protetto: 380, 129, 166, 152 ms. Nessuna chiamata ai provider sportivi. Il test dal PC verso il tunnel non sostituisce una prova da rete mobile indipendente né un test di carico. I dati di produzione e della copia locale hanno dimensioni e aggiornamenti differenti.

Il PC può ridurre la latenza database e gli avvii a freddo. Upload di casa, Wi-Fi, tunnel, numero di utenti, spegnimenti e cache dei file statici restano determinanti. Per le risorse statiche distribuite globalmente Netlify può essere più veloce. Prima del passaggio preferire Ethernet e collaudare da rete esterna.

## Cosa manca al passaggio definitivo

La copia Windows è ancora una **prova isolata**, non la produzione. Durante questa verifica `SELFHOST_ALLOW_EXTERNAL=false`, `SELFHOST_SCHEDULER_ENABLED=false`, `SELFHOST_TEST_INSTANCE=true`; le chiavi API/email di produzione non sono configurate. Non abilitarle su due server contemporaneamente.

Restano da completare: accesso HTTPS stabile (inoltro porte su entrambi i router o tunnel nominato), avvio affidabile prima del login Windows e prova di riavvio, trasferimento sicuro delle configurazioni originali, backup e ripristino verificati. Servono poi fermo scritture e job su Netlify, nuova copia coerente del DB e degli store operativi, verifica dei conteggi, attivazione di un solo worker e cambio DNS. La vecchia copia di prova non va promossa perdendo le scritture recenti.

Seguire `MIGRAZIONE-NETLIFY.md` e `GUIDA-SERVER-WINDOWS.md`. Il dominio principale resta su Netlify fino al passaggio coordinato. Non annullare il vecchio hosting o eliminare il DB sorgente durante il collaudo.
