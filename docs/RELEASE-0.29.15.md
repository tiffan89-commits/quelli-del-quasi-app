# Rilascio 0.29.15 — 3 novembre 2026

Pubblicato su https://quellidelquasi.com. Deploy 6ae99fd879922f36d00e48b1. Base: sorgenti completi della 0.29.14, nessun ripristino di versioni precedenti.

## Definitivi

Audit eseguito realmente dal backend pubblico alle 09:50 italiane: una chiamata API-FOOTBALL aggregata e due letture SQL, zero scritture DB. 9 partite della giornata Serie A 10 sono complete e già definitive; Bologna–Monza resta provvisoria. Il portiere Ł. Skorupski (API 2998) ha il flag penalty-save-undocumented: è presente il rigore sbagliato da Patrick Cutrone, ma le statistiche non confermano se fu parato dal portiere. La risposta fresca del fornitore resta incompleta. Nessun bonus o dato inventato; formula dei voti invariata.

Prossimo tentativo effettivamente inserito nella coda del backend: 03/11/2026, 10:50:10 Europe/Rome, solo Bologna–Monza. I tentativi seguenti partono a un'ora dal fallimento per dati incompleti, fino al completamento oppure a 48 ore dalla verifica iniziale. Successivamente resta un errore amministrativo da verificare. Nessun retry automatico per errori di autorizzazione o configurazione. Le riprese non rilanciano il download del calendario futuro e i servizi collegati. Nessun nuovo polling dal frontend.

## Interfaccia

- Controlli switch, saldi e azioni su una sola riga; profilo Bar nel menu inferiore. Nel Fanta rimane in alto. Il nome della lega occupa la riga dedicata sul telefono.
- Oggi conserva il collegamento all'ultima giornata conclusa anche quando è disponibile la prossima: risultati e voti nel Fanta, schedina della giornata precedente nel Bar. La selezione esplicita dello storico non viene più scartata dal filtro delle giornate correnti.
- La cartolina è un popup HTML con il vincitore, pronostici, risultati, puntata e ritorno. Nessun canvas, PNG o download. Supporto anche ai vincitori a pari merito.

## Verifiche

492 test automatici passati. Test su ripresa oraria, singole partite pendenti, esecuzione unica, arresto dopo successo, limite 48 ore, mancato retry su errori non riconosciuti, diagnostica, selezione esplicita dello storico e popup senza download. Prove browser a 375 px, quindi verificate anche sul sito pubblico: Bar apre la giornata 10 dallo storico, cartolina nel popup, riepilogo Fanta apre Risultati e voti della giornata 10. Nessun errore console rilevato. Endpoint pubblici HTTP 200 e versione 0.29.15 confermata.

Le prove UI impiegano la demo, senza dati o scritture dei giocatori reali. L'audit di produzione legge soltanto dati sportivi. Le modifiche al DB per completare i definitivi saranno eseguite dal normale worker alla prossima verifica, soltanto se i dati lo consentono.
