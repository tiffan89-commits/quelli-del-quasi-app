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

## Canale Friends & Family sul server Windows

- Una sola API di produzione serve entrambi i frontend e conserva la stessa sessione. Il canale sperimentale riguarda HTML, JavaScript e CSS. La PWA, Socket.IO, il worker e il database sono comuni.
- Il processo `runtime/friends-release.mjs` legge `FRIENDS_STABLE_DIR`, `FRIENDS_CANDIDATE_DIR`, `FRIENDS_CONFIG`, `FRIENDS_PORT` e `FRIENDS_SIGNING_KEY` da file ambiente privati. La configurazione locale è un JSON con `enabled`, `revision` (SHA del candidato) ed `emails` (account verificati). La build candidata è in `<FRIENDS_CANDIDATE_DIR>/<revision>`. Caddy instrada al processo la pagina iniziale, gli inviti e i percorsi `/_friends/*`. Il resto, comprese le API, resta sul servizio web principale.
- Il server verifica l'account della sessione prima di servire il candidato. Gli asset candidati hanno un percorso legato alla revisione e richiedono un cookie firmato e vincolato alla sessione. Un errore di selezione fa ripiegare sul frontend stabile.
- Per un rollback del frontend pilota, imposta `enabled: false` nella configurazione privata. Vale alla richiesta successiva. Chi ha già aperto la pagina rientra nel canale stabile tornando alla scheda o ricaricandola.
- I rilasci backend sono unici per tutti. Conserva una copia precedente e verifica la compatibilità dello schema prima di attivare il codice nuovo. Tornare al codice precedente lascia intatte le scritture del database.

## Prima integrazione

La configurazione parte dal commit taggato `v0.29.52`. Integra la PR di adozione su `main` con un merge commit per conservare quel tag nella storia di `main`.

Release Please usa il token integrato di GitHub e i permessi di scrittura del solo job di rilascio. Il repository deve consentire a GitHub Actions di creare pull request. GitHub raggruppa la creazione e l’approvazione in una sola impostazione. Il workflow crea PR e release e il merge resta una decisione del proprietario.

- [Release Please](https://github.com/googleapis/release-please)
- [Configurazione e permessi dell’azione](https://github.com/googleapis/release-please-action#workflow-permissions)
