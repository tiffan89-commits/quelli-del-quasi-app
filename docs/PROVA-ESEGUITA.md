# Stato verificato della prova — 3 novembre 2026

## Funzionante

- Server su Windows 11 dell'utente, Node 24.20, PostgreSQL 18.6 su loopback porta 55433; web su loopback 8845. Frontend e backend provengono dalla 0.29.22 con aggiornamento SEO.
- Copia completa isolata del DB reale, non dati sintetici spacciati per produzione: 42 tabelle confrontate, conteggi uguali e digest dello stato identico prima degli accessi di test; 15 utenti, 7 leghe e 288 giornate Bar.
- Esportazione sorgente in transazione in sola lettura con snapshot coerente. Il permesso Netlify PAT completo temporaneo è stato revocato al termine.
- Piano operativo e snapshot risultati copiati nei file persistenti locali. Gli aggiornamenti e gli invii esterni sono disattivati.
- Endpoint anonimi e letture autenticate verificati nella copia. L'accesso autenticato tecnico ha letto 4 leghe Bar e 2 Fanta dell'account di prova; la sessione tecnica temporanea è stata rimossa senza cambiare la password dell'utente.
- Tunnel HTTPS temporaneo protetto funzionante. Senza chiave/cookie aggiuntivo root e API rispondono 401; dopo l'accesso protetto il normale login resta necessario. Root, Fanta API e servizio risultati rispondono correttamente nelle prove. Header noindex attivi sul test.
- Adattatori locali di blob con CAS, coda persistente, routing HTTP/cookie, migrazioni/adoption e DDNS testati con test automatici. La verifica completa precedente all'aggiornamento SEO aveva 514 test passati; i nuovi controlli SEO e noindex sono stati eseguiti separatamente con esito positivo.
- Build di produzione riuscita. Guide SEO controllate anche a 390 px senza overflow orizzontale. Favicon, JSON-LD, guide e sitemap sono presenti nella copia e nell'aggiornamento pubblicato su Netlify.

## Non ancora dimostrato o attivato

- Non è stato eseguito un riavvio fisico completo di Windows con avvio di tutti i servizi prima del login. Lo script WinSW è preparato, non installato: serve la persona per i privilegi amministrativi. Il task utente di prova ha restituito errori nella verifica e non va considerato affidabile finché non viene corretto e ricollaudato.
- La login con password reale deve essere collaudata dalla persona. La verifica tecnica di una sessione non equivale a provare registrazione, recupero password e ricezione email. I servizi esterni sono volutamente bloccati.
- Non sono state trasferite le chiavi di produzione nell'installazione di prova. Le chiavi locali di test non costituiscono una configurazione definitiva dei dati cifrati/importati.
- Nessuna apertura porte router, nessun cambio DNS del dominio principale, nessuna attivazione DDNS reale. La logica DDNS è stata provata con risposte simulate; non è stato fatto un cambio reale di IP/DNS.
- Il test raggiungibile non è un servizio con garanzia di disponibilità: richiede PC, sessione e tunnel attivi. Il collegamento può cambiare se il tunnel riparte. Il link resta nella configurazione privata e non in questo documento.
- I due helper generici export-db/restore-db del pacchetto sono stati controllati sintatticamente; la copia effettiva del DB è stata eseguita e verificata con la stessa procedura operativa, prima della creazione di questi helper. Il futuro trasferimento deve collaudare anche l'esecuzione concreta dei helper sul nuovo PC.
- Non sono stati eliminati servizi, DB o dati di produzione Netlify. La migrazione definitiva richiede ancora fermo scritture, dump finale, collaudo e autorizzazione al cambio DNS.

La copia privata, i dump e le configurazioni reali si trovano fuori dal pacchetto sorgente. Non condividere quella cartella come se fosse uno ZIP del codice.
