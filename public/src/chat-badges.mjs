const unreadOf=league=>league?.chat?.unread||0;
export const unreadLabel=count=>count===1?'1 messaggio non letto':count+' messaggi non letti';

export function mergeChatSummary(previous,summary){
 if(!Number.isSafeInteger(summary?.unread)||summary.unread<0)return previous;
 for(const key of ['latest','revision','read']){
  if(Number.isSafeInteger(summary[key])&&summary[key]<(previous?.[key]||0))return previous;
 }
 const {unread,latest,revision,read,notify}=summary;
 return {...previous,unread,...(latest===undefined?{}:{latest}),...(revision===undefined?{}:{revision}),
  ...(read===undefined?{}:{read}),...(notify===undefined?{}:{notify})};
}

export function paintChatBadges(root,leagues,active){
 const total=leagues.reduce((sum,league)=>sum+unreadOf(league),0);
 const activeCount=unreadOf(active);
 const counts=new Map();
 for(const league of leagues){
  counts.set(league.id,unreadOf(league));
  if(league.nativeFantaLink?.leagueId)counts.set(league.nativeFantaLink.leagueId,unreadOf(league));
 }
 for(const badge of root.querySelectorAll('[data-chat-badge],[data-chat-tile-badge],[data-league-chat-dot]')){
  const count=badge.hasAttribute('data-chat-badge')?total:
   badge.hasAttribute('data-chat-tile-badge')?activeCount:counts.get(badge.dataset.leagueChatDot)||0;
  badge.hidden=!count;
  if(badge.hasAttribute('data-chat-tile-badge'))badge.textContent=count>99?'99+':String(count);
  badge.setAttribute('aria-label',unreadLabel(count));
 }
}
