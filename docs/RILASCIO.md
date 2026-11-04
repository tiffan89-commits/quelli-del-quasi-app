# Come rilasciare Quelli del Quasi

> Stato corrente: i sorgenti attivi includono l'adattamento per server Windows. Git versiona la copia locale e non pubblica automaticamente l'app. La procedura Netlify sotto è documentazione storica e resta subordinata a un'integrazione e a una verifica specifiche; nessun collegamento di deploy viene attivato con la creazione del repository.

Il repository non è ancora collegato a GitHub. Il processo con PR resta quello ordinario; per la 0.26.0 il proprietario ha autorizzato esplicitamente un rilascio diretto tramite CLI Netlify dopo le verifiche locali. Non vengono modificati segreti né protezioni Git e non si esegue un merge locale su main.

Il 1 novembre 2026 Francesco ha autorizzato anche la pubblicazione diretta della **0.27.0**, con selettore Bar | Fanta. Il rilascio viene preparato in una copia Git separata, senza toccare il lavoro aperto nella cartella di sviluppo. La beta resta limitata a `frankwood`; l'import automatico non viene attivato prima del completamento delle rose.

## I tre ambienti

| Ambiente | A cosa serve | Indirizzo previsto |
|---|---|---|
| Anteprima | Provare una singola PR prima del merge | `https://deploy-preview-<n>--quelli-del-quasi.netlify.app` |
| Pre-produzione | Provare insieme le modifiche del branch `staging` | `https://staging--quelli-del-quasi.netlify.app` |
| Produzione | Il sito usato dagli amici, branch `main` | `https://quellidelquasi.com` |

Gli indirizzi di anteprima e staging diventano disponibili dopo il collegamento del repository. In alto vedrai una striscia gialla “PRE-PRODUZIONE”, versione e commit. È presente anche nelle anteprime. In produzione non compare. Gli ambienti di prova hanno `X-Robots-Tag: noindex`; non è una password e non protegge dati privati.

## Prima attivazione: produzione sempre sotto controllo

Prima di collegare GitHub o caricare branch remoti: Netlify → progetto `quelli-del-quasi` → **Deploys → Lock to stop auto publishing**. Mantieni il blocco attivo. Le build possono essere preparate senza sostituire il sito pubblico. Non usare la CLI con `--prod` o un caricamento manuale per saltare il processo.

Il proprietario prova staging, approva la PR verso `main` e autorizza il merge. Con il blocco Netlify attivo, sceglie poi personalmente il deploy approvato e **Publish deploy**. Il blocco rimane la protezione per impedire pubblicazioni successive non viste. Questa azione non viene eseguita dagli script o dalla CI.

Su GitHub il diritto di eseguire il merge finale verso `main` deve restare al proprietario. Un'approvazione di un altro collaboratore non sostituisce la sua autorizzazione. GitHub non permette di approvare la propria PR: se il proprietario è anche autore, la regola “1 approvazione” richiede un secondo revisore fidato. Non aggirare la protezione per risolvere questo caso.

## Una funzionalità nuova

1. Parti da `staging` aggiornato e crea `feature/nome-modifica`.
2. Aggiorna `[Unreleased]` in `CHANGELOG.md` e apri una PR verso `staging`.
3. Controlla il link di anteprima Netlify, il banner e i test CI. Allega screenshot a 390 px e desktop.
4. Dopo la revisione, fai il merge verso `staging`. Prova l'indirizzo fisso di staging.
5. Su `staging` pulito esegui `npm run release:minor`. Per una sola correzione ordinaria usa `release:patch`; `release:major` è per incompatibilità o migrazioni dichiarate.
6. Lo script aggiorna versione, data, changelog, cache PWA e metadati del package; crea un commit e un tag annotato. Non carica nulla online. Per rispettare staging protetto stampa i comandi per creare `release/vX.Y.Z` e caricare quel branch e il tag. Apri una PR tecnica `release/vX.Y.Z` → `staging`, con CI verde e revisione. Fai il merge normale, senza squash/rebase, per conservare il commit taggato. Poi allinea lo staging locale con quello remoto tramite fast-forward. Non fare push diretto su staging.
Durante il rilascio congela staging: non far entrare altre funzionalità fra la prova del commit taggato e la pubblicazione. Se servono altre correzioni, prepara una nuova versione; non spostare un tag già condiviso.

7. Apri la PR da `staging` verso `main`. Il proprietario esamina il risultato su staging e approva esplicitamente.
8. Il proprietario autorizza il merge e pubblica personalmente il deploy approvato su Netlify. Nessun job CI pubblica.

I numeri seguono MAJOR.MINOR.PATCH: ad esempio una correzione da 0.25.1 diventa 0.25.2; una funzionalità diventa 0.26.0; un cambiamento incompatibile diventa 1.0.0. Non modificare il numero a mano. Lo script si ferma su modifiche non committate, branch sbagliato, tag esistente o changelog senza note.

Per l'autore dei futuri commit, configura nome ed email **solo nel repository** con `git config user.name` e `git config user.email`. I commit preparati in questo lavoro hanno usato l'autore autorizzato tramite opzioni temporanee, senza modificare la configurazione globale.

## Una correzione urgente

Dopo che il processo è stato approvato e integrato anche in `main`:

1. Parti da `main` aggiornato e crea `hotfix/nome-correzione`.
2. Correggi il problema, aggiorna `[Unreleased]`, prova e committa.
3. Esegui `npm run release:patch` sul branch hotfix. Gli incrementi minor/major da hotfix sono rifiutati.
4. Carica branch e tag con i comandi stampati; apri una PR verso `main`. Prova la sua anteprima.
5. Il proprietario approva e autorizza merge/pubblicazione con lo stesso controllo Netlify.
6. Dopo il rilascio, riporta `main` in `staging` tramite PR, così la correzione non si perde nelle funzionalità successive.

## Cosa resta separato

- **Dati:** database isolato per staging e preview; nessun utente, schedina, storico, sessione o sottoscrizione push di produzione deve essere copiato. Per i test usa dati sintetici. Non basta cambiare l'URL del sito.
- **Email e push:** fuori produzione sono ammessi solo destinatari elencati in `STAGING_EMAIL_ALLOWLIST`. Per i push vale l'email dell'utente proprietario del dispositivo, non l'URL della sottoscrizione. Gli invii bloccati sono registrati senza contenuti o indirizzi personali. Una allowlist vuota blocca tutti gli invii esterni.
- **Chiavi:** chiavi DB, cifratura, email e VAPID devono avere valori di test distinti. Gli indirizzi dell'app e dei link di attivazione/opt-out devono puntare all'ambiente di prova.
- **Fantacalcio:** se necessario lo stesso account sorgente di sola lettura può essere reinserito dal proprietario nel DB di prova, ma sessioni e credenziali cifrate non vengono copiate dalla produzione. Verifica i permessi dell'account; l'app non deve modificare la Fantalega.
- **Job:** fuori produzione i job schedulati e i loro worker sono bloccati, salvo `STAGING_ENABLE_SCHEDULES=1`. Lascialo disattivato finché DB e destinazione dei dispatch non sono stati controllati. Netlify non esegue automaticamente i cron dei branch deploy e delle anteprime: il flag abilita l'esecuzione del codice, non crea un nuovo servizio cron. Le prove manuali passano da Functions → Run now, a cura del proprietario.

Le variabili di `netlify.toml` sono di build. Per le Functions il contesto è letto a runtime se presente; altrimenti si usa il file generato in build con solo contesto e branch. È obbligatorio usare la build configurata: un caricamento di file che la salta non garantisce il contesto corretto. Se manca il contesto, il codice considera l'ambiente un'anteprima e blocca gli invii non autorizzati.

## Checklist prima di approvare

- API-FOOTBALL: chiave `API_FOOTBALL_KEY` solo server. Con chiave presente ha precedenza sugli altri live provider. `API_FOOTBALL_FULL_REFRESH` è l'identificativo non segreto dell'operazione completa: una nuova stringa avvia un nuovo recupero della stagione del DB. Il cron ogni minuto spedisce al worker `api-football-refresh-background` un ticket cifrato di due minuti; nessuna rotta pubblica può avviare il batch senza ticket. Report in `football.apiFootballFull` e nel pannello di sistema, console `API_FOOTBALL_FULL_COMPLETE`. Il worker legge abbonamento, calendario stagione corrente e dettagli in gruppi di 20; errori non cancellano dati precedenti. Controllare conteggi di partite, statistiche, giocatori, eventi e conflitti prima di dichiarare il caricamento completo. Non cambiare stagione per riempire dati mancanti.

- Banner giallo, versione e commit corretti; nessun banner sul deploy di produzione approvato.
- Landing/login, Home Oggi con Quasi, prossima mossa, resoconto, obiettivi e Borsa; cinque tab principali.
- Home: “Segui in diretta” sulla giornata in corso; prossima schedina soltanto quando tutti gli incontri della giornata Serie A hanno un risultato finale.
- Selettore lega sempre visibile, anche con una lega; moduli Entra/Crea nel pannello, senza duplicati nella Home.
- Cambi di menu immediati con lo stato della sessione già caricato, senza attendere una nuova lettura completa del DB; bozze conservate durante cambi rapidi e trasporto bloccato.
- Live: solo il batch backend condiviso interroga i provider durante le partite (60 s); il browser legge esclusivamente la nostra API/DB. Il numero di utenti non moltiplica le chiamate ai provider.
- Produzione: `SPORTAPI_KEY` nelle variabili Netlify, solo contesto production; nessuna interpolazione nella build del frontend. Il piano attuale richiede gli scope standard e non consente il flag Secrets Controller con scope limitato alle Functions: il valore resta nello storage cifrato delle variabili del progetto, accessibile ai suoi amministratori. Con un piano che consente scope granulari, restringere alle sole Functions e attivare Secrets Controller. SportAPI.ai fornisce risultati/eventi; ESPN e gli altri servizi restano attivi per le formazioni. Dopo la scoperta condivisa per data, una richiesta al dettaglio per partita attiva ogni 60 s; fuori finestra nessuna chiamata. Il cron resta `* * * * *`. Chiave mai nel frontend, nei log o nel Git. In assenza della variabile resta il percorso precedente per un rollback di configurazione.
- Lega: Classifica, I Quasi, Storico, Regolamento; Admin soltanto al presidente. Chat solo nel pannello flottante.
- Schedina Serie A e Fantacalcio: scelte, salvataggio, dati corretti e due competizioni al massimo.
- Ordine schedine: calcio d’inizio crescente e LIVE in cima; passaggi NS → LIVE → FT con spostamento dei nodi esistenti, conservando pronostici e dettagli aperti.
- Canale live unico ogni 60 secondi: risultati e colori in tutte le viste interessate, timeout, ripresa immediata tornando online/visibili, nessuna sovrapposizione e recupero dopo errore.
- Nessun render globale durante il live: campi, focus, bozze, accordion, formazioni, foto e scorrimento restano stabili. Risposta 304 quando i dati del DB non cambiano.
- Immagini: nessun download nelle sezioni chiuse, squadra nascosta non caricata, al massimo sei foto urgenti nel dettaglio; stanza Home prioritaria e miniature per gallerie/premi.
- Loghi WebP sotto 8 KB, foto ridimensionate e versionate; controllare header immutable degli asset con hash e revalidazione di HTML/JS/CSS.
- Calendario e classifica; dettagli formazioni letti dal DB.
- Invito alla lega e visibilità delle funzioni amministrative.
- Chat e consenso alle notifiche sul dispositivo di prova.
- Email consentita a un tester in allowlist; email esclusa bloccata nei log.
- Promemoria e opt-out puntano a staging e non agli utenti reali.
- Admin di sistema, accesso con codice e viste delle sole informazioni di prova; non eseguire wipe su dati reali.
- Test CI verdi, nessun errore in console, screenshot mobile a 375 px e desktop; confronto Lighthouse Fast 4G con cache fredda.
- Nessuna migrazione o operazione sui dati non dichiarata; nessun segreto nel commit.

## Se qualcosa va storto

Il proprietario apre Netlify → **Deploys**, sceglie il deploy precedente noto e usa **Publish deploy**. Il blocco dell'autopubblicazione deve rimanere attivo per non sovrascrivere subito il rollback.

Questo ripristina il codice distribuito, non il database. La 0.26.0 non modifica lo schema: il normale batch immagini converte gradualmente al massimo 20 ritratti già salvati per esecuzione, con marcatore di versione e digest nuovi. È una migrazione dei soli dati immagine, idempotente; le immagini originali versionate rimangono disponibili. Nessuna copia del DB di produzione viene usata nelle prove.

In Git annulla il merge con `git revert` su un branch `hotfix/*`; se è un merge commit, il comando richiede la scelta del genitore (`git revert -m 1 <commit-merge>`). Verifica con chi segue il codice prima di scegliere. Aggiorna il changelog, esegui un nuovo rilascio patch, apri la PR verso `main` e segui l'approvazione. Non riscrivere i tag esistenti e non fare force push.

## Riferimenti

- [Contesti e header Netlify](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Variabili disponibili nelle Functions](https://docs.netlify.com/build/functions/environment-variables/)
- [Job schedulati nei branch deploy](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Blocco pubblicazioni e rollback](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)
