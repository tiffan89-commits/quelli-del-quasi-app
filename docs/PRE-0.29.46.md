# Prova isolata 0.29.46

Indirizzo: https://pre.quellidelquasi.com/.

È una copia separata dei sorgenti, sul PC Windows, servita da un processo dedicato su `127.0.0.1:8995`. Il dominio ufficiale usa un servizio e dati di produzione separati; il 6 novembre è stato aggiornato alla stessa versione dopo autorizzazione. Il CNAME `pre` segue `server.quellidelquasi.com`, già gestito dal DDNS: non sono stati cambiati i record del sito ufficiale.

## Dati e accessi

- Soltanto fixture sintetiche: Bar in memoria e schema Fanta in PGlite RAM. Nessun database di produzione.
- Account `anteprima` per il presidente Bar e `frankwood` per il presidente Fanta. Password privata generata per questa prova, assente dal repository, dai log e dalla directory pubblica.
- Credenziali e configurazione sono in `outputs/pre-0.29.46/ACCESSO-PRIVATO.txt` e `private.env`, esclusi da Git e limitati all’utente Windows e SYSTEM.
- I dati della prova si azzerano al riavvio del processo. Le credenziali dell’app reale non valgono qui.
- Il Bar sintetico è collegato alla lega Fanta nativa di prova: sono verificabili inviti condivisi e barra con entrambi i saldi. Il collegamento viene creato soltanto nel database RAM di questa istanza.

## Isolamento

`scripts/preproduction.mjs` avvia il server di sviluppo con un ambiente esplicito e ridotto, senza ereditare URL DB, chiavi provider, configurazioni email o flag worker. Il processo non avvia alcun worker pianificato. Le richieste esterne del server di prova sono bloccate; la consegna email resta in memoria e le notifiche non vengono inviate.

In modalità pubblica non è consentita l’autenticazione automatica, non è disponibile la mailbox di debug e tutte le route `/__preview/` sono disabilitate. Cookie di sessione Secure, banner di pre-produzione, header noindex/nofollow/noarchive e robots Disallow `/`.

## Avvio manuale

Dal percorso della copia isolata, con dipendenze installate:

```powershell
node --env-file=../private.env scripts/preproduction.mjs
```

Il file privato deve contenere `PREVIEW_PORT=8995` e una `PREVIEW_PASSWORD` casuale di almeno 20 caratteri. Non inserirlo nel repository. Il processo attuale è stato avviato in background con finestra nascosta; log e PID sono nella cartella privata della prova.

La configurazione Caddy aggiunge unicamente l’host `pre.quellidelquasi.com`, diretto alla porta 8995. La configurazione precedente è conservata come backup locale. Nessun servizio principale è stato fermato o ripubblicato.

## Verifiche

HTTPS valido; health versione 0.29.46; login anonima assente, password errata rifiutata, login dei due account riuscita; bootstrap Fanta disponibile; cookie Secure e noindex verificati anche dall’URL pubblico. In browser verificati login, switch Bar/Fanta e pannello del presidente. Health del sito ufficiale ancora `0.29.45-selfhost`.
