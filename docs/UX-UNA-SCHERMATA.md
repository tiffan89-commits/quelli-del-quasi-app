# Una sezione = una schermata — recap per chi lavora sul branch

Branch: `feat/una-schermata`, nato da `origin/main` 0.31.3 (`c9140f5`). Nessuna modifica all'asta.

## Obiettivo
Nel Bar e nel Fanta nessuna sezione scorre in verticale. Ogni sezione mostra l'essenziale in una schermata; quello che non ci sta passa a pagine da scorrere di lato (swipe, puntini, rotella/frecce/← → su desktop).

## Come funziona

### Aggiornamento Friends & Family
- I blocchi `data-os-header` restano fermi. Il contenitore `data-os-content` ospita le colonne e mantiene la pagina corrente durante le patch live. Schedine, classifiche, Squadra e Lega usano questa separazione.
- Gli accordion delle sezioni paginate aprono un dettaglio a destra, con ritorno tramite pulsante o swipe verso destra. Se un dettaglio eccede lo spazio, scorre in verticale all’interno della schermata.
- La cartolina usa il telaio della pagina partita. Nel dettaglio delle partite un carosello dedicato mostra titolari e panchina di casa, poi titolari e panchina ospiti. Gli eventi della Serie A si aprono dall’intestazione. Il calendario della squadra resta in una sola pagina e carica quattro giornate alla volta.
- In Impostazioni resta solo «Il tuo banco di comando» nell’intestazione. Gli inviti e la gestione membri restano raggiungibili dai collegamenti della lega. Gestisci asta resta nel pannello del presidente del Fanta dove l’asta è disponibile.
### Motore: `public/src/one-screen.mjs` + `public/one-screen.css`
- `startOneScreen()` è chiamato da `app.mjs` (dopo `loadAppStyles()`) e da `fanta-mode.mjs` (`enterFanta`), sempre con guardia `typeof startOneScreen==='function'`. Il test `interface-live` toglie gli import: la guardia serve.
- Quando c'è `#app > .v2-tabbar` e la pagina non è esclusa, aggiunge `html.os-on` e `main.os-root`. `#app > main` diventa un contenitore a **colonne CSS** (`column-fill:auto`), alto quanto lo spazio tra intestazione e barra in basso (`--os-h`). Ogni colonna è una pagina.
- **Non sposta né clona nodi**: id, gestori, patch live, `scrollIntoView` e focus funzionano come prima. Per questo i puntamenti restano giusti.
- **Altezza**: `--os-h = innerHeight − top di main − barre fisse in basso (.v2-tabbar, .v2-slipbar, #pwa-install-card) − riga dei puntini (10 px; 18 px da 760 px in su) − 48 px se c'è la riga fissata`.
- **Tornare "in cima"**: `window.scrollTo(0,0)` (lo chiama l'app dopo ogni cambio di sezione) riporta alla pagina 1. I ridisegni live e i salvataggi restano sulla pagina. Chiudendo la pagina partita si torna alla pagina da cui la si era aperta. La pagina corrente è ricordata per hash + scheda selezionata.
- **Blocchi indivisibili**:
  - un blocco (riga flex, carosello orizzontale, ecc.) che non ci sta nel resto della pagina va alla successiva (`.os-break`);
  - un contenitore a scorrimento orizzontale che in realtà ci sta in larghezza si spezza (`.os-unclip`);
  - un blocco più alto di una pagina **e** più largo dello schermo scorre al suo interno (`.os-tall`).
- **Scorrimento verticale di riserva**: il documento non scorre mai (`html.os-on body{position:fixed;inset:0}`, serve anche per iOS). Se qualcosa dovesse comunque scorrere in verticale, scorre dentro `main`, che finisce **sopra** la barra in basso e non ci passa sotto. Se un browser non supporta le colonne (`html.os-nocols`), la pagina scorre in verticale, sempre dentro `main`.
- **Copyright**: visibile solo sull’ultima pagina, fuori dalle colonne per evitare una pagina vuota. I controlli privacy e statistiche sono nelle impostazioni account.

### Configurazione (in `one-screen.mjs`)
- `EXCLUDED` — mai attivo su: sala d'asta e wizard (`.auction-room`, `.fanta-asta`, `.auction-lobby`, `.auction-wizard-fields`, `.auction-page-head`, `[data-bid-form]`, `.auction-countdown-overlay`), voce "Asta" della Lega Fanta, `#/fanta/asta`, pagina partita (`body.match-page-active`) e landing (`.pb-landing`).
- `SEGMENTS` — sottosezioni generate sopra la pagina, ognuna inizia su una pagina nuova (`.os-seg-start`):
  - Bar Oggi: *Adesso · Obiettivi*;
  - Bar Quasi: *La squadra · I tuoi premi*;
  - Fanta Oggi: *Adesso · Sfida · Classifica*.

  Per aggiungerne una: `{ when: main => …, label, items: [[etichetta, selettore | null]] }`, con i selettori nell'ordine del DOM.
- `PINS` — riga sempre a vista quando sta in un'altra pagina (oggi `.rankrow.is-me`, la tua riga nella classifica del Bar). Toccandola si va alla sua pagina.

### Contenuti ristrutturati: `public/one-screen-ui.css`
Tutto sotto `html.os-on main.os-root`. Cambia solo l'aspetto, non i dati né le destinazioni. Fanno eccezione i riquadri della Lega del Bar, che valgono sempre.

| Sezione | Cosa cambia |
|---|---|
| Bar · Oggi | avviso presidente in una striscia; saluto più basso; prossima mossa, conto e invito nella prima schermata; obiettivi in griglia 2 colonne |
| Bar · Schedina | segmenti *La mia · Del Bar · Verdetto · Serie A* (testo corto in `data-short`, quello lungo resta nel DOM); partita su una riga con 1/X/2, quota (`data-odd`) e punti |
| Bar · Verdetto | card compatte, albo in griglia 2 colonne |
| Bar · Classifica | *Punti · Crediti* a segmenti, righe da 40 px, titolo nascosto, la tua riga fissata |
| Bar · Quasi | squadra in griglia 3 colonne, intestazione nascosta |
| Bar · Lega | **markup nuovo** in `barLeagueInfo()`: riquadri Pannello del presidente (solo admin), Partecipanti, Regolamento, Invita, Chat + Entra/Crea. Stessi `data-bar-page` / `data-president-group` / `#league-open-chat` di prima |
| Fanta · Oggi | card squadra compatta (stemma 56 px), prossima mossa, sfida e classifica nelle sottosezioni |
| Fanta · Squadra | intestazione in una riga; campo nella prima schermata (altezza max `--os-h − 210px`), panchina nella successiva; rosa a righe compatte |
| Fanta · Classifica | niente titolone; righe basse; sul telefono (≤ 520 px) colonne # · Squadra · PG · Pt · FP |
| Fanta · Lega | intestazione compatta |
| Barre di schede (`.v2-chips`, `.slip-section-buttons`) | barra a segmenti a pillola |
| "Installa l'app" | una riga sola, non copre il pulsante della chat |

### Chat
- Il pulsante della chat resta **flottante**, come in 0.31.3.
- Resta nascosto, come già in 0.31.3:
  - in Schedina › La mia, dove c'è la barra di conferma;
  - nello studio formazione (`body.fs-open`);
  - nella modifica del Quasi (`html.studio-active`);
  - nella modifica logo/nome (`dialog.fanta-logo-editor[open]`);
  - nella pagina partita.
- In modalità Fanta il pulsante non c'è (la chat si apre da `[data-fanta-chat]`).

### Studio formazione

- Lo Studio resta un pannello a schermo intero fuori da `main` e dalla paginazione. La sezione Squadra di sola lettura mantiene le pagine previste da «Una sezione, una schermata».
- Sotto i 620 px la panchina si apre da destra. La maniglia numerata permette di riordinare dentro il pannello. Superato il bordo sinistro, il pannello si ritira e si illuminano i posti compatibili. Il filtro per ruolo conserva le posizioni dell'intera panchina.
- Da 620 px in su resta la panchina orizzontale sotto il campo. La maglia trascinata usa coordinate relative allo schermo su entrambe le viste.
- La bozza invia al salvataggio l'ordine delle riserve. Il motore usa come prima riserva idonea il primo giocatore con voto dello stesso ruolo nell'ordine salvato.

### Piccole modifiche al markup
- `bar-fanta-rankings.mjs`: classe `is-me` sulla tua riga.
- `v2/slip-v2.mjs`: `data-odd` sulla quota. Il testo `Quota 2,1` resta, i test lo controllano.
- `app.mjs`:
  - `data-short` e `<span class="seg-long">` sui pulsanti della schedina;
  - `barLeagueInfo()` a riquadri;
  - import + chiamata guardata di `startOneScreen`.
- `app-styles.mjs` e `scripts/build-ux.mjs`: aggiunti `one-screen.css` e `one-screen-ui.css` in fondo alla lista dei fogli. Le due liste devono restare uguali.

## Regole per chi continua
- **Non toccare l'asta**: `fanta/asta.mjs`, `fanta/auction-wizard.mjs`, `public/auction-room.css`, né le classi in `EXCLUDED`. `test/one-screen.test.mjs` controlla che i fogli one-screen non contengano regole sull'asta e che le radici dell'asta siano escluse.
- Nuovi stili di sezione: in `one-screen-ui.css`, sotto `html.os-on main.os-root`.
- Non spostare nodi fuori da `main` e non avvolgere `main` in altri contenitori: il motore lavora su `#app > main`.
- Se una schermata ha bisogno di un'altra sottosezione, aggiungila a `SEGMENTS` invece di creare nuove rotte.
- File con fine riga misti (CRLF/LF, es. `v2/slip-v2.mjs`): modificali senza normalizzare tutto il file.

## Verifiche fatte
- Tutte le sezioni e sottosezioni a 390×844, 375×667, 375×560 e 1280×800 (utenti demo `anteprima` e `frankwood`):
  - documento che non scorre;
  - nessun contenuto tagliato;
  - `main` che finisce sopra la barra in basso.
- Destinazioni di tutti i pulsanti e link (confronto originale/modificato per attributo di navigazione): uguali. Le uniche differenze sono quelle volute della Lega del Bar, dove i riquadri aprono direttamente invece di stare dentro tendine.
- Sala d'asta e "Asta" in Lega: DOM e stili calcolati identici a 0.31.3.
- Swipe, puntini, `scrollIntoView`, apertura/chiusura pagina partita, studio formazione, modifica logo/nome, studio Quasi.
- `npm test`: 738/740. I 2 che falliscono controllano gli artefatti di build (`dist/index.html`, `docs/BUILD-METAFILE.json`) e falliscono uguali sulla 0.31.3 originale nell'ambiente di lavoro, perché lì esbuild non girava. Vanno rilanciati dopo `npm run build`.

## Limiti noti / da decidere
- La Lega del Fanta si apre sulla scheda "Asta", esclusa, quindi lì l'aspetto è quello di prima. I riquadri come nella bozza richiederebbero di aprire la Lega su un'altra scheda, ma questo cambia la destinazione del tab: serve l'OK del proprietario.
- La pagina "Asta" della Lega Fanta e la sala d'asta scorrono ancora in verticale come in 0.31.3, sotto la barra in basso: sono escluse per regola.
- Pill "Mister di Bordo" in Lega › Partecipanti (Fanta): contrasto basso, già presente in 0.31.3.

## Per caricare il branch
```
git push -u origin feat/una-schermata
```
Poi PR verso `main`. Il commit è `feat`, quindi release-please proporrà la 0.32.0.
