# Motore statistico v2

Modello `quasi-statistical-v2.2.0`, coefficienti in
`fanta/statistical-votes/config.mjs`. La firma include anche la configurazione.
Il rating del fornitore viene rimosso prima di normalizzazione, hash e calcolo;
l'AI non cambia voti e non viene chiamata da questo motore.

Pipeline pura: normalizzazione → ruolo/presenza → componente individuale →
contesto → episodi (gol/rigori) → minimi garantiti → voto grezzo → soglie di arrotondamento → bonus fantacalcio.
I valori mancanti restano mancanti. `passes.accuracy` numerico è interpretato
come passaggi riusciti, non percentuale; il dettaglio visualizza la percentuale
con al massimo un decimale. I blocchi non verificati non vengono usati.

Pesi per ruolo: P 60% parate/20 distribuzione/20 difesa; D 40 difesa/25 duelli/
25 distribuzione/10 creazione; C 30 distribuzione/30 creazione/25 difesa-duelli/
15 tiro; A 40 tiro/25 creazione/25 dribbling-duelli/10 difesa. Sottoruoli solo
se uno schieramento completo e verificabile li sostiene.

Le categorie confrontano mediana e dispersione robusta del ruolo con shrinkage
per minuti/tentativi ridotti. Le poche azioni di un subentrato non vengono
estrapolate a 90 minuti; categorie correlate sono aggregate e limitate. I dati
storici rispettano il cutoff temporale; il baseline del kickoff viene fissato
alla prima elaborazione per evitare che backfill tardivi cambino un live in corso.
In assenza di un campione sufficiente si usano prior dichiarati e confidenza minore.

Le quote sono quelle già archiviate prima del kickoff. Ogni terna completa 1X2
è privata del margine; si aggregano le probabilità mediane e si normalizzano.
`EP=3*pVittoria+pPareggio`, `S=(puntiEffettivi-EP)/3`. Quote non valide, incomplete
o raccolte dopo il kickoff non sono trattate come pre-partita. Un'eventuale stima
ha affidabilità inferiore. Il calcolo non cambia quote o schedine accettate.

Qualità collettiva:

`Q=.65*tanh(diff_xG/1.5)+.25*diff_tiri_porta/(somma+2)+.10*diff_tiri/(somma+4)`.

L'assenza di xG non equivale a un pareggio e non genera xG inventati. Il possesso
non dà un bonus autonomo. Presenza, stato della gara all'ingresso/uscita, espulsioni,
affidabilità e prestazione individuale modulano un contesto limitato da
`.75*tanh(z)`. Un ribaltamento successivo all'uscita incide molto meno. Nessun voto
minimo per una vittoria e nessun tetto a 6 per una sconfitta. I bonus/malus
fantacalcio restano separati. Dalla 2.1, su richiesta del prodotto, un gol
segnato sostiene anche la prestazione tecnica secondo la regola sotto, aggiornata nella 2.2.

## Gol, rigori e arrotondamento (2.2)

Il primo gol segnato aggiunge **0,5 al grezzo, anche nella sconfitta e per una
rete non decisiva**. Basta un gol documentato dalle statistiche individuali;
la sequenza degli eventi, quando coerente, permette di descriverlo come rete
del pareggio, del vantaggio o vincente. L'ordine di eventi allo stesso minuto
non viene inventato. Autogol, annullamenti, rigori sbagliati e shootout non
sono reti segnate dal giocatore. Il live applica le stesse regole, sui dati disponibili.

Le altre reti dello stesso giocatore partono da 0,2 e dimezzano progressivamente
il peso. Il contributo è moltiplicato per qualità individuale (0,4–1,2),
difficoltà prepartita (0,6–1,25, neutra senza quote verificate), risultato
(vittoria 1 / pareggio 0,8 / sconfitta 0,65), margine assoluto finale (inverso, minimo 0,25) e importanza
(1 se importante / 0,5 se altra rete). Totale massimo 0,9. Il primo +0,5 è fisso;
fattori e contributi successivi rimangono nell'audit. Il +3 fantasy resta
applicato una sola volta, dopo il voto tecnico.

Chi segna ha **voto tecnico minimo 6**; il portiere che para un rigore ha
**minimo 6,5**. I minimi si applicano dopo gli altri contributi, prima
dell'arrotondamento, e prevalgono anche se lo stesso giocatore sbaglia un rigore.
Ogni rigore sbagliato toglie **0,5 al grezzo**, separatamente dal **−3 fantasy**.
Un rigore parato non aggiunge un ulteriore mezzo punto se il voto tecnico è
già sopra 6,5: garantisce il minimo, oltre al bonus fantasy previsto. Gol e
rigori documentati consentono il voto anche in impieghi brevi o con dati
individuali mancanti: in quel caso si parte da 6, senza inventare statistiche.
Il dettaglio conserva contributo degli episodi, eventuale adeguamento al minimo
e arrotondamento, in modo che la somma ricostruisca il voto.

L'arrotondamento avviene una sola volta sul grezzo complessivo. Soglie:

| Condizione sul grezzo | Voto |
|---|---|
| 3 / 3,3 / 3,6 | 3 / 3,5 / 4 |
| 4,3 / 4,6 | 4,5 / 5 |
| Da 5,3 / **oltre** 5,6 | 5,5 / 6 |
| **Oltre** 6,2 / **oltre** 6,65 | 6,5 / 7 |
| **Oltre** 7,25 / **oltre** 7,75 | 7,5 / 8 |
| **Oltre** 8,25 / **oltre** 8,75 | 8,5 / 9 |

Le nuove soglie sono strette: 5,60 rimane 5,5; 5,600001 diventa 6;
6,20 rimane 6, 6,200001 diventa 6,5; 6,65 rimane 6,5 e 6,650001 diventa 7.
Il grezzo è fissato a sei decimali prima del confronto per evitare artefatti floating point.

## Commento della prestazione

`narrative.mjs` compone un breve commento deterministico sul giocatore, la sua
squadra, l'avversaria e il risultato effettivo. Seleziona i contributi osservati
più rilevanti, con un eventuale limite della prova, senza trasformare i numeri
in un elenco né inventare azioni. Il giudizio (sufficiente, buono, ottimo,
eccellente) riflette il voto complessivo. Gol e rigori sono descritti nel
racconto della partita, senza spiegare nel testo incrementi o minimi numerici.
Il live è descritto come provvisorio. Non usa servizi AI o chiamate
esterne. Le etichette «sperimentale» non compaiono nel dettaglio pubblico.

Il DB salva input, fonte, tempi, snapshot quote, baseline, componenti, voto grezzo,
voto arrotondato, eventi, stato e versione. Il live sostituisce il suo snapshot
corrente; finali e rettifiche ufficiali sono revisioni immutabili con predecessore.
L'importazione invariata non crea revisioni. Le correzioni cicliche A→B→A sono
supportate senza perdere il ritorno ad A. La migrazione 009 non cancella i voti vecchi.

Il dettaglio rende i contributi effettivi e distingue copertura/robustezza da
probabilità di correttezza. Il live ignora gli apporti non osservabili: può
differire dal finale, senza inventare azioni per colmare i dati.

Valutazione offline iniziale (2.0): 97 gare e 4.655 righe giocatore pubbliche, holdout temporale
dal 18/10/2026, dati successivi esclusi dai baseline. Nico Paz: 6,5, grezzo
6,721536, copertura/robustezza 0,811; quote reali archiviate il 28/10 prima del
kickoff del 01/11. Il report include tutti i numeri e controfattuali dichiarati.
Le medie dell'holdout sono P 6,159, D 5,888, C 5,728, A 5,898: segnali di bias e
limiti di campione, **non una formula validata**. Non sono stati ritoccati i
coefficienti per ottenere un voto obiettivo su Nico Paz. Con le nuove soglie
richieste, il medesimo grezzo 6,721536 diventa 7, senza cambiare i coefficienti
per forzare il vecchio 6,5. Il report rigenerato verifica la versione corrente.

Rigenerazione del report: `node scripts/report-statistical-votes.mjs`, usando solo
il dataset sportivo locale escluso da Git. Output in `outputs/statistical-votes/`.
Il rilascio attiva un backfill finito dei giocatori già scesi in campo e ricalcola
le giornate native, inclusa la 8; non tocca i pronostici del Bar. La verifica del
backfill e del conteggio aggiornato va completata sulla produzione dopo il deploy.
Ogni nuova versione/configurazione inserisce un solo job di installazione anche
nel calendario operativo già esistente, senza ripetere verifiche concluse o
resettare i lease del live. Il ricalcolo conserva le revisioni precedenti.

Rollback applicativo: non ripristinare il vecchio indice che ammetteva un solo
voto finale: cancellerebbe la possibilità di rettifica. Le revisioni vecchie sono
conservate; un rollback del modello richiede scegliere esplicitamente una chiave
di modello attiva e ricostruire risultati/riepiloghi, senza eliminare l'audit.
