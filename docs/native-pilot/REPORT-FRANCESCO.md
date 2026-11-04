# Rilascio 0.28.0 · Pilota, Fanta nativo, Quasi e stemmi

Lavoro sul branch `feature/native-pilot-rosters`, dalla versione pubblicata 0.27.19. Rilascio diretto autorizzato in chat e pubblicato su Netlify il 2 novembre 2026: frontend e 16 Functions. Migrazione 011 applicata e attivazione completata sul DB pubblico. Nessun commit o push; il lavoro locale resta salvato sul branch. I test e l’anteprima usano esclusivamente dati sintetici.

## Cosa puoi provare

Apri **http://127.0.0.1:8826/**. Account locali:

| Username | Password locale | Cosa verifica |
| --- | --- | --- |
| `anteprima` | `QuasiLocale26!` | Bar → Fanta → scelta della squadra pilota, formazione salvata davvero nel DB locale |
| `frankwood` | `QuasiLocale26!` | Pilota come presidente e «Lega nativa · prova locale» per asta e correzioni |

Sono account di prova: non usare qui la password del sito pubblico. I calciatori sono sintetici; non è una copia della tua lega. Il database rimane in memoria finché il server locale è acceso; riavviandolo riparte la prova. Le email restano nel simulatore locale e tutte le chiamate esterne sono bloccate.

Puoi avviarla anche da questa cartella con `npm run dev`; la porta predefinita è 8780, oppure imposta `PREVIEW_PORT=8826`. Non serve un `.env`.

## Cosa cambia

- Gli utenti registrati e verificati scelgono una squadra pilota libera, con conferma prima dell’assegnazione definitiva. Due persone non possono ottenere la stessa squadra. Chi ha scelto ritrova squadra, rosa e storico; non può cambiare squadra o entrare nelle altre pilote.
- Ogni pilota ha 10 squadre, stemmi originali, nomi e colori variati, 250 calciatori diversi nella lega e acquisti ai nostri valori entro 500 crediti. Frankwood ha una squadra ed è presidente in ogni pilota. Alla nona assegnazione agli altri utenti nasce subito la pilota successiva.
- I membri schierano e salvano sul DB. Niente mercato o asta nella pilota. Come confermato in chat, **solo frankwood può correggerne le rose**. La demo senza account continua invece a usare soltanto dati finti nel browser.
- Le squadre libere vengono gestite dal computer. Lucas mantiene le proprie squadre e usa lo stesso allenatore automatico per tutte; una formazione manuale salvata prima della scadenza ha precedenza.
- L’allenatore sceglie modulo e panchina usando disponibilità, probabilità già archiviate e fantamedia recente. Non interroga siti o API. I controlli condivisi sono a 2 ore e 30 minuti prima della scadenza; non sono nuovi cron. Una formazione identica non viene riscritta.
- La tab Fanta del Bar apre il nostro Fanta. Per il Bar collegato a Lucas rimangono le schedine sulle sfide native di Lucas, con un solo portafoglio Fanta e i risultati del nostro motore.
- Gli svincoli precedono gli acquisti nell’asta di riparazione, online e dal vivo. Il presidente sceglie il rimborso per singolo giocatore: 1, 0, metà oppure importo libero. Si può annullare finché gli svincoli sono aperti. Il registro conserva autore, importo e operazione; i crediti non rimborsati non diventano nuovamente spendibili.
- Le correzioni delle rose controllano budget, ruoli e unicità del calciatore. Le formazioni già giocate restano intatte; quelle future interessate ricevono un avviso. Gli strumenti si bloccano durante un’asta aperta o programmata.

## Cosa ho tolto

Tolti form di collegamento/importazione, rotte, connettore Chrome, lettore server, download Excel automatici e queste funzioni:

`fantasy-batch-background`, `fantasy-lineups-background`, `fantasy-pages-background`, `sync-fantacalcio`, `sync-fantasy-lineups`.

Tolte le relative configurazioni e le dipendenze Chromium/Puppeteer. Gli strumenti offline usati per le migrazioni precedenti sono conservati in `docs/history/legacy-data-tools`: nessun ingresso dell’app li importa e nessuno accede al sito esterno.

I vecchi identificatori `source: fantacalcio`, chiavi dei portafogli e riferimenti storici restano compatibili con i dati già salvati. Non sono collegamenti esterni. Le altre competizioni importate rimangono consultabili nello storico, ma non accettano nuove schedine: eventuali schedine precedenti ancora da liquidare vengono segnalate dal controllo preventivo, senza cancellarle o assegnare rimborsi arbitrari.

Il live Serie A e il motore dei voti rimangono quelli esistenti. Rimane anche la fonte pubblica delle probabili Serie A: è separata dall’accesso alle leghe private. Quindi una ricerca generica di `fantacalcio.it` trova ancora quella fonte editoriale, oltre ai documenti storici; una ricerca del dominio **leghe.fantacalcio.it nel codice attivo** non trova più integrazioni.

## Grafica e testi

I CSS Fanta/pubblico e la schermata di scelta pilota vengono dalla consegna in `E:\Users\frank\Downloads\Quelli del Quasi - Fantacalcio`. Le integrazioni tecniche conservano login stabile, cache, loghi, figurine, competizioni, inviti e navigazione già corretti; non ho rimesso i vecchi controller che avrebbero perso quei fix. Gli adattamenti delle schermate nuove usano gli stessi componenti.

Non sono stati copiati `.env`, `public/riferimento`, le pagine HTML di anteprima o i file `anteprima.mjs`. Le aggiunte di compatibilità mobile sono in `public/fanta-integrations.css`.

Come richiesto successivamente in chat, spariscono anche **«Tutti uguali»** e **«Sempre gratuita»** da landing, splash, metadati e inviti. La frase distintiva è soltanto **«Niente pubblicità, per sempre.»**. Le indicazioni sul funzionamento dei crediti virtuali rimangono nelle spiegazioni del gioco.

## Database pubblico e ripristino

La migrazione `011_native_pilot_market.sql` è **applicata e verificata in produzione**. Archivia configurazioni e credenziali cifrate precedenti, conserva i loghi già scaricati e collega il Bar Lucas alla competizione nativa. Se trova un vecchio import ancora attivo o Lucas nativa incompleta, si ferma prima di rimuovere il collegamento.

Il controllo preventivo ha individuato una schedina importata non Lucas, senza risultati. Il proprietario ne ha autorizzato l’annullamento e il rimborso: eseguito una sola volta, 20 crediti restituiti e movimento registrato. La CLI resta in sola lettura; la verifica dello schema Fanta è stata eseguita dal lavoro di attivazione autenticato sul server. Non sono stati ampliati i permessi sul database.

`docs/sql/rollback-native-cutover.sql` ripristina le vecchie configurazioni senza cancellare pilote, rose o storico. Blocca il ripristino automatico se esistono già schedine native: in quel caso serve una riconciliazione dei saldi. Prima di usarlo vanno fermati i lavori in background e ripristinata la versione applicativa compatibile, con autorizzazione del proprietario. Non è una migrazione automatica.

Se la prima pilota viene attivata a giornata già iniziata, le prime formazioni automatiche sono registrate all’ora reale di attivazione: non vengono retrodatate. Dalla giornata successiva valgono le normali scadenze. Le vecchie formazioni Lucas non vengono ricreate a posteriori.

## Variabili che potranno essere rimosse

Dopo l’accettazione del passaggio e aver conservato gli eventuali segreti necessari al ripristino, non servono più su Netlify:

- `ENABLE_FANTACALCIO_DIRECT` e tutte le variabili `FANTACALCIO_*`, comprese cifratura, trasporto, browser reader, bootstrap login e snapshot import;
- `FANTA_IMPORT_BETA`, `FANTA_IMPORT_COMPETITION_ID`, `FANTA_BETA_START_ROUND`, `FANTA_BETA_TEAM_NAME`, usate dal vecchio trasferimento;
- account/password/sessioni dell’import esterno e associazione dell’estensione Chrome.

**Da mantenere:** `MAIL_ENCRYPTION_KEY`, configurazione email e notifiche, accesso DB, chiavi Serie A/API-FOOTBALL, `FANTA_ENABLED`, `FANTA_SEASON`, `FANTA_BETA_USERS`, `FANTA_BETA_OWNER` e `FANTA_BETA_LEAGUES`. La chiave email firma anche lavori interni: non va confusa con quella del vecchio import.

Nessuna variabile Netlify è stata modificata durante questo lavoro.

## Verifiche

I risultati definitivi dei test sono riportati in `VERIFICHE.md`. Sono incluse prove SQL su concorrenza, saldi, riacquisto dopo svincolo, storico Lucas, sincronizzazione senza riscritture, ripristino e isolamento degli utenti. Nel browser sono stati provati accesso, scelta squadra, salvataggio e ricarica della formazione, permessi dei membri, editor del presidente e resa a 390 px.

Il rilascio è concluso: https://quellidelquasi.com . Deploy `6ae80005f4411ae3c757b0ee`. 404 test superati; 75 file pubblici e 40 spogliatoi confrontati con il sorgente; API anonime protette.

L’attivazione ha creato la pilota con 10 squadre, 250 calciatori, 29 giornate e 10 formazioni iniziali. Lucas conserva 10 squadre, 250 giocatori, 10 giornate e 79 formazioni archiviate. Nessuna chiamata aggiuntiva al fornitore durante l’attivazione.

I tre disegni consegnati sono stati copiati integralmente; soltanto le proporzioni del personaggio nella dashboard sono state adeguate alla figura intera. I file delle opzioni, dei premi e degli spogliatoi non sono cambiati. Verifica prima/dopo sul DB pubblico: **tutti e cinque i Quasi personalizzati e l’archivio dei premi sono identici**. Anche gli stemmi caricati dagli utenti restano invariati.

L’anteprima grafica Netlify separata è privata del team e non ha DB né Functions: https://grafica--quasi-native-preview-20261102.netlify.app/verifica-grafica.html . I flussi reali del backend sono stati provati con SQL sintetico locale.

Artefatto di rilascio: `outputs/release-0.28.0/RELEASE.json` nella cartella di lavoro principale.

Ultima rifinitura: miniatura Quasi del profilo separata dal titolo; CSS confrontato byte per byte sul sito pubblico dopo il secondo deploy della stessa consegna. Nessuna seconda migrazione o nuova attivazione.
