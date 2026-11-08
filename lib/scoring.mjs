import {pointTerms} from '../public/scoring.mjs';
export {marketProbability,pointTerms,pointOffers,QUOTA_SCORING,roundPointRules,slipPointTerms} from '../public/scoring.mjs';
export function migrateScoring(s, now = Date.now()) {
  let changed = false;
  for (const l of s.leagues || []) {
    if (l.scoringMigration === "difficulty-v1") continue;
    l.rules = {
      ...l.rules,
      mode: "weighted",
      correct: 1,
      wrong: -1,
      scoring: "difficulty-v1",
      marketPoints: {
        1: 1,
        X: 1,
        2: 1,
        "1X": 0.25,
        12: 0.25,
        X2: 0.25,
        Goal: 0.5,
        "No Goal": 0.5,
        "Under 2.5": 0.5,
        "Over 2.5": 0.5,
      },
    };
    l.scoringMigration = "difficulty-v1";
    l.scoringMigratedAt = new Date(now).toISOString();
    for (const r of (s.rounds || []).filter(
      (r) =>
        r.league === l.id &&
        !r.settled &&
        !r.closed &&
        r.kickoff &&
        Date.parse(r.kickoff) > now,
    )) {
      r.rules = {
        ...r.rules,
        mode: "weighted",
        correct: 1,
        wrong: -1,
        scoring: "difficulty-v1",
        marketPoints: structuredClone(l.rules.marketPoints),
      };
      for (const slip of r.slips || [])
        slip.pointTerms = Object.fromEntries(
          r.matches.map((m) => [
            m.id,
            pointTerms(
              {
                ...m,
                odds: slip.acceptedOdds?.[m.id]
                  ? { ...m.odds, [slip.picks[m.id]]: slip.acceptedOdds[m.id] }
                  : m.odds,
              },
              slip.picks[m.id],
              r.rules,
            ),
          ]),
        );
    }
    changed = true;
  }
  return changed;
}

// Prospective only. Settled, closed, started or undated rounds never change.
export function migrateStraightScoring(s,now=Date.now()){
 let changed=false;const version='straight-half-v1',straight=p=>['1','X','2'].includes(p);
 for(const league of s.leagues||[]){
  if(league.straightScoringMigration!==version){league.rules={...league.rules,scoring:'difficulty-v2'};league.straightScoringMigration=version;league.straightScoringMigratedAt=new Date(now).toISOString();changed=true;}
  for(const r of (s.rounds||[]).filter(r=>r.league===league.id&&!r.settled&&!r.closed&&Date.parse(r.deadline||r.kickoff)>now&&!(r.matches||[]).some(m=>m.score||m.liveScore||['1H','HT','2H','ET','BT','P','LIVE','FT','AET','PEN'].includes(m.status)))){
   if(r.rules?.scoring!=='difficulty-v2'){r.rules={...r.rules,scoring:'difficulty-v2'};changed=true;}
   for(const slip of r.slips||[])for(const m of r.matches||[]){const pick=slip.picks?.[m.id];if(!straight(pick))continue;const next=pointTerms(m,pick,r.rules);if(['pick','correct','wrong','source'].some(k=>slip.pointTerms?.[m.id]?.[k]!==next[k])){slip.pointTerms??={};slip.pointTerms[m.id]=next;changed=true;}}
  }
 }
 return changed;
}
