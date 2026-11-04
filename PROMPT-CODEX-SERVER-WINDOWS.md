# Prompt da eseguire con Codex sul PC Windows definitivo

Devi migrare Quelli del Quasi da Netlify a questo PC Windows, funzionante 24 ore su 24, usando questo pacchetto completo. Leggi prima README-SERVER-CASA.md, docs/GUIDA-SERVER-WINDOWS.md, docs/MIGRAZIONE-NETLIFY.md e docs/PROVA-ESEGUITA.md. Il proprietario ti autorizza a preparare e configurare l'installazione locale, fare test e guidare il passaggio, conservando tutti i dati. Non dichiarare completata un'installazione se hai scritto soltanto script.

## Vincoli

- Verifica la versione davvero online e i sorgenti del pacchetto. Se produzione è più recente della 0.29.22 con aggiornamento SEO, integra su quella base o segnala la differenza prima di rischiare un downgrade. Non ripristinare vecchi frontend o motori.
- Non cambiare formule/voti, crediti, giocate, rose, formazioni o storico. Non riattivare import dismessi, manutenzioni una tantum o ricalcoli massivi. Nessuna chiave nel frontend, nei log, in un endpoint di export pubblico o nello ZIP.
- Non modificare dati/servizi/cartelle estranei. Verifica target assoluti prima di cancellare o spostare ricorsivamente file. Se porte, servizi o DB esistono, ispezionali prima di riutilizzarli. Non terminare indiscriminatamente processi Node/PostgreSQL.
- Non indebolire Execution Policy, firewall, antivirus, TLS o controlli UAC. Chiedi alla persona di completare UAC, password, captcha e 2FA quando indispensabili. Le operazioni ordinarie e reversibili già autorizzate vanno portate avanti senza continue richieste.

## Fase 1 — inventario e installazione

Rileva sistema, privilegi reali, Node, PostgreSQL, spazio, rete, router e modalità AP/doppio NAT. Scegli una cartella privata stabile. Installa dalle fonti ufficiali Node, PostgreSQL compatibile con la sorgente (18.6 nella prova), Caddy e WinSW; cloudflared è facoltativo per un test protetto senza accesso al router. Usa hash/versioni controllate, senza inventare firme.

Metti i sorgenti in app/, configurazioni private in config/, stato in data/, log e backup fuori dalla root web. Esegui npm ci, build di produzione e i test pertinenti. Non installare il pacchetto portabile direttamente su Netlify: contiene adattatori locali.

## Fase 2 — copia isolata dei dati

Mantieni produzione invariata. Esporta in sola lettura il DB completo public+fanta con snapshot coerente, report dei conteggi e digest. Se serve il permesso PAT completo su Netlify, chiedi l'approvazione specifica immediatamente prima di attivarlo; spiega che concede anche scrittura. Usalo solo per letture e revocalo subito al termine, anche in caso di fallimento. Non accontentarti del solo schema pubblico.

Esporta il piano operativo e lo snapshot risultati dai due store previsti. Verifica nuovi store/tabelle/configurazioni se la versione è cambiata. Copia le chiavi applicative originali con un canale privato: i valori mascherati della CLI non sono utilizzabili. Non recuperare o stampare password degli utenti.

Ripristina in un DB locale nuovo e vuoto, verifica i report prima di avviare app/job e adotta le migrazioni senza rieseguire quelle storiche. Configura un ruolo applicativo non superuser. Preserva alias e ID permanenti dei calciatori e i contenuti cifrati. Lascia chiamate esterne, email, push e scheduler disabilitati sul test.

## Fase 3 — collaudo accessibile

Avvia web, worker e PostgreSQL su loopback. Se il router è disponibile prepara prima un sottodominio HTTPS di prova; se non lo è, proponi e chiedi autorizzazione per un tunnel HTTPS temporaneo protetto. Non pubblicare un clone reale senza protezione aggiuntiva; il normale login dell'app resta richiesto. Mantieni noindex su ogni risposta del test e non includere il link privato nel pacchetto.

Fornisci il link e fai testare dal cellulare su rete mobile. Verifica server-side e UI: landing, login, logout, registrazione/recupero con destinatari controllati, navigazione Bar/Fanta, storico, dettagli, salvataggi senza doppio clic e assenza di dati privati all'anonimo. Distingui test fatti da te, test personali ancora necessari e provider volutamente spenti. Non promettere il funzionamento email prima di averlo provato.

## Fase 4 — esercizio permanente

Con la persona disponibile per UAC, configura servizi Windows separati e account con privilegi minimi. Non considerare un task al login equivalente a un servizio prima del login. Evita servizi e bootstrap utente contemporanei. Prova avvio/stop e recupero dopo riavvio reale prima di dichiarare il servizio permanente. Imposta alimentazione/sospensione in modo appropriato senza disabilitare gli aggiornamenti di sicurezza.

Configura backup coerenti di DB, blob, coda, chiavi e certificati; cifrali prima di copiarli fuori dal PC. Prepara almeno una copia su supporto distinto e verifica un ripristino. Non esporre DB o porta Node a Internet.

## Fase 5 — DNS/DDNS e passaggio

Presenta una verifica concreta e un piano di rollback prima del cambio del dominio principale; ottieni l'approvazione del passaggio definitivo. Il solo DNS non ferma scritture, job o costi Netlify. Prevedi manutenzione e fermo dei job vecchi, nuovo dump finale, restore verificato e un solo sistema autorevole. Non usare la vecchia copia di prova come DB finale.

Sul router determina se il secondo apparato è AP o fa NAT. Con doppio NAT inoltra 80/443 attraverso entrambi; prenota l'IP LAN. Configura Caddy con certificato valido e origine identica alla configurazione app. Per l'IP variabile usa DDNS con due fonti IP concordi e soltanto i record A autorizzati. Prima fai dry-run. Non cambiare MX/SPF/DKIM o DNS estranei, non cancellare record gestiti senza averne verificato gli effetti. Mantieni token DNS separato dalle credenziali app.

Abilita provider e scheduler solo dopo lo stop della vecchia origine; verifica i primi job. La configurazione pubblica deve conservare canonical, sitemap e favicon sul dominio originale. In caso di rollback dopo nuove scritture, non perdere i dati più recenti.

Alla fine consegna link HTTPS, percorsi reali, versione e verifiche eseguite, elenco dei limiti rimasti, avvio/stop, backup/ripristino e rollback. Prepara un nuovo pacchetto sorgenti aggiornato senza dati personali/credenziali. Non inserire link privati di accesso o file env reali nel materiale condivisibile.
