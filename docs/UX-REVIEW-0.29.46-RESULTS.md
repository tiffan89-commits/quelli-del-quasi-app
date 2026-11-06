# Revisione UX 0.29.46 — avanzamento

Branch: `ux/review-0.29.46`. Solo anteprima locale isolata (`npm run dev`), account sintetici anteprima per Bar e frankwood per Fanta; sessione automatica di prova limitata al processo di sviluppo. Dati soltanto in RAM/PGlite. Nessun file ambiente di produzione caricato, nessun accesso al DB reale, invio esterno o job verso utenti reali.

Misure effettive del documento nel viewport 390×844 e 1280×800; font caricati e stesse viste/dati prima e dopo. Possono differire dalle misure della revisione originale: vengono riportati i valori rilevati in questa sessione.

## Blocco 1 — footer e margini finali

Un solo footer: i controlli Privacy/Statistiche esistenti vengono spostati, conservando gli handler del consenso, accanto ai testi dell’app. Un unico margine finale segue l’ingombro effettivo delle barre fisse; nessuna riserva aggiuntiva per la navigazione desktop o le barre sticky già nel flusso. Nessuna modifica ai dati o alla logica di gioco.

| Vista | Viewport | Prima | Dopo | Riduzione |
|---|---|---:|---:|---:|
| bar-oggi | 390×844 | 2619 px | 2450 px | 169 px |
| bar-schedina | 390×844 | 1626 px | 1436 px | 190 px |
| bar-classifica | 390×844 | 2134 px | 1965 px | 169 px |
| bar-quasi | 390×844 | 2606 px | 2437 px | 169 px |
| bar-profilo | 390×844 | 2234 px | 2065 px | 169 px |
| fanta-oggi | 390×844 | 1922 px | 1830 px | 92 px |
| fanta-squadra | 390×844 | 2058 px | 1966 px | 92 px |
| bar-oggi | 1280×800 | 2838 px | 2577 px | 261 px |
| bar-schedina | 1280×800 | 1808 px | 1352 px | 456 px |
| bar-classifica | 1280×800 | 2241 px | 1979 px | 262 px |
| bar-quasi | 1280×800 | 2701 px | 2439 px | 262 px |
| bar-profilo | 1280×800 | 2245 px | 1983 px | 262 px |
| fanta-oggi | 1280×800 | 1561 px | 1446 px | 115 px |
| fanta-squadra | 1280×800 | 1644 px | 1529 px | 115 px |

Il blocco analytics passa da 166 a 34 px e viene incluso nel footer, senza un secondo margine finale. Test pertinenti: 13 passati (footer, analytics, interfaccia live). Verificata la conservazione dei controlli dopo navigazione Bar/Fanta.

Screenshot: [footer a 390 px](ux-0.29.46/blocco1-footer-390.png).

## Blocco 2 — barra schedina e chat

Barra ridotta da 171 a 64 px, con riepilogo a sinistra e conferma a destra. L’importo si modifica da un pannello sopra la barra; importi rapidi, personalizzato e chiusura con Escape conservano la bozza. La chat flottante viene nascosta quando la barra è presente. Nessuna modifica a payload, saldi, limiti o calcoli.

| Vista | Viewport | Prima (dopo blocco 1) | Dopo | Riduzione |
|---|---|---:|---:|---:|
| bar-schedina | 390×844 | 1436 px | 1331 px | 105 px |
| bar-schedina | 1280×800 | 1352 px | 1245 px | 107 px |

Verificati graficamente entrambi i formati, apertura del pannello importo, scelta rapida, importo personalizzato e conservazione della bozza. La fixture Fanta non espone una schedina collegata: nessuna misura visiva dichiarata per quella vista. Il componente è condiviso e i test coprono anche il percorso di salvataggio Fanta.

Test pertinenti: **23 passati**, comando `node --import ./test/setup-release-context.mjs --test --test-concurrency=2 test/ux-review-slipbar.test.mjs test/ux-review-footer.test.mjs test/ux-ux-core.test.mjs test/interface-live.test.mjs test/ux-formation-save.test.mjs`. Un tentativo di suite completa ha esaurito la memoria con la concorrenza predefinita; il tentativo limitato ha evidenziato un metodo mancante nel DOM simulato del test, corretto senza modifiche al backend. Non è un esito positivo della suite completa; per questi interventi frontend la verifica finale resta quella mirata.

File del blocco: `public/src/v2/slip-v2.mjs`, `public/src/app.mjs`, `public/src/app-footer.mjs`, `public/ux-spacing.css`, `scripts/ux-viewport.mjs`, `test/ux-review-slipbar.test.mjs`, `test/ux-review-footer.test.mjs`, `test/interface-live.test.mjs`, questo rapporto e CHANGELOG.

Screenshot: [barra a 390 px](ux-0.29.46/blocco2-barra-390.png), [modifica importo](ux-0.29.46/blocco2-importo-390.png).

## Passaggi successivi

## Blocco 3 — pannello del presidente

Struttura approvata dal proprietario: Persone, Regole, Calendario e asta, Identità. Riepiloghi leggibili da chiusi, accesso diretto dalla barra per i presidenti, nessuna tab Oggi evidenziata erroneamente. Da fare espone solo stati già disponibili, senza inviare promemoria nuovi. Invito della lega unico nel gruppo Persone, codice/link/WhatsApp; premiati conservano il salvataggio esplicito, ora raggiungibile durante lo scorrimento. Rimozioni nel menu ⋯ con conferma già esistente. Ricerca oltre 12 membri e palette accessibile da 36 px.

| Stato Admin Bar | Viewport | Prima | Dopo |
|---|---|---:|---:|
| Tutto chiuso | 390×844 | 1024 px | 958 px |
| Persone aperto | 390×844 | 3174 px | 2335 px |
| Tutto chiuso | 1280×800 | 1027 px | 942 px |
| Persone aperto | 1280×800 | 2443 px | 2213 px |

La nuova sezione Persone comprende anche l’invito, prima separato e chiuso: il confronto aperto non è soltanto una riduzione di righe. Ogni riga membro misura 49 px. Verificati ricerca, apertura/chiusura, assenza di tab attiva, accessibilità e conservazione dei form. 19 test pertinenti passati; nessun test massivo backend.

File principali: `public/src/president-panel.mjs`, `public/src/app.mjs`, `public/src/v2/league-switcher.mjs`, `public/src/v2/tabs.mjs`, `public/ux-spacing.css`; test `ux-president`, `interface-live`, `ux-ux-core`. [Screenshot telefono](ux-0.29.46/blocco3-presidente-390.png).

## Blocco 4 — strumenti Fanta

I form asta, schedina, associazioni, dimensione lega e competizioni sono nel pannello condiviso, disponibili ai soli presidenti. La Lega conserva le informazioni per tutti; le squadre computer sono etichettate chiaramente. Il vicolo cieco senza Fanta ora spiega lo stato e porta il presidente al pannello Bar. Payload e chiamate di salvataggio esistenti conservati.

| Vista | Viewport | Prima | Dopo |
|---|---|---:|---:|
| Lega › Asta | 390×844 | 1861 px | 1350 px |
| Lega › Partecipanti | 390×844 | 1457 px | 1461 px |
| Lega › Asta | 1280×800 | 1786 px | 1312 px |
| Lega › Partecipanti | 1280×800 | 1491 px | 1491 px |

Il nuovo pannello chiuso misura 947 px a 390×844. Il prima Fanta è rilevato con gli asset del commit precedente su un processo isolato separato: stessa struttura sintetica (10 squadre, 1 umano), nomi delle squadre generati nuovamente. La pagina Partecipanti include la nuova spiegazione sulle squadre computer, quindi non è necessariamente più corta. Verificati percorsi, controlli esclusi per membri, pagine informative senza form admin e dettaglio rose; 19 test comuni + 5 regressioni UI Fanta passati.

File: `public/src/fanta/app.mjs`, `shell.mjs`, `lega.mjs`, `competitions-ui.mjs`, `test/ux-ux-core.test.mjs`, rapporto e CHANGELOG. [Pannello Fanta](ux-0.29.46/blocco4-presidente-fanta-390.png).

Seguono i blocchi 5–7 e la pre-produzione pubblica 0.29.46. Nessun merge su main o deploy sul sito ufficiale.
