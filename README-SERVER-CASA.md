# Quelli del Quasi — server Windows, runtime autonomo Windows

Questo pacchetto contiene **frontend e backend completi**, adattati per funzionare senza hosting, database o Functions Netlify. Il codice corrente è condiviso con il rilascio Netlify e include gli aggiornamenti successivi alla 0.29.22. Non è lo ZIP di un deploy statico.

Apri nell’ordine:

1. [Guida Windows](docs/GUIDA-SERVER-WINDOWS.md): installazione, avvio, rete, servizi, backup e aggiornamenti.
2. [Migrazione da Netlify](docs/MIGRAZIONE-NETLIFY.md): trasferimento coerente di DB, file operativi e configurazioni private.
3. [Prompt per Codex sul nuovo PC](PROMPT-CODEX-SERVER-WINDOWS.md): procedura da eseguire sul computer definitivo.
4. [Stato della prova su questo PC](docs/PROVA-ESEGUITA.md): cosa è stato davvero verificato e cosa resta da configurare prima di una migrazione pubblica.

Il sorgente del frontend è in `public/`, la build pronta in `dist/`, gli handler in `netlify/functions/`, la logica backend in `lib/` e `fanta/`, le 16 migrazioni in `netlify/database/migrations/`. Il nome della cartella Functions rimane per conservare l’organizzazione del codice; il server Node esegue questi handler localmente.

I nuovi file di avvio sono in `runtime/`; gli script operativi Windows sono in `windows/`. PostgreSQL, Caddy, Node, WinSW e cloudflared si installano dalle fonti ufficiali indicate nella guida: i loro eseguibili non sono inclusi nello ZIP.

**Non contiene dati personali, backup del DB reale, password, cookie, chiavi API, `.env` reali o link privati della prova.** I dati effettivi e le chiavi si trasferiscono separatamente. Non applicare migrazioni storiche da zero a un database ripristinato: usare l’adozione descritta nella guida.

Il runtime Windows seleziona esplicitamente PostgreSQL e storage locale tramite `runtime/config.mjs`. La build Netlify utilizza invece database e Blobs gestiti. Non pubblicare la directory privata dell’installazione Windows: contiene configurazioni e dati che restano fuori dai sorgenti. Le due destinazioni condividono il codice, ma non devono aggiornare gli stessi dati o inviare gli stessi promemoria contemporaneamente.
