# Quelli del Quasi

Bar e Fantacalcio: schedine con crediti virtuali, leghe, formazioni, voti statistici spiegati, chat e personalizzazione dei Quasi.

## Versione conservata nel repository

Questa è la **versione locale corrente**, basata sulla 0.29.22 e comprensiva delle modifiche provate il 4 novembre 2026: maglie disegnate e stemmi, formazioni ufficiali, statistiche compatte, fascia neutra dei voti, navigazione Oggi e modifica dello stemma dal banner Fanta. Le modifiche successive alla 0.29.22 sono descritte sotto `Unreleased` nel [changelog](CHANGELOG.md).

Il backend corrente è adattato per **server Node e PostgreSQL su Windows**. Il percorso `netlify/functions/` contiene gli handler applicativi usati anche dal server locale; il nome della cartella non implica che questa copia sia pronta per un deploy Netlify. La versione pubblica Netlify e il database di produzione non vengono cambiati da un push Git.

## Contenuto

| Percorso | Contenuto |
|---|---|
| `public/` | Frontend, PWA, stili, SVG e risorse statiche |
| `netlify/functions/` | Handler backend |
| `lib/` e `fanta/` | Logica del Bar e del Fanta, voti e processi operativi |
| `netlify/database/migrations/` | Migrazioni SQL |
| `runtime/` | Server HTTP, worker e adattatori per l'hosting autonomo |
| `windows/` | Installazione, avvio, backup e manutenzione Windows |
| `data/` | File seed e risorse richieste dal codice; non un dump del DB utenti |
| `test/` | Test con dati di prova |
| `docs/` | Documentazione tecnica e guide |

Database reali, configurazioni private, `.env`, chiavi, cookie, cache operative, log e backup non devono entrare nel repository. Il file `.env.example` contiene solo il modello di configurazione. Non salvare credenziali nei commit, negli URL di `origin` o nelle descrizioni delle PR.

## Avvio per lo sviluppo

Prerequisito: Node.js 24 LTS con npm.

```sh
npm ci
npm run dev
```

`npm run dev` avvia l'anteprima isolata con dati sintetici: non usa il database reale e non invia email o richieste ai provider sportivi.

```sh
npm run build
npm test
node scripts/check-syntax.mjs
```

La build genera `dist/`, esclusa da Git. Non modificare gli asset generati per apportare cambiamenti: lavorare sui sorgenti in `public/`.

Eseguire la build prima dei test anche in un clone nuovo: alcuni controlli verificano gli asset generati. I sei strumenti di compatibilità in `docs/history/legacy-data-tools/` sono conservati per i test delle migrazioni storiche e non vengono caricati dall'applicazione.

## Server completo su Windows

Seguire [GUIDA-SERVER-WINDOWS.md](docs/GUIDA-SERVER-WINDOWS.md), [MIGRAZIONE-NETLIFY.md](docs/MIGRAZIONE-NETLIFY.md) e [README-SERVER-CASA.md](README-SERVER-CASA.md). La configurazione dell'installazione e i backup del DB restano fuori dalla cartella Git. Prima di usare migrazioni su un DB ripristinato, seguire la procedura di adozione descritta nella guida.

## Versionamento

- `main`: base corrente verificata.
- `staging`: integrazione delle prossime modifiche.
- `feature/nome-modifica`: lavoro su una funzionalità; PR verso `staging`, poi revisione verso `main`.
- Il primo commit è una fotografia dei sorgenti disponibili, non una ricostruzione della cronologia precedente.
- I tag di rilascio si creano soltanto quando la relativa versione viene effettivamente approvata. La 0.29.22 con modifiche locali non viene etichettata come nuovo rilascio di produzione.

La CI esegue test e controlli sintattici su push a `main`/`staging` e sulle PR. **Non esegue deploy, migrazioni né lavori sul database di produzione.**
