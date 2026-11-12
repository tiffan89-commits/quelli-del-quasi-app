# Rilasci di Quelli del Quasi

Il repository usa Release Please su `main`. Il punto di partenza è il tag `v0.29.52`, già distribuito sul server Windows di casa. La procedura precedente è documentata nel [rapporto storico](REPORT-PROCESSO-RILASCIO.md).

## Commit e versioni

- Usa `fix: correggi il timer` per una patch e `feat: aggiungi un filtro` per una minor. Usa `feat!:` o un footer `BREAKING CHANGE:` per una modifica incompatibile. `docs:`, `ci:` e `chore:` normalmente non aprono una nuova versione.
- Parti da `main` aggiornato, lavora su un branch e apri una PR. Se la PR viene integrata con squash, usa un titolo Conventional Commit anche per il commit finale.
- Le modifiche approvate entrano in `main`. Release Please raccoglie i commit e apre o aggiorna una PR di rilascio con `CHANGELOG.md`, versione npm, lockfile, manifest, metadati pubblici e cache PWA. Il vecchio script locale di incremento versione è sostituito dal workflow.

## Dal tag al server

1. Controlla la PR di rilascio, le note e i test. Se GitHub mostra la CI in attesa di approvazione, autorizza l’esecuzione dalla PR. Se non parte, esegui il workflow CI manualmente sul branch della PR o prova il suo commit in locale.
2. Dopo il merge autorizzato della PR di rilascio, Release Please crea il tag `vX.Y.Z` e la release su GitHub. La data è quella della release GitHub.
3. Per un deploy autorizzato, recupera il tag, verifica che punti al commit approvato e prepara la build da quel commit con `npm ci`, `npm test -- --test-force-exit` e `npm run build:production`.
4. Distribuisci frontend e backend sul server Windows di casa seguendo la [guida Windows](GUIDA-SERVER-WINDOWS.md). Verifica la versione su `/healthz` e `/version.json`, l’avvio del worker e Socket.IO. GitHub versiona i sorgenti e Netlify gestisce il DNS. Il deploy Windows si avvia separatamente.
5. Per tornare a un rilascio noto, usa il backup del codice installato o il tag precedente. Una correzione successiva riceve un nuovo tag.

## Produzione unica sul server Windows

- Caddy inoltra al servizio web principale. Tutti gli account ricevono la stessa build stabile. Le build precedenti sono riservate al rollback.
- Il limite di memoria impegnata è di 4 GiB complessivi per web e worker, con due Job Object Windows da 2 GiB. Da 1.792 MiB il supervisore termina il processo interessato e WinSW lo riavvia. PostgreSQL e Caddy sono servizi separati.
- Su installazioni esistenti compila `windows/MemoryGuard.cs` con il compilatore .NET Framework x64 e configura il percorso dell’eseguibile in `SELFHOST_MEMORY_GUARD` nel file ambiente dei servizi. Dopo l’avvio verifica `QUASI_MEMORY_GUARD_READY` nei log di entrambi.
- I rilasci backend sono unici per tutti. Conserva una copia precedente e verifica la compatibilità dello schema prima di attivare il codice nuovo. Tornare al codice precedente lascia intatte le scritture del database.

## Chiusura delle giornate

- A 24 ore dalla fine registrata dell'ultima partita di Serie A, il worker esegue `round-close` usando solo i dati già salvati. Se manca il segnale di fine di una partita, usa la fine della finestra live prevista. Una partita rinviata non blocca la giornata.
- Nel Fanta restano validi i voti disponibili. I giocatori senza voto seguono le sostituzioni esistenti. Nel Bar le selezioni senza risultato definitivo o senza quota vengono annullate. Se tutte le selezioni sono annullate, la puntata viene rimborsata.
- I nuovi controlli del provider per quella giornata terminano alla scadenza. Un errore di esecuzione o un riavvio rimette in coda soltanto il calcolo sui dati locali.

## Prima integrazione

La configurazione parte dal commit taggato `v0.29.52`. Integra la PR di adozione su `main` con un merge commit per conservare quel tag nella storia di `main`.

Release Please usa il token integrato di GitHub e i permessi di scrittura del solo job di rilascio. Il repository deve consentire a GitHub Actions di creare pull request. GitHub raggruppa la creazione e l’approvazione in una sola impostazione. Il workflow crea PR e release e il merge resta una decisione del proprietario.

- [Release Please](https://github.com/googleapis/release-please)
- [Configurazione e permessi dell’azione](https://github.com/googleapis/release-please-action#workflow-permissions)
