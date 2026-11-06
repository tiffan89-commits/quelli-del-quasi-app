# Quelli del Quasi 0.29.46 — 6 novembre 2026

Rilasciata sul server Windows del sito ufficiale dopo autorizzazione del proprietario. Nessun deploy Netlify, nessuna migrazione o ricostruzione del DB. La prova `pre.quellidelquasi.com` conserva dati sintetici separati.

## Interfaccia

- Impostazioni per tutti, con gestione riservata al presidente. Account, avvisi e assistenza accorpati; logout visibile in fondo, fuori dagli accordion.
- «+» integrato nel selettore accanto al nome della lega in Bar e Fanta. Gli stessi moduli consentono di entrare con codice e creare Bar + Fanta.
- Invito nella home del Bar per presidenti e membri; si nasconde quando i posti disponibili sono occupati da persone. Capacità e appartenenza provengono dai dati già memorizzati, senza nuove chiamate per aprire la home. Promozione «Prova il Fanta» rimossa.
- Premi in Quasi, raccolta inizialmente chiusa e prima categoria con premi posseduti selezionata automaticamente.
- Revisione UX precedente inclusa: spazi finali, barra schedina compatta, stemmi conservati durante la scelta degli esiti, pannelli richiudibili, titoli e classifiche compatti, resa mobile e desktop.

## Premio della schedina da un credito

La verifica in sola lettura del DB di produzione ha trovato una schedina da un credito con il premio già assegnato. Il problema riguardava la spunta del front end: la ricevuta rapida non aggiornava gli obiettivi in memoria. Ora la ricevuta include gli obiettivi della giornata e i premi pertinenti; il client li unisce senza ricaricare il resto dell'app, conservando gli obiettivi di altre giornate e senza duplicare premi nei tentativi ripetuti. Nessun ricalcolo o assegnazione manuale di premi in produzione.

## Ufficiali Serie A

- Job server dedicato a ogni gara a T−30 minuti; recupero da `fixtures/lineups` di API-FOOTBALL con la chiave solo sul server.
- Dati mancanti o incompleti: mantiene le previste e ritenta ogni 5 minuti. Identità delle due squadre e 11 titolari per entrambe sono verificati prima di sostituire le previste.
- Dati completi: salvataggio nel calendario/partite e nella fixture Fanta. Il job segna le ufficiali acquisite e interrompe i tentativi; una formazione ufficiale già in cache non richiede altre chiamate esterne.
- Tentativi limitati alla finestra utile della partita; gare rinviate/annullate interrompono i job pendenti. Nessun polling esterno dal frontend, nessuna variazione della frequenza live o del motore voti.
- Venezia–Udinese, fixture API 1550196: recuperate dal server e salvate realmente nel DB ufficiali 3-5-2 / 3-4-2-1, 11+11 titolari e panchine. Un solo download remoto; controllo successivo e primo job del worker hanno usato il DB, con zero chiamate provider e zero nuove scritture delle formazioni.

## Verifiche e distribuzione

77 test mirati superati (55 interfaccia/salvataggi/premi e 22 API/calendario/ufficiali), con concorrenza limitata. Build produzione completata, 18 output. Verifiche browser a 390×844 e 1280×800: «+» interno, logout fuori dagli accordion, invito per membro e assenza della promozione Fanta. La barra a 320 px era stata verificata durante il ritocco precedente e mantiene la stessa occupazione complessiva.

79 file applicativi confrontati, copiati e verificati SHA256; backup dei file sostituiti in `C:/ProgramData/QuelliDelQuasiServer/backups/release-0.29.46-2026-11-06T19-28-38-068Z`. Vecchi chunk mantenuti per i client già aperti. Configurazione, segreti, DB, avatar e dati persistenti non sovrascritti. Servizi web, worker e proxy riavviati; PostgreSQL non fermato.

Verifica pubblica: health `0.29.46-selfhost`, versione stable, ambiente production, stato anonimo senza utenti/leghe e hash di 8 file pubblici critici corrispondenti alla build. Worker con schedulazione/esterni abilitati: job ufficiali Venezia–Udinese `done`, `providerCalls=0`, `saved=0`; 17 richieste future accodate ai rispettivi orari. DB confermato `kind=official`, due liste da 11 titolari.

[Impostazioni mobile](ux-0.29.46/impostazioni-logout-esterno-390.png) · [Invito Bar per membri](ux-0.29.46/home-invito-membri-390.png).
