# Fanta · frontend (note per chi integra)

Questa cartella contiene **solo il frontend** del Fanta, costruito con dati finti. Il backend (`/fanta-api`, database, job su Netlify) lo scrive Codex nel repo principale. Il prompt completo per Codex arriverà quando le schermate saranno finite: questa nota tiene traccia di cosa c'è e del contratto dati man mano.

## Come vederlo

```
node scripts/anteprima-fanta.mjs
```

Apri `http://127.0.0.1:8785`. Il riquadro giallo in basso a sinistra (solo anteprima) cambia lo stato della giornata; si può anche usare `?stato=da-schierare|schierata|in-corso|calcolata`.

## File

| File | Cosa fa | Va nell'app vera? |
|---|---|---|
| `public/fanta.css` | Stili del Fanta, prefisso `fanta-`. Usa variabili e classi `v2-*`/`dash-*` del sito | Sì, in `public/` |
| `public/src/fanta/app.mjs` | `mountFanta(root, {api, onModeChange})`: modalità, lega, tab, rendering | Sì |
| `public/src/fanta/shell.mjs` | Barra in alto con interruttore Bar \| Fanta, barra tab, selettore lega | Sì |
| `public/src/fanta/home.mjs` | Home «Oggi» (funzione pura: dati → HTML) | Sì |
| `public/src/fanta/giornata.mjs` | Pagina «Giornata»: sfide, formazioni con voto/fantavoto, totale, modificatore difesa, scheda giocatore («Perché 6,5?») | Sì |
| `public/src/fanta/formato.mjs` | Escape HTML, numeri con la virgola, conto alla rovescia | Sì |
| `public/src/fanta/api.mjs` | `createFantaApi()` (vera, su `/fanta-api/*`) e `createFakeFantaApi()` | Sì |
| `public/src/fanta/dati-finti.mjs`, `dati-finti-giornata.mjs`, `squadre-finte.mjs` | Dati finti (deterministici); definiscono la forma delle risposte | Solo per anteprima/test |
| `public/src/fanta/anteprima.mjs`, `public/index.html` | Pagina di prova con selettore stati | No |
| `public/riferimento/*` | Copie di `styles.css`/`v2.css` del sito, solo per l'aspetto | No |
| `scripts/anteprima-fanta.mjs` | Server statico locale, nessuna chiamata esterna | No |

## Interruttore Bar | Fanta

Sta in alto a destra. La scelta è salvata in `localStorage` (`qdq:mode`), la lega Fanta scelta in `qdq:fantaLeague`. Nell'anteprima la modalità Bar mostra un segnaposto; nell'app vera `onModeChange('bar')` deve mostrare la shell del Bar esistente.

Nota sui nomi: nel Bar esiste già una tab «Fanta» (schedine sulle leghe di Fantacalcio). Resta com'è: l'interruttore in alto cambia modalità, la tab del Bar cambia sezione.

## Contratto dati (finora)

Tutte le risposte in JSON, solo letture, utente dalla sessione esistente.

`GET /fanta-api/leagues` → leghe Fanta dell'utente:

```json
[{ "id": "lega-quasi", "name": "Lega dei Quasi", "season": "2026/27", "role": "admin", "accent": "#d6f77b", "teamName": "SamBuca Juniors" }]
```

`GET /fanta-api/home?league=<id>` → tutto quello che serve alla home:

```json
{
  "league": { "id", "name", "season", "role", "accent" },
  "me": { "teamId", "teamName", "manager", "position", "points", "fantapoints", "form": ["V","N","P"] },
  "round": { "number": 11, "state": "da-schierare|schierata|in-corso|calcolata", "deadline": "ISO", "firstKickoff": "ISO", "matchesTotal": 10, "matchesDone": 4 },
  "lineup": { "status": "missing|saved", "formation": "3-4-3", "savedAt": "ISO" },
  "match": {
    "home": { "id", "name", "manager", "color" }, "away": { … },
    "live":  { "home": { "points", "played" }, "away": { … }, "of": 11 } | null,
    "final": { "home": { "points", "goals" }, "away": { … } } | null
  },
  "lastResult": { "round", "home": { "id","name","points","goals" }, "away": { … }, "outcome": "V|N|P", "topPlayer": { "name", "fantavoto" } },
  "standings": [{ "position", "team": { "id","name","manager","color" }, "played", "points", "fantapoints", "form" }],
  "bar": { "odds": { "1": 2.05, "X": 3.4, "2": 3.3 }, "bets": 5 } | null
}
```

`form` e `outcome` dal punto di vista della squadra dell'utente in `lastResult`, di ciascuna squadra in `standings`. `bar` è il collegamento al Bar sulla sfida dell'utente: `null` se non ci sono quote.

### Pagina Giornata

Il frontend **non calcola nulla**: voti, bonus, sostituzioni, modificatore e totali arrivano già fatti dal server (motore regole + motore voti). Mostra solo quello che riceve.

`GET /fanta-api/round?league=<id>&number=<n>` → testata della giornata e elenco sfide (quella dell'utente con `isMine`):

```json
{
  "round": { "number": 11, "state": "da-schierare|schierata|in-corso|calcolata", "official": false, "updatedAt": "ISO", "matchesDone": 4, "matchesTotal": 10 },
  "rounds": [{ "number": 1, "state": "calcolata" }],
  "matchups": [{ "id": "11-sambuca-realgin", "isMine": true,
    "home": { "team": { "id","name","manager","color" }, "points": 69.5, "goals": 1 },
    "away": { "team": { … }, "points": 64, "goals": 0 } }]
}
```

`points`/`goals` sono `null` finché la giornata non è iniziata; in quel caso ogni lato ha `lineupSaved: true|false`.

**Lista | Campo**: la formazione si vede come lista per reparto o schierata sul campo (scelta salvata in `localStorage`, `qdq:fantaView`). Nessun dato in più dal server.

**Maglie**: nel campo ogni giocatore ha la maglia di casa del suo club, disegnata con i soli colori sociali (niente stemmi né sponsor), con la sigla di tre lettere sul petto (GEN, CAG, BOL…) per distinguere i club con gli stessi colori. La tabella dei 20 club sta in `public/src/fanta/maglie.mjs` ed è indicizzata per nome del club (`player.club`). Il server deve quindi mandare il nome del club come scritto lì, oppure si aggiunge un id. Club sconosciuto: maglia grigia. Da verificare: se `fixtures/lineups` di API-Football restituisce i colori delle squadre, la tabella si può aggiornare da lì.

**Formazioni visibili subito**: appena una squadra salva la formazione, tutti nella lega la vedono (con `savedAt`). Nascosta solo se non è ancora stata salvata.

**Live**: durante la giornata in corso la pagina rilegge `round` e `matchup` ogni 60 secondi (solo con la pagina visibile). Il voto in diretta parte da 6, si muove con i numeri della partita, resta 6 nei primi 25 minuti giocati; la correzione AI solo dopo 30 minuti. Da dove arrivano i dati: `docs/FANTA-FONTI-DATI.md`.

`GET /fanta-api/matchup?league=<id>&number=<n>&id=<matchupId>` → le due formazioni:

```json
{
  "id", "round": 11, "state", "official": true,
  "home": TeamSheet, "away": TeamSheet
}
```

`TeamSheet` visibile: `{ team, formation: "4-4-2", savedAt, starters: [Player], bench: [Player], substitutions: [{ out, in }], fantapoints, modifier: Modifier, total, goals, withVote }`.
`TeamSheet` nascosto (formazione non ancora salvata): `{ team, hidden: true, hiddenReason: "…", needsLineup?: true, total: null, goals: null }`.

`Player`:

```json
{
  "id", "name", "role": "P|D|C|A", "club", "opponent", "home": true,
  "status": "voted|playing|sv|to-play",
  "minutes": 90, "score": [3, 1], "kickoff": "sab 15:00",
  "vote": 6.5, "fantavote": 7.5,
  "replacedBy": "nome", "enteredFor": "nome",
  "events": { "goals", "assists", "yellow", "red", "ownGoals", "conceded", "penSaved", "penMissed" },
  "breakdown": {
    "start": 6,
    "lines": [{ "kind": "stat|context|ai", "delta": 0.5, "label": "3 passaggi chiave", "why": "3 passaggi chiave (media del ruolo 1,1)" }],
    "bonus": [{ "label": "Gol", "delta": 3 }]
  },
  "stats": [{ "label": "Passaggi chiave", "value": 3, "avg": 1.1, "unit": "" }],
  "why": "Parte da 6. Sale per …",
  "model": "voti-v1",
  "ai": { "delta": 0.5, "model": "haiku", "note": "…" } | null
}
```

Gol e assist **non** entrano nel voto base: valgono solo come bonus (+3, +1). Regole: `start + somma(lines.delta) = vote`; `vote + somma(bonus.delta) = fantavote`. La riga `kind: "ai"` è la correzione dello strato AI (massimo ±0,5) e la sua `why` è la motivazione mostrata all'utente. Per `status: "sv"` basta `why` (motivo del senza voto).

`Modifier`: applicato `{ applies: true, bonus, average, players: [{ id, name, role, vote }], bands: [{ from, to, bonus }], rule }`; non applicato `{ applies: false, bonus: 0, reason, rule, pending? }`.

### Pagina Squadra (formazione e rosa)

File: `public/src/fanta/squadra.mjs` (funzioni pure per la bozza della formazione + rendering), collegato in `app.mjs`. La bozza resta nel browser finché non si salva; **il server deve rifare tutti i controlli** (scadenza, modulo ammesso, 11 titolari con 1 portiere, giocatori della rosa, panchina massima).

`GET /fanta-api/team?league=<id>`:

```json
{
  "team": { "id", "name", "manager", "color" },
  "budget": { "total": 500, "spent": 476 },
  "round": { "number": 11, "state", "deadline": "ISO", "locked": false },
  "rules": { "formations": ["3-4-3","3-5-2","4-3-3","4-4-2","4-5-1","5-3-2","5-4-1"], "benchMax": null, "maxSubstitutions": null, "substitutionsSameRoleOnly": true },
  "roster": [{
    "id", "name", "role": "P|D|C|A", "club": "Lazio", "price": 11,
    "next": { "opponent": "Udinese", "home": true, "kickoff": "dom 15:00", "round": 11 },
    "stats": { "played": 10, "avgVote": 6.1, "avgFanta": 4.85, "goals": 0, "assists": 0 },
    "status": { "type": "ok|injured|doubtful|suspended", "note": "Infortunato · rientro tra 2 settimane" }
  }],
  "lineup": { "formation": "4-4-2", "starters": [id × 11], "bench": [id…], "savedAt": "ISO" } | null,
  "previous": { "round": 10, "formation", "starters", "bench" } | null
}
```

`POST /fanta-api/lineup` con `{ league, round, formation, starters, bench }` → la formazione salvata (stessa forma di `lineup`, con `savedAt`). In caso di errore `{ error: "messaggio leggibile" }` con stato 4xx: il frontend lo mostra così com'è. Dopo la scadenza (`locked: true`) la pagina è in sola lettura.

**Tocco e trascinamento** (`public/src/fanta/trascina.mjs`, Pointer Events: funziona col dito e col mouse, senza librerie). Il campo, compatto, e la panchina (7 posti in fila) restano fermi in alto mentre sotto scorre la lista di tutta la rosa, filtrabile per ruolo. Su computer campo e lista stanno affiancati. Si può:
- trascinare dalla lista su un posto del campo (stesso ruolo) o in panchina;
- trascinare tra panchina e campo: se i ruoli coincidono, i due giocatori si scambiano;
- riordinare la panchina trascinando;
- togliere un giocatore trascinandolo sulla lista.

Col dito, sulla riga della lista bisogna tenere premuto un attimo (così la pagina scorre normalmente); dalla maniglia ⠿ e dal campo si trascina subito. Il tocco semplice resta: un posto apre la scelta, una riga della lista mette il giocatore nel primo posto libero del suo ruolo (o in panchina). Tutte le regole stanno in funzioni pure in `squadra.mjs` (`canDropOn`, `dropOn`, `quickAdd`).

**Regole di base della panchina e dei cambi** (decise da Francesco; in futuro ogni lega potrà cambiarle, per questo stanno in `rules`):
- **panchina senza limite**: può contenere tutta la rosa (`benchMax: null`; un numero = limite);
- **cambi senza limite** (`maxSubstitutions: null`);
- **cambi solo nello stesso ruolo** e **il modulo non cambia mai** in base all'ordine della panchina: chi è senza voto viene sostituito dal primo panchinaro **dello stesso ruolo** con un voto, nell'ordine della panchina. Se nessuno di quel ruolo ha voto, il posto resta vuoto.

Comportamenti del frontend:
- l'ordine di `bench` è l'ordine dei cambi (per ruolo); c'è un pulsante «Tutti in panchina» che aggiunge in coda tutti i non titolari, per ruolo e fantamedia;
- quando si cambia modulo, i posti nuovi si riempiono con i primi panchinari di quel ruolo e chi esce va in testa alla panchina;
- c'è un pulsante «Ripeti la giornata N» che usa `previous`;
- i giocatori infortunati, squalificati o in dubbio si possono schierare, ma compare un avviso;
- `stats` e `status` arrivano da API-Football: medie dai voti nostri, `injuries` per lo stato (vedi `FANTA-FONTI-DATI.md`).

### Asta (sala d'asta live)

File: `public/src/fanta/asta.mjs` (rendering e timer), collegato in `app.mjs`. Ci si entra dalla card «Asta in corso» in cima alla home (c'è se `home.auction.status === "running"`); nella barra in basso resta accesa la tab Lega. Nell'anteprima `dati-finti-asta.mjs` simula il server: le altre 7 squadre chiamano e rilanciano da sole.

**Regole di base** (decise da Francesco, configurabili per lega in `rules`):
- **Ordine di chiamata casuale**: lo decide l'app all'inizio dell'asta e lo mostra a tutti. A turno **ogni squadra deve chiamare lei un giocatore**: il sistema non sceglie mai al posto di nessuno. Chi deve chiamare ha **30 secondi** (`callSeconds`); se non chiama, **salta il turno**. Le squadre con la rosa completa vengono saltate.
- Il giocatore chiamato parte con un timer di **30 secondi** (`openSeconds`). **Ogni rilancio riporta il timer a 10** (`raiseSeconds`).
- **Gli ultimi 3 secondi durano 5 secondi veri** (`finalSeconds: 3`, `finalStretch: 5`): ogni «secondo» finale dura circa 1,7 secondi, per dare tempo all'ultimo rilancio. Quindi un timer da 10 dura davvero 12 secondi e uno da 30 ne dura 32. Il server deve calcolare `endsAt` così: `adesso + (secondi − 3 + 5) × 1000`. In quella fase la card del giocatore va in allarme: bordo rosso pulsante, numero grande che batte, scritta «Sta per scadere!» e una vibrazione sul telefono.
- **Passo**: chi non è interessato passa e **non può più rientrare su quel giocatore**. **Passo automatico** se il ruolo è già completo o se i crediti non bastano per il rilancio minimo. Chi è in testa non può passare.
- **Se passano tutti tranne chi è in testa, il giocatore è suo subito**: il server porta `endsAt` a 1,5 secondi e mette `closing: true`.

**Tempo reale senza WebSocket** (come da `FANTA-PROGETTO.md` §3): mentre la sala è aperta e visibile, il browser legge `GET /fanta-api/auction` **ogni secondo**. Ridisegna solo quando cambia `version` e anima il timer da solo, calcolando lo scarto con `serverTime`. **Il timer vero è del server**: un'offerta è valida solo se arriva prima di `endsAt` e va salvata in una transazione (`SELECT … FOR UPDATE` sul lotto). Chi scrive una cifra libera non perde il campo durante gli aggiornamenti.

`GET /fanta-api/auction?league=<id>`:

```json
{
  "version": 57, "serverTime": "ISO", "status": "running|ended",
  "rules": { "budget": 500, "roster": { "P": 3, "D": 8, "C": 8, "A": 6 }, "minRaise": 1,
             "callSeconds": 30, "openSeconds": 30, "raiseSeconds": 10, "finalSeconds": 3, "finalStretch": 5 },
  "me": "sambuca", "order": ["ciaccola", "fly", …], "caller": "fly",
  "callDeadline": "ISO" | null,
  "pausedUntil": "ISO" | null,
  "skipped": { "team": "sambuca" } | null,
  "teams": [{ "team": { "id","name","manager","color" }, "credits": 367, "maxBid": 352, "slotsLeft": 16, "online": true,
              "roles": { "P": { "have": 1, "max": 3 }, … } }],
  "lot": { "id": "lot-57", "player": { "id","name","role","club","value","fm","played","status" }, "bid": 13, "leader": "perfetta",
           "endsAt": "ISO", "timerSeconds": 30, "closing": false,
           "passed": ["fly"], "autoPassed": { "united": "role", "bis": "credits" },
           "history": [{ "team", "amount", "at", "call"?: true, "pass"?: true }] } | null,
  "lastSale": { "player", "team", "price", "at" } | null,
  "log": [{ "player", "team", "price" }],
  "myRoster": [{ …player, "price": 20 }]
}
```

- `callDeadline` è la scadenza della chiamata di chi sta chiamando (anche degli altri, per mostrare il loro timer).
- `skipped` compare durante la pausa dopo un turno saltato.
- `timerSeconds` dice da quanti secondi parte il cerchio: 30 dopo la chiamata, 10 dopo un rilancio.
- `pausedUntil` è la pausa di qualche secondo dopo un'aggiudicazione, mentre si mostra «Aggiudicato».
- `maxBid` = crediti − (posti ancora da riempire − 1): deve restare almeno 1 credito per ogni posto.
- Non si può rilanciare su un ruolo già completo, né quando si è già in testa.

`GET /fanta-api/auction/players?league=<id>` → il listone dei giocatori liberi `[{ id, name, role, club, value, fm, played, status }]`, ordinato per `value` (il nostro valore, vedi `FANTA-PROGETTO.md` §6).

`POST /fanta-api/auction/bid` con `{ league, lotId, amount }`, `POST /fanta-api/auction/pass` con `{ league, lotId }` e `POST /fanta-api/auction/nominate` con `{ league, playerId, amount }` → lo stato aggiornato (stessa forma del GET). In caso di errore `{ error }` con un messaggio leggibile (es. «Serve almeno 14», «Il giocatore è già stato aggiudicato», «Non è il tuo turno di chiamata»): il frontend lo mostra sotto i pulsanti.

### Asta dal vivo (modalità manuale)

Per gli amici che fanno l'asta **tutti insieme, a voce**. **Nessun timer** e nessun turno gestito dall'app. Il **banditore** (l'admin della lega) deve poter assegnare **velocissimo**:
1. Cerca il giocatore chiamato e lo tocca: va **sul tavolo** e tutti lo vedono subito sul telefono. Il cursore va da solo nel campo **Prezzo**, subito di fianco al giocatore.
2. Scrive il prezzo e **tocca la squadra** che se l'è aggiudicato. Sotto ogni squadra si vedono crediti, puntata massima e posti di quel ruolo. Le squadre con il ruolo completo, o la cui puntata massima non basta per quel prezzo, sono spente con il motivo.
3. Un **piccolo pop-up** chiede conferma («E. Donati a Real Gin per 40 crediti · Annulla / Assegna»). Il pulsante Assegna ha già il focus, quindi basta Invio o un tap. Fatto: il cursore torna sulla ricerca per il giocatore successivo.

L'ultimo acquisto ha «Annulla» e ogni riga degli acquisti ha «×»: se il banditore sbaglia, il giocatore torna nel listone. Gli altri partecipanti vedono in sola lettura il giocatore sul tavolo, l'ultimo acquisto, crediti e posti di tutti e la propria rosa, aggiornati ogni secondo.

La modalità la sceglie l'admin, in cima alla sala: **Online** (a turni, con timer) oppure **Dal vivo**. Chi non è admin non vede la scelta. Nell'anteprima l'utente è admin della «Lega dei Quasi» e semplice partecipante nel «Fanta Ufficio»: cambiando lega si vedono entrambe le viste.

In più nello stato (`GET /fanta-api/auction`): `mode: "live"|"manual"`, `isAdmin`, `auctioneer` (nome del banditore), `table` (giocatore sul tavolo o `null`), e in `log` ogni acquisto ha `id`.

Azioni, **solo admin**: il server deve rifiutare con 403 chi non lo è. Ognuna restituisce lo stato aggiornato.
- `POST /fanta-api/auction/mode` con `{ league, mode }`;
- `POST /fanta-api/auction/table` con `{ league, playerId | null }`;
- `POST /fanta-api/auction/assign` con `{ league, playerId, teamId, price }`. Il server controlla: giocatore libero, ruolo non completo, `1 ≤ price ≤ maxBid` della squadra;
- `POST /fanta-api/auction/undo` con `{ league, saleId }`: il giocatore torna libero e i crediti tornano alla squadra.

### Pagina Lega

File: `public/src/fanta/lega.mjs`. Sezioni (chip in alto): **Classifica · Calendario · Asta · Regolamento · Partecipanti**. Ci si arriva dalla tab Lega, da «Classifica → Completa» della home e dalla card dell'asta.

- **Classifica**: posizione, squadra e allenatore, ultime 5 (V/N/P), V-N-P, punti, fantapunti totali. **Va calcolata dal server dai risultati delle giornate** (nei dati finti lo fa `standingsFor`, e home, Giornata e Lega ora mostrano gli stessi numeri). Spareggio: somma dei fantapunti (da confermare).
- **Calendario**: tutte le giornate, con quella in corso aperta e bordata. Ogni sfida giocata porta alla pagina Giornata **su quella sfida**. Le giornate future mostrano solo gli accoppiamenti.
- **Asta**: è la casa dell'asta.
  - In corso: «Entra nella sala»; l'admin ha anche «Chiudi l'asta», rifiutata se c'è un giocatore in tavola.
  - Programmata: data, modalità e conto alla rovescia; l'admin può «Aprire la sala adesso» o «Modificare». All'orario stabilito la sala si apre da sola.
  - Nessuna asta o asta chiusa: l'admin trova il modulo **Nuova asta**, con tipo (iniziale / di riparazione / lampo), modalità (online / dal vivo) e data e ora.
  - Sotto: crediti spesi e rimasti, posti per ruolo di ogni squadra.
- **Regolamento**: bonus e malus, come nasce il voto, modificatore difesa, dai punti ai gol, moduli, panchina e cambi, classifica. Arriva dal server (`rules`): in futuro sarà modificabile per lega.
- **Partecipanti**: «N/12» con la barra, elenco con admin e «tu», codice invito con «Invia il link» (condivisione del telefono) e «Copia». A 12 l'invito sparisce: «lega al completo».

La **card dell'asta in home** compare solo con l'asta aperta («Entra nella sala») o programmata entro 24 ore («Asta in arrivo · si apre tra…», porta alla sezione Asta).

`GET /fanta-api/league?league=<id>`:

```json
{
  "league": { "id","name","season","role","accent", "maxMembers": 12, "inviteCode": "QUASI-7K2P", "inviteUrl": "https://…/invito/QUASI-7K2P" },
  "isAdmin": true,
  "members": [{ "team": { "id","name","manager","color" }, "isAdmin": true, "isMe": true, "joinedAt": "ISO" }],
  "standings": [{ "position","team","played","won","drawn","lost","goalsFor","goalsAgainst","points","fantapoints","form": ["V","N","P"] }],
  "calendar": { "current": 11, "last": 35, "rounds": [{ "number", "state": "calcolata|in-corso|schierata|da-schierare|futura", "matchups": [{ "id","isMine","home": { "team","points","goals" }, "away": { … } }] }] },
  "rules": { "scoring": [["Gol","+3"], …], "vote", "modifier": { "rule", "bands" }, "goals", "lineup": { "formations","bench","subs","missing" }, "table", "roster", "budget" },
  "auction": { "status": "scheduled|running|ended|none", "type": "iniziale|riparazione|lampo", "typeLabel", "mode": "live|manual", "startsAt": "ISO", "types": { … },
               "teams": [{ "team","spent","credits","slotsLeft","roles" }] }
}
```

Azioni dell'admin sull'asta, solo admin (403 per gli altri). Restituiscono lo stato dell'asta:
- `POST /fanta-api/auction/schedule` con `{ league, type, mode, startsAt }`;
- `POST /fanta-api/auction/start` con `{ league }`;
- `POST /fanta-api/auction/close` con `{ league }`.

Il server apre la sala all'orario stabilito: un job o un controllo alla lettura. `GET /fanta-api/auction` ha in più `status: "scheduled|running|ended"`, `type` e `startsAt`. A sala chiusa o non ancora aperta, la pagina dell'asta lo dice e rimanda alla Lega.

### Accesso, demo e pagina Io

**Chi vede cosa** (deciso da Francesco il 01/11/2026):
- **Fanta vero**: per ora **solo l'utente `frakwood`** (Francesco, admin), sulla lega **«Fanta Lucas Lega A»**. Vuole provarlo da solo per un paio di giornate prima di aprirlo agli amici.
- **Tutti gli altri utenti registrati** vedono il tasto Fanta, ma dentro trovano **solo la demo**.
- **Chi prova l'app dalla landing senza registrarsi** («Guarda come funziona») trova **la stessa demo**.

**La demo** è il frontend con `createDemoFantaApi()` (i file `dati-finti*.mjs`, che quindi fanno parte del prodotto) e `mountFanta(root, { api, demo: true })`:
- in cima c'è una **fascia gialla fissa «DEMO · Dati di prova: niente viene salvato davvero · Come funziona»**;
- al primo ingresso si apre da sola una **spiegazione** (`qdq:fantaDemoSeen` in localStorage). Dice che sei l'allenatore (e admin) di una squadra di una lega finta, che puoi fare tutto e che niente resta salvato: ricaricando si riparte;
- la prima volta che si salva una formazione, si fa un'offerta o si usa un comando da admin, compare un avviso: «salvata per prova, resta solo su questo schermo»;
- la demo non fa chiamate di rete.

`GET /fanta-api/me` → `{ user: { username, name }, access: "full" | "demo", settings: { notify: { lineupReminder, roundStart, liveEvents, results, auction } } }`. Con `access: "demo"` il frontend monta la demo. **Tutte le altre rotte `/fanta-api/*` vanno rifiutate (403) a chi non ha accesso**: il controllo vero è sul server, non nel browser.

`POST /fanta-api/settings` con `{ notify: {…} }` → le impostazioni salvate.

**Pagina Io** (`public/src/fanta/io.mjs`):
- nome e username;
- in demo, una card che spiega la modalità;
- **notifiche del Fanta**, con interruttori che si salvano subito: promemoria formazione 2 ore prima, inizio giornata, gol e cartellini dei propri giocatori in diretta, risultati e voti ufficiali, asta;
- le proprie leghe Fanta;
- il rimando alla parte Bar per il Quasi e l'account, che sono gli stessi.

## Regole della lega (decise)

- **Massimo 12 partecipanti per lega** (deciso da Francesco il 01/11/2026). Il server deve rifiutare iscrizioni e inviti oltre il dodicesimo; la creazione e la gestione della lega (pagina Lega, ancora da fare) mostreranno «N/12». Le schermate già fatte (classifica, sfide, asta, console del banditore) reggono 12 squadre. Nota: in `FANTA-PROGETTO.md` §1 le licenze erano indicate fino a 10 partecipanti: la fascia oltre 10 (fino a 12) va aggiunta.

## Da decidere (non bloccanti per il frontend)

- Asta: timer, chiamata, passo e ordine sono **decisi** (vedi «Regole di base» dell'asta). Da confermare: rilancio minimo 1, budget 500, rosa 3/8/8/6; asta lampo per le leghe in beta a metà stagione, svincoli e asta di riparazione.

- Moduli ammessi: nei dati finti 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1.

- Panchina e cambi: **deciso** (vedi «Regole di base della panchina e dei cambi»).
- Senza voto: nei dati finti sotto i 15 minuti giocati.

- Conversione fantapunti → gol: nei dati finti 66 = 1 gol, +6 per gol (come il Classic). Vedi domande aperte in `FANTA-PROGETTO.md` §11.
- Cosa succede senza formazione: il testo dice «si gioca con quella della giornata scorsa», da confermare.
