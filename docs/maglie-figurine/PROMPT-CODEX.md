# Prompt per Codex — maglie al posto delle foto nelle formazioni

Copia da qui in giù.

---

Devi sostituire le foto reali dei giocatori con maglie disegnate, nelle formazioni delle partite. Il risultato deve essere identico alle anteprime in `docs/maglie-figurine/anteprime/formazione-venezia.png` e `formazione-udinese.png`. Guardale prima di iniziare, e apri anche `docs/maglie-figurine/riferimento/anteprima-venezia.html` e `anteprima-udinese.html` nel browser: sono le stesse schermate in HTML, con lo stile esatto.

## Perché

Le foto dei giocatori non si possono usare senza licenza (diritti d'immagine e copyright delle agenzie). Le sostituiamo con il retro della maglia della squadra, con cognome e numero, nello stesso stile delle maglie già usate nel Fanta (`public/src/fanta/maglie.mjs`).

## Materiale (già nel repo)

- `docs/maglie-figurine/maglie-portieri.mjs` — modulo pronto. Esporta:
  - `shirtBack(club, numero, cognome, { goalkeeper, nameSize })`: retro della maglia con cognome sopra e numero grande. Sulle maglie a righe, metà o croce mette da solo un pannello scuro dietro cognome e numero, per leggibilità. I cognomi lunghi vengono stretti in automatico (`textLength`).
  - `goalkeeperShirt(club)`: fronte della maglia del portiere (maniche lunghe, colore unico per club, sigla nel riquadro), stesso stile di `shirt()`.
  - `GOALKEEPER_KITS`: colori dei portieri per club.
  Importa `esc` da `./formato.mjs` e `KITS` da `./maglie.mjs`: va spostato in `public/src/fanta/maglie-portieri.mjs`, accanto a quei file. Non cambiarne il disegno.
- `docs/maglie-figurine/riferimento/formazione-maglie.css` — misure e stili delle anteprime.
- `docs/maglie-figurine/svg/` — gli SVG dei portieri e alcuni retro di esempio, solo come riferimento visivo: non vanno serviti come file, l'app genera le maglie al volo.

## Cosa fare

1. **Sposta** `docs/maglie-figurine/maglie-portieri.mjs` in `public/src/fanta/maglie-portieri.mjs` (gli import relativi funzionano già lì).

2. **Formazioni delle partite** (`public/src/lineup-pitch.mjs`, funzione `sticker(p, team)`):
   - Non mostrare più la foto (`<img data-deferred-src=...>`), anche quando `p.photo` c'è.
   - Al suo posto: `shirtBack(team.team, p.jersey, cognome, { goalkeeper, nameSize: 5 })`.
   - `cognome`: il nome del giocatore senza l'iniziale finale. `"Davis K."` → `"Davis"`, `"Moreno M."` → `"Moreno"`, `"Juan Jesus"` resta `"Juan Jesus"`. Regola: togli un ` X.` finale (lettera maiuscola, anche accentata, seguita da punto).
   - `goalkeeper`: vero per il portiere. Se il giocatore ha un ruolo/posizione nei dati usalo; altrimenti è il primo di `team.players` (è quello che `formationRows` mette nella riga da 1 in fondo).
   - Se manca `p.jersey`, passa stringa vuota: la maglia mostra solo il cognome.
   - La percentuale (`.player-probability`) va **sotto** la maglia, in una pastiglia, non più sovrapposta. Tieni la legenda esistente (probabilità effettiva / stimata, classe `estimated`); nelle anteprime il giallo indica sotto il 100%, ma nell'app vale la regola già presente.
   - L'etichetta con il nome sotto (`.pitch-player-name`) non si vede più (il cognome è sulla maglia) ma resta per i lettori di schermo: usa la classe `sr-only` già presente nell'app.
   - Togli il numero sovrapposto alla foto (`.player-number`): ora è sulla maglia.
   - Nessuna cornice intorno alla maglia.
   - Righe con 5 o più giocatori: maglie più piccole (66 px invece di 76 px), come in `formazione-maglie.css` (`.row-5`), così le maniche non si toccano a 375 px.
   - Lo stesso vale per `renderFantasyLineup`, che usa la stessa funzione.

3. **CSS**: riporta le regole di `riferimento/formazione-maglie.css` sulle classi reali (`.pitch-player`, `.player-sticker`, `.player-probability`, ecc.) nel foglio dove sono definite oggi (`public/lineup-pitch.css`). Togli gli stili della foto e della cornice che non servono più. Misure: maglia 76×76 px (66×66 nelle righe da 5+), pastiglia 11 px grassetto, bordo 1.5 px, `margin-top: -4px`.

4. **Fanta**: in `public/src/fanta/player-visual.mjs` smetti di usare `photoUrl`: restituisci sempre `shirt(player.club)` (o `goalkeeperShirt(player.club)` se il giocatore è un portiere, ruolo `P`). Le maglie di movimento del Fanta restano come sono.

5. **Niente più download di foto per le formazioni**: verifica che, senza `<img>`, il caricamento differito delle foto non parta più in queste viste (`deferred-media.mjs`). Non toccare per ora il backend delle foto (`lib/player-media.mjs`, route `player-photo`): lo spegniamo in un secondo momento.

## Test

- Aggiungi `test/maglie-portieri.test.mjs`:
  - `shirtBack` contiene cognome in maiuscolo e numero;
  - un cognome lungo (`"Ekkelenkamp"`) ha `textLength`;
  - una maglia a righe (`Udinese`) ha il pannello scuro, una a tinta unita (`Venezia`) no;
  - `goalkeeper: true` usa il colore di `GOALKEEPER_KITS` e le maniche lunghe;
  - club sconosciuto → maglia neutra, nessun errore;
  - l'output è escapato (`esc`) per nomi con apostrofi o `<`.
- Aggiorna i test di `lineup-pitch` se esistono: l'HTML della formazione non contiene più `<img` né `/api/player-photo`, contiene una `svg` per giocatore e la percentuale.
- Lancia la suite con `npm test` (usa `--test-force-exit` se non termina).

## Verifica visiva

Apri l'anteprima locale (`npm run dev`), apri una partita con le probabili formazioni e confrontala con `anteprime/formazione-venezia.png` e `formazione-udinese.png` a 375 px di larghezza e da desktop. Devono coincidere: maglie centrate, cognome leggibile sulle righe bianconere, percentuale sotto, portiere in maglia diversa, nessuna maglia che si sovrappone.

## Regole

- Non cambiare il disegno delle maglie né i colori di `KITS` e `GOALKEEPER_KITS`.
- Aggiorna `CHANGELOG.md` sotto Unreleased.
- Nessun commit, push, merge o rilascio senza il mio OK.

Alla fine scrivimi cosa hai cambiato, i file toccati e l'esito dei test.
