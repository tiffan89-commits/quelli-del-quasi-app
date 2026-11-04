# Rilascio 0.29.16

Pubblicato il 3 novembre 2026 su https://quellidelquasi.com.
Deploy: 6ae9a96ccae2d1f6e7c3f686. 16 Functions e 16 migrazioni incluse.

- Demo Bar/Fanta con sessione comune in RAM, due leghe e portafogli separati. Le schermate sono quelle reali. Formazioni, stemmi, Quasi, chat e azioni dell'asta di riparazione sono provabili senza modificare il DB reale. Reset al ricaricamento/uscita. Nessun invio email o consenso push reale nella demo.
- Dal pannello «Come funziona» della demo si possono provare giornata futura, live e calcolata. Dati, squadre e voti della demo sono sintetici; non sono un confronto dei voti reali.
- In Fanta → Oggi il comando per schierare/modificare apre direttamente il nuovo studio formazione di Claude, mantenendo Oggi sotto. L'ultimo risultato resta cliccabile. Nello scenario calcolato 11 si salva la formazione 12. Nessun ridisegno delle altre sezioni.
- Schedine: versione difficulty-v2, +1 per 1/X/2 corretti e -0,5 per errori. Difficulty-v1 resta disponibile per lo storico. Doppie chance, gol/no gol e under/over conservano la ponderazione esistente.
- Installazione una tantum install:straight-half:v1: completata sul DB reale alle 09:30:10 UTC (10:30:10 italiane), 7 leghe, 72 giornate future, 4 schedine salvate adeguate. Giorna­te chiuse, già iniziate e liquidate escluse; punti, crediti, quote accettate e storico non ricalcolati.
- Il motore dei voti reali è identico alla 0.29.15. La schedulazione dei controlli di completezza introdotta nella 0.29.15 è conservata.

Verifiche: 500 test automatici superati; ulteriori controlli mirati dopo gli ultimi testi. Prova SQL PostgreSQL locale dell'installazione con verifica dell'idempotenza e dell'invarianza di storico, crediti e quote accettate. Verifica browser mobile 390 px: scenario calcolato, apertura diretta studio 12, compilazione, salvataggio e ritorno a Oggi. Il bundle demo si carica solo all'ingresso nella prova.

Le operazioni account reali e la lega pilota richiedono la registrazione e non vengono simulate come invii effettuati. Le modifiche della demo sono effimere. Nessun servizio sportivo viene chiamato dalla demo.
