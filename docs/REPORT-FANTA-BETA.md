# Fanta · rapporto per Francesco

Aggiornamento di rilascio: il 1 novembre Francesco ha autorizzato il deploy della 0.27.0 con Bar | Fanta. Il selettore e la demo vengono pubblicati insieme al backend; la normalizzazione delle rose resta in attesa degli Excel richiesti. L'import automatico rimane disattivato. Le note di preparazione sotto descrivono lo stato precedente al rilascio.

Preparazione del 1 novembre 2026, branch `feature/fanta-beta`. Nessun commit, merge, push, PR o deploy eseguito. Il codice pubblico non è stato modificato. Dopo l'autorizzazione esplicita di Francesco è stato creato lo schema `fanta` sul DB remoto e copiato lì l'archivio della sua lega; nessuna scrittura nei dati del Bar. La cartella consegnata su `E:\Users\frank\Downloads\Quelli del Quasi - Fantacalcio` è accessibile; non sono stati copiati `.env`, credenziali o campioni privati.

## Cosa puoi già provare

Apri **http://127.0.0.1:8780/**, scegli la demo dalla landing e premi **Fanta** nell'interruttore Bar | Fanta. Puoi provare formazione, campo/lista, dettagli dei voti, regolamento, classifica, asta online e banditore dal vivo. Torni al Bar dall'interruttore. La vecchia tab Fanta del Bar continua a contenere le schedine sulle leghe esterne.

L'anteprima usa soltanto dati sintetici in RAM: non accede al database pubblico, non chiama API-Football/Anthropic/Fantacalcio e non invia messaggi. Per il login locale: `anteprima` / `QuasiLocale26!`. Riavvio: `npm run dev` dalla cartella del repository. Non usare l'opzione dell'anteprima legacy per questa prova.

Ho verificato anche il formato telefono a 390 × 844: ingresso dalla demo, salvataggio della formazione, giornata conclusa, vista campo e le due modalità d'asta. I moduli Fanta si caricano soltanto entrando nella modalità; il Bar non scarica il listone per avviarsi.

## Backend preparato

- Schema PostgreSQL `fanta` con club, giocatori, statistiche, eventi, voti versionati, leghe, squadre, rose/prezzi, formazioni, sfide/risultati, aste/lotti/offerte/acquisti, preferenze e coda notifiche. Limite di 12 squadre applicato anche dal DB. Il Fanta legge l'identità esistente con query mirate e **non scrive in `fanta_state`**.
- Tutte le rotte del contratto `/fanta-api/*`. L'accesso beta è verificato sul server; chi non è abilitato riceve `access: demo` e 403 sulle altre rotte. L'app usa per queste persone la demo in memoria. Le letture richiedono anche l'appartenenza alla lega.
- Voto da 6 con confronto con medie per ruolo; gol/assist sono solo bonus. SV sotto 15 minuti, salvo bonus/malus che danno 6 più il bonus/malus; nei primi 25 minuti live il voto resta 6. Modificatore su portiere e tre migliori difensori, almeno quattro difensori con voto. Cambi nello stesso ruolo, in ordine di panchina, senza limite. Classifica: punti, fantapunti, scontri diretti; segnalazione delle parità residue.
- Asta: 500 crediti, minimo 1, rosa 3 P / 8 D / 8 C / 6 A; contatore server, ultimi tre secondi dilatati a cinque, rilanci, passi, riserve per completare la rosa, assegnazioni e annullamenti tracciati. Il polling legge il nostro server; il lotto viene bloccato in transazione.
- Live: scoperta Serie A e gruppi fino a 20 fixture ogni minuto, letture finali distanziate 20 minuti. Congelamento dopo tre letture finali solo con statistiche sufficienti per entrambe le squadre e senza anomalie note. Dati parziali rimangono provvisori. Un rigore sbagliato non diventa automaticamente un rigore parato.
- Ogni giorno: calendario, rose, indisponibilità recenti, statistiche stagionali e listone con quotazioni nostre e spiegazione. Medie del modello aggiornate dai dati acquisiti; fino a 20 campioni per ruolo si usano valori iniziali dichiarati nel modello.
- AI facoltativa, famiglia Haiku: JSON validato, numeri verificati, correzione massima ±0,5. Errore, chiave assente o risposta incoerente: resta il voto deterministico. Correzioni memorizzate per fase, senza una chiamata AI per ogni lettura del browser. Un worker separato legge le statistiche dal DB: il live non aspetta Haiku e il worker AI non incrementa i controlli finali del fornitore.
- Notifiche: formazione mancante da due ore prima, inizio giornata, eventi dei titolari, risultati ufficiali, asta. Outbox con deduplicazione, preferenze e protezioni fuori produzione. La PWA usa le sottoscrizioni push già autorizzate nel Bar; i messaggi Fanta aprono la modalità corretta. L'email resta opzionale e richiede anche il consenso email già presente sull'account.

## Import di Lucas Bar Lega A

**Primo caricamento remoto eseguito e verificato:** la migrazione 003 ha creato le tabelle e `fanta.import_sources` conserva una copia della lega selezionata: 36 giornate, 180 incontri, 35 incontri con fantapunti e 8 con formazioni. La copia è stata eseguita interamente con `INSERT … SELECT` sul server; nessun dato di produzione è stato scaricato in file locali o usato nei test. Non include sessioni, credenziali o immagini. Il permesso temporaneo di scrittura della CLI è stato disattivato subito dopo.

Questo è un **archivio di migrazione**, non sono ancora rose giocabili nelle tabelle native: mancano i prezzi d'asta e l'anagrafica completa degli allenatori/rose. Il completamento normalizzato è predisposto nel worker, da attivare solo dopo il rilascio autorizzato e la verifica dei dati mancanti. La migrazione resta nei file del prossimo deploy, con istruzioni idempotenti.

Copertura verificata in sola lettura sul DB: risultati delle giornate 1–7 (5 incontri a giornata), formazioni in 3 incontri della giornata 7 e in tutti i 5 incontri della giornata 8. La giornata 8 non ha ancora fantapunti calcolati. Nel catalogo immagini esistente ci sono 663 giocatori API-Football; il collegamento della lega non ha un catalogo rose completo. Per completare servono l'Excel delle rose con i costi, i nomi degli allenatori e, per confrontare una giornata già conclusa, l'Excel delle formazioni/voti della 7ª. Le formazioni della 8ª già archiviate non vanno reinviate.

Il job seleziona esattamente il collegamento Lucas Bar, competizione `548867`, dell'account **frankwood**. Riusa la sessione cifrata esistente per leggere le rose con i costi; calendario, risultati e formazioni già archiviate vengono letti dal collegamento. Crea `Fanta Lucas Bar Lega A`, id `fanta-lucas-a`; collega a Francesco soltanto Fly Emigrates e conserva gli altri allenatori come testo, senza creare account.

Le giornate calcolate precedenti all'inizio beta diventano storico; dalla prima giornata non calcolata in avanti usa il nostro motore. È possibile fissare esplicitamente la giornata iniziale. Le formazioni complete già disponibili vengono importate; senza una nuova formazione si eredita l'ultima valida. Se una squadra non ha alcuna formazione utilizzabile, il dato resta mancante e la giornata non viene falsamente ufficializzata. I risultati esterni vengono conservati separatamente in `fanta.reference_results`: nel dettaglio compare un confronto richiudibile Quasi / Leghe / scarto. Un risultato storico importato non viene presentato come un calcolo del nostro motore. Il job legge i nuovi risultati esterni già nel DB, senza farli sovrascrivere ai nostri.

L'import è transazionale e idempotente. Un secondo avvio non resetta rose, aste o risultati nativi. Se la lega esiste già con un'altra operazione, il job si ferma per richiedere una revisione.

### Giocatori da controllare

**Elenco reale non ancora disponibile:** si genera durante l'import server; non sono stati copiati dati di produzione per compilarlo. Il confronto usa nome, club e ruolo API-Football; se ambiguo, senza club affidabile, con prezzo mancante o duplicato, il giocatore viene segnalato senza inventare l'abbinamento. Eventuali formazioni incomplete vengono segnalate a loro volta.

Il presidente troverà **Import · elementi da controllare** nella pagina Lega. Il DB conserva i dettagli in `fanta.import_issues` (squadra, nome, motivo e candidati); il riepilogo dell'operazione è in `fanta.jobs`. Questi casi vanno revisionati prima di considerare pronta la prova con le rose reali.

## Variabili Netlify per l'attivazione successiva

Configurare tramite Netlify, senza creare file locali contenenti segreti.

| Variabile | Impostazione |
|---|---|
| `FANTA_ENABLED` | `true` per avviare i job; assente/disattiva lascia fermi i job |
| `FANTA_BETA_USERS` | `frankwood` (username confermato; corregge il refuso del prompt) |
| `FANTA_BETA_LEAGUES` | `fanta-lucas-a`, già valore predefinito |
| `FANTA_SEASON` | `2026`, già predefinito |
| `API_FOOTBALL_KEY` | Chiave Pro già configurata; usata solo dal server |
| `ANTHROPIC_API_KEY` | Facoltativa; senza chiave il voto resta deterministico |
| `FANTA_AI_MODEL` | Facoltativa, modello Haiku; default `claude-haiku-4-5-20251001` |
| `FANTA_IMPORT_BETA` | Identificativo non segreto dell'operazione, es. `lucas-a-beta-2026-v1`; inserire quando si autorizza l'import |
| `FANTA_BETA_START_ROUND` | Facoltativa: prima giornata da calcolare con il nostro motore; default prima non calcolata |
| `FANTA_LAST_ROUND` | `38` oppure `37` per riservare la 38ª; default 38 |
| `FANTA_PROBE_FIXTURE_ID` | Facoltativa: id di una partita da misurare; rimuovere dopo la sonda |
| `FANTA_EMAIL_ENABLED` | Facoltativa, `true` per email ai soli utenti con consenso già attivo |

Restano necessarie le variabili DB, cifratura, posta e push già usate dal progetto. Il worker usa un ticket cifrato con finalità dedicata e scadenza di due minuti, oltre al controllo dell'ambiente. Le chiavi non vengono mandate al frontend.

`fanta-sync` è predisposto ogni minuto; `fanta-catalog` alle **04:00 UTC**. Il primo avvio con import richiesto inizializza catalogo/import senza attendere il giorno dopo; un errore viene riprovato con pausa. Il worker evita sovrapposizioni con una lease. La sonda acquisisce due campioni a 30 secondi di distanza durante il live, massimo 300 campioni, poi tre controlli finali distanziati 20 minuti; salva solo tempi, stato, score e impronte dei dati. Non è stata attivata su una partita reale.

## Verifiche e limiti della consegna

Base iniziale: **481 test passati**. Verifica finale: **503 test passati, zero fallimenti**, più controllo sintattico di 35 moduli Fanta. Test aggiunti: golden su bonus, SV, soglie esatte del modificatore, cambi, rigori/portieri, AI e listone; test con PostgreSQL in memoria per migrazione, contratti delle schermate, permessi, isolamento del Bar, offerte concorrenti, import idempotente, notifiche e ricalcolo risultati. Verificato anche che il live non chiami l'AI, che il catalogo giornaliero non si ripeta nella stessa data, che la copia migrazione escluda i segreti e che il confronto mantenga separati i risultati. I fixture sono interamente sintetici e non contattano fornitori.

Non sono ancora verificati contro il server reale: completamento delle rose e degli abbinamenti, latenza del live Pro, consegna push/email della beta e calibrazione sui dati reali. Il modello iniziale non è una calibrazione completa su una stagione passata. Se il fornitore non distingue un rigore parato da uno fuori, il caso resta da verificare e non viene inventato il bonus. Nuovi amici richiedono sia allowlist beta sia collegamento esplicito alla squadra esistente; non viene creato automaticamente un account per gli allenatori importati. L'eventuale spareggio alla 38ª è segnalato dalla classifica, non generato automaticamente come un nuovo torneo.

Prezzi e licenze sono fuori da questo aggiornamento. Quando autorizzerai il rilascio, si seguirà `docs/RILASCIO.md`, si applicherà la migrazione e si potrà eseguire l'import server. Prima di quel momento la beta pubblica rimane invariata.
