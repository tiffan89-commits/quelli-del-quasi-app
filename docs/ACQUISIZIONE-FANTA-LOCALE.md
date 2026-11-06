# Acquisizione Fanta · anteprima locale

Stato: lavoro sul branch `feature/acquisizione-fanta`, basato sulla 0.29.30. Nessun commit, push o deploy di questa funzionalità. Nessun annuncio Meta creato o attivato: qui si preparano e si provano pagina, percorso e materiale della campagna prima della revisione del proprietario.

Aggiornamento 5 novembre: il proprietario ha scelto la home pubblica già esistente con «Guarda la demo». Le nuove pagine qui descritte restano un prototipo non approvato per la pubblicazione. La prova continua sul PC corrente; il trasferimento al PC 192.168.0.194 è stato annullato. Nella home attuale gli esempi usano Éderson (Atalanta) e Kenan Yıldız (Juventus), verificati nell’anagrafica locale; voti e asta sono esplicitamente dimostrativi.

## Cosa provare

- `/prendi-squadra.html`: pagina leggera per gli annunci, con un pulsante principale verso la registrazione. La formazione disegnata è un esempio illustrativo, senza fotografie o loghi ufficiali.
- `/campagna.html`: due annunci coordinati, relativi testi e collegamenti UTM, immagini feed 1080×1350 e Stories 1080×1920, download PNG/SVG, piano JSON e storyboard del video. Il video finale non è ancora registrato: la grafica va prima approvata.
- `/entra-fanta.html`: dopo l’accesso, verifica i posti nella prova e assegna una squadra con un solo comando. Poi apre direttamente la sezione Squadra per schierare la prima formazione.

Nella prova sintetica avviata su `http://127.0.0.1:8991` si possono creare account con indirizzi `@example.test`: le email non vengono inviate. Aprire `/__preview/inbox` per il link di attivazione simulato. Dati e formazioni sono in RAM e vengono persi al riavvio. Le API esterne sono bloccate. Il percorso è stato provato fino al salvataggio effettivo di una formazione nel database sintetico.

La copia installata sul PC, raggiungibile tramite il collegamento privato di `casa.quellidelquasi.com`, serve le stesse pagine e usa il DB locale isolato. Gli invii esterni restano disabilitati: per il test completo di nuova registrazione usare l’ambiente sintetico e la sua casella di prova. Su casa usare un account già presente nella copia locale. Non è il DB pubblico.

## Campagna proposta

- Un solo gruppo di inserzioni in Italia, maggiorenni, con due creatività A/B. Il confronto iniziale è esplorativo; non è un test statistico garantito né richiede due budget separati.
- Budget condiviso proposto: 8,25 €/giorno per 7 giorni, limite pianificato del primo test 57,75 €. Nessuna nuova spesa autorizzata o eseguita dall’anteprima. Per l’attivazione impostare data di fine e limite totale coerenti, poi verificare il riepilogo Meta con il proprietario.
- A: squadra pronta e nuova occasione a stagione iniziata. B: voti spiegati.
- Destinazione unica: `/prendi-squadra.html`, con `utm_source=meta`, `utm_medium=paid_social`, `utm_campaign=allenatori_test_01` e `utm_content` diverso per annuncio.
- Prima di attivare l’obiettivo Meta per visite effettive, verificarne tracciamento e requisiti nell’account. Il successivo test per registrazioni va avviato solo con eventi verificati. Nessun pixel Meta è stato aggiunto all’app.
- Misure: visita, `entry_started`, `registration_requested`, `sign_up`, `team_claimed`, `lineup_saved`. Gli ultimi cinque sono eventi distinti; `lineup_saved` non viene falsamente descritto come il primo salvataggio univoco di un utente. Per il KPI di primo utilizzo occorre contare gli utenti del percorso, non sommare tutti i salvataggi.
- I due annunci restano locali. La campagna attualmente attiva non è stata modificata.

## Ingresso protetto e dati

`FANTA_ACQUISITION_ENABLED=true` abilita le due nuove API `entry/status` e `entry/claim`. Il valore predefinito è falso. Una lega entra nel bacino solo se nativa (`source_key IS NULL`), di tipo `pilot` o `random`, non disattivata, collegata a un Bar attivo e con `rules.acquisitionOpen=true`. Non vengono aperte automaticamente leghe private, né create nuove leghe al caricamento della pagina.

Il sito pubblico e il suo DB non sono stati modificati. Nella sola copia locale è stata aperta alla prova la lega `pilot:2026:1`; regole precedenti e codice sono conservati nei backup dell’installazione. La produzione richiederà approvazione esplicita della lega da aprire e della disponibilità prima di configurare questi flag.

L’assegnazione richiede un account autenticato con email confermata. Si usa lo stesso lock delle iscrizioni/rimozioni Bar e si collega una squadra libera mantenendo rose, voti e storico. Una ripetizione restituisce la stessa squadra; chi è stato rimosso dal Bar non viene reinserito. In caso di tutto esaurito compare un messaggio con verifica manuale dei posti. Non ci sono polling, fornitori esterni o job aggiuntivi. La pagina pubblicitaria non interroga il DB.

L’intento di entrare nel Fanta è una preferenza funzionale temporanea, cancellabile tornando all’app e con scadenza di sette giorni. Viene mantenuto nel link di conferma email tramite il solo parametro consentito `entry=fanta`. I tag pubblicitari e `fbclid` non vengono aggiunti alle email né ai record utenti. Gli inviti a leghe private hanno la precedenza sul percorso pubblicitario.

Google Analytics rimane opt-in: nessun invio o coda di eventi prima del consenso, su localhost e su casa. Dopo il consenso, le operazioni concluse durante il caricamento differito del tag vengono accodate in memoria per non perdere una registrazione rapida. La revoca elimina la coda. Le URL analitiche sono ripulite da token e identificativi privati.

## Revisione e pubblicazione futura

1. Approvare grafica e testi della pagina e degli annunci.
2. Provare il percorso dal telefono, inclusi email, errore, ritorno indietro e prima formazione.
3. Scegliere la lega di prova da aprire e verificarne capacità, rose e giornate future.
4. Solo dopo approvazione: preparare una nuova versione, verificare gli eventi sul dominio pubblico con consenso e trasferire la campagna nell’account Meta.
5. Far approvare al proprietario budget, durata e anteprime prima dell’attivazione dell’annuncio a pagamento.
