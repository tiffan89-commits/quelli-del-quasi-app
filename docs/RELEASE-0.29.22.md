# Rilascio 0.29.22

Base completa 0.29.21. Corretto il filtro condiviso di tutti i selettori delle giornate: schedina personale Bar, schedine del Bar, verdetto, schedina Fanta e altre schedine Fanta.

La prima giornata futura/aperta fa da limite. Le giornate con numero successivo restano nascoste anche se portano erroneamente flag closed/settled o date passate. Alla chiusura della giornata attiva il limite passa alla successiva, se disponibile; una giornata ancora priva di quote non permette di saltare a quelle successive. Le precedenti restano consultabili.

Nessuna modifica al DB, ai job, ai voti, alle giocate o ai saldi. Test di regressione sul caso G10/G11 aperta/G13-G17 erroneamente chiuse e sul passaggio G11→G12.

508 test superati. Deploy 6ae9f214b95022ed9c64f7ab. File online verificati byte per byte: version.json, build/app.mjs, build/app.css, src/slip-state.mjs.
