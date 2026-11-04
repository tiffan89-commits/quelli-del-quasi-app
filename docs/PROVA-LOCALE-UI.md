# Prova locale · maglie, stemmi e correzioni UI

Base: sorgenti 0.29.22, comprensivi degli aggiornamenti SEO e del runtime Windows. Le modifiche sono nella cartella `quelli-del-quasi-0.29.22-prova-ui`; il server di casa installato usa la relativa build. Nessun commit o deploy Netlify eseguito.

## Cosa cambia

- Corretto anche lo scorrimento tra squadre: l’altezza cambia al termine dello swipe, evitando il ritorno alla prima formazione; gli accordion richiusi continuano a ridurre lo spazio.
- Formazioni Serie A e importate: niente ritratti, richieste `player-photo` o cornici. Retro della maglia con cognome e numero, maglia distinta per i portieri, probabilità sotto la maglia, nomi completi accessibili. Le righe da cinque giocatori usano SVG da 66 px, le altre da 76 px.
- Fanta: maglie illustrate anche nei dettagli e nelle liste, portieri compresi. Il modulo fornito è copiato senza modificare disegni, KITS o GOALKEEPER_KITS.
- Venti stemmi cartoon del pacchetto sostituiscono i vecchi loghi ufficiali dei club. Alias Milan/Roma/Inter inclusi. Per club senza SVG fornito resta il simbolo neutro con iniziali; non si recuperano loghi ufficiali come fallback. Stemmi e immagini personalizzate delle squadre fantasy sono conservati.
- Palette: caricato il foglio di stile mancante, ripristinati i campioni colorati e aggiunto Blu. Eliminati i due override che impedivano di vedere il colore salvato. Il Fanta prende l'identità del Bar collegato anche quando riapre una vista conservata in memoria.
- Stemma di lega nuovamente visibile nel selettore; icona profilo centrata nel pulsante.
- Stato «Live · aggiornato alle…» in fondo alla pagina Bar. Intestazione giornata centrata su telefono e desktop. Spazio dedicato agli stemmi in partecipanti, classifica e riepilogo rose dell'asta.
- «Annulla modifiche» in Squadra e nello studio: ripristina la formazione corrente salvata, modulo e panchina compresi. Nessun salvataggio o altra richiesta di scrittura; il pulsante torna «Salvata» e resta disabilitato. Comando disabilitato quando non c'è un salvataggio, durante il salvataggio e a formazione bloccata.

## File applicativi modificati

- `public/src/lineup-pitch.mjs`, `public/lineup-pitch.css`.
- `public/src/fanta/maglie-portieri.mjs` (nuovo, identico al materiale fornito), `player-visual.mjs`, `formazione-studio.mjs`, `squadra.mjs`.
- `public/team-logos.js`, nuovi `public/assets/club-crests/stemma-*.svg`; rimossi dalla build i vecchi asset ufficiali `assets/teams/*` e `assets/optimized/team-*`.
- `public/src/league-theme.mjs`, `public/src/v2/league-switcher.mjs`, `public/src/app.mjs`, `public/src/fanta/app.mjs`, `shell.mjs`, `lega.mjs`, `public/src/fanta-mode.mjs`.
- `public/src/app-styles.mjs`, `scripts/build-ux.mjs`, `public/ux-review.css`, `CHANGELOG.md`.
- Test: `maglie-portieri.test.mjs` (nuovo), `formation-studio-gestures.test.mjs`, `lineup-consensus.test.mjs`; adattati `image-optimize.test.mjs` e il contesto di `interface-live.test.mjs`.
- Materiali forniti archiviati in `docs/maglie-figurine/` e `docs/stemmi-quasi-campioni/`.

## Verifiche

- Suite completa: **522 test passati, 0 falliti**, circa 26 secondi. Registro: `local-ui-tests-final.log`.
- Build produzione generata correttamente per provare gli stessi bundle sul server locale.
- Viste di riferimento Venezia/Udinese aperte e confrontate con le nuove maglie, a 375 px e su desktop.
- App provata con la copia locale reale: accesso, Bar/Fanta, giornata, partecipanti, classifica, Squadra e studio.
- Cambiato e salvato un colore nel DB locale, verificato lo stesso colore in Fanta, provato anche Blu; infine ripristinato Cielo, il valore originale della copia.
- «Svuota → Annulla» provato nelle due modalità. Undici titolari e panchina ripristinati, salvataggio disabilitato. Il test verifica anche l'assenza di scritture e l'identità della formazione nel DB simulato.
- Misure mobile: nessun overflow orizzontale della pagina; centro dell'intestazione identico al centro del contenitore; icona profilo con scarto di 0 px sui due assi; nomi distanti 12 px dagli stemmi nei partecipanti e 10 px nella classifica.
- Nessuna immagine `player-photo` nel DOM delle formazioni. Copia SVG fornita verificata byte per byte; escaping, cognomi lunghi, colori portiere e club sconosciuti coperti dai test.
- Backend foto e route mantenuti invariati; nessuna modifica a motore voti, crediti, giocate, punteggi o storico. Confronto sorgenti: nessuna modifica in `lib`, `fanta` o `netlify/functions`.

## Ambiente di prova

Server installato: `C:\Users\Francesco\AppData\Local\QuelliDelQuasiServer`, porta 8845. Il collegamento HTTPS protetto già fornito punta a questo server. Provider esterni, email/push e scheduler restano disabilitati nella prova; i risultati mostrati sono quelli della copia locale, non una diretta appena scaricata.

Il sito pubblico Netlify rimane invariato. Il rilascio richiede l'OK dell'utente.
