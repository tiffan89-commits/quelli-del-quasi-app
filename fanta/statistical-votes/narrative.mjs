import {digest} from './math.mjs';
export const NARRATIVE_VERSION='quasi-match-report-v4';
const choose=(input,key,phrases)=>phrases[parseInt(digest([input.id,input.fixtureId,key]).slice(0,8),16)%phrases.length];
const positive={
 distribution:['Dà ordine alla manovra e tratta il pallone con precisione.','Fa scorrere il gioco con una distribuzione pulita.','Accompagna la manovra con scelte di passaggio affidabili.'],
 creation:['Trova palloni utili per mettere i compagni in condizione di concludere.','Lascia il segno nella rifinitura e alimenta le occasioni della squadra.','La qualità dei suoi suggerimenti dà sostanza alla fase offensiva.'],
 defending:['Porta sostanza nel lavoro difensivo.','Nella fase difensiva offre un contributo concreto.','Il lavoro senza palla dà solidità alla sua prestazione.'],
 duels:['Si fa valere nei duelli e regge il confronto con gli avversari.','Nei confronti individuali trova un punto di forza.','La tenuta nei duelli sostiene una prova concreta.'],
 dribblingDuels:['Si fa valere nel confronto diretto e dà vivacità alla sua prova.','Trova nel gioco individuale una delle risposte migliori.','La capacità di affrontare l’avversario dà peso alla sua prestazione.'],
 defendingDuels:['Il lavoro senza palla gli permette di dare sostanza alla squadra.','Fa sentire la propria presenza nel confronto con gli avversari.','Il contributo nella fase di recupero sostiene la sua gara.'],
 stopping:['Risponde alle conclusioni avversarie con interventi utili.','Le parate sono il punto forte della sua prestazione.','Quando viene chiamato in causa trova risposte tra i pali.'],
};
function blockText(input,block){
 const good=block.delta>0,key=block.key,m=input.metrics||{};
 if(key==='shooting')return good?(m.shotsOn>0?'Riesce a rendersi pericoloso quando cerca la porta.':'Si assume la responsabilità delle conclusioni.'):(m.shotsTotal===0?'Non riesce a lasciare traccia nelle conclusioni.':m.shotsOn===0?'Cerca la conclusione, ma senza trovare lo specchio della porta.':'Le conclusioni non hanno la continuità necessaria per alzare il giudizio.');
 if(key==='creation'&&input.events?.assists>0)return input.events.assists===1?'Un assist che mette sostanza nella rifinitura.':`${input.events.assists} assist: i compagni ringraziano, gli avversari un po’ meno.`;
 if(good&&key==='distribution'&&m.passAccuracy==null)return 'Partecipa con continuità alla circolazione del pallone.';
 if(good&&key==='creation'&&!(m.keyPasses>0))return 'La partecipazione alla manovra sostiene il contributo offensivo.';
 if(good&&positive[key])return choose(input,key,positive[key]);
 if(key==='distribution')return 'La gestione del pallone non ha la pulizia necessaria e frena il giudizio.';
 if(key==='creation')return 'Incide poco nella costruzione delle occasioni.';
 if(['duels','dribblingDuels','defendingDuels'].includes(key))return m.duelsTotal>0&&m.duelsWon/m.duelsTotal<.5?'Fatica a imporsi nei duelli e il suo peso nella gara ne risente.':'Il contributo nei confronti individuali resta sotto le attese.';
 if(key==='defending')return 'Recuperi e lavoro difensivo non bastano a dare sostanza alla prova.';
 if(key==='stopping')return 'Gli interventi tra i pali non bastano a portare la prestazione sopra l’equilibrio.';
 return null;
}
function setting(input){
 const fixture=input.fixture||{},score=fixture.score,side=fixture.teamSide||'home',other=side==='home'?'away':'home',club=input.club||'la sua squadra',opponent=input.opponent||fixture.teams?.[other]?.name;
 const actualOrder=fixture.teams?.home?.name&&fixture.teams?.away?.name,duel=actualOrder?`${fixture.teams.home.name}–${fixture.teams.away.name}`:opponent?`${club}–${opponent}`:club;
 if(score?.[side]==null||score?.[other]==null)return {text:`nella sfida ${opponent?'tra '+club+' e '+opponent:'della sua squadra'}`,result:null};
 const own=score[side],against=score[other],result=own>against?'win':own<against?'loss':'draw';
 const scoreText=actualOrder?`${score.home}–${score.away}`:`${own}–${against}`;
 if(!input.final)return {text:`in ${duel}, sul ${scoreText} provvisorio`,result};
 return {text:`${result==='win'?'nella vittoria':result==='loss'?'nella sconfitta':'nel pareggio'} in ${duel} (${scoreText})`,result};
}
export function describePerformance(input,{individual,context,goalSupport,eventImpact={},ratingImpact,vote,shortFinal=false,eventOnly=false}={}){
 const match=setting(input),name=input.name||'Il giocatore';
 if(!input.onField)return `${name} non prende parte alla gara${input.opponent?' contro '+input.opponent:''}.`;
 const grade=vote>=8.5?'firma una prestazione eccellente':vote>=8?'firma una prestazione di grande spessore':vote>=7.5?'offre un’ottima prova':vote>=7?'offre una prova molto buona':vote>=6.5?'offre una buona prova':vote>=6?'porta a casa una prova nel complesso sufficiente':vote>=5.5?'si ferma a una prestazione discontinua':'vive una partita complicata';
 const sentences=[`${name} ${grade} ${match.text}.`],high=vote>=7;
 const ranked=(individual?.blocks||[]).filter(b=>b.observed&&Math.abs(b.delta)>=.07).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 const weakness=high?ranked.find(b=>b.delta<0):null;
 const goals=Number(input.events?.goals)||0,assists=Number(input.events?.assists)||0;
 if(high&&(goals||assists)){
  const facts=[goals===1?'un gol':goals>1?`${goals} gol`:null,assists===1?'un assist':assists>1?`${assists} assist`:null].filter(Boolean).join(' e ');
  sentences.push(choose(input,'decisive-summary',[`${facts[0].toUpperCase()+facts.slice(1)}: la firma sul tabellino si vede anche dall’ultima fila.`,`${facts[0].toUpperCase()+facts.slice(1)}: porta sostanza, il dibattito al bar può cominciare.`,`${facts[0].toUpperCase()+facts.slice(1)}: si prende la scena e lascia agli altri il commento del dopopartita.`]));
 }
 if(high)sentences.push(choose(input,'high-grade',['Una di quelle prove che fanno comodo in campo e ancora di più a chi lo ha schierato.','Prestazione da protagonista: il voto alto ha argomenti, non necessita di un avvocato.','Per chi lo ha lasciato in panchina, il consueto quarto d’ora di silenzio.']));
 if(shortFinal)sentences.push('Ha poco tempo a disposizione: il suo contributo va letto in un impiego breve.');
 else if(!eventOnly){
  const first=high?ranked.find(b=>b.delta>0&&!(b.key==='creation'&&assists)):ranked[0],opposite=!high&&first&&ranked.find(b=>Math.sign(b.delta)!==Math.sign(first.delta));
  for(const block of (high?[first]:[first,opposite||ranked[1]]).filter(Boolean)){const text=blockText(input,block);if(text&&!sentences.includes(text))sentences.push(text);}
  if(!ranked.length&&!high)sentences.push('Il contributo complessivo resta vicino all’equilibrio, senza uno scarto netto nelle fasi di gioco valutabili.');
 }
 if(goalSupport?.count>0&&(!high||match.result==='loss')){const kinds=goalSupport.anchor.types||[],goal=goalSupport.count>=3?'La tripletta':goalSupport.count===2?'La doppietta':kinds.includes('match-winner')?'La rete che decide il risultato':kinds.includes('equalizer')?'La rete del pareggio':kinds.includes('go-ahead')?'La rete del vantaggio':'Il gol';sentences.push(`${goal} dà sostanza alla sua prova${match.result==='loss'?(input.final?', pur senza evitare la sconfitta.':', anche se la squadra è ancora in svantaggio.'):'.'}`);}
 if(eventImpact.penSaved>0)sentences.push(eventImpact.penSaved>1?'I rigori parati sono i momenti di maggior rilievo della sua gara.':'Il rigore parato è il momento di maggior rilievo della sua gara.');
 if(eventImpact.penMissed>0)sentences.push(eventImpact.penMissed>1?'Gli errori dal dischetto pesano sulla prestazione e ne ridimensionano il giudizio.':'L’errore dal dischetto pesa sulla prestazione e ne ridimensiona il giudizio.');
 if(context?.marquee?.delta>0){
  sentences.push('Nella partita di cartello è il migliore per rendimento statistico e incide sul risultato: una serata che pesa più del solito.');
  if(context.marquee.youngDebut)sentences.push(choose(input,'young-marquee',['Giovane e al primo anno in Italia: il cartello «ambientamento» può aspettare.','Al primo anno in Italia, con l’età dalla sua, si presenta direttamente sul palcoscenico più ingombrante.','Giovane, alla prima stagione italiana: ha scelto una partita piuttosto rumorosa per presentarsi.']));
 }
 if(ratingImpact?.delta&&!context?.marquee?.delta){const selected=ratingImpact.selected,match=selected.key.startsWith('match');sentences.push(selected.delta>0?(selected.rank===1?(match?'È il migliore in campo nel confronto dei rating.':'È il riferimento della propria squadra nel confronto dei rating.'):'Si colloca tra i protagonisti più convincenti '+(match?'della partita.':'della propria squadra.')):(selected.rank===1?(match?'È il più in difficoltà della partita nel confronto dei rating.':'Nel confronto interno dei rating resta il più in difficoltà.'):'Nel confronto dei rating finisce tra le prove meno convincenti '+(match?'della partita.':'della propria squadra.')));}
 if(!goalSupport?.delta&&input.final&&match.result==='loss'&&vote>=7)sentences.push('Il risultato negativo della squadra non cancella il valore della sua prestazione.');
 if(weakness){
  const caveats={distribution:'La pulizia dei passaggi può migliorare',creation:'Nella costruzione delle occasioni resta qualche margine',shooting:'La precisione delle conclusioni può migliorare',duels:'Nei duelli lascia qualcosa agli avversari',dribblingDuels:'Nel confronto individuale resta qualche sbavatura',defendingDuels:'Nel lavoro di contrasto può fare meglio',defending:'Nel lavoro difensivo resta qualche sbavatura',stopping:'Tra i pali resta qualche intervento da rivedere'};
  sentences.push(`${caveats[weakness.key]||'Resta qualche dettaglio da limare'}: un appunto sul taccuino, dentro una prova decisamente positiva.`);
 }
 return sentences.join(' ');
}
