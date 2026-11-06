# Laboratorio del Quasi — 6 novembre 2026

Anteprima: https://quellidelquasi.com/laboratorio/

Registrazione di prova: https://quellidelquasi.com/laboratorio/accesso/#registrati

## Isolamento

Aggiornamento: il sito principale è stato pubblicato alla 0.29.43. Il laboratorio rimane isolato e usa tre esportazioni sportive pubbliche già archiviate; non carica credenziali, non interroga né modifica il database di produzione e non invia email. Le aste vivono in memoria, separate per cookie di prova, e scadono dopo due ore. Le partite sono replay degli eventi originali; le statistiche finali non sono anticipate durante il replay. Il rilascio principale e il ricalcolo controllato sono documentati in outputs/release-0.29.43/RILASCIO.md; nessun deploy Netlify.

Caddy inoltra soltanto /laboratorio/* a 127.0.0.1:8898; il resto rimane su 8845. Copia della configurazione precedente: C:/ProgramData/QuelliDelQuasiServer/config/Caddyfile.before-laboratorio-20261106.

## Prove

- Dirette: Riparti, Pausa e Vai ai finali controllano il replay condiviso. Toccare una maglia apre la pagella; gli aggiornamenti conservano gli accordion e la selezione della squadra.
- Asta single player: Avvia, chiama quando tocca a te, rilancia o passa. Gli altri tre allenatori sono computer. Salta l'attesa è uno strumento della sola demo. Le credenziali del gioco non servono.
- Il nuovo voto: pagella di Lorenzo Palmisani in Frosinone–Como 2–0. Dati archiviati: 7 parate, rating 10, Como 2,12 xG e 8 tiri nello specchio. Voto candidato 9: base 6, tra i pali +2,2, distribuzione −0,1, porta inviolata +0,5, migliore rating +0,5, arrotondamento/limite −0,1.
- Registrazione: soltanto email e password. Nick iniziale dalla parte prima della @, modificabile; nessuno username creato. Gli account esistenti mantengono il vecchio accesso. In questa anteprima il modulo è simulato e non invia email.

## Portieri: significato e limiti

Gli xG avversari indicano la pressione, non la difficoltà di ogni singola parata. Nel proxy convergono volume, efficacia, pressione e rating. Se entrambi sono disponibili, la pressione combina xG (65%) e tiri nello specchio (35%); il dato mancante non viene inventato. Con xGOT documentati e presenza completa viene usata la qualità post-tiro. Porta inviolata e contributo alla vittoria con un gol subito danno un unico sostegno, al massimo +0,5. Nome e ID del portiere non entrano nella calibrazione. L'esempio è una verifica, non una validazione statistica su un intero campionato.

## Push predisposto nel prodotto

runtime/sports-socket.mjs condivide snapshot DB ogni 60 secondi per lega/giornata. La personalizzazione avviene in memoria; nessuna chiamata ai fornitori nasce da un client. I controlli di validità delle sessioni sono aggregati per tutti i dispositivi. Il canale si ferma senza spettatori. Questa integrazione resta nei sorgenti candidati, non nel servizio principale, fino all'approvazione del rilascio.

## Gestione

Processo: scripts/live-lab-server.mjs. PID in outputs/live-lab/server.pid, log in server.log e server-error.log nella stessa cartella. Avviato nascosto, resta disponibile finché PC e processo sono accesi; non è un servizio permanente.

Per fermare solo la prova verificare che il PID appartenga a questo script. Per rimuovere il collegamento pubblico ripristinare il Caddyfile precedente, validarlo e ricaricarlo. Non cambiare i quattro servizi del sito principale.
