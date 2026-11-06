# Rilascio 0.29.48

- Inviti: rimosso il conflitto con window.history dopo l'accesso Google; ingresso tramite la normale API, deduplicato e con selezione della lega anche per chi è già collegato.
- PWA: proposta di installazione su gesto esplicito, guida iPhone e riuso della finestra nei browser compatibili. L'installazione e l'apertura automatica su iOS restano decisioni del sistema.
- Partite: campo più alto e maglie fino a 84 px; cognomi più grandi, voto live nello spazio riservato, senza avversario/club/probabilità per chi sta giocando. Aggiornamento Fanta dei voti tramite stanza Socket.IO condivisa.
- Schedine Serie A: descrizione ironica breve e rischio salvati nel JSON della schedina nella stessa UPDATE mirata. Cambiare puntata o esiti li ricalcola; replay idempotente senza doppio addebito. Nessuna chiamata AI o API aggiuntiva.
- Schede precedenti senza profilo: anteprima in cache da dati già salvati, senza scritture al DB. Eliminato il messaggio di errore usato prima come frase su tutte le schede. Le correzioni non alterano voti, risultati, punteggi o regole dei saldi.

## Verifiche

- Build di produzione completata; suite completa 721/721, test dedicato al budget CSS 15/15, diff senza errori.
- Prova mobile 390×844: nessun overflow orizzontale; voto live sotto la maglia e campo fino alla barra inferiore. Controllo desktop 1280×800.
- Invito sintetico dopo login: ingresso nella lega corretta, due partecipanti e nessun errore history.
- Verifica in sola lettura delle schedine correnti: la lega con sette schede riceve sette frasi diverse; nessun backfill o ricalcolo massivo.
- Salvataggio con puntata 1→20 e modifica dell'esito: rischio e descrizione aggiornati; ripetizione identica senza scritture o addebiti aggiuntivi.

## Distribuzione

Server Windows, backup dei file sostituiti e confronto SHA-256. Riavvio Web/Caddy/Worker; PostgreSQL resta attivo. Nessuna migrazione, nessun deploy Netlify e nessuna modifica a credenziali.
