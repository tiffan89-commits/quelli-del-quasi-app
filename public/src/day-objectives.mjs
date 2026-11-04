import {isClosed,currentSlipRound} from './slip-state.mjs';
// Shared schedule: five objectives per round, frozen by the server before kickoff.
export const OBJECTIVE_VERSION=2;
export function objectiveNumber(r){return Number(r.number)||Number(String(r.title||'').match(/\d+/)?.[0])||1;}
export function objectiveSeason(r){return String(r.season||new Date(r.kickoff||Date.now()).getUTCFullYear());}
export function createDayObjectives(r){
 const n=objectiveNumber(r),pick=n%3,stake=n%2?'minimum':'maximum';
 return [
  {id:'day-award',title:'Il bottino della giornata',condition:'Partecipa alla lega prima della scadenza. La percentuale di esiti corretti decide la rarità del premio.',rewardIds:[],rewardHint:'Un premio dal catalogo: Da bar, Raro, Epico o Leggendario.'},
  {id:'royalty',title:'Quasi leggenda',condition:'Un solo errore: Sua Quasità. Tutto corretto: corona e titolo King del betting. Per il Resort: almeno 5 partite, solo 1/X/2, quota ≥100 e utile netto ≥1.000 crediti.',rewardIds:['almost-title','king-crown','king-title','room-100'],rewardHint:'Il premio dipende dall’impresa compiuta.'},
  {id:stake,title:stake==='minimum'?'Spiccioli, grandi certezze':'Massimo ottimismo',condition:stake==='minimum'?'Salva la schedina di questa giornata puntando 1 credito.':'Salva la schedina di questa giornata puntando il massimo consentito.',rewardIds:[stake==='minimum'?'starter-coin':'starter-band']},
  pick===0?{id:'attendance',title:'Il solito posto',condition:'Salva la schedina in questa giornata e nelle due precedenti della stessa competizione.',rewardIds:['starter-shirt','starter-title']}:
  pick===1?{id:'five-correct',title:'Cinque certezze al tavolo',condition:'Indovina almeno 5 esiti in questa giornata conclusa.',rewardIds:['starter-boot','starter-points']}:
  {id:'profit',title:'Il brindisi del derby',condition:'Chiudi questa giornata con un guadagno netto positivo.',rewardIds:['starter-green','starter-cup']},
  n===1?{id:'opening-leader',title:'Chi ben comincia… quasi vince',condition:'Concludi la prima giornata della stagione con il miglior punteggio della lega in questa competizione, maggiore di zero. Sono premiati anche i pari merito.',rewardIds:['quasi-0020'],seasonal:true,rewardHint:'Solo prima giornata: se sfugge, si riprova la prossima stagione.'}:
  {id:'mixed-markets',title:'Il menu degustazione',condition:'Salva almeno 3 famiglie di esito diverse (1/X/2, doppia chance, under/over, gol/no gol) e indovina almeno metà delle partite valide.',rewardIds:['quasi-0417']},
 ].filter(g=>!(r.pointsOnly&&['minimum','maximum','profit','mixed-markets'].includes(g.id)));
}
export function currentObjectiveRound(league,source='seriea',competition=null,now=Date.now(),calendar){
 const rounds=(league.rounds||[]).filter(r=>(r.source==='fantacalcio'?'fantacalcio':'seriea')===source&&(source!=='fantacalcio'||!competition||r.competitionKey===competition)&&r.matches?.length&&!r.archived);
 const upcoming=rounds.filter(r=>!isClosed(r,now)&&Date.parse(r.deadline||r.kickoff)>now).sort((a,b)=>Date.parse(a.deadline||a.kickoff)-Date.parse(b.deadline||b.kickoff));
 return upcoming[0]||currentSlipRound(rounds,now,calendar)||null;
}
