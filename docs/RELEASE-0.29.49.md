# Rilascio 0.29.49

- Pallone condiviso tra gol e autogol, con geometria identica e solo pannelli chiari rossi per l'autorete; stessa icona nei riepiloghi Fanta.
- Eventi fuori dal riquadro della maglia, in fila sotto: gol, autogol, rigori parati, assist, ammonizioni, espulsioni, sostituzioni. Gli eventi ripetuti restano visibili; icone e frecce conservano etichette accessibili.
- Campo Serie A, schedina Fanta e giornata Fanta mostrano solo il fantavoto, senza V/FV né un secondo voto sovrapposto. Il voto tecnico resta nel dettaglio del calcolo e del modificatore; nessuna modifica a valori o regole.
- Aggiornamento live incrementale allineato all'HTML iniziale; jersey e accordion non vengono ricreati quando cambia il numero.
- Spazio riservato ai simboli e al voto per evitare sovrapposizioni tra righe; intestazione lista Fanta con unica colonna Fantavoto.

## Verifiche

Build produzione e 727 test passati, inclusi palloni identici, ordine e ripetizione degli eventi, simboli fuori dalla maglia e aggiornamento del solo fantavoto. Anteprime isolate dei due campi su telefono e desktop; controllo della riga con cinque giocatori e assenza di overflow orizzontale.

Distribuzione sull'istanza Netlify temporanea con la modalità d'emergenza già attiva. Nessuna migrazione, chiamata provider aggiuntiva o ricalcolo dei voti.
