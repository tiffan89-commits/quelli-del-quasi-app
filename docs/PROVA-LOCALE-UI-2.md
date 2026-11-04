# Prova locale — formazioni, statistiche e navigazione

Data: 4 novembre 2026. Base corrente 0.29.22, copia di lavoro `quelli-del-quasi-0.29.22-prova-ui`.

## Modifiche disponibili nella prova

- Le maglie usano il cognome, conservando i cognomi composti quando riconoscibili. Il numero usa prima il dato della formazione e poi quello dell'anagrafica API già salvata. Un numero non disponibile rimane assente: non viene inventato.
- Le probabili formazioni e i ballottaggi usano la stessa stima dello studio: minuti giocati / (90 × partite disputate dalla squadra), limitata all'intervallo 0–100%. È una stima di presenza, non una probabilità certificata di partenza da titolare. Le stime sono nere; gli indisponibili non sono proposti come titolari. Se esiste una riserva disponibile nello stesso ruolo viene preferita.
- Le formazioni ufficiali API hanno precedenza: 100% per i titolari e 0% per i panchinari, in verde. Anche lo studio e la sezione Squadra riconoscono la provenienza ufficiale; al successivo ingresso rileggono il dato dal nostro DB senza sovrascrivere una bozza modificata.
- La schedina mostra gli stemmi. Nel Fanta il dettaglio carica le formazioni effettivamente salvate per quell'incontro, con maglie dei club reali disegnate, numero, cognome e prossimo avversario (`@` in trasferta). I dati mancanti sono indicati senza inventare formazioni.
- La partita in numeri mostra quattro righe; Altro espande le restanti. I numeri dei giocatori hanno un selettore squadra e mostrano cinque giocatori, poi Altro. Le sezioni rimangono richiudibili.
- Il profilo si trova nella stessa posizione della barra superiore nel Bar e nel Fanta. La classifica Fanta completa espone PG, V, N, S, GF, GS, Pt, FP; da telefono scorre solo la tabella, non tutta la pagina. Il riepilogo compatto in Oggi rimane breve.

## Dati locali riparati

Il batch conservava le formazioni ufficiali nella risposta API archiviata, ma non sempre sostituiva la formazione probabile visualizzata. Inoltre la copia verso le giornate del Bar non propagava il campo `lineups`.

La riparazione ha aggiornato 100 incontri con formazioni ufficiali e 10 probabili future usando esclusivamente dati già nel DB locale. Le successive passate hanno uniformato metadati e stime. Il controllo finale ripetuto non ha effettuato modifiche: `changed: 0`, `protectedDataUnchanged: true` in `LOCAL-LINEUP-REPAIR.json`.

Le impronte dei dati protetti confermano che account, crediti, giocate, voti, risultati e formazioni salvate dagli allenatori non sono stati modificati. Nessun ricalcolo dei voti. Nessuna modifica al database di produzione.

Alcuni giocatori non dispongono di identità o minuti sufficienti: la percentuale resta non disponibile. Una formazione ufficiale non completa non viene trasformata artificiosamente in un undici definitivo.

## Prestazioni e accessi

Le anagrafiche e i minuti vengono letti con una query aggregata e mantenuti nella cache server per un'ora. I dettagli Fanta riutilizzano la richiesta in corso e la risposta per 60 secondi. Il frontend non chiama provider sportivi e non sono stati aggiunti processi periodici o polling. Il download delle immagini dei giocatori non è stato riattivato.

## Verifiche

- Suite completa: **529 test passati, zero errori**, dopo l'ultima correzione del dettaglio Fanta.
- Test mirati su cognomi, numeri, indisponibilità, percentuali, precedenza delle ufficiali, conservazione dei dati sportivi, doppio clic nel dettaglio, statistiche espandibili e intestazioni.
- Browser mobile a 375 px: Venezia–Udinese con maglie numerate e stime nere; Atalanta–Parma con formazioni ufficiali verdi; statistiche 4/5 righe ed espansioni; formazione salvata di Tramezzino City nella propria schedina.
- Verificate tutte le colonne della classifica completa su telefono e assenza di overflow orizzontale della pagina.
- Server di prova avviato sul PC; provider, invio email/push e scheduler esterni disabilitati nella prova.

## File principali

- Rendering: `public/src/lineup-pitch.mjs`, `player-label.mjs`, `club-crest.mjs`, `football-statistics.mjs`, `v2/slip-v2.mjs`, `v2/league-switcher.mjs`, `v2/tabs.mjs`, `app.mjs`, `ux-review.css`.
- Fanta: `public/src/fanta/schedine.mjs`, `app.mjs`, `lega.mjs`, `presence-probability.mjs`, `formazione-studio.mjs`.
- Server: `lib/official-lineups.mjs`, `lineup-presence.mjs`, `api-football.mjs`, `lineups.mjs`, `player-media.mjs`, `operations/sports-db.mjs`, `fanta/play-probabilities.mjs`, `views.mjs`, `api.mjs`, `ingest.mjs`, `netlify/functions/api.mjs`.
- Riparazione controllata: `scripts/repair-local-lineup-display.mjs`; il comando rifiuta DB diversi dalla copia locale di prova.
- Test: `test/lineup-display-revision.test.mjs` e aggiornamenti dei test esistenti di formazione, navigazione, schedine e server.

Nessun commit, push o deploy Netlify eseguito.
