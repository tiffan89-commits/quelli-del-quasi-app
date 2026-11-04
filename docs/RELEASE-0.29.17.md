# Rilascio 0.29.17

Pubblicato su https://quellidelquasi.com il 3 novembre 2026. Deploy Netlify 6ae9af04b1d3815c80328d44.

- La scelta della giornata da schierare è separata dalla giornata visualizzata nei risultati. La prossima formazione si può salvare prima dei definitivi della precedente; il risultato resta provvisorio. Sono invariati i controlli di scadenza e la protezione delle formazioni già bloccate.
- In Oggi, sotto Risultati e voti, compare la prossima verifica dei definitivi effettivamente presente nel piano batch. Se è in corso o non è programmata, viene detto senza inventare un orario. Il piano viene letto da una cache condivisa per un minuto, senza nuove letture DB o chiamate al fornitore per la sola dicitura.
- Barra del Bar e del Fanta su una riga, con nome lega riducibile e controlli compatti. Verifica browser a 320, 375 e 390 px; nessun a capo dei controlli.
- La splash iniziale casuale resta visibile finché dati e stili sono pronti. Rimosso lo spegnimento fisso a 2,5 secondi; la home sottostante resta nascosta. Sono mantenute le splash durante lo switch fra app. Sono presenti un messaggio di attesa e un pulsante Riprova se il caricamento si prolunga.
- Cartolina nel popup: Quasi del vincitore, frase ironica scelta casualmente senza ripetizione immediata e gli stessi riquadri scommessa usati nel Bar. Nessun PNG o download generato. Il passaggio al verdetto conserva la giornata storica selezionata.
- Corretto il formato della risposta live della demo, evitando falsi errori di connessione. Solo dati sintetici e memoria locale.

Verifiche: 505 test completi superati, ulteriori 14 controlli mirati dopo le rifiniture. Prova backend con DB PostgreSQL di test: salvataggio della seconda giornata mentre la prima resta non ufficiale, rifiuto di modificare la prima e risultati invariati. Prove browser su splash con ritardo artificiale di 3,5 secondi, barra in una riga, editor della prossima giornata con risultati provvisori e cartolina con frase diversa alla riapertura. Bundle pubblico confrontato byte per byte con la build.

Il motore dei voti è identico alla 0.29.16. Nessun ricalcolo dello storico o nuova migrazione dei punteggi è stato eseguito. Rimangono le regole +1/-0,5 per i secchi delle sole giornate future introdotte nella 0.29.16. Nessuna nuova schedulazione periodica o chiamata sportiva è stata aggiunta.
