# Prompt per Codex · revisione UX del sito

Copia da qui in giù e incolla a Codex.

---

Ciao Codex. Ho fatto una revisione UX di quellidelquasi.com il 3 novembre 2026. Ho provato tre cose: la parte pubblica, la demo e l'account di Francesco (admin). Ho usato un telefono a 375 px e un computer a 1366 px. Qui sotto trovi i problemi in ordine di importanza. Per ognuno c'è cosa succede oggi e cosa deve succedere.

Regole di sempre:
- Lavora in un'anteprima Netlify isolata.
- Niente commit, push, PR o rilascio senza OK di Francesco.
- Niente dati di produzione nei test.
- Non pulire né committare il lavoro non committato che hai già nell'albero.
- Dove trovi **[Decide Francesco]**, non scegliere tu: proponi e aspetta.
- **Su quali versioni si basa questo prompt.** La revisione (parti A, B, C, D, E) l'ho fatta sul **sito in produzione** il 3 novembre 2026. Le modifiche già pronte (menu del Fanta, formazione, studio) le ho fatte invece sui **nostri file di anteprima** in `E:\Users\frank\Downloads\Quelli del Quasi - Fantacalcio\public\src\fanta\`. Sono **più vecchi dei tuoi** in alcune parti: per esempio il tuo `app.mjs` e il tuo `lega.mjs` hanno cose che i nostri non hanno, e il sito in produzione ha già Schedine e «Risultati e voti» nel Fanta. Quindi **non copiare i nostri file sopra i tuoi**: confronta e porta nelle tue versioni solo le parti nuove descritte qui. Il nuovo `formazione-studio.mjs` invece puoi aggiungerlo così com'è. Se qualcosa non torna, chiedi.

## A · Errori (prima di tutto)

**A1. Bar › Serie A apre la giornata sbagliata.**
- Oggi:
  - la schedina si apre sulla «Giornata 13 · chiusa», con «Quota in arrivo» ovunque;
  - nel menu le giornate sono in ordine 13, 11, 12;
  - la 13 non è chiusa: non è ancora aperta.
- Deve:
  - aprirsi sulla prima giornata aperta (oggi la 11, la stessa che mostra Oggi con «Rivedi la schedina»);
  - mostrare le giornate in ordine;
  - avere tre stati distinti: «aperta», «chiusa» (scadenza passata) e «non ancora aperta» (quote non pubblicate).

**A2. Fanta › Oggi: lo stato della giornata si contraddice.** Succede nella lega «Quelli del quasi», squadra Tramezzino City.
- Oggi la stessa schermata dice insieme:
  - «Giornata 1 · LIVE»;
  - «10 partite di Serie A su 10 finite. Voti e punteggi sono provvisori»;
  - «0/11 a voto», ma con 66,5 punti già assegnati.
- Deve:
  - con tutte le partite finite, mostrare «Finita · voti provvisori, in attesa dei definitivi» e non «LIVE»;
  - contare in «x/11 a voto» i giocatori che hanno davvero un voto, coerente con il punteggio mostrato.

**A3. Demo: il tasto Bar butta fuori.**
- Oggi:
  - `/api/features` risponde `barDemo: false`;
  - in «Guarda la demo», la finestra «Quale demo vuoi provare?» offre una sola scelta, il Fanta;
  - dentro la demo Fanta, toccando **Bar** in alto si torna alla presentazione senza nessun messaggio.
- **Deciso da Francesco: riaccendere la demo del Bar.**
  - Dati finti e niente salvato, come per il Fanta, e solo calcio vero (vedi B0).
  - «Quale demo vuoi provare?» offre di nuovo Bar e Fanta.
  - Dentro la demo, il selettore «Bar | Fanta» passa da una demo all'altra senza uscire.
  - Se in futuro una delle due demo venisse spenta, la finestra di scelta va saltata.

**A4. Demo Fanta: Schedine vuota.**
- Oggi la scheda Schedine dice «Le schedine saranno disponibili quando la tua squadra sarà collegata alla lega», con mezza pagina vuota. Intanto Oggi mostra «Compila la schedina →» con le quote.
- Deve: nella demo, la scheda Schedine (la schedina del Fanta, vedi B0) funziona con i dati finti, come la card in Oggi.

**A5. Bar › Oggi, grafico «Capitale del Bar».**
- Oggi l'ultimo punto (Giornata 10) ha una riga verticale che sale fino in cima al grafico.
- Deve: niente riga verticale; la linea finisce sul punto.

## B · Navigazione e coerenza

**B0. Nuova regola di Francesco: Bar = calcio vero, Fanta = squadre del fanta.** Francesco ha già spostato la schedina del Fanta sotto il Fanta. Le regole ora sono queste:
- **Bar**: solo il gioco sulla realtà, con dati reali. Contiene:
  - schedine sulle partite di Serie A;
  - classifica e crediti delle schedine Serie A;
  - Borsa del Quasi;
  - obiettivi;
  - il Quasi.
- **Fanta**: tutto quello che riguarda le squadre del fantacalcio. Contiene:
  - formazione, rosa, asta, giornata, classifica;
  - la **schedina sulle sfide del Fanta**, con i suoi crediti e la sua classifica.
- **Ogni nuova lega ha sempre tutte e due le funzioni**, Bar e Fanta. Non si crea una lega solo Bar o solo Fanta:
  - il pulsante «Crea una nuova lega · Bar + Fanta» resta l'unico modo di crearne una;
  - l'invito porta dentro a entrambe.

Cosa va sistemato per applicare la regola:
- **Barra in basso del Bar**: togli la scheda «Fanta». Per andare al Fanta basta il selettore in alto «Bar | Fanta». Le schede nuove sono quelle di B0-bis.
- **Bar › Oggi**:
  - togli il selettore «Serie A | Fantacalcio» sotto la giornata; nel Bar si vede solo la Serie A;
  - la card «Lega pilota · Il Fantacalcio del Quasi» può restare in fondo come invito a provare il Fanta, ma chiaramente marcata come Fanta.
- **Bar › Lega › Classifica**: il menu «Quale classifica?» mostra solo classifiche del calcio vero. Quella delle schedine Fanta si sposta in Fanta › Lega.
- **Fanta › Oggi e Fanta › Schedine**: la schedina sulle sfide del Fanta vive qui, con un titolo chiaro: «Schedina del Fanta · scommetti sulle sfide della tua lega».
- **Fanta › Lega › Classifica**: l'impostazione «Abilita la schedina nel Bar per gli allenatori della lega» non ha più senso, perché la schedina Fanta è sempre parte del Fanta. Toglila, oppure, se serve davvero, spostala nelle impostazioni admin con un nome nuovo («Schedina del Fanta attiva»).
- **Segnale visivo costante**, così si capisce sempre dove si è:
  - il Bar ha il suo colore d'accento (oggi l'azzurro) e il Fanta il suo (oggi il lime), usati su intestazione, scheda attiva e pulsanti principali;
  - sotto il selettore in alto, una riga corta che dice dove sei: «Bar · partite vere di Serie A» oppure «Fanta · la tua squadra e le sfide della lega».

**B0-bis. Menu riallineati: schedine, classifiche e Fanta a un tocco.** Francesco vuole arrivare più facilmente a schedine, classifiche e gioco del Fanta. I menu nuovi sono questi:

| Posto | Bar (calcio vero) | Fanta (squadre del fanta) |
|---|---|---|
| 1 | **Oggi** | **Oggi** (sfida, prossima mossa; la Giornata con voti e diretta si apre da qui) |
| 2 | **Schedina** (Serie A) | **Schedina** (sfide del Fanta) |
| 3 | **Classifica** (crediti e punti; dentro anche Storico) | **Classifica** (dentro: Classifica · Calendario) |
| 4 | **Quasi** (il tuo Quasi, premi, «I Quasi» della lega) | **Squadra** (Formazione · Rosa) |
| 5 | — | **Lega** (Asta · Regolamento · Partecipanti) |

- Le **prime tre schede sono le stesse, nello stesso posto**, in Bar e Fanta: chi passa da uno all'altro trova subito schedina e classifica.
- **Profilo («Io»)**: non è più una scheda in basso. È un'icona tonda in alto a destra, accanto a «Bar | Fanta», uguale in tutti e due. Apre profilo, notifiche ed esci.
- **Cose della lega comuni a Bar e Fanta** (regolamento del Bar, invita amici, impostazioni admin): si spostano nel foglio che si apre toccando il nome della lega in alto. Esempio: «Quelli del quasi ▾» → Regolamento · Invita amici · Impostazioni lega (solo admin) · Le tue leghe. Così la scheda «Admin» del Bar sparisce dalla barra.
- Nel Fanta l'ho già fatto nella nostra anteprima. Parti da portare nelle tue versioni (non copiare i file interi), da `E:\Users\frank\Downloads\Quelli del Quasi - Fantacalcio\public\src\fanta\`:
  - `shell.mjs`: barra, icone e icona del profilo;
  - `lega.mjs`: `LEGA_GROUPS` e `groupOf`, cioè Classifica e Lega divise;
  - `app.mjs`: schede `schedina` e `classifica`; i collegamenti «Classifica → Completa» aprono la scheda Classifica;
  - `public/fanta.css`: classi `.fanta-top-right` e `.fanta-me`.

  La scheda Schedina del Fanta da noi è un segnaposto: collegaci la schedina Fanta che hai già nel sito. Il Bar è tuo: applica la stessa struttura.

**B1. Ogni schermata deve avere il suo indirizzo.**
- Oggi l'URL resta sempre `https://quellidelquasi.com/`. Il tasto Indietro del telefono esce dal sito invece di tornare alla schermata prima, e non si può mandare a un amico il link alla Giornata o alla Lega.
- Deve:
  - ogni scheda e sezione ha un indirizzo, per esempio `#/bar/oggi`, `#/bar/serie-a`, `#/fanta/squadra`, `#/fanta/lega/classifica`;
  - Indietro e Avanti funzionano;
  - aprire un link porta dritto a quella schermata (dopo l'accesso, se serve).

**B2. Il numero dei crediti in alto a destra cambia significato.** Nello stesso punto oggi compaiono:

| Dove | Cosa mostra |
|---|---|
| Bar › Oggi | «480 crediti Fanta» |
| Bar › Serie A | «479 crediti Serie A» |
| Fanta | «47 crediti asta» |

- Deve, seguendo la regola B0:
  - nel Bar, sempre e solo «crediti Bar», cioè il saldo delle schedine Serie A, su tutte le schede del Bar;
  - nel Fanta, «crediti schedina» (le sfide del Fanta) e, quando c'è un'asta, «crediti asta»;
  - quando i saldi sono due, vanno mostrati uno sopra l'altro con il loro nome, mai un numero senza etichetta.

**B3. Nel Bar ci sono due «Fanta».** Lo risolve B0: la scheda «Fanta» nella barra in basso del Bar va tolta.

**B4. Nomi delle leghe da programmatore.**
- Oggi nel menu «Le tue leghe Fanta» compare «Random League 1» (squadra Real Divano 7).
- Deve: nessun nome tecnico visibile. Le leghe pilota si chiamano «Lega pilota 1», «Lega pilota 2» e così via, o con il nome deciso per loro.
- Controlla anche questo: nel menu Fanta di Francesco non vedo «Fanta Lucas Lega A». Era deciso che restasse e girasse con i nostri voti. Se manca per errore, rimettila; se c'è un motivo, scrivilo.

**B5. Fanta › Lega › Classifica.**
- Oggi:
  - sopra la classifica, che vedono tutti, c'è una casella del browser senza stile, «Abilita la schedina nel Bar per gli allenatori della lega», con il pulsante «Salva»;
  - c'è la scritta «Classifica del nostro motore · risultati in verifica», che è gergo interno;
  - il sottotitolo ripete il titolo («Quelli del quasi» / «Quelli del quasi»).
- Deve:
  - spostare l'impostazione in Regolamento o Impostazioni, visibile solo all'admin, con un interruttore nello stile del sito;
  - sostituire la scritta di gergo con «Punteggi in aggiornamento» quando serve, o niente;
  - togliere il sottotitolo doppio.

**B6. Classifica sul telefono.**
- Oggi la tabella è larga 540 px in un riquadro di 338 px: «Pt» e «FP», le colonne più importanti, si vedono solo scorrendo di lato.
- Deve: a 375 px si vedono senza scorrere posizione, squadra, Pt e FP. V, N e P vanno in piccolo sotto il nome o si nascondono.

**B7. Il pulsante della chat copre i contenuti.**
- Oggi il tondo della chat in basso a destra sta sopra i numeri della classifica e i pulsanti «+» delle schedine.
- Deve: non coprire mai valori o pulsanti. Due modi: spazio in fondo alle pagine e pulsante più piccolo sopra la barra, oppure chat nell'intestazione.

## F · Formazione dal telefono (già fatta da noi, da integrare)

- Oggi, sul telefono, prima del campo ci sono molte righe: titolo grande, schede, scadenza, moduli, suggerimento lungo.
- Per riempire 11 posti bisogna trascinare o toccare e scorrere ogni volta, e la lista dei giocatori resta in una striscia stretta sotto il campo fisso.
- Francesco l'ha chiesta più pratica. Nella nostra anteprima ora funziona così:
  1. **Tre scorciatoie sopra il campo**:
     - «⚡ Schiera i migliori»: nel modulo scelto mette i più in forma tra i disponibili (prima chi non è infortunato, squalificato o in dubbio, poi per fantamedia) e tutti gli altri in panchina, per ruolo;
     - «↺ Come la 10ª»: ripete la giornata scorsa;
     - «Scegli uno per uno».
  2. **Scelta guidata**: toccando un posto vuoto (o «Scegli uno per uno») si apre il foglio del ruolo, con una barra di avanzamento («Titolare 3 di 11»). Scelto un giocatore, il foglio passa **da solo** al posto vuoto successivo. Nella scelta guidata non compare chi è già in campo.
  3. **Panchina in sequenza**: finiti gli 11, si apre da solo «Ora la panchina». Si toccano i giocatori nell'ordine in cui devono entrare, il foglio resta aperto e in alto si vede l'ordine (1 Cattaneo, 2 Mariani…). Ci sono anche i pulsanti «Tutti gli altri, per ruolo» e «Fatto».
  4. **Cambiare un giocatore**: toccando un giocatore in campo si apre il foglio del suo ruolo. Chi è già in campo sta in fondo (si scambiano di posto), e c'è sempre «Lascia il posto vuoto».
  5. **Testata compatta sul telefono**:
     - solo il nome della squadra in piccolo;
     - la scadenza su una riga;
     - niente suggerimento lungo.

     Il trascinamento resta com'era, per chi lo preferisce e sul computer.

- Parti da portare nelle tue versioni (non copiare i file interi, tranne ormazione-studio.mjs, che è nuovo):
  - `squadra.mjs`: `bestLineup`, `byExpected`, `nextEmptySlot`, scorciatoie e fogli guidati;
  - `formazione-studio.mjs`: tutto lo studio, con `studioTap` e `playBadge`;
  - `dati-finti-squadra.mjs`: esempio di `play` nei dati finti;
  - `app.mjs`: gestione di `data-lineup="best|guided"`, avanzamento automatico, foglio panchina che resta aperto;
  - `public/fanta.css`: `.fanta-quick`, `.fanta-ps-progress`, `.fanta-ps-order`, `.fanta-ps-actions`, il blocco `@media (max-width:699px)` della formazione e tutto il blocco «Studio formazione» (classi `fs-*` e `.fanta-studio-open`), in fondo al file.
  6. **Studio formazione a tutto schermo** (nuovo file `formazione-studio.mjs`), fatto come lo studio del Quasi:
     - in alto il modulo e il campo in orizzontale, con portiere a sinistra e attacco a destra, e sotto la panchina, che scorre di lato;
     - in basso i giocatori, divisi con le schede Tutti · Portieri · Difensori · Centrocampisti · Attaccanti · Panchina (con le frecce per l'ordine);
     - un tocco su un giocatore libero lo mette in campo (o in panchina se il reparto è pieno); un altro tocco lo toglie;
     - un tocco su un posto del campo lo seleziona, e il prossimo giocatore toccato va lì;
     - in alto ci sono «⚡ Migliori» e «↺ Come la 10ª»; in basso, sempre visibile, «Salva formazione».

     Si apre da Squadra › Formazione con «Apri lo studio formazione». Sul telefono, se piace a Francesco, può diventare il modo predefinito.
  7. **Iconcina sulla maglia**, in alto a destra, ovunque compaia un giocatore della propria rosa (studio, campo, liste):
     - croce rossa per l'infortunato;
     - cartellino rosso per lo squalificato;
     - «?» con la percentuale, arancione, per chi è in dubbio;
     - altrimenti la **percentuale di probabilità di giocare**: verde dal 75%, gialla dal 50%, grigia sotto.
  8. **«Schiera i migliori» pesa anche la probabilità di giocare.** Ordina per fantamedia × probabilità; infortunati e squalificati valgono zero; senza dato si conta 70%. Così non mette in campo chi gioca al 25%.

- **Dati nuovi dal server.** Ogni giocatore della rosa in `GET /fanta-api/team` ha in più `play: { pct, source } | null`, con `source` uguale a `"probabili"` o `"giornata-precedente"`. Il contratto è in `docs/FANTA-FRONTEND.md`.
  - **Infortuni e squalifiche**: API-Football li dà con l'endpoint `injuries` (per giornata e squadra), da mettere in `status`.
  - **Probabilità di giocare: deciso da Francesco.** Le probabili formazioni le raccoglie già la parte Bar, quindi sono nel database. Il Fanta le legge da lì: nessuna fonte nuova e nessun servizio esterno in più.
    - Quando per la giornata le probabili ci sono: `play: { pct, source: "probabili" }`, con la percentuale salvata dal Bar.
    - Quando non ci sono ancora: si usa il dato della stessa fonte per la giornata precedente, con `source: "giornata-precedente"`.
    - Infortunati e squalificati: `play: null`, conta `status`.
    - Nessun dato né per questa giornata né per la precedente: `play: null`.
    - Se nel database le probabili sono salvate come «titolare / panchina» invece che in percentuale, scrivimi com'è fatto il dato e decidiamo insieme come trasformarlo in percentuale. Non inventare una formula.
- Il salvataggio non cambia: si salva come prima con `POST /fanta-api/lineup`.

## C · Computer (1366 px)

**C1.**
- Oggi la barra di navigazione è una pillola che galleggia a metà schermo in basso e copre i contenuti (per esempio «Schiera la formazione» e i valori della Borsa del Quasi).
- Deve: da 1024 px in su, navigazione in alto o a sinistra, e niente sopra i contenuti.

**C2.**
- Oggi il Bar occupa tutta la larghezza, mentre il Fanta sta in una colonna stretta di circa 760 px con tanto vuoto ai lati.
- Deve: stessa larghezza massima per Bar e Fanta (circa 1180 px). Sul computer il Fanta può usare due colonne: per esempio Oggi con la sfida a sinistra e la classifica a destra.

**C3.**
- Oggi il selettore della lega in alto è una pillola che si allunga per tutta la larghezza dell'intestazione.
- Deve: larga quanto il nome della lega.

## D · Velocità

**D1. Dati finti caricati agli utenti veri.**
- Oggi, con l'account di Francesco, il browser scarica `fanta/dati-finti-giornata.mjs` e gli altri file `dati-finti-*`.
- Deve: questi file si caricano solo nella demo (import dinamico).

**D2. Troppi file separati.**
- Oggi l'app carica 86 file JavaScript e la presentazione 18 fogli di stile.
- Deve:
  - la presentazione carica solo `styles.css` e `pubblico.css`;
  - il resto viene unito o caricato solo quando serve.

**D3. Il Fanta si riscarica ogni volta.**
- Oggi `fanta-api/bootstrap` pesa 153 KB a ogni apertura del Fanta, e passando da Bar a Fanta si vede ogni volta la schermata di caricamento (circa 1 secondo).
- Deve: alleggerire il bootstrap (solo quello che serve alla prima schermata) e tenere i dati in memoria, così il ritorno al Fanta è immediato. La schermata di caricamento appare solo la prima volta.

## E · Ritocchi

1. Nel piè di pagina pubblico, API-FOOTBALL è citato due volte: lascia solo «Powered by API-FOOTBALL».
2. «Niente pubblicità, per sempre» compare tre volte nella presentazione: lascia il bollino in alto e la domanda nelle FAQ.
3. Il logo in alto nella presentazione punta a `#`: deve riportare in cima.
4. La presentazione cita «Il tuo Quasi» ma non lo mostra mai: aggiungi un Quasi in uno spogliatoio, possibilmente con i disegni nuovi (vedi `PROMPT-CODEX-QUASI-STEMMI.md`).

## Come chiudere

- Lavora nell'ordine A, B, F, C, D, E.
- Per ogni punto, prova su telefono (375 px) e computer (1366 px), da utente normale, da admin e nella demo.
- Alla fine mandami un elenco con lo stato di ogni punto: fatto, da decidere o non fatto, e perché. Mandami anche il link all'anteprima.
- Per tutto quello che non è scritto qui, chiedi a Francesco prima di decidere.
