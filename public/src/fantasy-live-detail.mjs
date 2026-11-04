const grade = value => Number.isFinite(value) ? String(value).replace('.',',') : 's.v.';
export function fantasyEventsText(events = []) {
  const counts = new Map();
  for (const event of events) counts.set(event.label,(counts.get(event.label)||0)+1);
  return [...counts].map(([label,n])=>label+(n>1?' ×'+n:'')).join(' · ');
}
// Patch only votes, bonuses and scores. Keep pitch, tabs, photos and accordions intact.
export function patchFantasyMatch(root, match) {
  const score=root.querySelector('[data-live-detail-score]');
  if(score)score.textContent=(match.status==='LIVE'?match.liveScore:match.score)?.join(' – ')||'—';
  const points=root.querySelector('[data-fantasy-points]');
  if(points&&match.fantasyPoints)points.textContent='Fantapunti '+(match.status==='FT'?'finali':'live')+': '+match.fantasyPoints.map(grade).join(' – ');
  const players=new Map((match.details?.teams||[]).flatMap(t=>t.players||[]).map(p=>[String(p.id),p]));
  for(const row of root.querySelectorAll('[data-fantasy-player]')) {
    const player=players.get(row.dataset.fantasyPlayer);if(!player)continue;
    const value=row.querySelector('[data-fantasy-grade]');
    if(value){value.hidden=false;value.textContent=(value.dataset.fantasyGrade==='pitch'?'V ':'')+grade(player.grade)+(value.dataset.fantasyGrade==='pitch'?' · FV ':' / ')+grade(player.fantagrade);}
    const events=row.querySelector('[data-fantasy-events]');if(events)events.textContent=fantasyEventsText(player.events);
  }
}
