import {publicLineups} from './lineup-consensus.mjs';
export function compactClientState(data,{compact=true}={}){
 const matches=[...(data.calendar?.rounds||[]).flatMap(r=>r.matches),...(data.leagues||[]).flatMap(l=>l.rounds.flatMap(r=>r.matches))];
 for(const m of matches){
  if(!compact){if(m.lineups)m.lineups=publicLineups(m.lineups);continue;}
  m.hasLineups=m.hasLineups??!!m.lineups;m.hasDetails=m.hasDetails??!!m.details;
  m.lineupRevision=m.lineupRevision||m.lineups?.updatedAt||null;m.detailRevision=m.detailRevision||m.details?.updatedAt||m.details?.at||null;m.detailsComplete=m.detailsComplete??!!m.details?.complete;
  delete m.lineups;delete m.oddsModel;delete m.frozen;
  if(m.pointOffers)m.pointOffers=Object.fromEntries(Object.entries(m.pointOffers).map(([pick,terms])=>[pick,{correct:terms.correct,wrong:terms.wrong}]));
  if(m.status!=='LIVE')delete m.details;
 }
 data.compact=compact;return data;
}
