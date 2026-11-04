# Migrare senza perdere dati o duplicare lavori

## Prima di iniziare

Il sito resta su Netlify fino al passaggio esplicito. La copia Windows usa PostgreSQL standard e file locali; il dominio può continuare a essere registrato e gestito nei DNS Netlify anche quando il sito viene ospitato altrove. Servono accesso al progetto, configurazioni private originali, accesso al dominio e, per pubblicazione diretta a casa, al router e al firewall Windows.

Questo pacchetto deriva dalla 0.29.22 e include l'aggiornamento SEO. Prima di una migrazione futura confrontare la versione online: se è più recente, recuperare i sorgenti corrispondenti e portare gli adattatori senza sovrascrivere le migliorie successive. L'archivio non contiene DB reale o segreti. Un download di solo frontend da Netlify non è un backup completo del progetto.

## 1. Inventario

Annotare versione/deploy attivo, versione PostgreSQL, database e schemi, variabili d'ambiente e configurazioni dei provider. Contare gli utenti, le leghe, le giornate e le righe delle tabelle Fanta. Conservare il piano operativo dei job. Esportare sorgente e configurazione del deploy per il rollback; non cambiare DNS in questa fase.

Le chiavi necessarie comprendono DB, API, email, cifratura di contenuti/OTP e push, più la configurazione specifica del motore. Non attivare vecchi flag di ricalcolo massivo o recupero una tantum. Non creare un endpoint pubblico per far uscire i segreti. Le credenziali dei nuovi ruoli PostgreSQL sono distinte dalle chiavi applicative già usate per cifrare i dati.

## 2. Esportazione DB in sola lettura

La CLI Netlify può leggere soltanto parte del DB se non è abilitato temporaneamente il permesso completo sui personal access token. Se serve, ottenere l'autorizzazione specifica, attivarlo dal pannello DB solo per il tempo dell'esportazione e **disattivarlo subito dopo, anche in caso di errore**. Il permesso è di scrittura sull'intero DB, anche se questa procedura esegue solo letture.

Preparare un file di ambiente privato con `SOURCE_DATABASE_URL` e `PG_BIN` (cartella dei binari PostgreSQL 18). Da `app`:

```powershell
node --env-file="C:\PercorsoPrivato\export.env" runtime/export-db.mjs "C:\PercorsoPrivato\produzione.dump"
```

L'esportazione usa una transazione repeatable-read read-only, uno snapshot condiviso con pg_dump, TLS verificato e default_transaction_read_only. Include gli schemi `public` e `fanta`, senza owner/ACL/tablespace di Netlify. Rifiuta di sovrascrivere un dump esistente e produce un report con conteggi e digest dello stato. Non esegue ricalcoli o correzioni. Un dump parziale/fallito non va considerato riuscito: usare un nuovo nome e ripetere solo dopo aver risolto il problema.

Il report verifica le tabelle Fanta e le quattro tabelle pubbliche principali attualmente note; il dump comprende comunque tutti gli oggetti degli schemi selezionati. Se il progetto futuro aggiunge tabelle pubbliche durevoli, estendere l'inventario e il verificatore prima della migrazione.

## 3. Piano operativo e risultati pubblici

Le cache private si possono ricostruire e non devono essere trasferite come requisito di avvio. Vanno invece preservati piano operativo e snapshot risultati:

```powershell
node --env-file="C:\PercorsoPrivato\blob-export.env" runtime/blob-transfer.mjs export "C:\PercorsoPrivato\operazioni.json"
```

Il file privato contiene `NETLIFY_SITE_ID` e `NETLIFY_AUTH_TOKEN`. L'export SDK richiede `npm ci`; `@netlify/blobs` è installato per il supporto delle due destinazioni, mentre il bootstrap Windows seleziona lo storage locale. Il trasferimento comprende `quasi-operations-v1/calendar` e `quasi-public-football-v1/scores`. Verificare eventuali nuovi store durevoli se la versione online è cambiata. Non esportare indiscriminatamente sessioni/cache private in un archivio pubblico.

## 4. Ripristino isolato

Creare un DB locale nuovo e vuoto, per esempio `quasi_migrazione`. Non ripristinare sopra il DB di test precedente o quello pubblico. Preparare un env privato con connessione locale del proprietario a questo DB e `PG_BIN`.

```powershell
node --env-file="C:\PercorsoPrivato\restore.env" runtime/restore-db.mjs "C:\PercorsoPrivato\produzione.dump"
node --env-file="C:\PercorsoPrivato\restore.env" runtime/verify-db.mjs "C:\PercorsoPrivato\ripristino-report.json"
```

Lo script rifiuta host non locali, nomi diversi da `quasi*` e database con tabelle/sequenze/viste preesistenti. Gestisce gli schemi public/fanta già creati escludendo dal TOC soltanto le relative istruzioni CREATE SCHEMA. Ripristina dati, sequenze e oggetti, poi adotta lo schema con `migrate --adopt-existing`: verifica la firma delle colonne e registra le migrazioni senza rieseguirle.

Confrontare conteggi e digest con il report sorgente **prima di avviare l'app o modificare sessioni**. Anche un semplice login o job può cambiare lo stato dopo il confronto. Verificare almeno rose, formazioni, risultati storici, anagrafiche/ID/alias, immagini, schedine, crediti e membership. Le chiavi originali devono decifrare correttamente i contenuti previsti; non rimuovere dati cifrati perché una chiave di test non li legge.

Concedere al ruolo applicativo i permessi con `runtime/grant-app.mjs`, poi impostare la sua connessione in `config/app.env`. Importare il piano in un nuovo `SELFHOST_DATA_DIR`:

```powershell
node --env-file="C:\ProgramData\QuelliDelQuasiServer\config\app.env" runtime/blob-transfer.mjs import "C:\PercorsoPrivato\operazioni.json"
```

L'import rifiuta di sovrascrivere uno store esistente. Non usare `init-fresh` per una migrazione: il piano esistente contiene scadenze e stato dei lavori.

## 5. Collaudo senza doppie attività

Lasciare provider e scheduler disattivati sulla copia Windows. Esporre un indirizzo di prova HTTPS protetto; il dominio principale rimane su Netlify. Testare personalmente password login, registrazione/recupero in un ambiente con email di test, navigazione Bar/Fanta, consultazione storico, salvataggi con blocco doppio clic e disponibilità dei dettagli. Verificare che l'anonimo non legga leghe/dati privati. Un test di lettura autenticata non dimostra da solo che l'intero flusso email funzioni.

Durante questa fase eventuali modifiche del test non ritornano su Netlify. Non copiare il DB di prova sopra quello pubblico e non attivare due scheduler con le stesse destinazioni email/API. Per testare invii reali serve una configurazione dedicata e destinatari controllati.

## 6. Passaggio definitivo

1. Concordare una breve finestra e un piano di ritorno. Verificare backup e ripristino, HTTPS, router, servizi Windows e monitoraggio.
2. Mettere il vecchio sito in manutenzione o bloccare realmente le scritture e spegnere i job sul vecchio hosting. Attendere la conclusione dei lavori già in corso. Il solo cambio DNS non lo fa.
3. Produrre un nuovo dump finale e trasferire il piano operativo dopo il fermo. La precedente copia di prova non include le modifiche avvenute nel frattempo.
4. Ripristinare in un nuovo DB di destinazione; confrontare report e dati prima dei nuovi accessi. Configurare chiavi originali, ruolo app e directory persistenti.
5. Avviare il nuovo server e verificare i percorsi autenticati sull'origine definitiva. Poi modificare soltanto i record DNS necessari al sito. Controllare anche AAAA/CNAME/record NETLIFY: un IPv6 o un record gestito rimasto verso il vecchio hosting può dividere il traffico.
6. Abilitare il worker/provider sul nuovo server solo dopo che il vecchio è fermo. Controllare i primi lavori e gli invii, mantenendo un'unica origine autorevole per le scritture.
7. Lasciare il vecchio sito non scrivibile durante la propagazione DNS. Verificare da rete mobile e reti esterne; mantenere backup e vecchio deploy disponibili per il rollback.

Un rollback dopo nuove scritture sul server Windows richiede trasferire anche quei dati: non ripuntare semplicemente a una copia Netlify ormai vecchia. Non eliminare il DB o il progetto Netlify per risparmiare prima che il collaudo sia concluso. La permanenza dei DNS/registrazione e i relativi costi sono distinti dall'hosting.

## Risultato della prova attuale

La copia del 3 novembre 2026 ha confrontato correttamente 42 tabelle, digest dello stato uguale, 15 utenti, 7 leghe e 288 giornate Bar. Il permesso PAT completo è stato già revocato. I file contenenti questi dati rimangono soltanto nella cartella privata del PC e non nello ZIP. Consultare `PROVA-ESEGUITA.md` per i limiti effettivi della prova.
