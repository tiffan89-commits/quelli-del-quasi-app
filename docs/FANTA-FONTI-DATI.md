# Fanta · da dove arrivano i dati

Stato al 31/10/2026. Prezzi: fonti pubbliche (la documentazione ufficiale di API-Football è dietro una verifica anti-bot). Campi e limiti: **verificati con la sonda** il 31/10/2026, piano gratuito, partita Lazio–Lecce 0–1 della stagione 2024/25 (vedi «Risultati della sonda»). Le risposte grezze sono in `.preview-samples/api-football/`.

## Risultati della sonda (31/10/2026)

**Confermato**
- Serie A è `league=135`. Copertura dichiarata per 2024, 2025 e 2026: eventi, formazioni, statistiche di squadra e **statistiche dei giocatori**, infortuni.
- `fixtures/players?fixture=` dà **entrambe le squadre in una chiamata**: 49 giocatori, di cui 31 in campo. Per ogni giocatore in campo:
  - minuti, posizione (G/D/M/F) e **rating del fornitore** (es. Falcone 9.2 con 8 parate);
  - tiri totali e in porta, gol, assist, gol subiti, parate;
  - passaggi totali, chiave e riusciti; contrasti, intercetti e blocchi; duelli totali e vinti; dribbling e falli;
  - cartellini, rigori segnati, sbagliati e parati.
- **`fixtures?id=` dà tutto in una chiamata**: partita, eventi, formazioni, statistiche di squadra e giocatori. Nel live basta quindi **1 chiamata al minuto per ogni partita in corso**.
- `fixtures/lineups` dà il modulo, la posizione in campo di ogni titolare (`grid` "riga:colonna") e i **colori delle maglie** (`primary`/`number`/`border`, giocatori e portiere; solo tinta unita, senza strisce).
- `players/squads` dà la rosa con il ruolo: Goalkeeper/Defender/Midfielder/Attacker, cioè P/D/C/A senza conversioni. Gli infortuni della stagione 2024 sono 3.036 righe con tipo e motivo.

**Da sapere per il backend**
- I valori a zero arrivano come `null`: per esempio un giocatore senza tiri ha `shots.total: null`. Vanno trattati come 0.
- `passes.accuracy` è il **numero** di passaggi riusciti, non la percentuale (Mandas: 14 su 18). La percentuale va calcolata.
- I panchinari non entrati compaiono con `minutes: null`.
- `fixtures?live=` accetta solo `all` o una lista `id-id`: si usa `all` e si filtra per `league.id`.

**Limiti del piano gratuito** (bloccanti per l'uso reale)
- **Solo le stagioni 2022–2024**. La 2025 e la 2026 sono rifiutate: «Free plans do not have access to this season».
- Niente parametro `ids` (più partite in una chiamata).
- **10 chiamate al minuto** e 100 al giorno.

Quindi: il piano gratuito va bene per costruire e calibrare il motore voti sulla stagione 2024/25. Per la stagione in corso, il live e la beta serve il piano a pagamento (Pro).

### Con il piano Pro (attivato il 31/10/2026, scade 01/12/2026)

Sonda ripetuta sulla stagione 2026/27, partita di prova Milan–Inter 3–1 (31/10/2026):
- **Stagione 2026 leggibile**: 93 partite finite (giornate 1–9). Limiti: 7.500 chiamate/giorno, 300/minuto.
- **`fixtures?ids=` funziona e include i giocatori**: 3 partite in una chiamata, ognuna con eventi, formazioni, statistiche e giocatori di entrambe le squadre. Nel live basta quindi **1 chiamata al minuto per tutte le partite in corso** (fino a 20), circa 120–150 chiamate per una giornata intera.
- Nel 2026 i valori a zero arrivano come `0`, non più `null`. Il rating ha anche 2 decimali (Maignan 8.44 con 7 parate).
- **`goals.conceded` è vuoto per tutti, portieri compresi.** Il malus «gol subito −1» va quindi calcolato dagli eventi: i gol della squadra avversaria segnati mentre il portiere era in campo, contando i cambi da `events` di tipo `subst`.
- `penalty.saved` e `penalty.missed` sono vuoti: rigori parati e sbagliati vanno presi dagli eventi (`Goal / Missed Penalty`, dettagli da verificare su una partita che li ha).
- I colori delle maglie nelle formazioni del 2026 sono `null`: non ci si può contare, per questo resta la tabella `maglie.mjs`.
- Giocatori senza posizione (`games.position` vuoto) solo per chi non è entrato.
- **Squadre della Serie A 2026/27 secondo API-Football**: Atalanta, Bologna, Cagliari, Como, Fiorentina, Frosinone, Genoa, Inter, Juventus, Lazio, Lecce, Milan («AC Milan»), Monza, Napoli, Parma, Roma («AS Roma»), Sassuolo, Torino, Udinese, Venezia. Maglie e dati finti sono aggiornati di conseguenza.
- Infortuni 2026: 1.262 righe.

**Ancora da misurare: la diretta.** Alla sonda non c'era nessuna partita in corso. Per vedere ogni quanto cambiano davvero le statistiche c'è `scripts/probe-api-football-live.mjs`: segue una partita, la legge ogni 30 secondi (massimo 300 chiamate) e annota quando cambiano statistiche, eventi e risultato. Dopo il fischio finale fa ancora 3 letture a 20 minuti di distanza, per vedere le correzioni del fornitore. Prima occasione: **Como–Venezia, domenica 1/11/2026 alle 12:30** (id 1550180).

```
node scripts/probe-api-football-live.mjs 1550180
```

Si può lanciare anche ore prima: aspetta da solo il calcio d'inizio. Il riassunto finisce in `.preview-samples/api-football-live/1550180/00-live.txt`.

## Raccomandazione

| Cosa | Fornitore | Piano | Costo |
|---|---|---|---|
| Statistiche per giocatore e partita, live ogni minuto (base dei voti) | **API-Football** (api-sports.io) | **Pro**: 7.500 richieste/giorno, tutti gli endpoint e tutte le competizioni | **19 $/mese**, prepagato, senza rinnovo automatico |
| Risultati e live del Bar | SportAPI.ai (già in produzione) | invariato | invariato |
| Spiegazione «Perché 6,5?» e correzione ±0,5 | Anthropic (modello piccolo, famiglia Haiku) | a consumo | pochi euro a stagione (~220 chiamate a giornata) |

Il piano gratuito di API-Football (100 richieste/giorno) basta per la sonda, non per il live: una sola giornata di Serie A ne consuma circa 1.000. Ultra (29 $, 75.000/giorno) e Mega (39 $, 150.000/giorno) servono solo se un giorno si aggiungono altri campionati.

SportAPI.ai da solo **non basta** per i voti: le statistiche di tutti i giocatori di una partita non sono documentate (`/stats` è solo di squadra).

**Alternativa**: Sportmonks, dal piano Starter a **29 €/mese** (5 campionati a scelta, 2.000 chiamate/ora per entità), con statistiche dei giocatori, formazioni e rating aggiornati ogni minuto; xG a parte. Il piano gratuito non include la Serie A, quindi non si può provare gratis.

## Dato per dato (API-Football)

Serie A: `league=135` (confermato). Stagione 2026/27: `season=2026` (solo con piano a pagamento).

| Cosa vedi nell'app | Endpoint | Quando si chiama | Chiamate |
|---|---|---|---|
| Listone: giocatori, ruolo, squadra, foto | `players/squads?team={id}` | 1 volta a settimana + finestre di mercato | 20 a giro |
| Statistiche stagionali (quotazioni, nuovi arrivi) | `players?league=135&season=2026&page={n}` | 1 volta al giorno | ~30–40 (20 giocatori per pagina) |
| Calendario e orari di Serie A | `fixtures?league=135&season=2026` | 1 volta al giorno | 1 |
| Infortunati e squalificati | `injuries?league=135&season=2026` | 1 volta al giorno | 1 |
| Formazioni ufficiali | `fixtures/lineups?fixture={id}` | da circa 40 minuti prima del calcio d'inizio | 1 per partita |
| Quali partite sono in corso | `fixtures?live=all` (filtrare `league.id=135`) | ogni minuto durante le finestre di gioco | 1 per minuto |
| **Voto in diretta**, risultato, eventi e formazioni insieme: minuti, tiri, passaggi chiave, contrasti, intercetti, duelli, parate, gol subiti, rigori, cartellini, rating del fornitore | `fixtures?ids={id}-{id}-…` (fino a 20 partite; ognuna con eventi + formazioni + giocatori di entrambe le squadre) | ogni minuto mentre almeno una partita è in corso | ~150 a giornata (~1.000 con una chiamata per partita) |
| Voto ufficiale | lo stesso `fixtures?id` (oppure `fixtures/players`) | 2–3 volte nelle ore dopo la partita, poi si congela | ~30 a giornata |
| Calibrazione dei voti sulla stagione passata | `fixtures/players?fixture={id}` per le 380 partite del 2025/26 | una volta sola | 380 |

**Ancora da verificare**: ogni quanto si aggiornano davvero le statistiche dei giocatori durante una partita. Le fonti dicono ogni minuto; va misurato con la sonda live.

Con `fixtures?ids=` (confermato con il Pro) il live si riduce a 1 chiamata al minuto per tutte le partite in corso.

Budget del giorno peggiore (domenica con 6–7 partite), usando `ids`: qualche centinaio di chiamate, contro le 7.500 del piano Pro.

## Come diventa il voto

1. Ogni minuto un job sul server (non il browser) legge `fixtures/players` delle partite in corso e salva i numeri nel database `fanta`.
2. Il motore voti parte da 6 e sposta il voto con i numeri confrontati con la media del ruolo. Nei primi 25 minuti giocati resta 6. Gol e assist non toccano il voto: sono solo bonus (+3 e +1).
3. Dopo mezz'ora di gioco, e a fine partita, lo strato AI può correggere di ±0,5 e scrive il «Perché». Cita solo i numeri ricevuti.
4. Fine partita: provvisorio. Qualche ora dopo, quando il fornitore ha corretto le statistiche: ufficiale, poi congelato.
5. Il browser legge solo la nostra API, ogni minuto. Il numero di utenti non cambia le chiamate al fornitore.

## Prima di pagare: la sonda

Pronta: `scripts/probe-api-football.mjs` (gemella di `scripts/probe-sportapi.mjs`). Sola lettura, massimo 25 chiamate (ne usa circa 13–17), chiave da `API_FOOTBALL_KEY`, risposte in `.preview-samples/api-football/`, riassunto in `00-riassunto.txt`. Non stampa né salva la chiave, e da `/status` toglie nome ed email dell'account. Provata solo con `--dry` (dati finti). Controlla, con ✓/✗ campo per campo, quello che serve al motore voti. Prova:
- `leagues?id=135`, che dice anche id, stagioni e copertura del piano;
- `fixtures/players` su una partita già giocata;
- `fixtures?ids=` con 2–3 partite;
- `players/squads` di una squadra;
- `injuries`.

Il piano gratuito basta per la sonda. Per provare il live serve un mese di Pro (19 $, nessun rinnovo automatico).

Prima di mostrare agli utenti dati di un fornitore (in particolare il loro rating): chiedere per iscritto se la licenza lo consente (vedi `FANTA-PROGETTO.md` §7).

## Fonti consultate

- Prezzi e piani API-Football: [api-sports.io](https://api-sports.io/sports/football), [SportsAPI.com](https://sportsapi.com/api-directory/api-football/)
- Campi di `fixtures/players`: [Educative](https://www.educative.io/courses/soccer-api-football-python/fixtures-players-statistics), [KNIME/API-Sports](https://nodepit.com/node/com.apisports.knime.football.nodes.query.players.PlayerStatsNodeFactory)
- Frequenza di aggiornamento: [API-Football, «How to save calls to the API»](https://www.api-football.com/news/post/how-to-save-calls-to-the-api)
- Sportmonks: [sito ufficiale](https://www.sportmonks.com/football-api/), [FAQ](https://docs.sportmonks.com/v3/api-faq)
