# Report processo di rilascio · Quelli del Quasi

## RISCHI — leggere prima di collegare un repository

1. **La separazione dei dati non è ancora attivata sulle piattaforme.** Il codice originale usa NETLIFY_DB_URL prima di DATABASE_URL e, in loro assenza, il database gestito Netlify. Un ambiente di prova con gli stessi valori potrebbe leggere e scrivere utenti, sessioni, schedine e code reali. Non è stata letta alcuna connessione o variabile di produzione. Servono database vuoti separati e verifica del proprietario. Non creare branch DB clonati dai dati di produzione.
2. **Prima dei nuovi guardrail email e push potevano raggiungere utenti reali anche da un deploy di prova.** Ora le destinazioni non autorizzate sono bloccate e registrate; i test usano solo dati sintetici e invii simulati. L'isolamento remoto non è ancora verificato.
3. **Collegare GitHub può avviare subito una build e una pubblicazione.** Prima di qualsiasi collegamento, il proprietario deve usare Deploys → Lock to stop auto publishing e mantenere il blocco. Nessuna produzione è stata pubblicata da questo lavoro.
4. **CONTEXT e BRANCH non sono garantite nelle Functions a runtime.** Su tua approvazione la build genera lib/release-context.json (solo contesto e branch), incluso nel bundle. Il modulo usa questo fallback. Senza un contesto valido prevale preview. Una distribuzione che salti la build non è un rilascio valido. La verifica sul runtime Netlify resta al proprietario.
5. **Dispatch dei job:** il codice preesistente usa DEPLOY_PRIME_URL, altrimenti URL (indirizzo principale del sito). Non impostare STAGING_ENABLE_SCHEDULES=1 finché non hai verificato che i dispatch restino nell'ambiente di prova e che le chiavi di firma/cifratura siano diverse. Fuori produzione cron e worker sono bloccati per default. Nessun dispatch remoto è stato provato.
6. **Autorizzazione del proprietario:** una generica approvazione GitHub non basta. Mantenere bloccata l'autopubblicazione e riservare al proprietario merge e pubblicazione. Per la regola di un'approvazione, GitHub non permette all'autore di approvare la propria PR: serve un secondo revisore fidato se l'autore è il proprietario.

## Stato e perimetro

- Lavoro preparato nella working copy: `C:\Users\Francesco\Documents\Codex\2026-10-30\x20-aqa-2\work\quelli-del-quasi-rilascio`. Stesso Git locale del progetto originale; nessun remote configurato.
- La cartella originale è rimasta sul suo master con le modifiche preesistenti; non è stata ripulita o sovrascritta.
- Autore autorizzato usato con opzioni temporanee dei soli commit. Nessuna configurazione Git globale modificata.
- Nessun deploy, push, connessione al DB, invio reale o operazione nelle dashboard. Nessuna migrazione o nuova dipendenza runtime.
- Baseline main: 8ff95e3, versione 0.25.1; tag annotato v0.25.1. Frontend baseline: 127 file identici alla sorgente locale pubblicata. I seed privati non sono stati letti o copiati: nel nuovo albero sono vuoti. Bootstrap amministratore vuoto.
- Nella preparazione cambia solo public/index.html per il banner (11 righe inline). Nessun public/src, altro HTML o CSS modificato.

## Passo 1 — inventario iniziale, sola lettura

### Branch e configurazione di produzione

All'inizio: solo master, commit 21e6490 “Baseline frontend ricevuto”; nessun tag o remote. main e staging mancavano. La 0.25.1 era nel working tree, non nella storia. Non si deduce il branch di produzione da netlify.toml; la documentazione precedente descrive deploy manuali. La configurazione effettiva nella console non è stata letta: il proprietario deve confermarla.

### netlify.toml iniziale

Build senza comando; publish public; Functions netlify/functions con esbuild. Nessun context. Di seguito il contenuto della baseline, senza segreti:

```toml
[build]
  publish = "public"
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
[functions."sync-football"]
  schedule = "* * * * *"
[functions."send-mail"]
  schedule = "*/30 * * * *"
[functions."sync-fantacalcio"]
  schedule = "*/5 * * * *"
[functions."send-chat-push"]
  schedule = "* * * * *"
[functions."send-reminders"]
  schedule = "* * * * *"
[functions."sync-match-cache"]
  schedule = "*/5 * * * *"
[functions."sync-fantasy-lineups"]
  schedule = "0 * * * *"
[functions."fantasy-lineups-background"]
  external_node_modules = ["@sparticuz/chromium", "puppeteer-core"]
  included_files = ["node_modules/@sparticuz/chromium/bin/**"]
[functions."fantasy-pages-background"]
  external_node_modules = ["@sparticuz/chromium", "puppeteer-core"]
  included_files = ["node_modules/@sparticuz/chromium/bin/**"]
[[redirects]]
  from = "https://www.quellidelquasi.com/*"
  to = "https://quellidelquasi.com/:splat"
  status = 301
  force = true
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
    X-Frame-Options = "DENY"

[[headers]]
  for = "/account.html"
  [headers.values]
    Cache-Control = "no-store"
    Referrer-Policy = "no-referrer"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

### Functions e nomi delle variabili

Elenco conservativo: variabili lette direttamente e nei moduli importati transitivamente. Un'importazione può portare nomi che non vengono usati in ogni invocazione. Sono riportati solo i nomi, non i valori; non sono state consultate variabili delle piattaforme.

| Function | Nomi variabili nella baseline |
|---|---|
| api.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `ENABLE_DEMO`, `ENABLE_FANTACALCIO_DIRECT`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_DRIVER`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `SUPPORT_TO`, `URL`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_SUBJECT` |
| fantasy-batch-background.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `ENABLE_FANTACALCIO_DIRECT`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |
| fantasy-lineups-background.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `ENABLE_FANTACALCIO_DIRECT`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |
| fantasy-pages-background.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_LOGIN_BOOTSTRAP`, `FANTACALCIO_LOGIN_BOOTSTRAP_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `FANTACALCIO_SNAPSHOT_IMPORT`, `FANTACALCIO_SNAPSHOT_IMPORT_0`, `FANTACALCIO_SNAPSHOT_IMPORT_1`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |
| match-cache-background.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |
| send-chat-push.mjs | `DATABASE_URL`, `NETLIFY_DB_URL`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_SUBJECT` |
| send-mail.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `FANTACALCIO_PAGE_READER_ENABLED`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |
| send-reminders.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `FANTACALCIO_PAGE_READER_ENABLED`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_SUBJECT` |
| sync-fantacalcio.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DEPLOY_ID`, `DEPLOY_PRIME_URL`, `ENABLE_FANTACALCIO_DIRECT`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `RESEND_API_KEY`, `URL` |
| sync-fantasy-lineups.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `CONTEXT`, `DATABASE_URL`, `DEPLOY_ID`, `DEPLOY_PRIME_URL`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `FANTACALCIO_SNAPSHOT_IMPORT`, `FANTACALCIO_SNAPSHOT_IMPORT_0`, `FANTACALCIO_SNAPSHOT_IMPORT_1`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |
| sync-football.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `FANTACALCIO_PAGE_READER_ENABLED`, `LEGACY_RECOVERY_CONFIG`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `ODDS_API_BOOKMAKERS`, `ODDS_API_KEY`, `ODDS_API_MAX_EVENTS`, `ODDS_API_REGIONS`, `ODDS_API_RESERVE`, `ODDS_API_SPORT`, `RESEND_API_KEY`, `URL` |
| sync-match-cache.mjs | `ADMIN_OTP_KEY`, `API_FOOTBALL_KEY`, `APP_BASE_URL`, `DATABASE_URL`, `DEPLOY_ID`, `DEPLOY_PRIME_URL`, `FANTACALCIO_ENCRYPTION_KEY`, `FANTACALCIO_PAGE_READER_ENABLED`, `FANTACALCIO_SERVER_TRANSPORT`, `MAIL_ENCRYPTION_KEY`, `MAIL_FROM`, `NETLIFY`, `NETLIFY_DB_URL`, `RESEND_API_KEY`, `URL` |

Nuovi controlli condivisi: CONTEXT, BRANCH, STAGING_EMAIL_ALLOWLIST, STAGING_ENABLE_SCHEDULES. Build/banner: APP_ENV, ENABLE_ENV_BANNER, COMMIT_REF; DEPLOY_PRIME_URL resta una variabile preesistente di dispatch.

### Dati e connessione

PostgreSQL, tramite @netlify/database e pg; lib/db.mjs usa NETLIFY_DB_URL oppure DATABASE_URL, altrimenti il database gestito dal SDK. Le tabelle definite nel sorgente sono fanta_state (stato JSON), fanta_login_limits, football_player_catalog e football_player_images. Non risultano Netlify Blobs. Il SQLite nella cartella originale è uno strumento locale e non è stato copiato. File pubblici Serie A sono seed; seed delle leghe private e materiale di anteprima sono esclusi. Nessun dato di produzione è stato trasferito in staging.

### Effetti verso l'esterno

- Resend: attivazione, recupero account, codice amministrativo, suggerimenti e promemoria email facoltativi; opt-out firmato gestito dall'app.
- Web Push: chat e promemoria schedina ai dispositivi iscritti.
- Fantacalcio: autenticazione, calendario/risultati, download ufficiale delle formazioni e risorse squadra; browser server isolato. I precedenti rifiuti del provider non sono affrontati in questo lavoro.
- Dati sportivi/immagini/quote: provider già presenti nei moduli football, live-scores, match-data, final-scores, lineup-consensus e player-media. Nessun provider cambiato.
- Pianificati: sync-football ogni minuto; send-mail ogni 30 minuti; sync-fantacalcio ogni cinque minuti; send-chat-push e send-reminders ogni minuto; sync-match-cache ogni cinque minuti; sync-fantasy-lineups ogni ora. Worker in background separati. Frequenze invariate.

### Test

Esiste npm test (Node test runner). Dopo i guardrail usa test/setup-release-context.mjs per il contesto produttivo dei test storici; i test di ambiente impostano esplicitamente preview/staging. Nuovi test verificano blocchi invii, job, build e release su dati sintetici. Nessun segreto di produzione caricato o fornito ai test; gli invii delle prove sono simulati.

## Passi 2–9 — esito

| Passo | Esito |
|---|---|
| 2 | main dalla 0.25.1 locale autorizzata; staging creato. Working copy distinta, stesso Git. |
| 3 | Un solo modulo lib/release-env.mjs; guardrail email, cc/bcc, push e job; DB non produzione richiede una URL esplicita. Protezioni locali verificate. |
| 4 | Context production/staging/deploy-preview; publish, bundler, redirect e cron originali mantenuti. Comando ausiliario di build necessario per metadati, come ai passi 4–5. Header noindex generato solo fuori produzione, workaround autorizzato. |
| 5 | public/env.json e lib/release-context.json generati, non committati; banner inline entro 15 righe. In produzione env.json contiene solo env=production e il file _headers generato viene rimosso. |
| 6 | CHANGELOG, script semver, comandi npm e tag annotato della baseline; script provato senza push su repository temporanei. Nessuna nuova versione rilasciata realmente. PR tecnica release/* → staging aggiunta su autorizzazione successiva, perché staging protetto non accetta push diretti. |
| 7 | Template PR e CI locale configurati. GitHub Actions non ancora eseguite sul servizio. |
| 8 | docs/RILASCIO.md completo, con approvazione e pubblicazione manuale del proprietario. |
| 9 | Branch locale feature/test-processo: una sola riga aggiunta a CHANGELOG. Nessuna PR aperta: richiede GitHub e la regola 5 impone l'azione al proprietario. Nessun merge della prova. |

## Verifiche eseguite

- npm ci --ignore-scripts nella working copy separata: dipendenze identiche al lockfile; nessun aggiornamento runtime.
- npm test: **414 superati, 0 falliti**.
- node scripts/check-syntax.mjs: **192 file JavaScript verificati**.
- Build staging locale nella working copy eseguita senza deploy; build staging, preview e produzione provate anche in directory temporanee: metadata corretti, noindex assente in produzione, pulizia dell'output preview dopo build produzione; fallback runtime verificato localmente.
- Invio verso indirizzo sintetico fuori allowlist: log NONPRODUCTION_DELIVERY_BLOCKED e zero chiamate al provider. cc/bcc filtrati; push chat/promemoria bloccati sul proprietario del dispositivo non autorizzato.
- Gli undici entrypoint dei job si fermano fuori produzione prima di DB o rete.
- Release patch/minor/major e hotfix provate in Git temporanei: commit, tag annotato, data italiana, cache PWA e guardie funzionanti; nessun remote o push.
- **Non verificati online:** deploy anteprima, URL staging, banner remoto, CI GitHub, log Function remoto, isolamento DB effettivo e protezioni dei branch. Non sono successi simulati.

## File toccati e righe — passo 3 e banner passo 5

Riferimenti alle righe attuali; per eliminazioni la posizione è il punto del diff. Nessun valore di segreto compare nei diff.

| Passo | File | Righe del cambiamento |
|---|---|---|
| 3 | lib/db.mjs | 1 |
| 3 | lib/db.mjs | 33 |
| 3 | lib/league-chat.mjs | 1 |
| 3 | lib/league-chat.mjs | 333 |
| 3 | lib/league-reminders.mjs | 1 |
| 3 | lib/league-reminders.mjs | 34 |
| 3 | lib/mail-delivery.mjs | 7–9 |
| 3 | lib/mail.mjs | 1 |
| 3 | lib/mail.mjs | 95–96 |
| 3 | lib/release-env.mjs | 1–23 |
| 3 | netlify/functions/fantasy-batch-background.mjs | 1 |
| 3 | netlify/functions/fantasy-batch-background.mjs | 6 |
| 3 | netlify/functions/fantasy-lineups-background.mjs | 1 |
| 3 | netlify/functions/fantasy-lineups-background.mjs | 5 |
| 3 | netlify/functions/fantasy-pages-background.mjs | 1 |
| 3 | netlify/functions/fantasy-pages-background.mjs | 4–5 |
| 3 | netlify/functions/match-cache-background.mjs | 1 |
| 3 | netlify/functions/match-cache-background.mjs | 11 |
| 3 | netlify/functions/send-chat-push.mjs | 1 |
| 3 | netlify/functions/send-chat-push.mjs | 5 |
| 3 | netlify/functions/send-mail.mjs | 1 |
| 3 | netlify/functions/send-mail.mjs | 7 |
| 3 | netlify/functions/send-reminders.mjs | 1 |
| 3 | netlify/functions/send-reminders.mjs | 8 |
| 3 | netlify/functions/sync-fantacalcio.mjs | 1 |
| 3 | netlify/functions/sync-fantacalcio.mjs | 6 |
| 3 | netlify/functions/sync-fantasy-lineups.mjs | 1 |
| 3 | netlify/functions/sync-fantasy-lineups.mjs | 6 |
| 3 | netlify/functions/sync-football.mjs | 1 |
| 3 | netlify/functions/sync-football.mjs | 20 |
| 3 | netlify/functions/sync-match-cache.mjs | 1 |
| 3 | netlify/functions/sync-match-cache.mjs | 4 |
| 5 | public/index.html | 159–170 |
| 5 | public/index.html | 172 |

## Altri file per passo

| Passo | File |
|---|---|
| 2 | .gitignore; baseline completa del progetto, elencata sotto. JSON privati sostituiti da contenitori vuoti e bootstrap vuoto nella nuova working copy. |
| 3 | package.json (solo comando test), test/setup-release-context.mjs, test/release-env.test.mjs; test/fantasy-assets-b.test.mjs usa fixture sintetica al posto del seed privato, senza cambiare la funzione testata. |
| 4 | netlify.toml |
| 5 | scripts/build-release-env.mjs, test/release-build.test.mjs, public/index.html |
| 6 | CHANGELOG.md, scripts/release.mjs, test/release-script.test.mjs, package.json (script npm), docs/RILASCIO.md per la PR tecnica autorizzata; il release script aggiorna anche i soli metadati versione del package-lock se presente. |
| 7 | .github/pull_request_template.md, .github/workflows/ci.yml, scripts/check-syntax.mjs |
| 8 | docs/RILASCIO.md |
| 9 | CHANGELOG.md: una riga soltanto nel branch feature/test-processo |
| 10 | docs/REPORT-PROCESSO-RILASCIO.md e copie consultabili della guida/report nella cartella outputs. |

<details><summary>Passo 2 — elenco file della baseline main, escluso lo storico precedente</summary>

```text
.gitignore
browser-connector/background.mjs
browser-connector/calendar-dom.mjs
browser-connector/fantasy-detail-dom.mjs
browser-connector/manifest.json
browser-connector/popup.css
browser-connector/popup.html
browser-connector/popup.mjs
data/fantasy-assets-b.json
data/fantasy-assets.json
data/fantasy-observed.json
data/historical-results-2026.json
data/match-cache-final.json
data/match-details-2026.json
data/serie-a-2026.json
data/seriea-player-media-seed.json
data/team-logos.json
lib/account.mjs
lib/budget.mjs
lib/calendar.mjs
lib/client-snapshot.mjs
lib/community.mjs
lib/configured-recovery.mjs
lib/day-objectives.mjs
lib/db.mjs
lib/editorial-lineups.mjs
lib/email-templates.mjs
lib/estimated-odds.mjs
lib/fantacalcio-api.mjs
lib/fantacalcio-bridge.mjs
lib/fantacalcio-client.mjs
lib/fantacalcio-export.mjs
lib/fantacalcio-legacy.mjs
lib/fantacalcio.mjs
lib/fantasy-assets.mjs
lib/fantasy-batch.mjs
lib/fantasy-browser-session.mjs
lib/fantasy-config.mjs
lib/fantasy-credential-bootstrap.mjs
lib/fantasy-details.mjs
lib/fantasy-import.mjs
lib/fantasy-limits.mjs
lib/fantasy-lineup-download.mjs
lib/fantasy-lineups-batch.mjs
lib/fantasy-lineups-export.mjs
lib/fantasy-odds.mjs
lib/fantasy-page-batch.mjs
lib/fantasy-page-reader.mjs
lib/fantasy-rankings.mjs
lib/fantasy-server-details.mjs
lib/fantasy-snapshot-import.mjs
lib/fantasy-ticket.mjs
lib/fantasy-wallet.mjs
lib/final-scores.mjs
lib/football.mjs
lib/forecast-sources.mjs
lib/game.mjs
lib/league-chat.mjs
lib/league-management.mjs
lib/league-reminders.mjs
lib/lineup-consensus.mjs
lib/lineups.mjs
lib/live-scores.mjs
lib/mail-delivery.mjs
lib/mail.mjs
lib/match-cache.mjs
lib/match-data.mjs
lib/platform-admin.mjs
lib/player-analysis.mjs
lib/player-media.mjs
lib/player-seed.mjs
lib/player-store.mjs
lib/progression.mjs
lib/reminder-email.mjs
lib/scoring.mjs
lib/serie-a-table.mjs
lib/support.mjs
lib/system-admin-auth.mjs
lib/system-admin-bootstrap.json
lib/system-admin-operations.mjs
netlify.toml
netlify/database/migrations/001_initial.sql
netlify/database/migrations/002_player_portraits.sql
netlify/functions/api.mjs
netlify/functions/fantasy-batch-background.mjs
netlify/functions/fantasy-lineups-background.mjs
netlify/functions/fantasy-pages-background.mjs
netlify/functions/match-cache-background.mjs
netlify/functions/send-chat-push.mjs
netlify/functions/send-mail.mjs
netlify/functions/send-reminders.mjs
netlify/functions/sync-fantacalcio.mjs
netlify/functions/sync-fantasy-lineups.mjs
netlify/functions/sync-football.mjs
netlify/functions/sync-match-cache.mjs
package-lock.json
package.json
public/account.html
public/admin.html
public/assets/icons/apple-touch-icon.png
public/assets/icons/icon-192.png
public/assets/icons/icon-512.png
public/assets/icons/icon-maskable-512.png
public/assets/rooms-v2/base-room-01.webp
public/assets/rooms-v2/base-room-02.webp
public/assets/rooms-v2/base-room-03.webp
public/assets/rooms-v2/base-room-04.webp
public/assets/rooms-v2/base-room-05.webp
public/assets/rooms-v2/base-room-06.webp
public/assets/rooms-v2/base-room-07.webp
public/assets/rooms-v2/base-room-08.webp
public/assets/rooms-v2/base-room-09.webp
public/assets/rooms-v2/base-room-10.webp
public/assets/rooms-v2/room-top.webp
public/assets/rooms-v2/tier-01-b.webp
public/assets/rooms-v2/tier-01-c.webp
public/assets/rooms-v2/tier-01.webp
public/assets/rooms-v2/tier-02-b.webp
public/assets/rooms-v2/tier-02-c.webp
public/assets/rooms-v2/tier-02.webp
public/assets/rooms-v2/tier-03-b.webp
public/assets/rooms-v2/tier-03-c.webp
public/assets/rooms-v2/tier-03.webp
public/assets/rooms-v2/tier-04-b.webp
public/assets/rooms-v2/tier-04-c.webp
public/assets/rooms-v2/tier-04.webp
public/assets/rooms-v2/tier-05-b.webp
public/assets/rooms-v2/tier-05-c.webp
public/assets/rooms-v2/tier-05.webp
public/assets/rooms-v2/tier-06-b.webp
public/assets/rooms-v2/tier-06-c.webp
public/assets/rooms-v2/tier-06.webp
public/assets/rooms-v2/tier-07-b.webp
public/assets/rooms-v2/tier-07-c.webp
public/assets/rooms-v2/tier-07.webp
public/assets/rooms-v2/tier-08-b.webp
public/assets/rooms-v2/tier-08-c.webp
public/assets/rooms-v2/tier-08.webp
public/assets/rooms-v2/tier-09-b.webp
public/assets/rooms-v2/tier-09-c.webp
public/assets/rooms-v2/tier-09.webp
public/assets/rooms-v2/tier-10-b.webp
public/assets/rooms-v2/tier-10.webp
public/assets/teams/103.png
public/assets/teams/104.png
public/assets/teams/105.png
public/assets/teams/107.png
public/assets/teams/109.png
public/assets/teams/110.png
public/assets/teams/111.png
public/assets/teams/112.png
public/assets/teams/113.png
public/assets/teams/114.png
public/assets/teams/115.png
public/assets/teams/118.png
public/assets/teams/17530.png
public/assets/teams/239.png
public/assets/teams/2572.png
public/assets/teams/2925.png
public/assets/teams/3263.png
public/assets/teams/3997.png
public/assets/teams/4007.png
public/assets/teams/4057.png
public/chat.css
public/dashboard.css
public/experience.css
public/fantasy.css
public/icon.svg
public/index.html
public/league-logo.svg
public/league-settings.css
public/lineup-pitch.css
public/manifest.webmanifest
public/market-navigation.css
public/match-layout.mjs
public/mobile-sections.css
public/password-toggle.css
public/prediction.mjs
public/progression.css
public/quasi-studio.css
public/reminder-off.html
public/src/achievement-board.mjs
public/src/achievements.mjs
public/src/admin.mjs
public/src/app.mjs
public/src/auth-submit.mjs
public/src/avatar-art.mjs
public/src/avatar-renderer.mjs
public/src/avatar.mjs
public/src/calendar-dom.mjs
public/src/calendar-order.mjs
public/src/chat.mjs
public/src/community.mjs
public/src/day-objectives.mjs
public/src/deferred-media.mjs
public/src/fantasy-detail-dom.mjs
public/src/fantasy-match.mjs
public/src/fantasy-rankings.mjs
public/src/fantasy-ui.mjs
public/src/fantasy.mjs
public/src/league-dashboard.mjs
public/src/league-invite.mjs
public/src/league-theme.mjs
public/src/lineup-pitch.mjs
public/src/locker-rooms.mjs
public/src/notifications.mjs
public/src/password-toggle.mjs
public/src/progression-ui.mjs
public/src/pwa-viewport.mjs
public/src/quasi-roster.mjs
public/src/quasi-scene.mjs
public/src/quasi-studio.mjs
public/src/reminder-off.mjs
public/src/reward-catalog.mjs
public/src/reward-rules.mjs
public/src/slip-results.mjs
public/src/slip-state.mjs
public/src/styled-select.mjs
public/src/system-admin.mjs
public/styles.css
public/sw.js
public/system-admin.css
public/team-logos.js
public/version.json
scripts/dev.mjs
scripts/preview-key.mjs
scripts/verify-release.mjs
test/account-page.test.mjs
test/account.test.mjs
test/auth-submit.test.mjs
test/bridge.test.mjs
test/calendar-order.test.mjs
test/chat.test.mjs
test/connector-worker.test.mjs
test/day-objectives.test.mjs
test/deferred-media.test.mjs
test/email-templates.test.mjs
test/estimated-odds.test.mjs
test/experience.test.mjs
test/fantacalcio-legacy.test.mjs
test/fantasy-assets-b.test.mjs
test/fantasy-assets.test.mjs
test/fantasy-authenticated-reader.test.mjs
test/fantasy-batch.test.mjs
test/fantasy-bookmaker.test.mjs
test/fantasy-browser-session.test.mjs
test/fantasy-config.test.mjs
test/fantasy-credential-bootstrap.test.mjs
test/fantasy-detail-dom.test.mjs
test/fantasy-incremental.test.mjs
test/fantasy-lineup-download.test.mjs
test/fantasy-lineups-batch.test.mjs
test/fantasy-lineups-export.test.mjs
test/fantasy-page-batch.test.mjs
test/fantasy-page-reader.test.mjs
test/fantasy-rankings.test.mjs
test/fantasy-snapshot-import.test.mjs
test/final-cache.test.mjs
test/formation-session.test.mjs
test/game.test.mjs
test/interface-live.test.mjs
test/lazy-snapshot.test.mjs
test/league-creation-retry.test.mjs
test/league-dashboard.test.mjs
test/league-management.test.mjs
test/league-reminders.test.mjs
test/lineup-consensus.test.mjs
test/live-display.test.mjs
test/live-enrichment.test.mjs
test/live-source.test.mjs
test/mail-delivery.test.mjs
test/match-cache.test.mjs
test/match-polling.test.mjs
test/mobile-ux.test.mjs
test/notifications.test.mjs
test/official-lineup-link.test.mjs
test/password-toggle.test.mjs
test/platform-admin.test.mjs
test/player-media.test.mjs
test/progression-rewards.test.mjs
test/pwa-viewport.test.mjs
test/quasi-studio-achievements.test.mjs
test/scoring.test.mjs
test/slip-results.test.mjs
test/social-and-layout.test.mjs
test/support.test.mjs
test/system-admin.test.mjs
test/updates.test.mjs
```
</details>

## Chiarimenti autorizzati durante il lavoro

- main creato dalla 0.25.1 locale, con esclusione dei dati privati e dei segreti.
- Header noindex generati in build soltanto per ambienti non produzione.
- Fallback del contesto runtime tramite file generato contenente soltanto contesto e branch.
- Autore dei commit fornito dal proprietario; configurazione globale non modificata.
- PR tecnica release/vX.Y.Z → staging prima di staging → main, senza bypass delle protezioni; nessun push diretto sui branch protetti.

## Domande aperte

1. Quale repository GitHub privato collegherai e quale account GitHub è il proprietario autorizzato ad approvare? Nessun URL remoto è stato fornito o inventato.
2. Qual è il branch di produzione attualmente configurato nella console Netlify? La destinazione desiderata è main, ma non è stata modificata la console.
3. Quali indirizzi di tester vuoi in STAGING_EMAIL_ALLOWLIST? Non metterli nel repository.
4. Come verrà fornito DEPLOY_PRIME_URL a runtime per le prove manuali dei job? Prima di chiarirlo mantieni STAGING_ENABLE_SCHEDULES non abilitato.
5. Se l'export Fantacalcio richiede un account amministratore, è disponibile un account di test approvato? Non è stata copiata alcuna credenziale o sessione reale.

## Azioni per il proprietario

**Prima di tutto:** Netlify → progetto quelli-del-quasi → Deploys → **Lock to stop auto publishing**. Mantieni il sito sul deploy attuale. Non collegare il repository prima di aver impostato questo blocco.

1. **GitHub → New repository:** crea o individua il repository privato. Dal progetto locale configura il remote e carica i branch solo dopo il blocco Netlify; questi comandi non sono stati eseguiti dall'agente. Non fare push diretto su main: per il suo caricamento iniziale concorda l'import del repository tramite la tua gestione GitHub e le protezioni, senza innescare pubblicazioni.
2. **GitHub → repository → Settings → Branches → Add branch protection rule:** main con PR obbligatoria, almeno un'approvazione, CI “Test e sintassi” richiesta, niente force push e niente cancellazione; staging con PR obbligatoria e CI verde. Se l'interfaccia usa Rulesets: Settings → Rules → Rulesets. Applica le regole anche a chi amministra; limita il merge di main al proprietario, senza concedere bypass all'automazione. Per una tua PR serve un revisore diverso per soddisfare l'approvazione GitHub.
3. **Netlify → Project configuration (Site configuration) → Build & deploy → Continuous deployment → Repository:** collega il repository soltanto dopo aver bloccato l'autopubblicazione e predisposto i dati di test. Poi **Branches and deploy contexts**: production branch main; Branch deploys → Let me add individual branches → staging; Deploy Previews attive. Build command deve essere node scripts/build-release-env.mjs, publish public, functions netlify/functions. Non usare Publish deploy durante la preparazione.
4. **Provider DB attuale / Netlify → Data & storage → Database:** crea una base vuota separata per staging e una separata per preview, oppure una base preview dedicata con soli dati sintetici. Non usare fork o backup della produzione che copino utenti o sessioni. Se la UI Netlify non permette un database nuovo vuoto, usa la console del provider già collegato, senza cambiarlo. Lo schema esistente richiede inizializzazione controllata: qui non è stata eseguita alcuna migrazione. Non procedere al test applicativo finché lo schema e i dati sintetici non sono disponibili.
5. **Netlify → Project configuration → Environment variables:** apri ogni variabile e limita/assegna i valori per Production, Branch deploys e Deploy Previews come nella tabella seguente. Includi lo scope Functions per quelle runtime; i valori nel TOML sono soltanto build. Non usare valori ereditati della produzione nei test e non inserirli in chat o Git.
6. **Prima PR di prova:** carica solo staging e feature/test-processo dal Git locale dopo le configurazioni. In GitHub → Pull requests → New pull request: base staging, compare feature/test-processo. Titolo suggerito “rilascio: passo 9 – prova processo”. Lascia la PR aperta, senza merge. Il diff deve contenere una sola riga di CHANGELOG.
7. **Verifica cloud:** nella PR apri il controllo Netlify e controlla banner giallo, versione/commit, X-Robots-Tag e CI verde. Netlify → Functions → seleziona l'API del deploy di anteprima / log del relativo deploy: prova un invio dal solo account sintetico fuori allowlist, verifica NONPRODUCTION_DELIVERY_BLOCKED; nessun provider deve essere chiamato. Non usare Run now su un job finché il suo isolamento non è verificato.
8. **Solo dopo tutte le prove:** apri la PR staging → main per installare il processo anche sul branch produttivo. Il proprietario deve approvare esplicitamente l'eventuale rilascio. La pubblicazione resta una sua azione con Netlify bloccato; questo lavoro non la esegue.
9. **Facoltativo:** Netlify → Project configuration → Access & security → Visitor access / Access control → password per deploy non produzione, se disponibile sul piano. Non sostituisce l'isolamento dei dati.
10. **Facoltativo:** Netlify → Domain management → Branch subdomains / Add domain → collega staging.quellidelquasi.com al branch staging e configura il DNS indicato. Aggiorna anche gli indirizzi di app/email di staging senza cambiare quelli di produzione.

### Variabili da separare per Branch deploys e Deploy Previews

| Nomi | Cosa deve fare il proprietario |
|---|---|
| NETLIFY_DB_URL, DATABASE_URL | Entrambe devono risolvere soltanto al DB vuoto dell'ambiente corretto; la prima ha priorità. Non lasciare la prima puntata alla produzione mentre cambi soltanto la seconda. |
| NETLIFY_DB_DRIVER | Confermare il driver previsto, senza usarlo per aggirare l'isolamento. |
| APP_BASE_URL | Indirizzo dell'ambiente di prova per attivazione, recupero e opt-out. |
| RESEND_API_KEY, MAIL_FROM | Credenziale di test e mittente autorizzato per test; nessuna chiave produttiva copiata. |
| MAIL_ENCRYPTION_KEY, ADMIN_OTP_KEY, FANTACALCIO_ENCRYPTION_KEY | Valori nuovi dedicati ai test, stabili nell'ambiente; diversi dalla produzione. Nessun ciphertext produttivo da decifrare. |
| WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT | Identità VAPID e contatto di test distinti; solo dispositivi dei tester sul DB di prova. |
| STAGING_EMAIL_ALLOWLIST | Solo indirizzi approvati dei tester, separati da virgola. Vuota significa bloccare tutti gli invii esterni. |
| STAGING_ENABLE_SCHEDULES | Lasciare non abilitato; usare 1 solo dopo controllo del DB, delle chiavi di firma e dell'URL del dispatch. Il servizio Netlify non crea cron automatici nei preview/branch deploy. |
| SUPPORT_TO | Casella del tester autorizzata, non una destinazione produttiva. |
| API_FOOTBALL_KEY, ODDS_API_KEY | Chiavi di test separate o assenti; se il servizio non consente chiavi di test, non abilitarlo senza valutazione esplicita del proprietario. |
| ODDS_API_SPORT, ODDS_API_REGIONS, ODDS_API_BOOKMAKERS, ODDS_API_MAX_EVENTS, ODDS_API_RESERVE | Parametri pubblici, configurabili per i test; rispettare le quote del servizio. |
| ENABLE_FANTACALCIO_DIRECT, FANTACALCIO_PAGE_READER_ENABLED, FANTACALCIO_SERVER_TRANSPORT | Connettore disabilitato nei test fino alla configurazione approvata; eventuale sessione reinserita nel solo DB di prova dal proprietario. |
| FANTACALCIO_LOGIN_BOOTSTRAP, FANTACALCIO_LOGIN_BOOTSTRAP_KEY, FANTACALCIO_SNAPSHOT_IMPORT, FANTACALCIO_SNAPSHOT_IMPORT_0, FANTACALCIO_SNAPSHOT_IMPORT_1, LEGACY_RECOVERY_CONFIG | Nessun valore in staging/preview: sono configurazioni operative temporanee, non dati da ereditare. |
| ENABLE_DEMO | Scelta esplicita del proprietario per utenti sintetici sul DB di test. |
| CONTEXT, BRANCH, APP_ENV, ENABLE_ENV_BANNER, COMMIT_REF | Metadati di build non segreti; CONTEXT/BRANCH salvati nel file generato come fallback runtime. Non affidarsi a variabili di build come se fossero automaticamente runtime. |
| URL, DEPLOY_PRIME_URL, DEPLOY_ID, NETLIFY | Metadati Netlify, non chiavi da copiare. Verificare disponibilità a runtime e destinazione dei dispatch; non sovrascrivere variabili riservate. |

## Fonti tecniche primarie

- [Netlify: contesti e limiti degli header](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Netlify: variabili Functions e runtime](https://docs.netlify.com/build/functions/environment-variables/)
- [Netlify: scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Netlify: autopubblicazione e rollback](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)

La configurazione CI usa actions/checkout e actions/setup-node v7, come documentato nei rispettivi README ufficiali; Node 24 e permessi di sola lettura. Nessuna dipendenza runtime del progetto è stata aggiornata.

- [Checkout ufficiale](https://github.com/actions/checkout)
- [Setup Node ufficiale](https://github.com/actions/setup-node)
