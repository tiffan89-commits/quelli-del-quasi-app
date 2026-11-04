# 0.29.15 — 2026-11-03

- Definitivi incompleti: diagnostica e ripresa oraria sulle sole partite pendenti, entro 48 ore.
- Barra con controlli su una riga; profilo Bar nel menu inferiore.
- Ultima giornata sempre raggiungibile da Oggi; storico selezionabile esplicitamente.
- Cartolina della schedina vincente nel popup, nessun download.
- 492 test passati. Formula dei voti invariata.

# 0.29.14 — 2026-11-03

- Revisione UX Bar/Fanta, navigazione con URL e cache, demo Bar, studio formazione guidato e layout mobile/desktop.
- Bootstrap lite, ricevute delle schedine senza rilettura completa, salvataggio mirato e idempotente delle formazioni.
- Probabilità dalla cache DB del Bar e conteggio effettivo dei giocatori a voto.
- 487 test passati. Motore dei voti invariato.

# Changelog

Le modifiche seguono [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

- I membri del Bar senza squadra possono scegliere una panchina libera nella lega Fanta collegata, anche se allenano già in un’altra lega. Assegnazione verificata sul server, idempotente, protetta dai doppi clic e recuperata dopo timeout; nessun accesso a leghe estranee o import privati.
- Formazione mobile: cognomi più leggibili, nomi non compressi e campo utilizzabile anche con cinque difensori. Cambio libero del reparto sia dal campo sia dal selettore, senza ritorno automatico al reparto precedente; bozza, salvataggio e trascinamento conservati.

## [0.29.28] - 2026-11-04

- Probabili guidate dalle nostre stime: le alternative con percentuale strettamente maggiore entrano nello stesso ruolo, mantenendo modulo e posizione del titolare sostituito. Parità e dati mancanti conservano la scelta di partenza; undici ufficiali e formazioni degli utenti restano prioritari. Conservata la base originale per rendere la selezione ripetibile e misurarne l'accuratezza.

- Posizioni in campo: coordinate esplicite prioritarie, ordine destra/sinistra dichiarato dagli importatori e normalizzazione unica delle linee. Il consenso conserva le posizioni della formazione scelta; le sostituzioni mantengono lo slot e gli schieramenti personali Fanta mantengono il proprio ordine.

- Giocatori disponibili nelle probabili: selettore scorrevole Tutti/Portieri/Difensori/Centrocampisti/Attaccanti con conteggi, filtro immediato e dimensionamento dell'accordion; filtri indipendenti per squadra e nessuna nuova richiesta al server.

- Probabili formazioni: al posto dei ballottaggi, elenco richiudibile degli altri giocatori disponibili del club, senza duplicati, in ordine di stima; indisponibili e inattivi esclusi. Panchine ufficiali e formazioni Fanta conservano il loro ordine.
- Probabilità stimate arrotondate sempre per eccesso a multipli di cinque, fino al 90%; percentuali ufficiali invariate. Stessa regola in campo e nello studio formazione, senza nuove chiamate API.
- Misura prospettica dell'accuratezza degli undici: previsioni bloccate prima del calcio d'inizio e confrontate con gli ID degli ufficiali durante i lavori backend già esistenti. Voce pubblica nascosta fino a dieci partite con confronto completo; riepilogo condiviso in cache, senza polling né chiamate esterne aggiuntive.

## [0.29.27] - 2026-11-04

- Schedina Bar: salvataggio SQL mirato con ricevuta compatta, quote e controlli sul server, ritentativi identici senza doppio addebito; nessuna scansione globale di calendario e premi durante l'invio.
- Formazione Fanta: autenticazione e validazione su dati essenziali, meno richieste al DB e blocco immediato del pulsante senza ricostruire lo studio; invii identici già salvati riconosciuti anche dopo la scadenza.
- Probabilità di presenza: peso prevalente alle ultime cinque partite, crescita esponenziale per le titolarità consecutive, contributo delle buone prestazioni e di gol/assist decisivi verificati. Stime salvate in DB e aggiornate nei lavori esistenti, senza nuove chiamate al fornitore; voti e risultati invariati.

## [0.29.26] - 2026-11-04

- Link pubblici con o senza estensione HTML riconosciuti dal server Windows e conteggiati nella stessa pagina Analytics, anche dopo la riscrittura degli URL da Netlify.

## [0.29.25] - 2026-11-04

- Comandi del tag Analytics nel formato Arguments richiesto da Google, con verifica di compatibilità e nessun invio prima del consenso.

## [0.29.24] - 2026-11-04

- Google Analytics 4: proprietà dedicata, tag differito solo dopo consenso, scelta revocabile, URL generici senza dati personali e conteggio degli esiti di accesso, registrazione e salvataggio. Nessuna lettura DB aggiuntiva.
- Informativa privacy con i contatti del titolare e collegamento ad Analytics nel pannello amministrativo.
- Metadati di versione del server autonomo ricavati dal pacchetto, senza numeri obsoleti negli endpoint di salute.

## [0.29.23] - 2026-11-04

- Ripristinati gli adattatori gestiti Netlify per database e cache; il runtime Windows continua a selezionare esplicitamente gli adattatori locali.

- Banner principale Fanta con lo stemma della propria squadra: il tocco apre direttamente l'editor esistente, senza caricare prima la sezione Squadra. Logo aggiornato nelle viste già aperte dopo il salvataggio.
- Oggi Fanta: rimossi i pulsanti Panoramica/Risultati e voti; il riquadro La tua sfida apre i risultati della propria giornata. Avviso dei definitivi sotto la sfida, senza spazio aggiuntivo sopra la dashboard.
- Voti: fascia neutra simmetrica intorno al riferimento del ruolo, con contributo nullo e statistiche gialle. Tolleranza legata alla variabilità e all'esposizione; le differenze oltre la fascia incidono gradualmente. Le percentuali hanno una tolleranza minima di due punti percentuali. Formula condivisa tra motore e dettaglio giocatore, senza cambiare bonus/malus e soglie degli episodi.
- Prova locale: maglie con solo cognome e numero anche dalle anagrafiche già salvate; avversario con indicazione della trasferta nelle formazioni delle schedine Fanta.
- Percentuali di presenza uniformate al calcolo sui minuti dello studio formazione; indisponibili esclusi dalle probabili, ballottaggi coerenti e formazioni ufficiali prioritarie con percentuali definitive verdi.
- Recupero delle formazioni ufficiali dai dati API già archiviati e propagazione corretta nelle giornate del Bar. Riparata soltanto la copia locale del database; voti, crediti, giocate e storico invariati.
- Statistiche partita inizialmente limitate a quattro righe; statistiche giocatori divise per squadra con cinque righe e ulteriori dati espandibili.
- Stemmi nella schedina, profilo nella barra superiore anche nel Bar e classifica Fanta completa con PG, V, N, S, GF, GS, Pt e FP.
- Corretto il dettaglio delle formazioni Fanta salvate con eventi in formato oggetto. Letture riutilizzate in cache, senza chiamate esterne all'apertura delle viste.

## [0.29.13] - 2026-11-03

- Schedine Fanta nella sezione dedicata del Fanta: lega ereditata dalla cornice e competizione selezionabile solo se multipla. La barra resta a cinque voci; risultati e voti sono sotto Oggi.
- Riutilizzati snapshot autorizzato, salvataggio e bozze esistenti, con isolamento per utenza/lega/giornata, protezione da doppi invii e conflitti. Crediti schedine distinti dal budget asta.
- Aggiornamenti delle schedine con il timer Fanta esistente, solo nella finestra sportiva, senza chiamate al provider o letture aggiuntive al cambio di sottosezione.

## [0.29.12] - 2026-11-02

- Borsa del Quasi nel Bar riservata allo storico crediti e punti Serie A, senza selettore Fanta.
- Punti guadagnati e persi visibili accanto a ogni quota; termini accettati mantenuti sulle schedine chiuse.
- Obiettivi allineati alla prossima giornata giocabile, ignorando i segnaposto senza data valida; premi visibili.

## [0.29.11] - 2026-11-02

- Schedine Serie A e Fanta del Bar: la giornata resta in evidenza fino a mezzanotte Europe/Rome del giorno dell’ultima partita, anche se già liquidata; dal giorno successivo si apre la prossima. Giornate precedenti escluse dal selettore personale, storico conservato nel profilo. Schedine del Bar e verdetto restano sulla giornata pubblica precedente fino all’inizio della successiva.

## [0.29.10] - 2026-11-02

- Creazione unica Bar + Fanta dal selettore leghe e dall’ingresso dei nuovi utenti, con scelta tra squadre con rose vuote e rose random equilibrate. Operazione atomica, richieste idempotenti e invii protetti dai doppi clic.
- Nuovo modulo responsive condiviso; rimossa la creazione random separata dal Fanta. Chi entra nel Bar riceve una squadra libera; le rose vuote consentono l’asta iniziale, quelle random vengono completate in background.

## [0.29.9] - 2026-11-02

- Live: pubblicazione atomica del feed condiviso, protezione dalle risposte obsolete e aggiornamento degli eventi disponibili anche nelle risposte parziali. I gol esplicitamente annullati dal provider restano eventi VAR.

## [0.29.8] - 2026-11-02

- Disattivazione di Lucas Bar nel Bar e del Fanta Lucas Bar Lega A: archivio conservato, accesso bloccato, aste chiuse e automatismi/notifiche esclusi. Le altre leghe restano attive.

## [0.29.7] - 2026-11-02

- Asta: corretto lo svincolo che chiudeva il popup al clic sugli importi; importi ed errori restano visibili durante gli aggiornamenti.
- Chiusura visibile anche durante gli svincoli, scarto delle risposte obsolete, annullamento del tavolo nella fase svincoli e controlli per spettatori senza squadra.

## [0.29.6] - 2026-11-02

- Commenti delle pagelle più vivaci, con contributi verificati e giudizio complessivamente positivo dai 7 in su; carenze in chiusura, conteggio corretto degli assist e contesto di cartello raccontato senza formule.
- Aggiornamento editoriale dei commenti già salvati, in batch e senza chiamate API né modifiche a voti, input, classifiche o storico numerico.

## [0.29.5] - 2026-11-02

- Nuova revisione degli input carriera per ricalcolare i voti definitivi con i metadati importati, mantenendo invariati pesi e baseline del ruolo.
- Ricalcolo delle sole partite concluse da dati memorizzati, in batch, con conservazione delle revisioni precedenti, annullamento dei lavori obsoleti ancora in coda e verifica mirata dei giocatori richiesti.

## [0.29.4] - 2026-11-02

- Ripristinata la pianificazione del dispatcher anche nei rilasci con funzioni precompilate; pubblicazione del risultato live prima dei calcoli voti e delle notifiche.
- Verifica definitiva alle 07:00 Europe/Rome del giorno successivo alla conclusione dell’ultima partita, inclusa ripianificazione dei lavori ancora in coda.
- Importazione iniziale di anagrafiche, statistiche stagionali, carriere e trasferimenti disponibili per 715 giocatori; archivio separato e metadati carriera collegati tramite ID API, senza modificare rose o storico dei voti.

## [0.29.3] - 2026-11-02

- Schedine del Bar: rimossi esclusivamente spunta, croce e barratura; colori, esito scelto e risultato restano invariati.
- Contesto partite di cartello: bonus tecnico continuo da +0,50 a +1,00, con fattori di prestazione, incisività, difficoltà e partecipazione; maggiore margine per giovani fino a 23 anni al debutto in Italia verificato. Nessuna nuova chiamata API per partita.

## [0.29.2] - 2026-11-02

- Il ritorno Fanta → Bar mantiene la lega collegata selezionata anche per chi appartiene a più leghe.
- Cache locale dei dati di visualizzazione Fanta e dei dettagli partita Bar, separata per utente, con scadenze, revisioni, limite di spazio e pulizia al logout; invalidazione dopo le scritture e nessuna cache delle aste.

## [0.29.1] - 2026-11-02

- Migrazione del campionato esistente nel Bar Quelli del quasi, mantenendo ID, rose, formazioni, schedine, crediti e storico; rimozione del Bar doppione e liberazione delle panchine dei due account test.
- Switch Bar/Fanta sempre visibile e apertura della lega collegata al Bar selezionato; chiuse le iscrizioni pubbliche alla pilota senza cambiare il motore aste.

## [0.29.0] - 2026-11-02

- Leghe random reali: generazione asincrona, rose equilibrate per ruolo, assegnazione casuale delle panchine e sole aste di riparazione.
- Collegamento Fanta–Bar: creazione automatica del Bar, creazione del Fanta dal Bar e schedine native configurabili dal presidente, riservate agli allenatori.
- Leghe importate escluse dal Bar e riservate a frankwood nel Fanta; rimozione mirata di Lucas Bar B.
- Cache DB e richieste aggregate preservate; nessun nuovo cron o polling per le leghe random.

## [0.28.2] - 2026-11-02

- Motore voti v2.3: contributi proporzionati per i primi/ultimi quattro rating di partita e squadra; vale solo il contributo maggiore in valore assoluto, con parità condivise e nessun effetto dai dati mancanti.
- Ricalcolo server una tantum dei voti archiviati e risultati nativi, con aggiornamento delle schedine collegate.
- Crediti e classifiche scommettitori separati per fantalega; competizioni della stessa lega condividono il saldo. Migrazione idempotente con conservazione di puntate, vincite e rettifiche precedenti.
- Selettori di classifica e portafoglio, menu Fanta coerenti con lo stile dell’app e giornate future selezionabili per scommettere.
- Classifica delle squadre Serie A spostata nelle schedine Serie A, con navigazione a pulsanti.

## [0.28.1] - 2026-11-02

- La tab Fanta del Bar apre sempre la schedina, senza passare all'app Fanta; seleziona una lega accessibile con sfide attive e la giornata in corso prima delle successive o archiviate.
- Banner sotto la propria sfida in Fanta → Oggi, con quote 1/X/2 e collegamento alla lega e giornata corrette del Bar; a scadenza diventa «Segui la schedina».
- Snapshot live dal DB con fantapunti e revisione del dettaglio: aggiornati solo punteggi, voti e bonus, mantenendo campo, immagini e sezioni aperte.
- Classifica Fanta con PG, V, N, P separati, cifre uniformi e colonne dedicate anche ai punteggi a due o tre cifre; scorrimento orizzontale sui telefoni stretti.
- Nessuna migrazione, chiamata a provider o modifica a voti, saldi, giocate, rose e personalizzazioni.

## [0.28.0] - 2026-11-02

- Leghe pilota persistenti da 10 squadre: scelta atomica, una squadra per account, frankwood presidente e nuova lega automatica al completamento; demo anonima separata.
- Allenatori automatici per le squadre libere della pilota e per Lucas, con precedenza alle formazioni manuali; due lavori condivisi prima della scadenza, senza chiamate aggiuntive ai provider.
- Lucas e schedine Fanta del suo Bar collegate al motore nativo: migrazione 011, archivio di sicurezza, controllo preventivo e ripristino protetto; quote accettate, storico e saldi conservati.
- Asta di riparazione divisa in svincoli e acquisti, rimborso scelto per operazione, annullamento nella fase aperta e registro. Gestite anche riacquisto dello stesso giocatore e crediti non rimborsati.
- Correzioni delle rose da parte del presidente, solo frankwood nelle pilote: aggiunta, rimozione, prezzo e trasferimento con conferma interna, vincoli, audit e segnalazione delle formazioni future da correggere.
- Rimossi collegamenti e funzioni dell’import esterno, lettore browser, connettore Chrome e dipendenze Chromium/Puppeteer. Strumenti offline precedenti separati nello storico documentale.
- Integrate le schermate pilota e i CSS consegnati, mantenendo le correzioni recenti a navigazione, login, cache e visualizzazione mobile.
- Rimossi i messaggi «Sempre gratuita» e «Tutti uguali»: la promessa visibile è «Niente pubblicità, per sempre.», anche in splash e inviti.
- Anteprima isolata con database in memoria, utenti e calciatori sintetici.
- Quasi a figura intera e stemmi cartoon dalla consegna grafica: contratti, personalizzazioni, immagini caricate e premi conservati; proporzioni della dashboard adattate.
- Rimborso una tantum della sola schedina importata senza risultati identificata nel controllo, come autorizzato dal proprietario.

## [0.27.19] - 2026-11-02

- Invito pubblico all’app per tutti, in Bar e Fanta: WhatsApp, copia link e condivisione del dispositivo; i presidenti mantengono anche l’invito separato alla lega con codice.
- Formazioni non schierate: 0 fantapunti e 0 gol, senza copia automatica della precedente né esclusione dell’intera giornata. Ricalcolo una tantum dei risultati di squadra con i voti già salvati, senza nuove chiamate ai provider né modifiche ai voti individuali.

## [0.27.18] - 2026-11-02

- Le letture dell'asta usano la cache senza ricostruire il catalogo in una transazione di scrittura a ogni secondo: il percorso bloccante scatta soltanto quando scade un timer o arriva un comando.
- Regolamento del voto coerente con il nuovo motore statistico.

## [0.27.17] - 2026-11-01

- Cache DB privata su memoria e Blobs con controllo versione, invalidazione tra istanze e verifica fresca dei permessi; deduplicazione delle letture frontend e protezione dalle risposte obsolete dopo un salvataggio.
- Modifiche profilo e segnalazioni senza caricare l'intero archivio sportivo; nessuna password di accesso in cache.
- Abbinamenti persistenti e verificati degli undici giocatori di Lucas Bar Lega A, alias normalizzati e club Juventus per Yildiz; importazioni successive preservano associazioni e storico.
- Classifica statistica completa anche in attesa della verifica finale; un ricalcolo incompleto conserva risultati validi, senza rimpiazzarli con zeri.

## [0.27.16] - 2026-11-01

### Changed
- Motore voti 2.2: sostegno anche alle reti nelle sconfitte, minimo 6 per i marcatori e 6,5 per i portieri che parano rigori; −0,5 tecnico per ogni rigore sbagliato, separato dai bonus/malus fantasy. Nuove soglie strette oltre 5,6 / 6,2 / 6,65 / 7,25 e commenti giornalistici senza spiegazioni degli incrementi.
- Ricalcolo finito delle prestazioni già memorizzate e controlli sugli episodi con minuti o statistiche mancanti.

### Fixed
- Chiusura dell’asta anche con un giocatore sul tavolo e annullamento della chiamata da parte del presidente, senza acquisti impliciti né variazioni a rose e crediti; comandi disponibili anche nella demo.
- Scelta coerente della giornata corrente per la home e per i relativi voti letti dal DB.

### Added
- Audit una tantum delle undici identità Lucas Bar indicate dall’amministratore, con verifiche mirate delle rose API Juventus/Lazio e nessuna modifica a dati di gioco.

## [0.27.15] - 2026-11-01

### Fixed
- Accesso e registrazione mantengono il campo password durante la digitazione, la compilazione automatica e il cambio di visibilità; validazione senza ricreare il form e risposte tardive isolate dopo la navigazione.
- Creazione e ingresso nelle leghe con transazioni mirate, senza importare lo stato pesante o rielaborare premi e calendario. Primo accesso senza lega limitato ai dati di onboarding; errori di lettura senza scritture sullo stato completo.
- Pulsante e navigazione live Fantacalcio puntano alla giornata corrente, senza riaprire una vecchia giornata non verificata o conservata in cache.
- Login recuperabile se il caricamento iniziale fallisce dopo l’autenticazione. Flusso registrazione, conferma email, recupero e cambio password verificato in ambiente isolato.

## [0.27.14] - 2026-11-01

### Changed
- Commenti giornalistici deterministici sulle prestazioni, contestualizzati a giocatore e partita, con contributi numerici separati e senza diciture sperimentali nel dettaglio.
- Motore voti 2.1: primo gol importante +0,5 al grezzo in caso di risultato utile, altre reti con peso decrescente legato a prestazione, difficoltà e risultato; nuove soglie progressive di arrotondamento (5,6 → 6; 6,3 → 6,5; 6,7 → 7).
- Ricalcolo finito delle prestazioni e delle giornate native già salvate, mantenendo lo storico e il calendario operativo esistente.

## [0.27.13] - 2026-11-01

### Added
- Nuova area pubblica consegnata: landing Fanta + Bar, registrazione a tre campi, accesso, recupero e link email, inviti personalizzati e demo Fanta offline. Importazione guidata dopo il login e demo Bar mostrata soltanto se abilitata.
- Motore deterministico di voti statistici v2: normalizzazione verificata, baseline temporali, contributi individuali per ruolo, contesto da quote pre-partita e qualità collettiva, audit e ricalcolo delle giornate native esistenti.
- Calendario operativo persistente fuori dal DB: live condiviso, verifica mattutina Europe/Rome, promemoria puntuali, code reali e controlli manuali nell’Admin.

### Changed
- Un solo dispatcher sostituisce nove pianificazioni; cache sportiva pubblica condivisa con CDN, letture private su cambi di risultato e aggiornamenti mirati del DB.
- Uno snapshot corrente per voto provvisorio; finali e rettifiche preservano lo storico. Riepiloghi di classifica preparati dal backend.

### Fixed
- Passaggi riusciti con al massimo un decimale e dettaglio del voto allineato alla formula.
- Correzione dell’email di una registrazione appena creata con verifica della password e invalidazione del vecchio link, senza account duplicati.
- Asta: GET senza assegnazioni, tick esplicito nella sala visibile; polling sospeso offline. Rettifiche ufficiali con ledger compensativo idempotente, anche A→B→A.
- Pulsanti occupati non duplicano gli invii; logout, link email e navigazione pubblica mantengono una via di ritorno.

## [0.27.12] - 2026-11-01

### Fixed
- La sala d’asta mantiene una sola lettura in corso: le connessioni lente non accumulano richieste e una risposta tardiva non aggiorna un’altra lega.

## [0.27.11] - 2026-11-01

### Fixed
- Accesso, registrazione e recupero password usano transazioni leggere; invio email asincrono con coda durevole, tentativi e idempotenza. Recupero anche per account non ancora verificati.
- Stato di caricamento e blocco dei doppi clic per le azioni di Bar, Fanta e amministrazione; errori di accesso mantengono i dati inseriti.
- Asta dal vivo apribile subito dal presidente, visibile a tutti i membri; accesso e rilanci online per i giocatori associati, cache coerente dopo i cambi di stato.
- Titoli Fanta corretti su desktop e giocatori già schierati esclusi dai selettori e dalla lista disponibili.

### Added
- Calendario e risultati nella squadra; rosa degli avversari dal nome nei partecipanti.
- Editor del logo a schermo intero con forme, colori e simboli cartoon; caricamenti fino a 250 KB, immagini ottimizzate e lettura separata dal database.
- Competizioni condivise nella lega: campionati, coppe a gironi ed eliminazione; calendari, formazioni e risultati indipendenti. Taglia bloccata dopo avvio con tutte le rose complete e giornata iniziale scelta dal presidente.
- Migrazione conservativa delle competizioni esistenti e pulizia dei soli account di prova richiesti.

## [0.27.10] - 2026-11-01

### Fixed
- Completato l'import delle 250 spese delle rose Lucas Bar Lega A; rimossi gli endpoint operativi temporanei dopo la verifica dei dati salvati e dei punteggi live.

## [0.27.9] - 2026-11-01

### Fixed
- Gli aggiornamenti del Bar rilasciano la riga dell'autenticazione durante le operazioni esterne; il salvataggio verifica i conflitti e conserva le sessioni create nel frattempo.
- Importazione protetta delle rose e delle spese, con verifica dei voti live già presenti nel database.

## [0.27.8] - 2026-11-01

### Fixed
- Il batch live inizializza automaticamente calciatori, partite e abbinamenti usando i dati già archiviati; non richiede operazioni temporanee di amministrazione.

## [0.27.7] - 2026-11-01

### Fixed
- Il collegamento delle formazioni archiviate ai voti live può essere completato anche separatamente dall'import delle spese delle rose.

## [0.27.6] - 2026-11-01

### Added
- Import delle rose da Excel con tutti i costi reali, totali controllati, identità API separate dai giocatori ancora da abbinare e riconciliazione delle formazioni archiviate.
- Voti live nativi dalle statistiche API-FOOTBALL già salvate dal batch condiviso; ricalcolo sui nuovi dati e riuso dei tabellini invariati.
- PG nella classifica e colori verde/rosso soltanto per fantapunti massimi/minimi; palloni, scarpetta assist e cartellini vicino ai giocatori.

### Fixed
- Login e riapertura sul Bar, senza richieste dei dati Fanta prima dell’ingresso esplicito; base di navigazione Fanta accorpata al primo ingresso.
- Revisione mobile/desktop di dashboard, formazione, rosa, giornata, classifica, asta e profilo; orari leggibili, foto differite e nessuno zero inventato per i dati mancanti.
- Dettagli storici senza scomposizione del voto: mostrano i dati disponibili e un messaggio breve senza eccezioni.

## [0.27.5] - 2026-11-01

### Fixed
- Login e logout separati dal payload completo di gioco: transazione limitata a utenti, sessioni e dati di autenticazione, senza sincronizzare calendario e premi.
- Accesso amministrativo e invio del codice email usano la stessa transazione leggera, conservando MFA e limiti di tentativi.
- Gli errori di autenticazione non avviano una seconda transazione sullo stato completo solo per registrare il problema; attese DB limitate.

## [0.27.4] - 2026-11-01

### Fixed
- Le richieste anonime al pannello amministrativo sono respinte prima di caricare lo stato di gioco o aprire una transazione sul DB.

## [0.27.3] - 2026-11-01

### Fixed
- La barra superiore conserva nome della lega e crediti anche prima che il Fanta abbia completato il bootstrap; cambia subito soltanto la modalità selezionata.

## [0.27.2] - 2026-11-01

### Fixed
- Selettore Bar/Fanta uniforme sulla stessa barra di lega e crediti, con layout mobile compatto.
- Ingresso Fanta con bootstrap unico, letture DB aggregate e riuso dei dati durante la navigazione; polling delle aste sempre fresco.
- Formazioni archiviate trasferite nelle tabelle native, comprese quelle della giornata 8, senza inventare prezzi di acquisto o identificativi API. Import ripetibile senza sovrascrivere modifiche manuali.

### Added
- Barra dell’app madre persistente nei cambi Bar/Fanta; solo l’area sotto cambia. Prima splash sempre a tutto schermo, splash successive sotto la barra: nuove frasi sul fantacalcio entrando nel Fanta, frasi originali tornando al Bar.

## [0.27.1] - 2026-11-01

### Added
- Il presidente può associare una squadra Fanta a un account beta registrato dalla sezione Partecipanti. Verifiche server su ruolo, abilitazione e unicità dell'associazione; Frankwood resta destinato a Fly Emigrates nell'import della lega.

## [0.27.0] - 2026-11-01

### Added
- Modalità Fanta nativa accanto al Bar: frontend consegnato integrato, caricato al cambio di modalità; demo senza rete per ospiti e utenti fuori beta. La tab delle schedine Fantacalcio del Bar resta invariata.
- API separata `/fanta-api/*`, autorizzazione server per `FANTA_BETA_USERS=frankwood` e appartenenza alla lega, migrazione relazionale `003_native_fanta.sql` nello schema `fanta`. Nessuna scrittura del Fanta nel blob del Bar.
- Motori puri per voti statistici spiegati, bonus/malus, modificatore, cambi nello stesso ruolo e classifica; correzione Haiku opzionale e validata entro mezzo punto. Storico degli input e dei voti, tre controlli dopo il finale e congelamento quando i dati sono completi.
- Aste online e dal vivo con transazioni, blocco del lotto, controllo crediti/ruoli/turni, passi irreversibili, assegnazioni e annullamenti tracciati. Budget 500, rilancio 1, rosa 3/8/8/6.
- Job Fanta predisposti ogni minuto e giornalmente, import beta idempotente dal collegamento Lucas Bar Lega A, elenco dei casi dubbi visibile solo al presidente, promemoria e push con le protezioni degli ambienti di prova. Sonda live server con campioni a 30 secondi e limite di chiamate.
- Test PostgreSQL in memoria con dati sintetici: schema, contratti frontend, isolamento del Bar, import, aste concorrenti, congelamento, aggiornamento punteggi e notifiche. Rapporto e procedura di attivazione in `docs/REPORT-FANTA-BETA.md`.
- Copia remota autorizzata dell'archivio Lucas Bar Lega A nel nuovo schema, senza credenziali né scritture nel Bar; confronto richiudibile tra risultati del Quasi e risultati esterni conservati separatamente, con scarto dei fantapunti.

### Fixed
- Gestione della prima giornata senza storico, dati mancanti, ritorno Fanta → Bar e pulizia dei listener/timer quando si cambia modalità. Le notifiche Fanta aprono il Fanta, senza aprire la chat del Bar.

## [0.26.5] - 2026-10-31

### Changed
- API-FOOTBALL Pro diventa la fonte primaria di risultati, eventi e statistiche Serie A. Aggiornamento backend condiviso ogni minuto con fino a 20 partite per richiesta; i servizi delle probabili formazioni restano invariati.
- Recupero completo della stagione corrente eseguito da un worker server autenticato, con report persistente, lease e operazione idempotente. Statistiche delle squadre, statistiche dei giocatori, cartellini, gol, rigori segnati/sbagliati/parati, sostituzioni e VAR sono conservati nel DB.
- Dettaglio partita con statistiche e riepilogo rigori richiudibili; aggiornamenti dal DB senza ricostruire formazioni, foto o accordion. Rigori sbagliati e parati non vengono conteggiati come gol; i dati non forniti restano assenti.

## [0.26.4] - 2026-10-31

### Changed
- SportAPI.ai diventa la fonte di risultati, minuti e gol/cartellini in diretta quando è configurata la chiave server `SPORTAPI_KEY`. Il cron condiviso esegue una richiesta per partita ogni minuto dopo la scoperta dell’ID; nessuna chiamata al provider dal browser. I servizi precedenti continuano a gestire le formazioni.
- Tabellini finali conservati nel DB: controlli ogni 15 minuti durante la pubblicazione dei dettagli finali, poi nessuna nuova richiesta quando l’archivio è completo. Errori parziali e risposte obsolete non cancellano i dati già acquisiti.

### Fixed
- Partite delle schedine Serie A e Fantacalcio ordinate per calcio d’inizio, con le gare LIVE in cima. All’avvio e al termine della diretta si riordinano le righe esistenti senza ricostruire mercati, pronostici o dettagli aperti; stesso ordine nelle mini schedine del Bar.

## [0.26.3] - 2026-10-31

### Fixed
- Cambio dei menu immediato usando lo stato già caricato: rimossa la lettura completa bloccante prima di mostrare ogni sezione. Le azioni di salvataggio mantengono il proprio aggiornamento esplicito; il canale live resta una lettura del nostro DB ogni 60 secondi.
- Regressioni: navigazione verificata anche con trasporto bloccato; 1.000 letture live simulate producono zero chiamate ai provider esterni e zero scritture del DB.

## [0.26.2] - 2026-10-31

### Fixed
- Lista Fantacalcio: iscrizione salvata sul server e mail al proprietario con nome/email dell’account verificato, ruolo, partecipanti e messaggio obbligatorio. Conferma persistente, invio immediato con coda di recupero e nessuna email duplicata dai tentativi ripetuti.
- Ritorno rapido alla pagina iniziale da accesso, registrazione, recupero password e demo; ripristino delle viste con Indietro/Avanti del browser e link pubblici funzionanti anche durante il caricamento iniziale.

### Changed
- Le schedine del Bar rifatte: un unico tavolo con una tessera per giocatore (Quasi in miniatura, nome, stile di gioco, battuta, schedina compatta su carta con esito e ✓/✕ per partita, pulsante «Il profilo del pronosticatore»); la tessera personale è la prima, corona al migliore, bollini per il più spericolato e il pompiere.
- Profilo del pronosticatore più veloce: l'analisi non passa più dalla transazione di scrittura ma da una lettura leggera (nessun blocco dello stato, nessuna ricostruzione del calendario) con ETag; un'unica chiamata porta i verdetti di tutta la giornata, quindi il popup si apre subito. Il percorso di scrittura resta solo come ripiego se un profilo non è ancora salvato.
- Testi dei profili accorciati: battuta di una riga per la tessera, verdetto breve nel popup con rischio, puntata, azzeccate, colpo più ardito, evoluzione e storico a barre. I profili già salvati vengono rigenerati una volta nel nuovo formato.
- Anteprima locale isolata: due giornate chiuse con sette pronosticatori, Quasi e stili diversi per provare le schedine del Bar.

## [0.26.1] - 2026-10-31

### Fixed
- Test del download Excel ripetibile: data fissa nei file ZIP sintetici, senza dipendere dal secondo in cui viene eseguito il confronto. Nessun cambiamento al download reale.

## [0.26.0] - 2026-10-31

### Changed
- Home sulla giornata in corso con “Segui in diretta”; compilazione della prossima soltanto dopo tutti i risultati finali Serie A.
- Schedine del Bar con Quasi, mini schedina, ritratto ironico e profilo del pronosticatore; lettura collettiva dei profili già salvati e aggiornamento dei testi precedenti.
- Immagini: 20 stemmi WebP con hash, miniature responsive degli spogliatoi, stanza Home prioritaria, ritratti WebP fino a 160×214 e conversione graduale/idempotente delle immagini già archiviate, senza cambiare lo schema DB.
- Cache lunga per immagini con hash, revalidazione per codice e HTML; cache in memoria dei ritratti mantenendo l’autenticazione per richiesta.
- Un solo canale live DB per tutte le viste: 60 secondi con jitter, timeout/watchdog, pausa offline o in background, ripresa immediata e backoff; ETag/304 e aggiornamento mirato senza ricostruire pagina, formazioni o foto.
- Anteprima locale isolata con dati sintetici in RAM, senza chiamate esterne, invii o accesso al DB pubblico.
- Home ridisegnata come dashboard: scena del Quasi nel suo spogliatoio, prossima mossa con conto alla rovescia e un solo pulsante, numeri senza cornici, obiettivi in fila orizzontale, Borsa del Quasi sempre visibile.
- Duplicati rimossi dalla Home: Regolamento (solo in Lega), Movimenti e giornate archiviate (Lega › Storico), La mia lega (Lega › I Quasi), Entra o crea una lega (dentro il selettore delle leghe). Tolta la voce Chat dalla barra di Lega: resta il pulsante flottante.
- Formazioni più leggere: le foto della squadra non visibile non partono più, le foto di una partita aperta si caricano fino a sei alla volta e la riga del club non si ripete quando coincide con la squadra.
- Piè di pagina su una sola riga con © e anno corrente, con l’attribuzione SportScore (prima nascosta dietro la barra delle tab); tolto il vuoto sotto il contenuto; area sicura in basso con margine minimo di 10 px (barra delle tab, pulsante chat, pannelli, editor del Quasi) per non sovrapporsi alla gesture di sistema.
- Premi: guardaroba in Io aperto, con avanzamento e senza i tre «Riduci»; «Indossa nel tuo Quasi» apre l’editor sul premio; l’editor mostra i premi per categoria; schermata di rivelazione per i premi nuovi; messaggio chiaro quando non hai ancora premi.
- Schedina: stato fisso ("Non ancora confermata", "Modifiche da salvare", "Confermata · modificabile fino a…"), messaggio "Mancano N partite", campo "Altro" per la puntata e pulsante principale "Conferma".
- Home essenziale: il Quasi si personalizza dalla scheda Io; invito a collegare il Fantacalcio per admin e giocatori.
- Admin: collegamento Fantacalcio in cima e aperto finché non è collegato.
- Invito via link /invito/CODICE (conservato 7 giorni), messaggio WhatsApp con link, pagina 404 a tema.
- Lega demo con squadre e quote diverse tra le partite.

### Added
- Fantacalcio del Quasi: pagina di pre-lancio dell’app a parte per la stagione 2027/28 (cosa arriva, percorso, lista d’attesa tramite il canale di supporto) con invito dalla Home.
- Schedine separate nelle tab Fanta e Serie A; bollini Lega centrati e Chat nel pannello a scomparsa.
- Barra unica con lega e crediti, visibile soltanto con più leghe; rimossi selettore e intestazione duplicati dopo l’accesso.
- Landing pubblica, navigazione a 5 tab, selettore lega con ruoli e schedina v2.
- Processo di rilascio con anteprime PR, staging e produzione approvata dal proprietario.
- Protezioni per invii e job fuori produzione; banner di ambiente e header noindex.
- Script semver, template PR e verifiche CI senza deploy.

## [0.25.1] - 2026-10-31

### Changed
- Risultati live nella riga della schedina, con punteggio, minuto e indicatore LIVE.
- Unico polling ogni 60 secondi per i risultati salvati nel DB; letture delle altre pagine su apertura o richiesta.
- Chat con aggiornamento manuale dei messaggi.

### Fixed
- Formazioni e dettagli aperti restano stabili durante gli aggiornamenti dei risultati.
- Aggiornamento dei colori delle giocate e animazione della riga al rilevamento di un gol.

Ricostruzione dalla versione pubblica `public/version.json` e dalla baseline Git locale. La storia precedente disponibile contiene un solo commit frontend e non consente di attribuire a questa patch tutte le funzionalità storiche elencate nei feature flag.


## Unreleased

- Prova locale UI: maglie, stemmi, colori condivisi e ripristino formazione.
