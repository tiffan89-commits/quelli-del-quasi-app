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

## Passaggi successivi

Blocco 2 in lavorazione. Il pannello del presidente (blocco 3) richiede proposta e OK del proprietario prima dell’implementazione. Le altre modifiche e la pre-produzione pubblica 0.29.46 seguono nell’ordine richiesto. Nessun merge su main o deploy sul sito ufficiale.
