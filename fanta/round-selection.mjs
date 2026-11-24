import {serieASubmissionWindow} from '../lib/seriea-round-window.mjs';

export function currentRound(s,now=Date.now()){
 const rounds=s.rounds.filter(r=>!r.data?.archivedWithoutResults).sort((a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline)||a.number-b.number),started=rounds.filter(r=>Date.parse(r.deadline)<=now);
 const live=started.filter(r=>!r.official&&(s.fixtures||[]).some(f=>f.round===r.seriea_round&&['1H','HT','2H','ET','BT','P','LIVE'].includes(f.status)&&(!f.kickoff||Date.parse(f.kickoff)>=now-210*60000))).at(-1);
 if(live)return live;const latest=started.at(-1);if(latest&&!latest.official)return latest;
 return rounds.find(r=>Date.parse(r.deadline)>now)||latest||rounds[0];
}
// Same selection for the vote rows: old unverified rounds cannot select another day's votes.
export const currentRoundNumberSQL=`coalesce($3::int,
 (SELECT r.number FROM fanta.rounds r JOIN fanta.fixtures f ON f.round=r.seriea_round AND f.season=l.season WHERE r.league_id=l.id AND r.competition_id=selected.id AND r.deadline<=now() AND NOT r.official AND NOT (r.data @> '{"archivedWithoutResults":true}') AND f.status IN('1H','HT','2H','ET','BT','P','LIVE') AND f.kickoff>=now()-interval '210 minutes' ORDER BY r.deadline DESC,r.number DESC LIMIT 1),
 (SELECT x.number FROM (SELECT r.number,r.official FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id AND r.deadline<=now() AND NOT (r.data @> '{"archivedWithoutResults":true}') ORDER BY r.deadline DESC,r.number DESC LIMIT 1) x WHERE NOT x.official),
 (SELECT r.number FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id AND r.deadline>now() ORDER BY r.deadline,r.number LIMIT 1),
 (SELECT r.number FROM fanta.rounds r WHERE r.league_id=l.id AND r.competition_id=selected.id AND NOT (r.data @> '{"archivedWithoutResults":true}') ORDER BY r.deadline DESC,r.number DESC LIMIT 1))`;

// Editing a future lineup is independent of final verification of prior results.
export function lineupRound(s,now=Date.now()){
 return s.rounds.map(round=>({round,...lineupWindow(s,round,now)}))
  .filter(item=>!item.started&&Date.parse(item.deadline)>now&&!item.round.data?.archivedWithoutResults)
  .sort((a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline)||a.round.number-b.round.number)[0]?.round||currentRound(s,now);
}

export function lineupWindow(state,round,now){
 if(!round||round.official||round.data?.archivedWithoutResults)return {deadline:round?.deadline??null,started:!!round?.official,open:false};
 return serieASubmissionWindow(state.submissionWindows??new Map(),round.seriea_round,round.deadline,now);
}

export function teamLineupRound(state,now=Date.now()){
 const rounds=state.rounds.filter(r=>!r.data?.archivedWithoutResults).sort((a,b)=>a.number-b.number);
 let played=null,upcoming=null;
 for(const round of rounds){
  const {deadline,open,started}=lineupWindow(state,round,now);
  const phase={round,number:round.number,deadline,open,started,official:!!round.official};
  if(started){played=phase;upcoming=null;}
  else upcoming??=phase;
 }
 return (upcoming?.open?upcoming:played||upcoming)??{round:null,number:1,deadline:null,open:false,started:false,official:false};
}
