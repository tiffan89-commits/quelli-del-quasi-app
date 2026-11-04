export const MATCH_EVENT_KINDS = ['goal','own-goal','yellow','red','penalty-missed','penalty-saved','substitution','var'];
export const isMatchEvent = e => MATCH_EVENT_KINDS.includes(e?.kind);
export function matchEventLabel(e) {
  return ({goal:e.penalty?'⚽ Rigore segnato':'⚽ Gol','own-goal':'⚽ Autogol',yellow:'🟨 Giallo',red:'🟥 Rosso',
    'penalty-missed':'✕ Rigore sbagliato','penalty-saved':'🧤 Rigore parato',substitution:'⇄ Sostituzione',var:'▣ VAR'})[e.kind] || '';
}
