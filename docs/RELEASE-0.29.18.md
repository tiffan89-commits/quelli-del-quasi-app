# Rilascio 0.29.18

- Studio formazione compatto: avversario abbreviato, nessuna data/ora nelle schede; casa senza prefisso, trasferta con @.
- Campo sempre visibile sopra; disponibili su due file orizzontali, una fila sui telefoni bassi. Anche panchina e filtri scorrono solo lateralmente. Su schermi orizzontali molto bassi campo ed elenco si affiancano.
- Trascinamento verso l'alto distinto dallo swipe laterale; illuminazione dei soli posti del ruolo corretto, con scambi e ordinamento panchina. Restano disponibili i tocchi. Il trascinamento ora è collegato anche al contenitore dello studio, non solo alla precedente pagina Squadra.
- Probabilità attuali in verde. Se mancano, stima nera con bordo bianco: minuti / (90 × partite della squadra), arrotondata e limitata a 0–100. Una previsione vecchia non viene presentata come attuale. Nessuna percentuale inventata quando mancano anche i minuti. Infortuni/squalifiche mantengono le loro icone.
- Le stime leggono i dati stagionali già presenti; se mancanti, aggregazione mirata delle prestazioni archiviate della rosa e del club nella stagione, con cache condivisa oraria. Nessun nuovo polling o chiamata sportiva; nessuna scrittura dei dati di gioco.
- Giocatori schierati esclusi dai disponibili; posizione laterale conservata dopo assegnazioni e salvataggi.

Verifiche: test automatici su probabilità, separazione gesto laterale/trascinamento, quattro ruoli, annullamento e puntatori estranei, integrazione reale del controller dello studio, mantenimento scroll laterale, salvataggio unico e rilettura, query e cache DB. Suite completa e controlli browser documentati dopo la verifica finale.

Motore voti, storico, crediti e regole delle formazioni invariati. Nessuna nuova migrazione DB.

Pubblicato su https://quellidelquasi.com — deploy Netlify 6ae9b6b19a35a08ad6a21921. 510 test completi superati. Prove browser a 320×568, 375×812 e 1280×900: nessuno scorrimento verticale del dock; campo e salvataggio sempre visibili. Salvataggio della demo confermato nello studio. Versione pubblica e bundle JS/CSS verificati rispetto alla build; API anonima /fanta-api/me risponde 200. Il contenuto HTML coincide con la build salvo lo script RUM aggiunto da Netlify.
