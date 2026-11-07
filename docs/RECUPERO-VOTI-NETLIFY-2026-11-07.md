# Recupero mirato voti Netlify — 7 novembre 2026

La migrazione ridotta aveva conservato solo i voti ufficiali del modello attivo. Due partite delle giornate Serie A 10 e 11 erano terminate ma avevano ancora voti provvisori: Bologna–Monza e Venezia–Udinese.

Sono stati eseguiti sul backend Netlify due job morning del motore già pubblicato, limitati alle due partite; una richiesta API-FOOTBALL ciascuno. Nessun cambio di algoritmo e nessuna reimportazione dello storico completo.

- Venezia–Udinese (1550196): 51 record ricalcolati e salvati, 26 voti numerici, conferma definitiva. Job completato alle 02:49 UTC.
- Bologna–Monza (1550179): 49 record ricalcolati e salvati, 31 voti numerici. La conferma definitiva resta sospesa per il controllo penalty-save-undocumented sul portiere. Tentativo automatico successivo previsto alle 03:48 UTC tramite il meccanismo orario già presente; nessuna forzatura dei definitivi.
- Ricalcolo dei risultati collegati eseguito dai job standard, con revisioni e invalidazione della cache previste dal sistema.
- Verificati i dati prodotti dalle stesse viste backend usate dal Fanta: nella lega Quelli del quasi, giornata 1/Serie A 10 dispone di 464 record voto, giornata 2/Serie A 11 di 51; i calciatori di Venezia e Udinese hanno di nuovo voto e fantavoto nelle formazioni.

I voti dei giocatori mai scesi in campo restano senza voto. Questo intervento non trasforma automaticamente in definitive prestazioni che richiedono ancora verifica.
