import {round2} from './rules.mjs';
export function comparisonView(reference,home,away,{historical=false}={}){
 if(!reference)return null;
 const side=(key,current)=>({points:reference[key]?.points??null,goals:reference[key]?.goals??null,ours:historical?null:current.total,delta:!historical&&Number.isFinite(current.total)&&Number.isFinite(reference[key]?.points)?round2(current.total-reference[key].points):null});
 return {source:'Archivio storico',historical,home:side('home',home),away:side('away',away)};
}

