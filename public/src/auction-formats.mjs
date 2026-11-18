export const AUCTION_TYPES={iniziale:'Asta a chiamata',riparazione:'Asta di riparazione',lampo:'Asta lampo'};
export const AUCTION_DESCRIPTIONS={iniziale:'Ogni allenatore chiama a turno',lampo:'Estrazione casuale, venti secondi',riparazione:'Svincoli e nuovi acquisti'};
export const LAMPO={open:20,raise:10,final:3,stretch:5,maxGrace:1000,httpGrace:250};
export const lampoDuration=seconds=>(seconds-LAMPO.final+LAMPO.stretch)*1000;
export function lampoShownSeconds(leftMs){
 const seconds=Math.max(0,leftMs)/1000;
 return seconds>LAMPO.stretch?seconds-LAMPO.stretch+LAMPO.final:seconds*LAMPO.final/LAMPO.stretch;
}
