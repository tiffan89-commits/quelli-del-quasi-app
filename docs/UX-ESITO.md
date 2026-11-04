# Revisione UX — stato della consegna

Sito pubblicato: https://quellidelquasi.com
Anteprima UX sintetica precedente: https://ux-review-02913--quelli-del-quasi.netlify.app (precede gli interventi backend finali)
Base completa: pacchetto sorgenti 0.29.13 fornito da Francesco, corrispondente al deploy 6ae919b33612ddbfb1eea634. Verificati tutti i 660 hash SHA-256 del manifest senza conflitti. Versione pubblicata: 0.29.14, deploy 6ae99776ef05cce65710588d. Nessun commit, push, PR, migrazione o ricalcolo dei voti. Il rilascio completo è stato successivamente autorizzato da Francesco.

## Stato punto per punto

Implementazione verificata con dati sintetici, anche sullo schema PostgreSQL reale tramite PGlite. Le prove di salvataggio non usano utenti né dati di produzione.

| Punto | Stato | Esito / limite |
|---|---|---|
| A1 | Fatto | Prima giornata aperta, ordinamento numerico, distinzione aperta/chiusa/non ancora aperta; niente conferma sulle quote mancanti. La giornata in corso resta corrente. |
| A2 | Fatto FE e backend | Tutte le gare terminate rimuovono LIVE dalla home; il backend restituisce il conteggio dei giocatori effettivamente a voto, incluse le sostituzioni. Verifica con dati sintetici; il conteggio non è dedotto dal totale punti. |
| A3 | Fatto | Demo Bar riaccesa con soli dati sintetici di Serie A, scelta delle due demo e passaggio reciproco. Il flag pubblico barDemo è attivo; la demo resta interamente locale e non crea sessioni o giocate nel DB. |
| A4 | Fatto | Schedina Fanta nella demo funzionante, con portafogli indipendenti per le due leghe fittizie. |
| A5 | Fatto | Linea del grafico termina sul punto, area senza contorno e rimosso il segno verticale finale. |
| B0 | Fatto FE | Bar solo Serie A; schedine e classifiche delle sfide fantasy nel Fanta. Contratto di creazione Bar+Fanta e inviti esistente conservato. Creazione/inviti reali non eseguiti in anteprima. |
| B0-bis | Fatto | Bar: Oggi/Schedina/Classifica/Quasi. Fanta: Oggi/Schedina/Classifica/Squadra/Lega. Profilo in alto, strumenti comuni nel menu lega, admin solo se autorizzato. |
| B1 | Fatto per schede/sezioni | Hash per schermate, sottosezioni e giornate, ripresa dopo accesso, Indietro/Avanti. Gli editor e i dettagli temporanei restano finestre sopra la schermata. |
| B2 | Fatto | Saldo Bar sempre Serie A; Fanta con crediti schedina e asta etichettati separatamente. |
| B3 | Fatto | Nessuna scheda Fanta nel menu basso Bar; selettore unico in alto. |
| B4 | Fatto nomi; Lucas non riattivata | "Random League" presentata come "Lega pilota". La cronologia deploy riporta nella 0.29.8 la disattivazione di Lucas Bar/Fanta Lucas A conservando lo storico: non l'ho annullata implicitamente. Per tornare alla precedente intenzione di tenerla attiva serve decidere la riattivazione. |
| B5 | Fatto | Toggle della schedina spostato in Regolamento, chiuso e solo admin, con API esistente conservata. Niente checkbox nella classifica; sottotitolo duplicato eliminato; "Punteggi in aggiornamento". |
| B6 | Fatto | A 375 px visibili #/Squadra/Pt/FP; PG/V/N/P presenti su desktop. |
| B7 | Fatto | Chat nell'intestazione; niente tondo sopra classifica o pulsanti. |
| F1–F6 | Fatto FE | Migliori, ripeti, scelta guidata degli 11, panchina in sequenza, scambio titolari, testata compatta e studio a schermo intero. Conservati calendario squadra, logo, rosa, trascinamento, strumenti esistenti. |
| F7–F8 | Fatto FE e backend | Badge e ordinamento fantamedia × probabilità collegati al contratto play del backend. Dato assente pesato 70% SOLO per il suggerimento, come richiesto; non viene mostrata una probabilità inventata. Nessun nuovo provider o polling. |
| F dati dal server | Fatto | GET team legge esclusivamente le percentuali esplicite del Bar già salvate nel DB, nella stessa stagione e giornata oppure nella precedente. Abbinamento per ID stabile o nome e club coerenti; nessuna percentuale ricavata da flag titolare/panchina. Nessun nuovo provider. |
| C1 | Fatto | Da 1024 px menu in alto e nel flusso del documento, non sopra il contenuto. |
| C2 | Fatto | Stesso massimo 1180 px, home Fanta a due colonne su desktop. |
| C3 | Fatto | Selettore lega largo quanto il nome, con troncamento controllato sul telefono. |
| D1 | Fatto | Moduli dati-finti Fanta e demo Bar dietro import dinamico. Test del grafo statico: esclusi dal caricamento iniziale degli utenti reali. |
| D2 | Fatto | Landing con styles.css/pubblico.css, stili app caricati entrando, JS raggruppato e minificato: 18 output/chunk in tutta la build, non 86 moduli separati. Non è una misura di 18 richieste iniziali. |
| D3 | Fatto | Bootstrap lite con un solo endpoint e soli me/leagues/home; squadra/classifica/giornata caricati su richiesta. Istanza e dati mantenuti in memoria al cambio app; nessuna splash al ritorno in cache. Il bootstrap completo resta disponibile per compatibilità, ma il nuovo FE non lo usa. |
| E1 | Fatto | Un solo Powered by API-FOOTBALL nel piè di pagina pubblico. |
| E2 | Fatto | Slogan nel bollino e nelle FAQ; rimane nelle splash già esistenti. |
| E3 | Fatto | Logo torna alla presentazione e scorre in cima. |
| E4 | Fatto | Quasi con spogliatoio nelle immagini già nello stile del progetto. |

## Salvataggi richiesti in aggiunta

- Blocco immediato e aspetto scuro/incliccabile durante l'invio.
- Blocco delle scritture in corso indipendente dal DOM: ridisegnare la pagina non permette il doppio POST di formazione o schedina.
- Nessun retry automatico delle scritture; errore esplicito, bozza conservata, comando riabilitato per un tentativo consapevole.
- Formazione confermata alla risposta del POST, senza attendere la successiva lettura della home.
- Schedina: il POST restituisce una ricevuta compatta con schedina salvata, saldo, quote accettate, savedAt, movimenti e premi del proprio utente. Il client aggiorna il proprio snapshot senza un secondo download completo. Il controllo dei conflitti tra dispositivi resta attivo.
- Formazione: transazione mirata alla propria rosa; non carica anagrafiche globali, risultati e voti storici. Una richiesta identica conserva savedAt e non riscrive la formazione; scadenza e proprietà sono verificate sotto lock.
- Restano i controlli di conflitto baseSavedAt. Il blocco client non sostituisce l'idempotenza transazionale server fra dispositivi diversi.
- Il minor numero di letture e di dati trasferiti è verificato nei test; non è stato misurato un tempo di salvataggio con utenti reali sul DB pubblico.

## Verifiche finali

487 test automatici passati, zero fallimenti. Comprendono la suite del pacchetto originale aggiornata dove il nuovo menu cambia il comportamento previsto, più test UX e test SQL per salvataggi mirati, proprietà/scadenze/idempotenza, bootstrap lite, probabilità esplicite e ricevute delle schedine. Nessun cambiamento al motore dei voti.

Verifiche browser già eseguite a 375 e 1366 px con utente sintetico normale, presidente e demo: passaggio Bar/Fanta, studio e scelta guidata 1→11→panchina, blocco doppio clic, classifica mobile, profilo e azioni comuni, Indietro/Avanti, link diretto dopo accesso, ritorno Fanta dalla cache.

Il pacchetto mantiene le 16 funzioni e le 16 migrazioni del rilascio originale. Nessuna nuova pianificazione, nessun import o processo di ricalcolo avviato. Creazione di leghe, inviti e invio email sono coperti dai test esistenti, non sono stati eseguiti su dati di produzione.

Verifica dopo il deploy: versione 0.29.14 e ambiente production, 16 funzioni, API pubbliche HTTP 200, flag barDemo attivo. Demo pubblica provata a 375 e 1366 px: switch, salvataggio nello studio, classifica e schedina Fanta, ritorno in cache senza splash. Nessun errore console rilevato in questa prova.
