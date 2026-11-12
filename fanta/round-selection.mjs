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
export function lineupRound(s,now=Date.now()){return [...s.rounds].filter(r=>!r.official&&Date.parse(r.deadline)>now).sort((a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline)||a.number-b.number)[0]||currentRound(s,now);}
