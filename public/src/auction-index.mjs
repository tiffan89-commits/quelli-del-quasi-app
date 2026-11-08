import {loadSportsClient} from './sports-push.mjs';

let sessionKey='',socket,running=new Set();

export function paintAuctionBadges(root=globalThis.document){
 for(const node of root?.querySelectorAll('[data-auction-indicator]')||[]){
  const active=node.dataset.auctionIndicator==='*'?running.size>0:running.has(node.dataset.auctionIndicator);
  node.hidden=!active;
  node.closest('.v2-league-row')?.classList.toggle('has-auction',active);
 }
}

export function trackAuctionBadges(user,leagues,doc=globalThis.document){
 const active=user?.emailVerified&&!user.demo&&!user.adminOnly&&doc?.documentElement?.dataset?.netlifyEmergency!=='true';
 const key=active?JSON.stringify([user.id,...leagues.map(l=>l.nativeFantaLink?.leagueId).filter(Boolean).sort()]):'';
 if(key===sessionKey)return;
 sessionKey=key;socket?.disconnect();socket=null;running.clear();paintAuctionBadges(doc);
 if(!key)return;
 void loadSportsClient().then(io=>{
  if(sessionKey!==key)return;
  const current=socket=io('/auction-index',{path:'/socket.io',transports:['websocket'],withCredentials:true});
  current.on('chat:update',data=>{
   if(socket===current)doc.dispatchEvent(new doc.defaultView.CustomEvent('quasi:chat-update',{detail:data}));
  });
  current.io?.on('reconnect',()=>{if(socket===current)doc.dispatchEvent(new doc.defaultView.Event('quasi:chat-reconnect'));});
  current.on('auction:index',ids=>{
   if(socket!==current||!Array.isArray(ids))return;
   const next=new Set(ids);
   if(next.size===running.size&&[...next].every(id=>running.has(id)))return;
   running=next;paintAuctionBadges(doc);
  });
  current.on('auction:index-change',({league,running:live})=>{
   if(socket!==current||running.has(league)===live)return;
   if(live)running.add(league);else running.delete(league);
   paintAuctionBadges(doc);
  });
 }).catch(()=>{if(sessionKey===key)sessionKey='';});
}
