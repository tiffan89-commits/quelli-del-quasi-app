# Quelli del Quasi — sorgenti completi 0.29.13

Pacchetto del progetto corrispondente alla versione pubblicata su https://quellidelquasi.com.
Deploy Netlify verificato: `6ae919b33612ddbfb1eea634`.
Commit del rilascio: `bc061f7` (versione 0.29.13). Verifica: 466 test superati.

## Contenuto

- `public/`: frontend completo, PWA, sezioni Bar e Fanta, asset e stili responsive.
- `netlify/functions/`: tutte le 16 funzioni backend in formato sorgente.
- `lib/` e `fanta/`: autenticazione, cache, voti, calendario, aste, leghe e portafogli.
- `netlify/database/migrations/`: tutte le 16 migrazioni SQL nell'ordine previsto.
- `data/`: dati statici sportivi di inizializzazione e media; nessun export di account o DB utenti.
- `scripts/`, `test/`, `docs/`, `.github/`: strumenti, test e documentazione.
- `package.json`, `package-lock.json`, `netlify.toml`, `CHANGELOG.md` e configurazione Git.
- `MANIFEST-SORGENTI.json`: dimensione e SHA-256 dei file inclusi, escluso il manifest stesso.

## Avvio locale

Richiede Node.js 22 o superiore; il rilascio è stato verificato con Node.js 24.

1. Estrarre l'intera cartella.
2. Eseguire `npm ci`.
3. Eseguire `npm run dev` e aprire http://127.0.0.1:8780/.
4. Eseguire `npm test` per i controlli del progetto.

L'ambiente locale usa dati sintetici in memoria. Le stringhe di prova nei test non sono credenziali di produzione.

## Produzione

Installare le dipendenze con `npm ci` e configurare i servizi e i segreti nell'ambiente server.
Database PostgreSQL/Netlify Database, archivi Blobs, API-Football, email e notifiche richiedono la propria configurazione esterna. Le variabili sono documentate nei sorgenti e nella cartella `docs/`.
`npm run build` genera `public/env.json` e `lib/release-context.json` per il contesto di build; questi file specifici dell'ambiente non sono inclusi.
Applicare le migrazioni con il flusso previsto prima di utilizzare un database nuovo.
La pianificazione di `operational-dispatch` resta di un minuto; il codice limita il lavoro alle finestre sportive e ai calcoli definitivi previsti.

Questo pacchetto non è un backup del database di produzione. Per trasferire account e storico reali serve un export separato e protetto del database e degli archivi Blobs.
Sono esclusi `.git/`, `.netlify/`, `node_modules/`, file `.env`, token, sessioni, configurazioni locali e dati privati di produzione.
