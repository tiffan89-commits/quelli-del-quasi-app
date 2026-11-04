# Verifica e rilascio 0.26.0

Data: 31 ottobre 2026. Progetto: `work/quelli-del-quasi-rilascio`.

## Ambito e autorizzazioni

La parte A di Claude è stata isolata nel commit 31fec81; il nuovo profilo è nel commit 9fcdd67 e le schede aggiuntive nel commit 6ce4f36. Il proprietario ha confermato che anche queste modifiche successive sono richieste e ha autorizzato il rilascio diretto Netlify, come eccezione al percorso PR/staging poiché non esiste un remote Git. Le parti B e C sono revisionate separatamente. Nessun push, modifica delle chiavi o copia del DB pubblico nelle prove.

La Home mantiene la giornata corrente e «Segui in diretta» mentre mancano risultati finali Serie A; mostra la prossima schedina soltanto dopo tutti i finali. Le schedine Fanta e Serie A restano separate; chat nel pannello flottante. Il selettore lega resta sempre visibile secondo l'ultima consegna.

## Immagini e migrazione dichiarata

- Venti stemmi: 761.655 byte originali contro 81.972 byte WebP complessivi; tutti sotto 8.192 byte, fino a 128×128, nomi con hash.
- Stanze: miniature 240×300 / 480×600 e versione completa originale 640×800 ricodificata. Nessun ingrandimento artificiale. La Home usa priorità alta; liste e catalogo usano miniature responsive; sezioni chiuse e squadra non visibile non avviano foto.
- Ritratti: WebP entro 160×214, senza ingrandimento; gli originali più piccoli rimangono validi. Dimensioni dichiarate, massimo sei download urgenti nei dettagli, due in coda idle ordinaria.
- Codec @jsquash PNG/JPEG/WebP via WebAssembly, senza dipendenze native. Provati tramite il bundler Netlify e con esecuzione del codec nel pacchetto estratto: PNG 65.777 byte → WebP 16.972 byte. Tutti i 12 bundle Functions contengono i sei WASM e il contesto di rilascio; i due worker Chromium mantengono i propri binari.
- Migrazione dei soli dati: il normale batch ritratti converte al massimo 20 record per esecuzione, con marcatore `portrait-webp-160-v1`; una seconda esecuzione non riscrive i record già convertiti. Nessuna modifica dello schema. I vecchi digest/URL rimangono leggibili. Nessuna acquisizione dal fornitore per questa conversione. Con API immagini non configurata il batch non parte.
- Cache lunga immutable solo su asset statici con hash; revalidazione di HTML/JS/CSS e scadenza media delle immagini legacy. Le foto DB mantengono autenticazione ad ogni richiesta, filtro sessione per hash e piccola cache dei byte in memoria.

## Misura mobile prima/dopo

Lighthouse 13.6.0, Edge headless, viewport 375×812, DPR 2, cache fredda, CPU ×4, Fast 4G: RTT 40 ms, download 4096 Kbps, upload 3072 Kbps. Singole esecuzioni indicative, non medie statistiche né misure di utenti reali. Frontend iniziale A (31fec81) contro versione finale; stesso harness sintetico con 17 membri, due Fanta e ritratti pubblici identici. Nessuna API a pagamento chiamata dalla prova. Gli endpoint locali rispondono senza compressione HTTP: i byte totali non rappresentano la compressione CDN di produzione.

| Vista | Richieste prima → dopo | Byte totali prima → dopo | Byte immagini prima → dopo | Ultima immagine pronta, ms | LCP ms prima → dopo |
|---|---:|---:|---:|---:|---:|
| Home | 67 → 70 | 754.159 → 777.316 | 31.107 → 27.958 | 2.498 → 2.193 | 2.540 → 2.470 |
| Lega / I Quasi | 76 → 79 | 1.091.982 → 859.099 | 367.536 → 108.347 | 4.342 → 3.128 | 909 → 703 |
| Io / guardaroba | 67 → 70 | 755.559 → 778.716 | 31.107 → 27.958 | 2.719 → 2.149 | 920 → 800 |
| Dettaglio / formazioni | 81 → 84 | 1.060.203 → 830.181 | 329.902 → 73.450 | 3.381 → 3.236 | 2.447 → 2.517 |

Le immagini calano del 10% nella Home/Io, del 70,5% nella galleria e del 77,7% nelle formazioni. Il numero di immagini richieste resta 2/11/2/15; non vengono scaricate immagini aggiuntive. Le tre richieste di codice aggiunte sono canale live, renderer e CSS delle nuove schede del Bar: il totale Home/Io cresce di circa 23 KB. Il LCP delle formazioni non migliora in questa singola prova, anche se i byte calano nettamente. Non si dichiara un miglioramento universale.

Report JSON grezzi e configurazione: `work/perf-before-*.json`, `work/perf-after-*.json`, `work/perf-config.cjs`, `work/perf-summary.json` nella cartella di lavoro esterna al repository. «Ultima immagine pronta» usa networkEndTime; non coincide con LCP. I ritratti già piccoli non vengono ingranditi per simulare maggiore nitidezza. Verifica visiva eseguita anche nel browser mobile e desktop; non sostituisce un test su dispositivo fisico.

## Canale live

Riprodotto il difetto precedente con richiesta senza risposta: resultsLoading rimaneva true, nessun secondo tentativo né listener di ripresa. Nuovo canale unico DB, 60 s con jitter, AbortController + watchdog 10 s, mai due richieste concorrenti, pausa offline/nascosto, ripresa immediata online/visibile, backoff fino a circa 5 min. ETag privato/304. La rotta non chiama provider e non scrive nel DB neppure per errori di autenticazione.

Patch mirate di punteggio, eventi, esiti, valori classifiche, riepiloghi e Home. Formazioni e immagini aperte restano intatte; nessun render globale dal polling. Indicatore aria-live discreto. Le altre letture su apertura delle viste restano DB; non si introducono aggiornamenti automatici di chat o formazioni.

Prova nel browser: gol sintetico 0–0 → 1–0, outerHTML delle formazioni e scroll del dettaglio invariati. Dopo tutti i finali, la Home passa automaticamente da Giornata 10 / Segui in diretta a Giornata 11 / Compila la schedina. Test di regressione per timeout, backoff, ripresa, sovrapposizione, ETag, separazione delle leghe, conservazione nodi e cambio colore delle mini schedine del Bar.

## Anteprima locale

`npm run dev` avvia http://127.0.0.1:8780 con utente `anteprima`, password `QuasiLocale26!`, dati solo in RAM. Il backend usa gli handler reali con store sintetici; nessun DB, email, push o job esterno. Le vecchie anteprime persistenti non sono caricate. Al riavvio i dati fittizi si ricreano. Il launcher aggiornato è in outputs/Avvia-anteprima-v2.ps1. Il percorso 127.0.0.1 è locale al computer, non raggiungibile dal telefono con lo stesso URL.

## Esito dei controlli

- Suite completa e controllo sintattico prima del rilascio; risultati finali nel riepilogo di pubblicazione.
- SQL live eseguito con PostgreSQL compatibile PGlite su dati sintetici: nessuna formazione nel payload. Nessun DB di produzione consultato.
- Browser 375 px e desktop: Home, Lega/Classifica/I Quasi/Storico/Regolamento/Admin, moduli Entra/Crea, Io/guardaroba/editor, Fantacalcio del Quasi, dettaglio con figurine, profilo del pronosticatore, invito e 404. Controllo footer e safe area; nessuna email o notifica inviata.
- Feature flag e changelog aggiornati senza modificare a mano la versione. Versione/tag generati dallo script semver su staging locale; main non modificato.

Il rilascio include frontend e tutte le Functions, dopo build esplicita del contesto production. Il deploy ID e i controlli HTTP di produzione saranno registrati nel riepilogo finale.

Verifica finale della candidata: **447 test superati, zero fallimenti**; sintassi verificata su **209 file JavaScript**. Incluso anche l'ultimo ritocco Claude 52b06cd alle schede del Bar; rimosso l'import duplicato nel test condiviso. Le misure Lighthouse sopra precedono questo piccolo ritocco CSS, senza variazioni alla strategia o ai file immagine. Le immagini di prova mobile/desktop sono in outputs/0.26-*.png.

## Chiusura tecnica 0.26.1

La ripetizione della suite sul tag 0.26.0 ha intercettato un test preesistente dipendente dall'orologio: due ZIP sintetici identici avevano timestamp diversi attraversando il cambio di secondo. Il file restituito dal download era corretto. È stata fissata soltanto la data della fixture, mantenendo il confronto byte per byte; nessun cambiamento al download reale. Per conservare immutabile il tag già creato, il rilascio pubblico viene chiuso come **0.26.1** con lo script patch. La 0.26.0 non è stata pubblicata.
