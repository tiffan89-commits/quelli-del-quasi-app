# Emergenza Netlify — 7 novembre 2026

Il PC server era connesso all'hotspot iPhone, non alla LAN domestica. La connettività in uscita non dimostrava la raggiungibilità del server; il DDNS aveva registrato l'IP dell'hotspot.

## Destinazione temporanea

- Ultimo main di partenza: 697be5c, versione 0.29.48. Branch operativo ops/emergency-netlify-0.29.48; nessun merge automatico.
- Sito Netlify esistente quelli-del-quasi, dominio quellidelquasi.com. A apex verso 75.2.60.5; www CNAME verso quelli-del-quasi.netlify.app, TTL 300. Record email e verifica Google conservati.
- Pacchetto dati ridotto a 12,8 MB compressi: 21 utenti, 14 leghe, 466 giornate, rose, formazioni, saldi, risultati. Solo 3.780 voti definitivi del motore attivo (3,8 MB compressi); statistiche finali conservate. Escluse revisioni obsolete, voti provvisori, archivio tecnico dei vecchi import e foto reali inutilizzate. Nessun ricalcolo o modifica ai valori dei voti.
- Il DB completo locale resta invariato. La copia cloud è stata ripristinata in una transazione, con conteggi per tabella, SHA-256 degli oggetti compressi e digest dello stato verificati. Conservato backup cloud precedente in schema privato e dump locali esclusi da Git.
- Piano operativo, risultati pubblici e report Admin trasferiti; cache private ricostruibili non trasferite. Job operativi riprendono nel cloud. Google e invio email usano le impostazioni private del progetto.
- L'istanza Netlify non ospita Socket.IO. Solo nella build marcata NETLIFY_EMERGENCY=true il live legge i nostri endpoint DB ogni 60 s; API-Football rimane chiamata dal backend condiviso. L'asta usa il recupero HTTP già esistente. La build normale continua a usare Socket.IO.

## PC sospeso

QuasiWeb, QuasiWorker e QuasiCaddy fermati; PostgreSQL conservato. DDNS e scheduler disabilitati nella configurazione privata. SELFHOST_MAINTENANCE=true impedisce API e socket e sospende il worker anche in caso di avvio accidentale o riavvio Windows.

## Ritorno a casa: NON basta cambiare DNS

1. Verificare Wi-Fi/LAN domestica e raggiungibilità HTTPS dall'esterno. Non usare l'indirizzo rilevato tramite hotspot.
2. Congelare brevemente le scritture cloud e i job; esportare una nuova copia Netlify, includendo gli utenti e i salvataggi successivi al passaggio.
3. Ripristinare/verificare DB e piano operativo sul PC; conservare backup delle due copie. Il vecchio DB locale non deve diventare autorevole senza riallineamento.
4. Rimuovere la manutenzione, riattivare i servizi e verificare login, dati e live. Spostare DNS sul vero IP domestico; fermare i job cloud.
5. Riattivare DDNS solo dopo aver verificato la rete corretta. Questo intervento non introduce failover automatico permanente.

## Riproduzione build temporanea

PowerShell: impostare NETLIFY_EMERGENCY=true, eseguire npm run build:production e pubblicare dist e netlify/functions sul progetto esistente. Credenziali, database, configurazioni e strumenti di ripristino temporanei non sono nel repository.

## Verifiche

723 test passati e build produzione. Controllati HTTPS sul dominio ufficiale verso l'edge Netlify, record pubblici Google DNS, metadati release, API anonime, disponibilità Google Login, schema e conteggi. La funzione di ripristino autenticata è stata rimossa dopo la migrazione.
