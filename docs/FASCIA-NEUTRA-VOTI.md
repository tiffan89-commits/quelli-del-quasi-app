# Fascia neutra delle statistiche — prova locale

La stessa regola è applicata al contributo nel voto e al colore nel dettaglio giocatore.

- **Giallo:** prestazione vicina al riferimento del ruolo, contributo statistico zero. La neutralità è simmetrica, sopra e sotto il riferimento.
- **Rosso / verde:** scarto oltre la fascia. Viene valutata solo la parte eccedente, così appena fuori dalla fascia il contributo rimane piccolo e cresce gradualmente.
- I dati assenti restano non disponibili e non diventano zeri.

Per conteggi e volumi, il margine è il maggiore tra il **10% del riferimento atteso** e **un quarto della scala di variabilità del ruolo**, corretta per i minuti giocati. Il confronto conserva la correzione per possesso/opportunità già presente nel motore.

Per le percentuali, il margine è il maggiore tra **2 punti percentuali** e **un quarto della scala di variabilità del ruolo**. La riduzione di affidabilità per pochi tentativi continua ad applicarsi al contributo fuori dalla fascia.

Esempi: 1 contrasto rispetto a 1,21 con scala 1,5 è neutro; 86,49% rispetto a 84,31% con scala di 10 punti percentuali è neutro. Uno scarto importante continua a pesare. Se tutti i contributi individuali sono nella fascia, il voto individuale resta esattamente 6; contesto, rating ed episodi continuano a essere valutati separatamente.

Bonus/malus, sostegno dei gol, rigori, soglie minime e arrotondamenti non sono stati cambiati. La fascia fa parte della configurazione con impronta propria, quindi il normale batch distingue i nuovi calcoli da quelli precedenti.

## Applicazione e verifiche

Solo nella copia locale sono state ricalcolate **100 partite e 4.760 prestazioni**, senza chiamate esterne, conservando le revisioni precedenti. Una giornata attiva è stata ricalcolata con il percorso ordinario del motore. Il controllo delle impronte conferma account, crediti e schedine Bar invariati e nessuna modifica alle formazioni salvate dagli allenatori. Dettagli in `LOCAL-NEUTRAL-VOTE-REBUILD.json`.

**533 test passati, zero errori.** I nuovi test coprono neutralità effettiva sul voto, colori coerenti, progressività sui limiti, dati assenti, pochi minuti e differenze sostanziali. Restano verdi i test delle regole gol/rigori e degli arrotondamenti.

File: `public/src/fanta/stat-comparison.mjs`, `fanta/statistical-votes/config.mjs`, `individual.mjs`, `model.mjs`, `public/src/fanta/giornata.mjs`, `public/fanta.css`, `test/neutral-statistics.test.mjs`, `scripts/local-neutral-vote-rebuild.mjs`, `CHANGELOG.md`.

Nessun deploy Netlify e nessun accesso al DB di produzione.
