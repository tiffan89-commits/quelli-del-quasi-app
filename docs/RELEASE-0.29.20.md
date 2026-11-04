# Rilascio 0.29.20

Le quote delle partite reali passano ad API-FOOTBALL. Nessuna nuova fonte per le quote delle competizioni Fanta private, che continuano con il modello proprietario.

- API /odds, selezione per ID partita + campionato 135 + stagione. Mercati primo tempo, handicap e linee diverse da 2.5 ignorati. Mediana dei prezzi bookmaker, famiglie di esiti complete, duplicati e conflitti respinti. Una sola risposta per più leghe/utenti; paginazione limitata e riserva API preservata.
- Installazione una volta nel piano operativo esistente, senza riavviare gli altri job. Prima acquisizione entro 14 giorni dal kickoff; verifica solo delle quote mancanti ogni 3 ore. Dopo la prima acquisizione, aggiornamento al massimo ogni 7 giorni per partita, fino al kickoff. Un unico slot ricorrente nel piano, senza migliaia di job accumulati.
- Piano e ultimo report in cache condivisa; nessuna chiamata DB/provider se le quote sono complete e non ancora da aggiornare. Scritture JSONB limitate alle quote dei match interessati; identiche quote e fonti non riscrivono il DB.
- Salvataggio delle quote accettate anche sulle schedine Serie A. Per le schedine già salvate, prima di aggiornare le offerte si conserva il prezzo originario da match/quote congelate. Se una schedina non è riconciliabile, l'intera transazione viene annullata e segnalata. Scelte, puntate, punti e saldi non vengono alterati.
- Rimossi client The Odds API, vecchio budget mensile, vecchio recupero dei finali e generazione automatica Poisson delle quote Serie A. Rimosso il ramo quote ogni 6 ore dal vecchio sync. I vecchi snapshot rimangono nello storico e restano riconoscibili come tali.
- Le aspettative prepartita del motore riconoscono anche la nuova provenienza API-FOOTBALL; nessuna modifica alla formula dei voti o ricalcolo storico. Nessuna migrazione SQL.

Le prove coprono parser, paginazione, validazione temporale, calendario/cadenza, cache inattiva, scritture mirate, idempotenza, prezzi accettati e rollback atomico dei conflitti. I test dei vecchi client rimossi sono stati sostituiti; restano quelli di risultati, liquidazioni, UI e sicurezza.

Pubblicato su https://quellidelquasi.com. Deploy 6ae9e089f3d5015304f450a8. Suite completa: 502 test superati dopo il ritiro dei test dei vecchi client. Ulteriori 43 controlli mirati superati sulle rifiniture. Il primo job produttivo ha completato 4 chiamate API-FOOTBALL, aggiornando 10 incontri e 100 quote, senza conflitti. Nessuna chiave copiata o inserita nel frontend.
