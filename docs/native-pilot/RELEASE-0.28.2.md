# Rilascio 0.28.2

Motore quasi-statistical-v2.3.0. Il contributo del rating entra nel voto tecnico prima dei minimi per gol/rigore parato e dell’arrotondamento. Bonus e malus fantasy restano separati.

| Posizione | Migliori partita | Migliori squadra | Peggiori partita | Peggiori squadra perdente | Peggiori squadra non perdente |
| --- | --- | --- | --- | --- | --- |
| 1 | +0.50 | +0.30 | -0.50 | -0.30 | -0.10 |
| 2 | +0.30 | +0.18 | -0.30 | -0.18 | -0.06 |
| 3 | +0.10 | +0.06 | -0.10 | -0.06 | -0.02 |
| 4 | +0.05 | +0.03 | -0.05 | -0.03 | -0.01 |

Vale solo il contributo maggiore in valore assoluto. In caso di segni opposti e identico valore assoluto, contributo neutro. Parità a pari posizione, con salto delle successive. Nessuna classifica se tutti i rating sono identici; panchinari senza presenza e rating assenti esclusi. Il live usa il risultato corrente ed è provvisorio.

## Portafogli

Ogni fantalega ha un saldo iniziale indipendente di 500 crediti. Più competizioni della stessa lega nativa condividono il saldo. La migrazione ricostruisce puntate e vincite per lega, conserva il saldo comune precedente e registra eventuali rettifiche non attribuibili sulla prima lega in ordine stabile. Non modifica le giocate né il portafoglio Serie A. È idempotente e usa un lock di transazione. Le copie precedenti restano nei metadati di migrazione.

## Operazioni

Il calendario operativo esegue una sola installazione dei portafogli e un ricalcolo paginato del nuovo modello. Il ricalcolo preferisce i dati già archiviati; richiede al provider in batch solo le partite prive di rating. Alla fine aggiorna risultati di squadra e proiezione nel Bar. Nessun nuovo polling o lavoro periodico.

## Verifiche

417 test superati. Provata nell’interfaccia mobile una schedina sintetica sulla giornata successiva: salvata e saldo scalato nel portafoglio corretto. Verificati menu classifiche separati e selettori personalizzati. Controllo post-deploy su 80 file frontend e 40 sfondi; accessi anonimi amministrativi negati.
