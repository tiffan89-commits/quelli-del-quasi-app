# Dashboard amministrativa: traffico, utilizzo e suggerimenti

La nuova area è dentro `/admin.html`, accessibile soltanto all’account di sistema con sessione MFA valida. Le API sono `GET /api/platform-insights`, `POST /api/platform-insights-refresh`, `POST /api/platform-insights-task`. Le due POST rispettano il controllo di origine e non possono essere usate da utenti del gioco.

## Google Analytics

- Proprietà: `562275036`, misurazione esistente `G-2C4R9NRYXZ`.
- Progetto dedicato: `quelli-del-quasi-analytics`.
- Account tecnico: `quasi-analytics-reader@quelli-del-quasi-analytics.iam.gserviceaccount.com`. Solo Visualizzatore della proprietà, nessun ruolo IAM Cloud aggiuntivo.
- L’assertion JWT usa esclusivamente lo scope `analytics.readonly`; token in memoria, credenziale privata in `C:/ProgramData/QuelliDelQuasiServer/config/google-analytics-reader.json`, fuori dal repository e dalle risorse web.
- La chiave effettiva è generata sul PC; Google riceve soltanto il certificato pubblico RSA_X509_PEM. Il certificato locale scade il 5 novembre 2028: pianificare una rotazione prima della scadenza. Non includere la configurazione in ZIP pubblici o commit.
- `ADMIN_INSIGHTS_ENABLED=true`, `GA4_PROPERTY_ID=562275036`, `GA4_CREDENTIALS_FILE=<percorso privato>` nel file di configurazione del server.

Google viene letto ogni sei ore dal worker: sei report aggregati in due chiamate batch, più autenticazione quando necessaria. Gli ultimi 28 giorni completi sono confrontati con i 28 precedenti; oggi è escluso. Visitatori unici del periodo provengono dal totale Google e non dalla somma dei singoli giorni. Provenienza, campagne, eventi, dispositivi e pagine mantengono i valori Google; la UI arrotonda solo la visualizzazione. Soglie, aggregazioni e limiti di righe sono segnalati.

Le visite misurate richiedono il consenso Analytics già previsto nell’app. Non equivalgono a tutti gli utenti né a registrazioni. Gli eventi ripetuti non sono persone e il confronto fra richiesta registrazione e attivazione non è un funnel attribuito per persona. Non vengono dedotti costi Meta, costo per iscritto o ritorno della spesa senza dati della piattaforma pubblicitaria.

## Database e cache

Ogni ora il worker esegue due query di sola lettura, in transazione coerente: proiezione dei soli campi account/contatori ed aggregati Fanta. Nessun download di foto, formazioni, sport o chat. Nessuna modifica a voti, risultati, utenti, crediti o giocate.

I risultati sono in un archivio locale persistente `quasi-admin-insights-v1`, sotto `SELFHOST_DATA_DIR/blobs`. L’Admin legge il report già pronto, senza lanciare chiamate Google o riletture massive. Il comando manuale accoda una richiesta: massimo una ogni 15 minuti, lavorata entro circa un minuto. Una lease evita duplicati fra worker. Nessun nuovo polling nel frontend. Gli errori conservano l’ultimo report e ne segnalano l’anzianità; le credenziali e le risposte sensibili del provider non sono restituite al browser.

In contesti non produttivi il namespace è distinto. Le credenziali non devono essere replicate automaticamente in ambienti di test. Il worker richiede anche `SELFHOST_ALLOW_EXTERNAL=true`.

## Suggerimenti e verifica

La prima versione è un motore di analisi con regole spiegabili, **non un modello generativo**. Non comporta chiamate né costi di API AI. Ogni suggerimento ha ragione, evidenze, priorità e azione proposta. Le soglie sono euristiche interne, non benchmark del settore.

Stati: da valutare, da fare, applicato, accantonato. Una nota documenta la modifica. Segnare «applicato» non dichiara riuscita l’ottimizzazione. Quando c’è un indicatore compatibile, il report confronta sette giornate complete prima e dopo, senza sovrapposizioni e con un campione minimo di 50 sessioni, 100 richieste oppure 30 esecuzioni della stessa operazione per ogni finestra. Il giorno di applicazione è escluso da entrambe le finestre. Per Google si rispetta il fuso della proprietà, per i contatori operativi UTC. Variazioni inferiori a 2 punti percentuali dei tassi, o al 10% dei tempi medi, sono classificate stabili. Mancanza di dati, campione piccolo e assenza di un indicatore sono distinti. Nessuna significatività statistica o causalità viene inventata. La scomparsa del segnale non equivale a successo dimostrato.

Clarity è collegato con consenso facoltativo e sessioni mascherate. I report aggregati sono letti dal backend ogni 12 ore, con un intervallo minimo di 6 ore anche per le richieste manuali; il frontend legge soltanto la cache. Vedere `docs/CLARITY.md` per minimizzazione, quote e finestre mobili di 72 ore. I totali restano separati da Google. Un eventuale modello generativo futuro dovrà usare solo aggregati autorizzati e mantenere separati numeri, osservazioni e ipotesi.

## Operatività

- Aprire l’Admin e usare «Rileggi report» per leggere la cache attuale.
- «Aggiorna dal server» accoda il recupero, senza bloccare la pagina. Dopo circa un minuto rileggere il report.
- Aggiornamenti automatici nel log worker: `ADMIN_INSIGHTS_REFRESH`; nessun token è scritto nel log.
- Per disattivare solo questa funzione: `ADMIN_INSIGHTS_ENABLED=false` e riavviare `QuasiWorker`. I normali job del gioco restano indipendenti.
- Anteprima visuale locale: `node --env-file=<file privato> scripts/preview-admin-insights.mjs`, su `127.0.0.1:8893`, solo lettura. Non è un accesso alternativo all’Admin pubblico.
