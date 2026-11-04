# Rilascio 0.29.21

Base completa 0.29.20; quote API-FOOTBALL e batch settimanale invariati.

- Schedina Bar e Fanta: prima giornata aperta come default, tutte le giornate iniziate/concluse consultabili, solo la prossima giornata aperta aggiunta al selettore. Nessuna giornata futura priva di quote o non aperta.
- La scelta della giornata resta invariata tra schedina personale, schedine del Bar e verdetto. Il menu Schedina già attivo non ridisegna né resetta la bozza. Un nuovo ingresso dal menu riapre la prima giornata disponibile.
- I link da Oggi con una giornata esplicita continuano ad aprire quella giornata. Anche il banner Fanta conserva il riferimento alla propria partita.
- Verdetto e cartolina storici leggono i dati della giornata selezionata, non i vincitori più recenti.
- Quasi personale centrato con spazio sopra la scheda. Pagina bloccata in orizzontale; le barre interne mantengono lo scorrimento laterale previsto.
- Un solo pulsante chat flottante, esterno alla barra superiore. Nascosto in formazione fullscreen, editor Quasi e logo; ricompare alla chiusura.

Nessuna nuova query, job, migrazione o modifica alle formule dei voti. Dati e credenziali esclusi dai sorgenti.

Verifiche: 507 test passati; 24 controlli mirati dopo le ultime rifiniture. Prova locale isolata a 390x844: selezione G10 conservata tra Bar e verdetto, default G11, Quasi centrato, scorrimento pagina orizzontale fermo a zero, chat unica/fissa e nascosta nei tre editor.

Pubblicato: 6ae9e5aa587ae2b04b5f5e3c. Verificati per uguaglianza byte a byte bundle JS/CSS e otto sorgenti/metadati sul dominio pubblico.
