# Quelli del Quasi · Fantacalcio — documento di progetto e passaggio di consegne

Scritto il 31/10/2026 dalla chat di progettazione con Francesco (proprietario). Serve a chi sviluppa (Claude Code) per partire senza rifare le decisioni già prese. Quello che è **deciso** è marcato così; quello **da confermare** sta in fondo, in «Domande aperte».

## 1. Prodotto e principi

- **Cosa**: fantacalcio vero e proprio (Classic) dentro Quelli del Quasi, accanto alle scommesse virtuali («Bar»). Una sola app, un solo account, due modalità con interruttore in alto (Bar | Fanta). Una sola PWA. Store più avanti (Capacitor).
- **Lancio**: **beta in primavera 2027 sulle giornate rimaste del 2026/27** con le leghe di Francesco; lancio pieno per l'asta di agosto 2027 (stagione 2027/28).
- **Principi non negoziabili** (valgono anche per il Fanta): sempre gratuita; mai pubblicità, mai pay per use, mai banner o video per sbloccare funzioni; tutti gli utenti uguali (stessa interfaccia, stesse probabilità); crediti virtuali, nessun denaro reale. Monetizzazione futura prevista: licenza annuale per lega (indicativamente 20 € fino a 6 partecipanti, 30 fino a 8, 40 fino a 10). Alcune funzioni potrebbero stare in un premium futuro: da decidere, non ora.
- **Idea distintiva**: una lega, due giochi. Gli stessi amici giocano al fantacalcio e al Bar scommettono sulle sfide del fantacalcio, con i punteggi che arrivano dal motore interno (oggi arrivano da scraping di leghe.fantacalcio.it). Quasi, premi e chat sono condivisi.
- **Marchio**: «Quelli del Quasi» è il marchio. Il termine «Fantacalcio» nel nome è un rischio legale da far verificare a un consulente prima di spendere in grafica/store (non bloccante per lo sviluppo).

## 2. Vincoli di lavoro (da rispettare sempre)

- **Mai pubblicare in produzione.** Nessun merge, push, PR o deploy senza OK esplicito del proprietario. Processo di rilascio: `docs/RILASCIO.md`, `docs/REPORT-PROCESSO-RILASCIO.md`.
- **Nessun dato di produzione** in locale o nei test. Nessuna chiave o credenziale in chat, nel codice o nei file: solo variabili d'ambiente.
- Test: `npm test` (equivale a `node --import ./test/setup-release-context.mjs --test test/*.test.mjs`). La suite non termina da sola: usare `--test-force-exit`, e senza l'`--import` falliscono i test su email/push. Node ≥ 22.
- Anteprima locale isolata: `npm run dev` → `http://127.0.0.1:8780`, login `anteprima` / `QuasiLocale26!`, dati solo in RAM, `fetch` esterno disattivato (`scripts/dev-isolated.mjs`). Il Fanta deve avere lo stesso tipo di anteprima.
- L'albero di lavoro contiene **modifiche non committate** (redesign delle schedine del Bar, profilo del pronosticatore su lettura leggera, `scripts/probe-sportapi.mjs`, ecc.; vedi `CHANGELOG.md` → Unreleased). Il rilascio lo gestisce Codex/Francesco: non committare né ripulire senza chiedere.
- Attenzione ai nomi: nel repo `lib/fantasy-*.mjs` e `lib/fantacalcio*.mjs` sono l'**import/scraping di leghe esterne** per le scommesse sul fantacalcio altrui. Il nuovo prodotto nativo va in una cartella e un namespace distinti (proposta: `fanta/`, schema DB `fanta`, funzione `fanta-api`) per non confonderli.

## 3. Architettura decisa

```
Fonte dati → Ingestione → Database → Motore voti → Motore regole → App
```

- **Stack**: lo stesso del sito (ES modules `.mjs`, SPA vanilla in `public/`, funzioni Netlify, Postgres di Netlify DB). Niente riscrittura in Next.js: stesso repo, test, rilascio, anteprime, database.
- **Database**: stesso database, **nuovo schema `fanta` con tabelle relazionali vere** (giocatori, club, partite, statistiche per giocatore e partita, eventi, voti versionati, leghe, squadre, rose, formazioni, scadenze, aste/offerte, risultati, classifiche, regole per lega). **Mai** scrivere nel blob JSON `fanta_state` (riga unica `id=1`, bloccata con `FOR UPDATE` a ogni scrittura in `lib/db.mjs`): bloccherebbe il Bar e crescerebbe senza controllo.
- **Identità**: utenti e sessioni restano per ora dentro `fanta_state` (campi `users`, `sessions`). Le tabelle `fanta` salvano solo l'id utente come testo, senza chiave esterna, così l'identità si può spostare in una tabella propria più avanti. Il Fanta **legge** utente/lega con letture leggere dedicate (vedi `readSnapshot` in `lib/db.mjs`: ogni `kind` ha una query SQL che estrae solo il necessario; il profilo del pronosticatore usa `kind: 'analysis'`).
- **Isolamento**: cartella `fanta/` con funzioni, schema e test propri; entrata API separata (`netlify/functions/fanta-api.mjs`, redirect `/fanta-api/*` in `netlify.toml`), così un guasto del Fanta non abbatte il Bar; interruttore di funzionalità per accenderlo solo alle leghe in beta.
- **Motore regole**: libreria pura (niente rete, niente DB), versionata, deterministica. Ogni lega salva il proprio set di regole; un calcolo si può rifare identico mesi dopo.
- **Motore voti**: libreria pura + strato AI opzionale (vedi §5).
- **Job**: i cron Netlify esistono già (`netlify.toml`: `sync-football` ogni minuto, ecc.). Il live ogni 60 s è accettabile per la beta; i lavori lunghi vanno in background function (limite 15 min). Se il live diventa fragile: worker sempre acceso (Fly.io/Railway) o Inngest/Trigger.dev.
- **Aste in tempo reale**: Netlify non ha WebSocket. Per 8–10 amici: polling ogni 1–2 s + offerta salvata in una transazione. Realtime esterno (Ably/Supabase Realtime) solo se servirà scalare.
- **Il browser non chiama mai i fornitori**: legge solo la nostra API (come già oggi per il live).

## 4. Regole di punteggio v1 (Classic)

Fantavoto = voto base + bonus/malus.

| Evento | Valore |
|---|---|
| Gol | +3 |
| Assist | +1 |
| Ammonizione | −0,5 |
| Espulsione | −1 |
| Autogol | **−3** (deciso; nel Classic ufficiale è −2) |
| Gol subito (solo portiere) | −1 |
| Imbattibilità del portiere | **nessun bonus** (deciso) |
| Rigore parato / sbagliato | da confermare (Classic: +3 / −3) |

**Modificatore difesa** (deciso): si calcola **solo sui voti base, senza bonus né malus**. Fasce sulla media: `< 6` → 0; `6 ≤ m < 6,5` → +1; `6,5 ≤ m < 7` → +2; `m ≥ 7` → +3. Da confermare: media di portiere + 3 migliori difensori, applicato solo con almeno 4 difensori schierati (come nel Classic).

Ruoli: solo **Classic P/D/C/A** per ora (niente Mantra).

Il set di regole è un oggetto per lega (`rules` versionato), con questi valori come default.

## 5. Voti «con ragionamento AI» (ibrido, non un LLM che inventa)

1. **Base statistica deterministica**: parte da 6,0 e si sposta con le statistiche specifiche del ruolo (tiri, passaggi chiave, contrasti, parate, duelli, minuti) confrontate con la distribuzione storica del ruolo, più contesto (risultato, differenza di xG se disponibile, forza dell'avversario). Stessi dati → stesso voto.
2. **Niente doppio conteggio**: gol e assist valgono già come bonus; nel voto base pesano poco.
3. **Strato AI limitato**: riceve i dati strutturati, può correggere il voto di **al massimo ±0,5**, deve motivare citando solo numeri ricevuti e produrre 1–2 righe leggibili («Perché 6,5?»). Se i dati sono incoerenti segnala il caso invece di inventare. Modello piccolo (famiglia Haiku), una chiamata per giocatore-partita (~220 a giornata, ~8.000 a stagione), risposta in JSON validato, fallback al solo voto deterministico. Nei test mai chiamate esterne: interfaccia con implementazione finta.
4. **Provvisorio → ufficiale**: durante la partita il voto è provvisorio; a fine gara, quando il fornitore ha corretto le statistiche (alcune ore), diventa ufficiale e si congela. Ogni voto salva versione del modello, input usati e (se c'è) prompt/hash. Finestra di correzione definita.
5. **Calibrazione** su stagione passata: media ≈ 6,0, scarto tipico ≈ 0,6–0,7, correlazione con il rating del fornitore. Occhio: se i voti sono troppo generosi, il modificatore difesa scatta sempre a +2/+3.
6. **Limite onesto**: l'AI non vede la partita (errori che causano gol, salvataggi sulla linea spesso non emergono dai numeri). I voti saranno diversi da quelli di Gazzetta; si presentano come punto di forza: formula pubblica e spiegazione per ogni voto.

## 6. Listone e quotazioni (nostri)

Decisione: **listone nostro**, costruito dai dati del fornitore; **quotazioni nostre**. L'import da leghe.fantacalcio.it resta solo come strumento di migrazione per chi porta una propria lega (ruoli, quotazioni e listone di Fantacalcio.it sono loro contenuti: non costruirci sopra il prodotto).

- Ruolo Classic: derivato dalla posizione reale + tabella di correzioni manuali.
- Modello di valore (valore sopra la sostituzione):
  1. probabilità di giocare (presenze da titolare, minuti medi; per i nuovi arrivi un valore di partenza per ruolo/età/campionato di provenienza + correzione manuale);
  2. fantapunti attesi a partita con le **nostre** regole, dalle statistiche partita per partita, riportati verso la media del ruolo quando i dati sono pochi;
  3. probabilità di bonus (rigorista, tiri in porta, passaggi chiave, parate);
  4. forza della squadra (gol fatti/subiti);
  5. punti attesi meno quelli di un sostituto medio del ruolo, budget ripartito tra i ruoli (500 crediti da confermare) e convertito in prezzo (minimo 1);
  6. spiegazione per ogni prezzo («Perché costa 38?»).
- Il difensore vale poco per i bonus: il suo valore è nel modificatore difesa e nei cartellini → trattarlo a parte.
- **Beta a metà stagione**: le quotazioni devono usare anche le statistiche 2026/27 fino a quel momento, non solo la stagione scorsa.

## 7. Fornitori dati (stato al 31/10/2026)

**SportAPI.ai** (già usato in produzione per risultati/live via `SPORTAPI_KEY`, vedi `lib/sportapi-live.mjs`, che oggi consente solo `fixtures/date/…` e `fixtures/{id}`):
- Dalla loro pagina: piano gratis = 2.000 richieste/giorno e 14.000/mese, una chiave; Starter 10 $/mese (10.000/giorno); Pro 25 $; Business 50 $. Ogni chiamata conta, anche se in errore. **La chiave è la stessa del live di produzione**: un download in blocco consuma la quota del sabato.
- Endpoint documentati: `leagues`, `leagues/{id}`, `teams/{id}`, `teams/{id}/squad` (id, nome, ruolo, maglia, nazionalità, nascita, altezza, peso), `teams/slug/{slug}`, `players/{slug}`, `players/stats?name&team_id&shirt_number` (partita per partita + totali, un giocatore per volta), `fixtures/{id}`, `/events`, `/stats` (solo squadra), `/lineups`, `standings/{leagueId}`, topscorers/topassists/topcards (con `season`).
- **Non documentato**: statistiche per giocatore di tutti i giocatori di una partita; infortuni/squalifiche; elenco stagioni disponibili; copertura specifica della Serie A.
- Uso previsto: listone, calendario, risultati, formazioni, statistiche storiche per giocatore (≈600 chiamate per tutta la Serie A).

**API-Football** (`API_FOOTBALL_KEY`): oggi usato **solo per le foto** (`lib/player-media.mjs`, con protezione quota a 85/giorno ⇒ probabile piano gratuito). Da verificare con una sonda: statistiche per giocatore e partita in una sola chiamata per partita (`fixtures/players`, da quanto ricordo), statistiche stagionali (`players?team&season`), quali stagioni consente il piano gratuito. Probabile fonte dei voti.

**Alternativa**: Sportmonks (da 29 €/mese per 5 campionati, statistiche giocatore incluse, xG a parte). Opta/Sportradar solo con ricavi.

Il proprietario è disposto a sottoscrivere piani a pagamento se servono. Prima di mostrare dati di un fornitore agli utenti: chiedere per iscritto se la licenza lo consente.

**Stato della sonda**: `scripts/probe-sportapi.mjs` (max 25 chiamate, chiave da `SPORTAPI_KEY`, scrive in `.preview-samples/sportapi/`, ignorata da git, riassunto delle forme in `00-riassunto.txt`). **Provata solo con dati finti, mai con la chiave vera.** Francesco la lancia in PowerShell: `$env:SPORTAPI_KEY="…"; node scripts/probe-sportapi.mjs`. Serve una sonda gemella per API-Football (stesso schema: budget fisso, sola lettura, nessuna chiave stampata).

## 8. Piano

| Periodo | Fase |
|---|---|
| Nov 2026 | Sonde dati; decisioni sulle regole; schema `fanta`; motore regole e motore voti con test |
| Nov–dic | **Demo verticale** (vedi §9) |
| Gen–feb 2027 | Leghe, rose, formazioni, calendario, classifiche, notifiche, asta; adattatori dei fornitori |
| Mar 2027 | Beta chiusa con le leghe di Francesco sulle giornate rimaste |
| Apr–mag 2027 | Apertura graduale, calibrazione voti |
| Estate 2027 | Listone e quotazioni 2027/28, asta, lancio pieno (agosto) |

## 9. Demo (da costruire nell'anteprima isolata)

Pagina in cui si sceglie una partita passata e si vedono: statistiche di ogni giocatore → voto base → fantavoto con ogni bonus/malus riga per riga → spiegazione («Perché 6,5?») → modificatore difesa su una formazione di prova; più una mini-lega di 4 squadre con una giornata calcolata. Dati in RAM, nessuna chiamata esterna. Francesco fornirà i dati (esportazioni o campioni scaricati dalle sonde).

## 10. Primi compiti per Claude Code (in ordine)

0. Leggere `docs/RILASCIO.md`, `CHANGELOG.md`, `lib/db.mjs`, `netlify/functions/api.mjs`, `scripts/dev-isolated.mjs`; eseguire `npm test` come base di partenza e annotare lo stato.
1. **Dati**: quando Francesco ha lanciato la sonda SportAPI, leggere `.preview-samples/sportapi/`, scrivere `docs/FANTA-DATI.md` con le forme reali (campi, ruoli, id Serie A, copertura, quote usate). Preparare e far lanciare la sonda API-Football.
2. **Fondazione**: struttura `fanta/`, migrazioni dello schema `fanta` (verificare prima come `lib/db.mjs` crea oggi le tabelle e adottare lo stesso meccanismo o proporne uno), test dello schema.
3. **Motore regole** (puro) con test «golden» su casi scritti a mano: ogni evento, modificatore difesa ai bordi delle fasce (5,99 / 6,00 / 6,49 / 6,50 / 6,99 / 7,00), meno di 4 difensori, senza voto, regole per lega.
4. **Motore voti** (puro): input = statistiche normalizzate, output = voto base + scomposizione; interfaccia dello strato AI con implementazione finta; armatura di calibrazione su stagione passata.
5. **Formato interno** unico per partite/giocatori/statistiche/eventi, e adattatori per ciascun fornitore (con budget di chiamate, timeout, nessun dato sensibile nei log).
6. **Valutazione** del listone (§6) e pagina di controllo per correzioni manuali dei ruoli.
7. **Demo** (§9) nell'anteprima isolata.
8. Poi: interruttore Bar | Fanta nella shell, `fanta-api`, leghe, rose, formazioni con scadenza, calendario, classifiche, notifiche, asta.

Criterio generale: ogni passo con test, `CHANGELOG.md` aggiornato sotto Unreleased, nessuna modifica al comportamento del Bar senza motivo, nessun rilascio.

## 11. Domande aperte (da chiedere a Francesco quando servono)

- Rigore parato / sbagliato: +3 / −3 come nel Classic?
- Senza voto: soglia di minuti? «6 politico»?
- Modificatore difesa: portiere + 3 migliori difensori, solo con ≥ 4 difensori?
- **Da punti a gol**: soglie come nel Classic (66 = 1 gol, +6 per gol) o somma dei punti? Non è ancora stata discussa.
- Struttura squadra: 25 giocatori in rosa? budget 500 crediti? moduli ammessi? panchina e sostituzioni? bonus panchina?
- Calendario: andata/ritorno all'italiana? spareggi/tie-break? mercato di riparazione?
- Come parte una lega in beta a metà stagione: asta lampo? quotazioni da dati 2026/27?
- Sportmonks o API-Football (piano) per i voti dopo le sonde.
- Verifica legale su «Fantacalcio» nel nome.

## Prompt di avvio per Claude Code

> Leggi `docs/FANTA-PROGETTO.md` e rispetta i vincoli del §2. Parti dai compiti del §10: prima il punto 0 (lettura e `npm test` di base), poi proponimi in poche righe come intendi fare la fondazione (punto 2) prima di scrivere codice. Non committare, non fare push e non rilasciare nulla senza mio OK.
