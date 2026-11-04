# 0.29.0 — Leghe native e random

Base: QuelliDelQuasi-0.28.2-Sorgenti-completi02.11.zip, blob GitHub 4999557e042363c53e72985049e342ce081543b4.

## Comportamento
- Le leghe importate sono riservate a frankwood nel Fanta ed escluse dalle schedine, dai selettori e dagli aggiornamenti del Bar.
- La migrazione 012 rimuove la lega Lucas Bar B identificata da ID o nomi esatti e la competizione legacy verificata fc:2026:1366161:730462: 35 giornate, una schedina già annullata e rimborsata (20 crediti). Un controllo interrompe la migrazione se compaiono giocate non liquidate. Non cancella gli account o il catalogo condiviso.
- Il Fanta pilota ha un Bar; i nuovi Fanta random creano il Bar o si collegano al Bar esistente. Un Bar senza Fanta resta indipendente e il suo admin può crearlo.
- Le leghe random hanno squadre pari ai membri del Bar fotografati al momento della richiesta; nella creazione diretta si sceglie la taglia. Il numero massimo tecnico è 20 e il listone deve bastare per tutti i ruoli, senza duplicare calciatori.
- Generazione asincrona firmata, su richiesta, con job persistente e transazione. Lo stesso Bar o identificatore di richiesta non genera duplicati. Errori consentono un nuovo tentativo; lo stato si controlla esplicitamente, senza polling.
- I migliori giocatori sono distribuiti per fasce e ruolo; i costi sintetici di assegnazione sono proporzionati per rispettare il budget. I membri del Bar prendono casualmente una squadra libera, con protezione dalle assegnazioni concorrenti.
- Leghe random effettive, nessuna asta iniziale o scelta della rosa; solo aste di riparazione. Vietate correzioni dirette delle rose e assegnazioni manuali degli account in questa modalità.
- Schedina abilitata di default, configurabile dal presidente Fanta. Controllo relazionale aggiornato sull'invio: solo gli allenatori della lega possono giocare. Selettore leghe e giornate, giornata corrente come scelta iniziale.

## Consumi
Cache delle letture, revisioni DB, cache client, richieste concorrenti aggregate e namespace privati conservati. Nessuna nuova chiamata periodica o provider. La generazione legge il listone già nel DB; la proiezione Bar avviene una volta per lavoro. Il job di installazione pilota v2 viene eseguito una sola volta dal calendario operativo esistente.

## Rilascio
Applicare la migrazione 012 sullo stesso database dell'ultimo deploy, prima di attivare il backend nuovo. Verificare che gli ID/nome di Lucas Bar B corrispondano ai dati effettivi e che non esistano nuove tabelle dipendenti non incluse nella migrazione. Poi pubblicare frontend e tutte le Functions insieme sul progetto Netlify esistente, 4d97693c-5f83-4ad8-8789-82538b06dffc.

Al momento del confezionamento non sono state eseguite migrazioni o modifiche al database di produzione e il deploy non è ancora stato effettuato: è necessaria l'autorizzazione Netlify CLI. La preview HTTP locale non è risultata raggiungibile tra i processi dell'ambiente; i percorsi applicativi sono stati verificati nella suite e tramite DB PGlite sintetico.

## Verifica finale di produzione
- Pubblicata su https://quellidelquasi.com ; deploy finale `6ae88001fcb6c0cf74e4fed0`.
- Migrazione 012 applicata in produzione tramite Netlify, senza abilitare accesso SQL completo ai token personali.
- Lucas Bar B non compare più fra le competizioni nel DB attivo del Bar. L'unica schedina aveva già ricevuto 20 crediti di rimborso: nessun nuovo rimborso è stato eseguito.
- Il Bar `bar:pilot:2026:1` è stato creato e collegato alla pilota: 5 membri/allenatori, 28 giornate native proiettate al momento della verifica.
- Suite completa: 422 test superati. Successivi test mirati su cache, caricamento differito, visibilità e migrazione: 14 superati.
- Verificati gli hash di 8 risorse in produzione, metadati ambiente produzione e versione. API anonime: nessuna lega restituita, bootstrap Fanta e amministrazione protetti con 403.
- Backup precedente al rilascio: `snap-cold-leaf-b9uwrbq8`, conservato su Netlify.

## Preparazione portabile per Netlify CLI
La CLI locale può imporre un contesto di build diverso da quello richiesto per la pubblicazione. Per usare il pacchetto già preparato:

```sh
npm ci
node scripts/prepare-production.mjs
netlify functions:build --src netlify/functions --functions .netlify/functions
netlify deploy --prod --no-build
```

La preparazione genera soltanto i metadati locali e copia le migrazioni nella directory interna prevista da Netlify. La piattaforma applica soltanto le migrazioni non ancora eseguite. Le credenziali restano nella configurazione sicura di Netlify, fuori dai sorgenti.
