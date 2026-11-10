# Quelli del Quasi — sviluppo e versionamento

## Repository centrale

- Repository canonico: https://github.com/tiffan89-commits/quelli-del-quasi-app (privato).
- Lavorare sui sorgenti correnti, senza ricostruire il progetto da vecchi ZIP o modificare direttamente la copia installata del server come unica fonte.
- Prima di iniziare controllare branch, stato locale e aggiornamenti remoti; conservare il lavoro non committato già presente. Non fare reset, push forzati o sostituzioni della storia.

## Commit e push automatici autorizzati dal proprietario

Il 6 novembre 2026 il proprietario ha chiesto che ogni modifica completata sia committata e caricata su GitHub senza doverlo richiedere ogni volta.

- Dopo ogni blocco coerente di modifiche completato, eseguire le verifiche appropriate, controllare il diff e creare un commit descrittivo, quindi fare push sul branch di lavoro.
- Usare Conventional Commits per i titoli dei commit e delle PR. Release Please propone su `main` versioni SemVer, changelog e tag `vX.Y.Z` a partire dalla baseline `v0.29.52`. Per i dettagli vedi `docs/RILASCIO.md`.
- Usare branch di funzionalità/correzione o di rilascio; rispettare le protezioni esistenti e aprire una PR quando utile. Questa autorizzazione a commit/push non autorizza ad aggirare protezioni, eseguire merge su main o attivare deploy.
- Riportare branch e collegamento al commit o alla PR. Se il push fallisce, indicarlo chiaramente e mantenere il commit locale.
- Non caricare file .env, credenziali, chiavi private, token, dati DB, backup, log, sessioni o report con dati personali. Verificare sempre i file nuovi prima di aggiungerli all'indice; outputs/ è locale e ignorata.
- I valori segreti si configurano esclusivamente nell'ambiente privato del server. I file di esempio devono contenere soltanto segnaposto.
- Non creare commit con codice incompleto presentandolo come pronto; il lavoro in corso resta locale finché non è coerente e verificato.

## Verifica e pubblicazione

- Node.js 24; installazione ripetibile con npm ci.
- Eseguire i test pertinenti e, per modifiche estese o rilasci, npm test e la build prevista dal progetto.
- Verificare l'interfaccia mobile per modifiche grafiche, compreso lo studio formazione e gli stati di salvataggio.
- I rilasci di produzione vanno eseguiti soltanto sul server Windows di casa. Per il dominio ufficiale Netlify gestisce unicamente il DNS verso il server Windows. Qualsiasi ritorno temporaneo all'hosting Netlify richiede una richiesta esplicita e attuale del proprietario. Se il dominio risponde da Netlify durante un rilascio, verificare DNS e server Windows prima di procedere.
- GitHub versiona i sorgenti. Il sito ufficiale è attualmente sul server Windows; un push non deve attivare automaticamente un deploy, un ricalcolo o una modifica al DB.
- Distribuire ogni rilascio autorizzato sul solo canale stabile del server Windows, uguale per tutti gli account. Conservare la revisione precedente per il rollback.
- Per pubblicare sul canale stabile serve l’OK del proprietario. Usare il commit del tag pubblicato da Release Please e verificare tag e versione sul server.
- Pubblicazione e operazioni sui dati devono restare nel perimetro esplicitamente autorizzato per il lavoro in corso.
