# Rilascio 0.29.19

- Svuota accanto a Migliori, pillola rossa nello stesso stile. Svuota panchina separato sotto il campo. I comandi aggiornano subito la sola bozza; mantengono modulo, controlli di scadenza e blocco durante il salvataggio. Svuota tutto riapre i disponibili sul filtro Tutti.
- Campo → area dei giocatori sotto: trascinamento verso il basso rimuove dalla bozza e rimette il giocatore fra i disponibili. Zona di rilascio evidenziata, nessuna assegnazione in panchina involontaria. Restano i trascinamenti sul campo, gli scambi e la separazione fra scorrimento laterale e gesto verticale.
- Unico pulsante chat flottante condiviso Bar/Fanta, fuori dal render delle pagine. Tolte le icone chat nelle barre superiori. La stanza segue la lega Fanta collegata, conservando badge, bozze e riduzione della chat. Nessuna nuova richiesta DB o frequenza di polling.
- Chat e pulsante nascosti negli editor a schermo intero di formazione, stemma, Quasi e nelle schede modali del Fanta; tornano visibili alla chiusura. Nascosti anche in accesso/splash.
- Corretto il vincolo di trascinamento del pulsante flottante su PC: la navigazione alta non lo costringe più in cima. La sua posizione usa una nuova preferenza locale, separata da quella del precedente pulsante di assistenza.

Verifiche: test di integrazione del controller per trascinare fuori dal campo, svuotare titolari/panchina separatamente, modulo conservato, nessuna scrittura finché non si salva e blocco delle azioni durante il salvataggio. Test per singolo launcher e cambio stanza/badge. Prove browser della chat nel Bar/Fanta, nascondimento negli editor di formazione/logo/Quasi e ricomparsa alla chiusura; comandi provati su dati sintetici. Nessun ricalcolo di voti o storico e nessuna modifica al backend.

513 test superati. Controlli browser su telefono 320×568 e 375×812: nessun overflow della barra dei comandi o scorrimento verticale del dock. In demo, Svuota panchina conserva 11 titolari, Svuota tutto riporta 25 disponibili mantenendo il 4-4-2. Chat unica, flottante, apribile e riducibile in entrambe le app; nascosta e ripristinata negli editor di formazione, logo e Quasi. Hash dei sorgenti backend confrontati con la 0.29.18: nessuna differenza salvo i metadati di versione generati in build.

Pubblicato su https://quellidelquasi.com. Deploy Netlify 6ae9bc42c54babba95f7c421. Versione pubblica e JS/CSS di ingresso corrispondono alla build verificata; HTML identico salvo lo script RUM aggiunto da Netlify.
