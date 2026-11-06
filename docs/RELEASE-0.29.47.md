# Rilascio 0.29.47

- Barra comune: switch Bar/Fanta centrato rispetto alla pagina; conservati selettore lega, saldi e Impostazioni.
- Il Quasi in Oggi apre lo studio direttamente, conservando la personalizzazione salvata.
- Serie A e schedine Fanta: dettaglio partita in un main dedicato dentro la cornice, con Chiudi, Escape e Indietro. La schedina sottostante rimane montata: scelte, importo e posizione non vengono ricostruiti alla chiusura.
- Campi compatti con altezza adattata alla finestra, squadre e partita centrate; dettagli richiudibili. Nessun cambiamento a voti, punteggi, quote o saldi.
- Classifica Serie A a dieci colonne senza minimo da 730 px; eliminate le due percentuali casa/trasferta.
- Live: recupero condiviso già presente a ogni minuto nella finestra del calcio d'inizio. Dopo il completamento del job viene emesso NOTIFY PostgreSQL; il server rilegge una volta per stanza Socket.IO e distribuisce ai dispositivi. Resta il recupero server ogni 60 s in caso di notifica persa; nessun polling HTTP o chiamata al provider dal browser.

## Verifiche

- Suite completa: 715 test passati. Ricontrollo del ciclo della pagina dopo l'ultimo ritocco di navigazione: 2 test passati.
- Test con due client: una lettura iniziale condivisa e una sola rilettura al segnale di commit, senza attendere il timer di un minuto.
- Verificato il trasporto NOTIFY sul PostgreSQL del server, senza modificare dati di gioco.
- Anteprima isolata: apertura/chiusura partita, ritorno alla schedina, editor Quasi diretto; controllo 390×844 e 1280×800. Classifica con tutte le 20 squadre salvate, senza overflow orizzontale.
- Prima verifica contabile del live: provider e DB inizialmente NS; primo 1H ricevuto dal provider e salvato al ciclo 20:49 locale. Recuperi del worker condivisi ogni minuto.
- Individuata pressione sulla memoria virtuale del PC; chiuso SignalRGB su autorizzazione del proprietario. I cicli live successivi sono tornati a completarsi.

## Distribuzione

Server Windows già esistente, senza deploy Netlify. Backup dei soli file sostituiti, verifica SHA-256, riavvio ordinato di Web/Caddy/Worker; PostgreSQL e archivio dati restano attivi. Nessuna migrazione o ricalcolo straordinario.
