# Accessi Google, Facebook e Apple

## Stato operativo — 6 novembre 2026

- Google: progetto `quelli-del-quasi-analytics` pubblicato in produzione dopo conferma del proprietario; client Web con callback `https://quellidelquasi.com/api/social-google-callback` verificato nella console. `GOOGLE_LOGIN_ENABLED=true` nella configurazione privata del server. API `/api/social-config` espone Google e il pulsante reale porta alla scelta account Google. Riconosciuti 22 test di autenticazione/interfaccia superati. Il completamento del login reale con consenso dell'account del proprietario resta da provare personalmente; il solo arrivo alla scelta account non dimostra lo scambio del codice OAuth.
- Facebook: caso d'uso Facebook Login e riepilogo per la nuova app “Quelli del Quasi” preparati, condizioni di creazione autorizzate dal proprietario. La creazione è bloccata dalla richiesta Meta di reinserire la password nel browser: non è ancora confermata la creazione di una nuova app, non sono state recuperate credenziali e il provider resta disattivato. La console richiede anche verifica azienda e analisi dell'app per l'uso pubblico. Il proprietario è al telefono: può creare l'app nel proprio browser mobile, poi l'operatore potrà ritrovarla nella lista delle app del medesimo account Meta. Autenticarsi sul telefono non sblocca la richiesta nel browser del PC.
- Apple: non configurato, nessun abbonamento Apple Developer acquistato.

La pubblicazione Google non modifica l'accesso in sola lettura di Analytics. Nessuna chiave è presente in questo documento.

Il login con email/password resta disponibile. L’Admin di sistema conserva il proprio accesso con MFA: i social non lo sostituiscono.

## Configurazione privata

Solo in `C:\ProgramData\QuelliDelQuasiServer\config\app.env`:

- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_VERSION`: versione Graph supportata selezionata nella console Meta, in formato `vNN.0`.
- Apple, facoltativo: `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_FILE` (percorso della chiave P8 privata, mai sotto public/dist).
- `PUBLIC_ORIGIN=https://quellidelquasi.com`.

Attivare separatamente `GOOGLE_LOGIN_ENABLED=true`, `FACEBOOK_LOGIN_ENABLED=true`, `APPLE_LOGIN_ENABLED=true` soltanto dopo aver verificato disponibilità pubblica e configurazione del provider. La presenza dei segreti, da sola, non abilita il login.

Nessun segreto va nel repository, frontend o log. L’API pubblica espone solo l’elenco dei provider configurati. Il browser non carica SDK social all’apertura della pagina; apre il provider solo dopo un clic esplicito. Il consenso alle statistiche resta indipendente dall’accesso.

Redirect autorizzati, esatti:

```
https://quellidelquasi.com/api/social-google-callback
https://quellidelquasi.com/api/social-facebook-callback
https://quellidelquasi.com/api/social-apple-callback
```

Google: client Web, scope `openid email`. Completare branding, dominio/privacy e disponibilità in produzione prima di offrire il pulsante a tutti. Il progetto Analytics può contenere il client senza modificare i permessi del servizio di lettura report.

Facebook: caso d’uso di autenticazione, dati `id,email`, URL di ritorno valido e app pubblicata. La modalità sviluppo limita gli accessi ai ruoli di test. Verificare nella console se Meta richiede ulteriori passaggi/revisione prima dell’uso pubblico. Non richiedere gestione di Pagine, inserzioni o pubblicazione di post per il login.

Apple richiede la configurazione tramite Apple Developer, Services ID associato a un App ID abilitato, dominio/return URL e chiave Sign in with Apple. Finché mancano questi dati il pulsante resta nascosto. Non è stato acquistato alcun abbonamento.

## Collegamento agli account esistenti

- L’identità persistente è `(provider, subject)` e ha precedenza sull’email nei successivi accessi.
- Una Gmail o un indirizzo Workspace per cui Google è autorevole, confermati da un ID token valido, possono collegarsi automaticamente all’account giocatore con la stessa email. Nessun duplicato né modifica a soprannome, leghe, crediti, rose, voti o storico.
- Google non è automaticamente autorevole per ogni email esterna associata a un account Google: in quel caso serve la password del nostro account una sola volta.
- Per un vecchio account non ancora verificato, il collegamento autorevole invalida vecchia password, sessioni e link email: evita il pre-hijacking tramite registrazioni non confermate.
- La sola email Facebook non basta per unire account: una volta viene richiesta la password del nostro account. In seguito basta l’identità Facebook già collegata.
- Un nuovo account Google/Apple con email verificata è subito attivo. Facebook può non fornire una mail o una prova affidabile della sua verifica: si usa la normale conferma email, con possibilità di reinvio e recupero. Non si dichiara verificata una mail senza prova.
- In assenza di una mail equivalente non si prova a indovinare collegamenti, in particolare con indirizzi privati relay Apple. Un collegamento differente già presente non viene sovrascritto.

## Soprannome

Un nuovo account social riceve come soprannome la parte prima di `@`, fino a 60 caratteri. Lo username tecnico è normalizzato e reso unico con suffisso; il soprannome rimane leggibile e non deve essere unico. Un avviso nelle viste del Bar e nel profilo spiega che può essere cambiato. Il flag `nicknameSuggested` viene rimosso solo quando il soprannome cambia davvero, attraverso la normale modifica profilo. Gli utenti già registrati conservano il nome scelto e non ricevono il nuovo avviso.

## Sicurezza e persistenza

- Authorization code flow; Google con PKCE S256. ID token Google/Apple verificati con JOSE, chiavi pubbliche in cache, firma/issuer/audience/scadenza/nonce e verifica email.
- Facebook verifica il token contro il nostro App ID e controlla che `/me` abbia lo stesso ID; `appsecret_proof` nelle letture del profilo.
- State casuale, binding con cookie HttpOnly Secure `__Host-`, provider vincolato, tentativo monouso e scadenza di 10 minuti. Apple usa `form_post` con cookie di tentativo SameSite=None; quello di completamento e la sessione sono SameSite=Strict.
- Start/complete solo POST same-origin. Limiti sui tentativi, sulle dimensioni e sui tempi di rete. Nessuna chiamata esterna mentre il DB è bloccato.
- Si salvano soltanto associazioni permanenti e tentativi transitori; mai access token, refresh token, ID token o client secret nel DB del gioco.
- I campi `socialIdentities`, `socialAttempts`, `socialPending`, `socialLimits` usano la transazione di autenticazione leggera del JSONB esistente: nessuna migrazione di punti o dati sportivi. Sono esclusi dai payload del gioco. Il wipe personale cancella anche associazioni e completamenti riferiti al giocatore.
- Completamento idempotente per retry concorrenti; niente account duplicati o invii email ripetuti. Nessun polling o job periodico.
- Prima di attivare il redirect, filtrare gli URI completi nei log Caddy: i codici di autorizzazione arrivano nelle query. La configurazione del PC usa un encoder filter globale che sostituisce request>uri e rimuove Cookie/Authorization. Il runtime registra soltanto il nome della rotta e codici generici; non logga corpi o URL completi.

## Verifiche

`test/social-auth.test.mjs` e `test/social-ui.test.mjs`: firme/claim, PKCE, binding/state/scadenza/replay, accesso Gmail esistente senza password, account nuovi senza duplicati, nickname modificabile, conferma Facebook, Admin MFA non aggirabile, concorrenza/retry, CSRF, UI mobile e campi password preservati.

Il completamento di una prova simulata non equivale al test reale del provider: verificare callback e sessione con l’account del proprietario dopo la configurazione e prima di considerare ogni provider operativo.

Fonti: https://developers.google.com/identity/openid-connect/openid-connect · https://developers.google.com/identity/gsi/web/guides/verify-google-id-token · https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/ · https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
