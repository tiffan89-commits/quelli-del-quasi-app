# Verifiche 0.28.0

- Suite completa: **404/404 test superati**, nessun test saltato.
- SQL sintetico PGlite: scelta concorrente della squadra, nuova pilota, isolamento, formazione manuale e storico, svincolo/annullamento/riacquisto, vincoli rose, sincronizzazione Bar idempotente, ripristino e rimborso selettivo una sola volta.
- Browser locale: login, passaggio Bar/Fanta, scelta squadra e salvataggio formazione; presidente e membro; correzione della rosa; Quasi intero nello studio a 390 px; stemma con forma e motto salvati nel DB locale.
- Grafica verificata anche in **anteprima Netlify separata**, senza database o Functions: https://grafica--quasi-native-preview-20261102.netlify.app/verifica-grafica.html . Accesso privato del team Netlify. Desktop e 390 px. Il backend è stato provato localmente con dati sintetici, non nel sito statico di confronto.
- I tre file di disegno sono identici alla consegna. Avatar, opzioni, catalogo premi, obiettivi e spogliatoi invariati rispetto al codice precedente; Quasi predefinito 6347 byte.
- Bundle Netlify: 16 Functions, unico cron operational-dispatch; nessuna funzione privata Leghe Fantacalcio o dipendenza Chromium/Puppeteer.
- Motore dei voti invariato. Nessun dato reale usato nei test o nell’anteprima.

## Controlli produzione

Prima del deploy: cinque Quasi personalizzati, raccolta delle sole impronte aggregate senza esportare avatar o premi. Individuata una schedina non Lucas senza risultati: annullamento e rimborso approvati dal proprietario in chat. La CLI dispone solo di lettura sul DB pubblico e non ha privilegi sullo schema Fanta; la migrazione viene inviata attraverso il ciclo ufficiale di deploy Netlify, senza ampliare i permessi. Gli esiti effettivi sono registrati nell’artefatto di rilascio dopo la pubblicazione.

Esito pubblico: migrazione 011 applicata, nessuna pendente; setup `done`; pilota attiva (10 squadre/250 giocatori/29 giornate/10 formazioni), Lucas conservata (10/250/10/79). Rimborso 20 crediti completato. Cinque personalizzazioni e archivio premi identici prima/dopo. 75 file pubblici + 40 spogliatoi verificati; 16 Functions effettivamente pubblicate e 0 vecchi import in coda.
