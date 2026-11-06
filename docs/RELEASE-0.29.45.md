# Quelli del Quasi 0.29.45

Snapshot dei sorgenti del rilascio pubblicato il 6 novembre 2026 sul server Windows di quellidelquasi.com. Il push GitHub versiona i sorgenti; non esegue un deploy e non modifica il database.

## Contenuto

Frontend, backend Node.js, Functions Netlify mantenute nel progetto, migrazioni SQL, runtime Windows, worker, pannello di controllo e test. Il changelog descrive anche le versioni intermedie dopo la precedente 0.29.30 presente su GitHub.

Le ultime modifiche includono panchina automatica su un'unica fascia nello studio formazione, riordino delle riserve, correzione dell'accesso amministrativo tiffano, orientamento delle probabili e delle formazioni ufficiali, motore voti aggiornato, sincronizzazione Socket.IO e accesso tramite email.

## Verifiche del rilascio

- `npm test`: 689 test passati, zero errori.
- `npm run build:production`: completata.
- Prova interattiva dello studio a 375 × 812 px, cambio modulo, ordine riserve e salvataggio.
- Health pubblico dopo il rilascio: `0.29.45-selfhost`.

## Ripristino in un ambiente nuovo

1. Installare Node.js 24 e PostgreSQL secondo la guida del server Windows nel repository.
2. Eseguire `npm ci`.
3. Configurare le variabili del solo ambiente desiderato usando `.env.example` come riferimento. Usare credenziali e DB separati per le prove.
4. Applicare le migrazioni previste dalle guide del backend al DB scelto.
5. Eseguire i test e la build appropriata prima di avviare web e worker.

La versione non include dati degli utenti, sessioni, DB, backup, file `.env`, credenziali OAuth o account di servizio Analytics. Gli snapshot dimostrativi sportivi sono dati pubblici statici già utilizzati dalla demo. Il laboratorio legge esportazioni locali escluse da Git; per usarlo rigenerarle con gli script dedicati. Non sostituisce l'avvio normale dell'app.

I segreti e il DB del sito attivo restano nel percorso privato del server e non sono necessari per consultare o versionare il codice.
