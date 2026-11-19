# Consumi e calendario operativo

## Evidenze prima dell'intervento

Analisi della 0.27.12 pubblicata, non di un vecchio pacchetto. Il campione dei log
va dal 01/11/2026 19:25:04 al 19:37:27 UTC: 13 batch email vuoti, 13 job AI e 13
job Fanta live. Il job AI non chiamava più un modello ma continuava a svegliare DB
e calcoli. Il live nativo disponeva di un proprio ripiego API oltre al collettore
del Bar: possibili chiamate duplicate, ora eliminate dal percorso pianificato.

Alle 19:39 UTC il DB conteneva 11 utenti e 4 leghe. Misure PostgreSQL:
`pg_total_relation_size(fanta_state)` 123.256.832 byte; `pg_column_size(payload)`
12.494.568; football estratto 17.594.568; rounds estratti 3.902.118. Sono misure
di rappresentazioni/TOAST differenti, **non byte fatturati o traffico HTTP**:
non vanno sommati né moltiplicati per stimare una bolletta.

Il servizio Netlify mostra 6 siti nel team, zero build hook per questo sito e
un repository configurato nel servizio. Nessun altro sito è stato modificato.
Il repository locale non ha un remote utilizzabile per il processo PR; il
proprietario ha già autorizzato il rilascio diretto. Non sono disponibili da
queste evidenze le quote della fattura per sito, bandwidth, compute, richieste,
Blobs, DB, deploy e preview: nessuna attribuzione di spesa agli altri progetti.

## Prima e dopo

| Attività | Prima: trigger/frequenza | DB e fornitori prima | Intervento |
|---|---|---|---|
| sync-football | cron ogni minuto | snapshot grande, lease, controlli quota/odds/calendario anche a vuoto | un collettore condiviso, solo nelle partite note attive |
| fanta-sync | cron ogni minuto e fan-out live/AI | letture native, possibili provider duplicati, ricalcoli globali | riceve lo stesso batch del Bar; solo giornate coinvolte; AI ritirata |
| fanta-catalog | 04:00 UTC ogni giorno | catalogo, rose, infortuni e storico | cron rimosso; helper resta per manutenzione esplicita |
| send-mail | cron ogni minuto | scansione e dispatch account anche con coda vuota | solo invii da eventi e retry di job realmente esistenti, massimo 8 |
| sync-fantacalcio | ogni 5 minuti | connessioni, sessioni, import e assets | verifica mattutina o richiesta manuale del presidente |
| send-chat-push | ogni minuto | coda dispositivi e messaggi | job creato dal messaggio; tentativi limitati sui destinatari rimasti |
| send-reminders | ogni minuto | scansioni leghe, utenti e code | push a −2h/email a −1h, come richiesto; nessuna scansione periodica |
| sync-match-cache | ogni 5 minuti | dettagli, probabili, ritratti e relativo DB | recupero dei dettagli e dei ritratti nel controllo mattutino |
| probable-lineups | 10 passaggi giornalieri tra due giornate | fonti editoriali condivise per la prossima giornata | da 08:00 a 21:30 ogni 90 minuti, fino a 30 minuti dal primo calcio d’inizio |
| sync-fantasy-lineups | ogni ora | export Excel/browser e import | avvio mattutino/manuale; hash semantico invariato non importa di nuovo |
| FE Bar | live privato ogni minuto anche senza gare | letture per utente, progressioni/classifiche | cache sportiva pubblica CDN solo nella finestra utile; dati privati su cambio risultato |
| FE Fanta | giornata aperta ogni minuto | due letture private anche tra giorni senza gare | verifica finestra effettiva; niente overlap/offline; Bar sospeso in modalità Fanta |
| chat | apertura/azioni | messaggi e stato privato | resta a scomparsa e su richiesta; nessun cron vuoto |
| asta | letture ogni secondo con avanzamento in GET | transazioni e possibili assegnazioni | GET puro; tick POST solo dalla sala visibile/online, una richiesta in corso |
| classifiche native | ricomputate nelle view | lavoro ripetuto a ogni navigazione | riepilogo scritto dal backend dopo risultati/avvio competizione, con fallback transitorio per dati non ancora migrati |
| voti live | potenziale revisione completa ogni minuto | crescita dello storico senza limite utile | uno snapshot corrente per giocatore/partita/modello; revisioni finali immutabili |
| API pubbliche/accesso | stato letto anche senza cookie | trasferimento inutile prima del login | features e stato anonimo senza DB; inviti con query piccola e limite richieste |

Stima da configurazione, non da fattura: i nove cron generavano **7.801 invocazioni
al giorno**, più i worker figli. Ora resta un dispatcher da **1.440/giorno**, più
il lavoro utile. Riduzione minima teorica delle sole invocazioni pianificate:
81,5%. Il dispatcher e le letture Blobs **hanno comunque un costo**; non promettiamo
consumo zero o un risparmio in euro senza misurare il periodo successivo.

## Comportamento operativo

- Il dispatcher importa solo calendario e storage leggero: fuori dalle finestre
  non apre Postgres e non chiama fornitori. Calendario e lease sono persistenti
  in Netlify Blobs, separati da DB, memoria del processo e dati pubblici.
- Un batch API-FOOTBALL aggrega fino a 20 fixture. Lo stesso risultato alimenta
  Bar, voti nativi e cache condivisa. Il numero di client non aumenta tali chiamate.
- La gara finisce quando arriva lo stato finale. Non si deduce un FT dopo 90 minuti.
  Ritardi NS oltre 45 minuti, live oltre 210 e sospensioni oltre 10 minuti diventano
  anomalie da verificare, senza liquidazione fittizia né polling infinito.
- Dopo l'ultima gara effettivamente conclusa: una verifica logica alle **07:00
  Europe/Rome del mattino successivo**, con ora legale. Gli eventi già finali
  importati senza timestamp usano la prima osservazione certa del finale, non una
  durata presunta. I rinvii restano pendenti; il recupero ha la sua verifica.
- La mattina: batch delle gare terminate, aggiornamento calendario futuro, avvio
  dei servizi collegati/probabili. Ogni sottolavoro usa il worker già autorizzato;
  errori restano nei relativi stati amministrativi. Se mancano dati definitivi, ripresa dopo un’ora solo sulle partite incomplete,
  fino a 48 ore dalla prima verifica. Un operatore può ripetere la verifica.
- Le probabili ripartono dopo la chiusura registrata della giornata. Il primo passaggio del giorno verifica gli orari ufficiali delle gare candidate. Il worker Windows esegue questa coda separatamente da live, ufficiali e chiusure.
- La richiesta del presidente e l'azione dell'amministratore sono eventi utente:
  possono avviare un aggiornamento senza attendere una nuova pubblicazione.
- Il nuovo motore ha una manutenzione iniziale finita, a blocchi di 12 fixture:
  prima usa i dati archiviati, richiede solo quelli mancanti. Il progresso è
  persistente, il completamento non viene ripetuto. Un blocco senza dati si ferma
  e richiede intervento; esiste anche un limite totale di blocchi.
- Gli invii email hanno indice di retry esterno al DB solo se falliscono; push e
  email puntuali restano opt-in e rispettano le preferenze esistenti. Nessun invio
  di prova a utenti reali è stato effettuato per le verifiche locali.

Le modifiche tardive di un calcio d'inizio non sono conoscibili mentre il sistema
è dormiente: saranno rilevate nel successivo controllo autorizzato o manuale.
Il calendario operativo conserva un orizzonte di 21 giorni; dopo lunghe interruzioni
senza verifiche serve rileggerlo dall'Admin. Le vecchie cadenze orarie di probabili
ed Excel **non restano attive fuori dalle finestre**: è il compromesso richiesto
dal nuovo piano di risparmio, con aggiornamento manuale disponibile.

## Integrità e accessi

Nessuna modifica a puntate, crediti iniziali, regole, quote accettate o scadenze.
Una rettifica ufficiale di risultato produce solo la differenza di punti/crediti
nel ledger, con precedente, nuovo valore e revisione. È idempotente anche quando
un risultato passa A→B→A. I vecchi voti finali restano consultabili per audit.

Le scritture sportive aggiornano solo le partite e le schedine interessate; non
trasferiscono autenticazione, sessioni esterne o tutti gli assets della riga JSON.
Nessuna richiesta a fornitori sotto il lock di questo percorso. Premi e profili
sono derivati dopo una liquidazione/rettifica, con confronto semantico prima della
scrittura. GET di gioco/asta/analisi/amministrazione non rigenerano dati. Il piccolo
contatore di sicurezza dell'invito pubblico è un'eccezione deliberata per il rate limit.

La cache pubblica contiene solo punteggi, eventi e statistiche sportive. Mai
saldi, schedine, iscrizioni o credenziali. ETag e cache CDN durable evitano una
Function e una ricostruzione DB per ogni client; le risposte private non sono
pubbliche. Snapshot vecchi non sovrascrivono risultati più recenti. I dati Blobs
di preview/staging usano namespace differenti dalla produzione.

## Controllo e limiti delle metriche

Admin di sistema → **Calendario operativo e consumi**: mostra stato, errori,
conteggi dei job, ultimo live, rilegge il calendario e ripete un job esplicitamente.
Nessun polling amministrativo. `QUASI_OPERATION` nei log riporta durata, fixture,
query/scritture del nucleo sportivo nativo, chiamate API e cache. Il campo `scope`
chiarisce che questi conteggi non comprendono i worker collegati né sono la fattura
Netlify. Non esiste un nuovo cron per raccogliere metriche.

Test: inattività senza DB/provider; concorrenza; FT/rinvii/limiti; DST; singola
verifica/no retry mattutino; 100 lettori della cache pubblica; scritture invariate;
rettifiche del ledger; snapshot live limitati; preservazione dati privati;
registrazione/inviti e rimozione cron email. La prova locale non emula la CDN:
il cache hit va verificato dopo il singolo deploy con `Cache-Status`.

Documentazione ufficiale consultata:
[Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/),
[Background Functions](https://docs.netlify.com/build/functions/background-functions/),
[Caching overview](https://docs.netlify.com/build/caching/caching-overview/).
