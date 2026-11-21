import {digest} from './math.mjs';

export const NARRATIVE_VERSION='quasi-match-report-v6-short';
const choose=(p,key,rows)=>rows[parseInt(digest([p.id,p.fixtureId,key]).slice(0,8),16)%rows.length];
const openings=[
 [10,'da dieci',['Il dibattito può aspettare.', 'Questa volta la pagella richiede poca fantasia.', 'Per discutere il voto serve una prestazione migliore, la prossima volta.']],
 [9,'eccellente',['Tra le poche cose su cui sarà difficile litigare.', 'Con una partita così, il merito si vede anche senza rileggere il tabellino.', 'Chi doveva limitarlo avrà parecchio da rivedere.']],
 [8,'ottima',['Chi lo ha schierato può evitare di raccontarci quanto è stato bravo.', 'La conferenza stampa può cominciare da qui.', 'Ci sono giornate in cui le scelte dell’allenatore si spiegano da sole.']],
 [7,'buona',['Il titolare meritava il posto, e si è preso anche il resto.', 'Una partita concreta, senza bisogno della conferenza stampa.', 'Oggi basterebbe rivedere le azioni decisive.']],
 [6,'sufficiente',['Ha fatto il suo. Per i titoli di prima pagina ci riproviamo domenica.', 'Parte del lavoro era evitare guai. Missione compiuta.', 'Nessuna arringa richiesta per promuoverlo.']],
 [5.5,'discontinua',['C’è del buono, ma bisogna cercarlo tra gli errori.', 'La seconda visione servirà più a lui che al pubblico.', 'Il complimento migliore è che poteva andare peggio.']],
 [0,'in difficoltà',['Il riesame della partita può iniziare dalle cose semplici.', 'Si può sbagliare partita. Oggi ne abbiamo la prova.', 'Il merito della prova è offrire parecchio materiale per l’allenamento.']]
];
const goalQuips={
 one:['Arriva al momento giusto.', 'Una rete che dà sostanza alla prova.', 'Sul gol c’è poco da aggiungere.'],
 two:['Il tabellino lo chiama in causa due volte. Gli altri possono spiegare il resto.', 'Firmare due reti è già una discreta risposta alle critiche.', 'Due gol pesano. Il resto della prova spiega quanto.'],
 three:['Tre reti meritano più di una nota a margine.', 'Per tre volte la difesa ha avuto lo stesso problema.', 'Le reti sono tre. Il risultato della squadra è un’altra voce.'],
 many:['C’è chi discute il modulo. Lui ha presentato il tabellino.', 'La notizia è chi ha segnato gli altri gol, se ce ne sono stati.', 'Chi cercava il migliore in campo può smettere di cercare.'],
 assist:['Conta anche l’ultimo passaggio.', 'L’azione decisiva porta anche la sua firma.', 'Gli assist valgono una riga anche quando il titolo va a chi segna.']
};
const playQuips={
 distribution:[
  ['Fa circolare il pallone e trova compagni in posizione migliore.', 'La squadra riparte da passaggi che sembrano facili soltanto a chi li guarda.'],
  ['Sbaglia troppo quando la squadra ha bisogno di tenere il pallone.', 'Concede possessi che il prossimo avversario ringrazierà.']
 ],
 defending:[
  ['Legge le azioni prima che diventino problemi seri.', 'Interviene quando serve. Anche questo fa risparmiare lavoro al portiere.'],
  ['Perde tempi e interventi. Gli avversari se ne accorgono subito.', 'La difesa ha avuto bisogno di più aiuto di quanto lui sia riuscito a darle.']
 ],
 shooting:[
  ['Cerca la porta con continuità.', 'Per gli avversari, concedergli la conclusione è una scelta discutibile.'],
  ['Calcia, ma trova la porta di rado.', 'La quantità dei tentativi merita più del risultato.']
 ],
 duels:[
  ['Si prende la sua parte di palloni contesi. E anche quella di altri.', 'Gli avversari devono fare parecchio per passare.'],
  ['Concede troppi duelli per controllare la sua zona.', 'Nei contrasti c’è parecchio da rivedere.']
 ]
};
const blockKey={duels:'duels',defendingDuels:'duels',dribblingDuels:'duels'};

export function describePerformance(p,{individual,goalSupport,eventImpact={},keeperPerformance,context={},vote}={}){
 const f=p.fixture||{},name=p.name||'Il Quasi',score=f.score;
 const match=f.teams?.home?.name&&f.teams?.away?.name?f.teams.home.name+'–'+f.teams.away.name:p.club||'la partita';
 if(!p.onField)return name+' resta a guardare. La pagella può aspettare la prossima partita.';
 const [tier,grade,variants]=openings.find(([minimum])=>vote>=minimum)||openings.at(-1);
 const language=(!p.final?'provvisoria, ':'')+grade+(context.marquee?.delta>0?' nella partita di cartello':'');
 const text=[name+', '+match+(score?.home!=null&&score?.away!=null?' '+score.home+'–'+score.away:'')+': prova '+language+'.'];
 const goals=goalSupport?.count||0,assists=p.events?.assists||0;
 const other=f.teamSide==='home'?'away':'home',against=score?.[other],opponent=f.teams?.[other]?.name||p.opponent;
 const lost=p.final&&Number.isFinite(against)&&Number.isFinite(score?.[f.teamSide])&&score[f.teamSide]<against;
 let quip=choose(p,'grade-'+tier,variants);
 if(goals>=2||goals&&assists){
  const group=goals>=4?'many':goals===3?'three':goals===2?'two':'one';
  const count=goals===1?'Un gol':goals+' gol';
  text.push(count+(assists?' e '+assists+' assist':'')+(lost?' senza evitare la sconfitta':'')+'.');
  quip=choose(p,'goals-'+group,goalQuips[group]);
  if(goals>=4&&opponent&&Number.isFinite(against)&&goals>against)quip=choose(p,'goals-opponent',[
   opponent+' a '+against+', lui da solo a '+goals+'. Chi cercava il migliore in campo ha finito.',
   'Per fare più gol di '+opponent+' è bastato un giocatore. Indovinate quale.',
   opponent+' ne ha fatti '+against+'. Il resto della pagella può aspettare.'
  ]);
 }else if(keeperPerformance?.available&&keeperPerformance.saves>0){
  const saves=keeperPerformance.saves;
  const impact=keeperPerformance.resultKind==='clean-sheet'?' e porta inviolata':keeperPerformance.resultKind==='winning-saves'?' che sostengono la vittoria':'';
  text.push(saves+(saves===1?' parata':' parate')+impact+'.');
 }else if(goals){
  const types=goalSupport.anchor?.types||[],moment=types.includes('equalizer')?'Segna il pareggio':types.includes('match-winner')?'Firma il gol partita':'Va a segno';
  text.push(moment+(lost?' senza evitare la sconfitta':'')+'.');
  quip=choose(p,'goals-one',goalQuips.one);
 }else if(assists){
  text.push(assists===1?'Serve un assist.':'Serve '+assists+' assist.');
  quip=choose(p,'assists',goalQuips.assist);
 }else{
  const best=(individual?.blocks||[]).filter(b=>b.observed&&Math.abs(b.delta)>=.1)
   .sort((a,b)=>(vote>=6.5?Number(b.delta>0)-Number(a.delta>0):0)||Math.abs(b.delta)-Math.abs(a.delta))[0];
  const options=best&&playQuips[blockKey[best.key]||best.key];
  if(options)text.push(choose(p,best.key,options[best.delta>0?0:1]));
 }
 if(eventImpact.penMissed>0)quip='Resta l’errore dal dischetto, anche con tutto il resto in pagella.';
 else if(eventImpact.penSaved>0)quip='Un rigore parato. Il rigorista può passare alla prossima domanda.';
 else if(p.final&&context.underdogWin?.eligible&&context.delta>=.05)quip='La vittoria da sfavoriti rende la prova ancora più pesante.';
 text.push(quip);
 return text.join(' ');
}
