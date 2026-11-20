# Quelli del Quasi su un PC Windows

## Architettura e requisiti

La cartella `public/` contiene il frontend; `dist/` la build pronta da servire. Node esegue `runtime/server.mjs`, che pubblica i file statici e inoltra `/api/`, `/fanta-api/` e il servizio risultati agli handler esistenti. Le Functions non hanno più bisogno di Netlify per essere eseguite. `runtime/worker.mjs` esegue la coda locale e il dispatcher operativo esistente; PostgreSQL conserva dati e storico. Blob, cache e coda operativa sono file locali persistenti.

Consigliati Windows 11 supportato, SSD, 8 GB RAM o più, almeno 20 GB liberi oltre allo spazio per backup e fotografie, connessione stabile e sospensione disabilitata durante l'esercizio. Ethernet è preferibile al Wi-Fi per un servizio permanente. Il test funziona anche dietro due router grazie al tunnel in uscita. Non serve Docker.

Software dalle fonti ufficiali:

| Componente | Versione usata nella prova | Fonte |
|---|---|---|
| Node.js | 24.20, minimo progetto 22 | https://nodejs.org/ |
| PostgreSQL Windows x64 | 18.6 | https://www.enterprisedb.com/download-postgresql-binaries |
| Caddy | versione corrente Windows amd64 | https://caddyserver.com/download |
| WinSW | 2.12.0 x64 | https://github.com/winsw/winsw/releases/tag/v2.12.0 |
| cloudflared, solo prova | 2026.10.7 | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ |
| PowerShell | 7 consigliato per gli script | https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows |

Il dump deve essere prodotto con `pg_dump` della stessa major del server sorgente o più recente. La sorgente verificata usa PostgreSQL 18.6: non usare pg_dump 17. Prima del trasferimento futuro verificare nuovamente la versione effettiva.

## Cartelle

Nel nuovo computer scegliere, per esempio, `C:\ProgramData\QuelliDelQuasiServer`. Per una prova senza privilegi amministrativi va bene `%LOCALAPPDATA%\QuelliDelQuasiServer`.

```text
QuelliDelQuasiServer/
  app/                    contenuto del pacchetto
  config/app.env          configurazione privata dell'app
  config/owner.env        connessione privata del proprietario PostgreSQL
  config/ddns.env         solo se si attiva DDNS
  data/postgres18/        cluster PostgreSQL
  data/blobs/             cache/file persistenti
  data/jobs/              coda operativa
  data/caddy/             certificati HTTPS
  tools/pg18/pgsql/bin/   binari PostgreSQL 18
  tools/caddy.exe
  tools/winsw.exe
  tools/cloudflared.exe   opzionale, solo test
  logs/
  backups/
```

Non mettere la cartella in un percorso pubblico, in una cartella sincronizzata o sotto la directory web `dist/`. Non cambiare i permessi di cartelle esterne all'installazione. Il pacchetto esclude dipendenze npm e binari: dalla cartella `app` eseguire `npm ci`, poi `npm run build:production`.

## Configurazione privata

Copiare `.env.example` in `config/app.env`, fuori da `app/dist`. Compilare localmente i valori, senza incollarli in chat o salvarli nel frontend. Esempio di impostazioni non segrete:

```dotenv
PUBLIC_ORIGIN=https://casa.quellidelquasi.com
HOST=127.0.0.1
PORT=8845
SELFHOST_DATA_DIR=C:/ProgramData/QuelliDelQuasiServer/data
CONTEXT=production
SELFHOST_TEST_INSTANCE=true
SELFHOST_ALLOW_EXTERNAL=false
SELFHOST_SCHEDULER_ENABLED=false
TRUST_PROXY=false
```

`DATABASE_URL` punta al ruolo applicativo `quasi_app`, al DB locale e alla porta scelta, nella prova 55433. `config/owner.env` contiene una connessione separata con privilegi per dump, ripristino e migrazioni. Non usare il superutente come connessione dell'app e non pubblicare la porta DB in rete. Usare password casuali lunghe, con URL encoding nella stringa PostgreSQL.

In una migrazione reale riusare le chiavi di cifratura originali, in particolare quelle per email/OTP e qualsiasi contenuto cifrato, e le chiavi VAPID per mantenere compatibilità con i dati copiati. Trasferire anche configurazioni del motore dei voti e dei provider, non sostituirle con impostazioni generiche. La CLI può mostrare valori mascherati: non sono chiavi utilizzabili. Configurarli da un archivio sicuro o dal pannello autorizzato. Il test attuale usa chiavi di prova e invii esterni bloccati: non è la configurazione per l'esercizio definitivo.

## Database: due percorsi diversi

**Migrazione della produzione:** seguire prima `MIGRAZIONE-NETLIFY.md`. Ripristinare il dump in un DB nuovo e vuoto, poi adottare lo schema. Non eseguire tutte le migrazioni storiche sopra i dati esistenti: alcune hanno effetti sui dati.

**Installazione nuova senza dati:** inizializzare il cluster con `initdb`, password del proprietario in un file temporaneo privato; avviare PostgreSQL solo su loopback; creare un DB nuovo. Da `app`, con `DATABASE_URL` del proprietario impostata nella sessione:

```powershell
node --env-file="C:\ProgramData\QuelliDelQuasiServer\config\owner.env" runtime/migrate.mjs
```

Per il ruolo dell'app, impostare `APP_DB_PASSWORD` nella sessione privata ed eseguire `runtime/grant-app.mjs` con la connessione proprietario. La password non deve essere passata in argomenti visibili o log. Su un'installazione nuova `runtime/init-admin.mjs` crea l'amministratore solo se manca; non usarlo per resettare quello importato. Rimane richiesto il codice email del flusso amministrativo: per testarlo serve prima configurare correttamente l'invio email.

## Avvio di prova

Dalla cartella `app`, su Windows:

```powershell
node runtime/bootstrap-local.mjs "C:\ProgramData\QuelliDelQuasiServer"
```

Oppure usare PowerShell 7:

```powershell
.\windows\Start-Local.ps1 -InstallRoot "C:\ProgramData\QuelliDelQuasiServer"
```

Il bootstrap usa gli eseguibili già installati; non modifica Execution Policy. Verifica i PID prima di riutilizzare processi. `http://127.0.0.1:8845/healthz` controlla la disponibilità del server. Per i flussi autenticati e i cookie Secure usare l'indirizzo HTTPS configurato, non un IP HTTP differente dall'origine.

Per la prova da cellulare si può usare `--tunnel`, dopo aver configurato `SELFHOST_TEST_INSTANCE=true` e una `SELFHOST_PREVIEW_KEY` casuale di almeno 32 caratteri. Il bootstrap avvia cloudflared, aggiorna l'origine e conserva il collegamento privato in `config/test-link.txt`. Non pubblicare quel collegamento: include la chiave della protezione aggiuntiva. Dopo il primo accesso al link resta comunque necessaria la login normale. Il link può cambiare a ogni nuovo tunnel. Il test manda header noindex anche quando viene negato l'accesso.

Per fermare solo app e worker:

```powershell
.\windows\Stop-Local.ps1 -InstallRoot "C:\ProgramData\QuelliDelQuasiServer"
```

`-Database` ferma anche PostgreSQL. Il tunnel si ferma separatamente, verificando PID e percorso dell'eseguibile: non terminare tutti i processi Node o cloudflared del computer.

## Avvio automatico

Il task utente che esegue il bootstrap al login Windows è adatto alla prova: **non è un servizio che parte prima del login**. Il PC non deve sospendersi. Non abilitare accesso automatico a Windows per aggirare questa differenza.

Per l'esercizio definitivo usare `windows/Install-Services.ps1` da una sessione amministrativa. Leggere e verificare prima lo script, i percorsi e gli account di servizio. Installa quattro servizi WinSW: PostgreSQL, web, worker e Caddy; configura gli accessi alle directory dell'installazione e le sole porte pubbliche di Caddy. Non sovrascrive servizi con nomi già esistenti. L'approvazione UAC richiede la persona al computer: non indebolire le protezioni di Windows. Non eseguire contemporaneamente servizi e task utente sugli stessi dati/porte.

## HTTPS, router e IP variabile

Il dominio non deve puntare all'IP locale 192.168.x.x ma all'IP pubblico. Fissare l'indirizzo LAN del PC con una prenotazione DHCP. Con un solo router fare port forwarding TCP 80/443 verso Caddy sul PC. Il DB 55433 e Node 8845 restano su loopback.

Se il router Wi-Fi lavora in modalità access point, il forwarding si gestisce sul router principale. Se fa anche NAT, le porte devono attraversare entrambi: principale → IP WAN del Tenda, Tenda → IP del PC. Verificare quale modalità è attiva prima di cambiare configurazione. Il tunnel temporaneo non richiede nessuno di questi passaggi.

Caddy termina HTTPS e inoltra a Node. Il nome host nel Caddyfile deve coincidere con `PUBLIC_ORIGIN`. I certificati si emettono solo quando DNS e raggiungibilità pubblica sono corretti. Conservare i dati dei certificati nel backup. Non disabilitare la verifica TLS per far passare il test.

Per IP dinamico, `runtime/ddns.mjs` legge l'IPv4 pubblico da due fonti e opera soltanto sul record A esplicitamente autorizzato nel proprio file di configurazione. Prima usare dry-run; il token Netlify rimane in `config/ddns.env`, separato dalle credenziali dell'app. Il TTL consigliato è 300 secondi. Non tocca MX, SPF, DKIM o altri record. Con il provider attuale il cambio avviene creando il nuovo A prima di eliminare quello precedente; il file di stato consente di riprendere l'operazione. Il DDNS non elimina la necessità del forwarding, né cambia le restrizioni del contratto Internet.

## Attività automatiche

Il worker conserva il dispatcher operativo e le finestre già previste nell'app, senza riaggiungere vecchi import da Leghe Fantacalcio o cron dismessi. Cinque handler background sono eseguiti tramite coda locale firmata; i vecchi file Functions rimangono per completezza del sorgente. Non avviare uno scheduler separato per ciascun file.

Il controllo delle formazioni passa ogni giorno alle 05:20, ora di Roma. Registra fonte, partita, calciatori, valori in conflitto e date di rilevamento. Sulla stessa istanza del worker, `node runtime/admin-control.mjs lineup-quality` mostra le segnalazioni della stagione corrente, a partire dalle più recenti.

`SELFHOST_ALLOW_EXTERNAL=false` blocca le chiamate esterne. Lo scheduler richiede anche `SELFHOST_SCHEDULER_ENABLED=true` e il piano operativo importato. Attivarli solo al passaggio definitivo e dopo aver spento i job di produzione Netlify. Prima riattivare provider e invii fare verifiche mirate, mai un ricalcolo massivo non richiesto. Questo trasferimento non cambia formule, voti, crediti o scadenze.

## Backup e ripristino

Fermare web e worker per ottenere una copia coerente di DB, blob e coda. PostgreSQL può restare acceso. Eseguire `windows/Backup.ps1`: usa il **nome del DB attivo in app.env**, con le credenziali proprietario, e salva dump, configurazioni, blob, coda e file Caddy/DDNS. Il backup contiene dati personali e chiavi: conservarlo in una cartella privata e cifrarlo con uno strumento affidabile prima di copiarlo fuori dal PC. Un semplice ZIP non è cifratura.

Tenere almeno una copia cifrata su un supporto diverso dal disco del server e provare il ripristino in un database distinto. Non copiare la cartella PostgreSQL mentre è in esecuzione come sostituto di pg_dump. Non cancellare gli ultimi backup riusciti finché il nuovo non è stato verificato. Gli script non implementano da soli una strategia off-site o una rotazione: vanno configurate nel PC definitivo.

## Aggiornamenti e problemi comuni

Preparare gli aggiornamenti in una nuova cartella, fare build e test, backup coerente e poi fermare i processi per il cambio. Conservare il rilascio precedente. Il rollback del codice non autorizza a sovrascrivere dati più recenti con un vecchio dump.

- **Login 403:** controllare origine HTTPS, cookie Secure e orologio; non cambiare password per tentativi.
- **DB non disponibile:** verificare PostgreSQL, porta, nome del DB e ruolo applicativo. Non stampare la connessione nei log.
- **Email o aggiornamenti assenti in prova:** sono intenzionalmente bloccati. Verificare i flag prima di diagnosticare i provider.
- **Link tunnel non funziona:** controllare PC, connessione e processo; leggere il nuovo `config/test-link.txt`.
- **Errore su migrazioni dopo restore:** usare adozione e verifica schema, non ripetere migrazioni con effetti sui dati.
- **App raggiungibile solo in casa:** verificare forwarding e doppio NAT da rete mobile. Un test dallo stesso Wi-Fi non prova l'accesso pubblico.
- **Costi Netlify ancora presenti:** cambiare il DNS non ferma automaticamente database, storage, deploy o job di Netlify. Seguire il piano di dismissione dopo il collaudo.

Log in `logs/`; mai condividere dump, cookie, file env o contenuti privati dei messaggi. Le nuove guide SEO, favicon e sitemap sono incluse: mantenere il dominio canonico `quellidelquasi.com`, non il nome temporaneo del tunnel.
