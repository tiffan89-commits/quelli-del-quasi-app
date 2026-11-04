# SEO: cosa è stato fatto e come misurarlo

La home contiene titolo e descrizione descrittivi, canonical, metadati social e JSON-LD inline. Il grafo collega Organization, WebSite, WebApplication e WebPage. Le guide aggiungono BreadcrumbList. Non sono presenti recensioni inventate, prezzi presunti, FAQ markup non pertinente o una ricerca del sito inesistente.

Favicon quadrata derivata dallo stemma esistente: SVG, ICO 16/32/48 e PNG 48. L'immagine social locale è PNG 1200×630. La generazione delle pagine informative non richiede chiamate API, DB o funzioni server: sono file statici serviti dalla stessa distribuzione del frontend. Nessun nuovo polling, tracker o cookie pubblicitario.

## Pagine pubbliche

- `/`: presentazione e demo dell'app. La landing statica rimane leggibile senza JavaScript.
- `/fantacalcio-tra-amici.html`: formazione, voti spiegati, diretta e limiti attuali della pilota.
- `/asta-fantacalcio.html`: modalità online/dal vivo e disponibilità in demo.
- `/schedine-virtuali.html`: pronostici, mercati, storico e natura virtuale dei crediti.

Testi e schema sono in `scripts/build-seo.mjs`. La home e la landing generata dal client collegano le stesse guide. La build genera robots.txt e sitemap.xml: solo la produzione pubblica ha URL indicizzabili. Staging/preview hanno robots Disallow /, sitemap vuota e X-Robots-Tag noindex; le guide hanno anche meta noindex. Il test server di casa mantiene protezione aggiuntiva e noindex a livello HTTP.

Account, amministrazione, disiscrizione promemoria e 404 hanno meta noindex; gli inviti hanno header noindex. La sitemap esclude dati privati e pagine di servizio. La protezione dei dati resta affidata all'autenticazione, non a robots.txt.

## Verifiche dopo la pubblicazione

1. Visitare home, guide, robots.txt, sitemap.xml, favicon.ico e og-image.png: devono rispondere 200 con il tipo MIME corretto. La home deve avere un solo canonical e un solo grafo JSON-LD.
2. In Google Search Console verificare la proprietà del dominio e inviare `https://quellidelquasi.com/sitemap.xml`. Se la proprietà non è verificata, Google fornisce un record TXT: serve il valore esatto, non inventarlo.
3. Usare Controllo URL sulla home e sulle tre guide, verificare il rendering e richiedere l'indicizzazione. Non ripetere ogni giorno la richiesta. Il superamento dei test non garantisce indicizzazione, rich result o una posizione.
4. Validare JSON-LD su https://validator.schema.org/ e gli eventuali risultati supportati su https://search.google.com/test/rich-results. WebApplication senza offerte/recensioni non promette un rich result Software App; è una descrizione semantica corretta. FAQ rich result non è un obiettivo per questa app.
5. Registrare impressioni, clic, CTR e query per ogni pagina in Search Console; confrontare periodi di 28 giorni dopo che le pagine sono state indicizzate. Distinguere ricerche del marchio da ricerche generiche.
6. Pubblicare nuove guide solo se rispondono a domande reali e possono essere mantenute. Le guide attuali dichiarano la fase pilota: aggiornarle quando le funzionalità saranno aperte a tutti. Evitare pagine duplicate con poche parole cambiate.
7. Ottenere collegamenti autentici dalle community e dai profili ufficiali; non comprare link. Misurare prestazioni mobile e conversioni alla demo/registrazione prima di aumentare il traffico pubblicitario.

La favicon e gli snippet possono richiedere un nuovo passaggio dei crawler. Non è stato aggiunto un finto `lastmod` alla sitemap: una build identica non è un aggiornamento editoriale. La migrazione del server conserva lo stesso dominio/canonical: non cambiare gli URL pubblici con quelli temporanei del tunnel.

Documentazione di riferimento: https://developers.google.com/search/docs/appearance/favicon-in-search · https://developers.google.com/search/docs/appearance/site-names · https://developers.google.com/search/docs/essentials · https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
