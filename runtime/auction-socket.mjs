import {computerActionAt,computerDecision} from '../fanta/auction-computer.mjs';
import {Server} from 'socket.io';
import {connection} from '../lib/db.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {auctionView,auctionAction,auctionTickDue} from '../fanta/auction.mjs';
import {queueAuctionOpened} from '../fanta/notifications.mjs';
import {dispatchFanta} from '../fanta/jobs.mjs';

export function socketAuctionView(state,uid,stamp){
 const data=auctionView(state,uid,stamp),player=p=>p?Object.fromEntries(['id','name','role','club','price','value','fm','played','ownerTeam'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]])):p;
 data.competition=state.competition?{id:state.competition.id,status:state.competition.status,startRound:state.competition.start_round}:null;
 data.teams=data.teams.map(t=>({...t,team:{id:t.team.id,name:t.team.name,manager:t.team.manager,color:t.team.color}}));
 data.myRoster=data.myRoster.map(player);data.log=data.log.map(s=>({...s,player:player(s.player)}));
 if(data.lot)data.lot={...data.lot,player:player(data.lot.player)};data.table=player(data.table);
 if(data.lastSale)data.lastSale={...data.lastSale,player:player(data.lastSale.player)};
 if(data.releases)data.releases=data.releases.map(r=>({...r,player:player(r.player)}));delete data.cancellations;
 return data;
}

// PostgreSQL NOTIFY is delivered only after COMMIT, including across processes.
export async function listenAuctionChanges(change,{connect=connection,onUnavailable=()=>{},onReady=()=>{}}={}){
 let client=null,closed=false,retry=null;
 async function open(){
  let c;try{
   c=await connect();if(closed){c.release();return;}
   const lost=()=>{if(client!==c)return;client=null;try{c.release(true);}catch{}onUnavailable();if(!closed)retry=setTimeout(open,3000);};
   c.on('error',lost);c.on('end',lost);c.on('notification',n=>{if(n.channel!=='quasi_auction')return;try{const data=JSON.parse(n.payload);if(typeof data.league==='string'&&data.league.length<=200)change(data.league);}catch{}});
   client=c;await c.query('LISTEN quasi_auction');onReady();
  }catch{if(client===c)client=null;try{c?.release(true);}catch{}onUnavailable();if(!closed)retry=setTimeout(open,3000);}
 }
 await open();return async()=>{closed=true;clearTimeout(retry);const c=client;client=null;if(c){try{await c.query('UNLISTEN quasi_auction');}catch{}c.release();}};
}

export async function attachAuctionSocket(httpServer,{store=sqlFantaStore(),origin=process.env.PUBLIC_ORIGIN,allowedOrigins=[origin],subscribe,now=Date.now,log=(event,data)=>console.info(event,JSON.stringify(data))}={}){
 const allowed=new Set(allowedOrigins),rooms=new Map(),limits=new Map();let closed=false,listenerReady=!!subscribe;
 const io=new Server(httpServer,{path:'/socket.io',serveClient:true,transports:['websocket'],maxHttpBufferSize:2048,perMessageDeflate:false,pingInterval:5000,pingTimeout:5000,
  allowRequest:(req,done)=>{
   const ip=req.socket.remoteAddress||'',at=now(),hit=limits.get(ip);
   if(!hit||at-hit.at>60000)limits.set(ip,{at,count:1});else hit.count++;
   if(limits.size>2000)for(const [key,value]of limits)if(at-value.at>60000)limits.delete(key);
   done(null,allowed.has(req.headers.origin)&&(limits.get(ip)?.count||0)<=180);
  },cors:{origin:[...allowed],credentials:true},});
 const sid=cookie=>String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sid='))?.slice(4)||'';
 async function authorize(token,league){
  if(typeof league!=='string'||!league||league.length>200||!token||token.length>256)throw Error('Accesso non autorizzato');
  const user=await store.identity(token);if(!user?.verified||user.demo||user.admin_only)throw Error('Accesso non autorizzato');
  await store.auctionStatusForSession(token,league);return user;
 }
 io.use(async(socket,next)=>{try{
  if(!listenerReady)throw Error('Collegamento temporaneamente non disponibile');
  const league=socket.handshake.auth?.league,token=sid(socket.request.headers.cookie),user=await authorize(token,league);
  if([...io.sockets.sockets.values()].filter(s=>s.data.user?.id===user.id).length>=8)throw Error('Troppi dispositivi collegati');
  socket.data={league,token,user,acked:0};next();
 }catch{next(Error('Accedi alla lega per seguire l’asta.'));}});
 function roomFor(league,uid){if(!rooms.has(league))rooms.set(league,{league,uid,sockets:new Set(),state:null,pending:false,refreshing:null,timer:null,attemptedComputerTurn:null});return rooms.get(league);}
 function send(socket,room,stamp){
  const state=room.state;if(!state?.teams.some(t=>t.userId===socket.data.user.id)){socket.disconnect(true);return;}
  const data=socketAuctionView(state,socket.data.user.id,stamp);socket.data.sent=data.version;
  socket.timeout(5000).emit('auction:update',{league:room.league,data},(error,ack)=>{
   if(!error&&ack?.applied!==false&&ack?.version===data.version){socket.data.acked=Math.max(socket.data.acked,data.version);const peers=[...room.sockets].filter(s=>s.connected);if(peers.length&&peers.every(s=>s.data.acked>=data.version))log('AUCTION_SYNC_CONFIRMED',{league:room.league,version:data.version,devices:peers.length});}
  });
 }
 async function tick(room){
  if(closed)return;let notice;
  try{await store.league(room.uid,room.league,async(s,c)=>{
   const stamp=now(),due=auctionTickDue(s.auction,stamp),planned=computerActionAt(s);
   if(!due&&(planned==null||planned>stamp))return;
   const next=due?auctionAction(s,'read',{},'server',{now:stamp}):s;
   if(s.auction.status!=='running'&&next.auction.status==='running'){
    next.auction.openNotificationKey=s.league.id+':open:'+next.auction.version+':'+stamp;notice=await queueAuctionOpened(c,next,next.auction,{now:stamp});
   }
   if(next.auction.version!==s.auction.version)await store.persistAuction(c,s,next,'server','tick',{});
   const cmd=computerDecision(next,{now:stamp});
   if(cmd){
    const bot=(await c.query('SELECT user_id FROM fanta.teams WHERE id=$1 AND league_id=$2 FOR UPDATE',[cmd.teamId,s.league.id])).rows[0];
    if(!bot||bot.user_id)return;
    const action=auctionAction(next,cmd.kind,cmd.input,null,{now:stamp,computerTeam:cmd.teamId});
    await store.persistAuction(c,next,action,'computer',cmd.kind,{...cmd.input,teamId:cmd.teamId,source:'computer'});
   }else if(planned!=null&&planned<=stamp&&!due){
    // A caller without eligible players can only wait for the normal deadline.
    room.attemptedComputerTurn=planned;
   }
  },{write:true,auction:true,catalog:!!room.state&&computerActionAt(room.state)!=null&&!room.state.auction.lot});
  if(notice)try{await dispatchFanta('auction-notify:'+notice);}catch{}
  }catch{log('AUCTION_TIMER_RETRY',{league:room.league});}
  await refresh(room);
 }
 function schedule(room){
  clearTimeout(room.timer);const a=room.state?.auction;if(!a)return;
  const deadline=a.status==='scheduled'?a.startsAt:a.status==='running'&&a.mode==='live'&&a.phase!=='releases'?(a.pausedUntil||a.lot?.endsAt||a.callDeadline):null;
  const botDeadline=computerActionAt(room.state);
  const nextDeadline=Math.min(deadline?Date.parse(deadline):Infinity,botDeadline!==room.attemptedComputerTurn?botDeadline??Infinity:Infinity);
  if(Number.isFinite(nextDeadline)){const delay=Math.max(20,Math.min(86400000,nextDeadline-now()+10));room.timer=setTimeout(()=>void tick(room),delay);}
 }
 async function refresh(room){
  if(closed)return;room.pending=true;if(room.refreshing)return room.refreshing;
  room.refreshing=(async()=>{while(room.pending&&!closed){room.pending=false;
   try{
    // One shared authoritative state per version, personalized in memory for each participant.
    const state=await store.league(room.uid,room.league,s=>s,{catalog:false,detailedVotes:false});
    if(room.state&&state.auction.version<room.state.auction.version)continue;
    room.state=state;const stamp=now();for(const socket of room.sockets)if(socket.connected)send(socket,room,stamp);
    schedule(room);
    log('AUCTION_PUSH',{league:room.league,version:state.auction.version,devices:room.sockets.size});
   }catch{for(const socket of room.sockets)socket.emit('auction:unavailable');clearTimeout(room.timer);room.timer=setTimeout(()=>void refresh(room),2000);}
  }})().finally(()=>{room.refreshing=null;});return room.refreshing;
 }
 async function changed(league){
  if(closed)return;let room=rooms.get(league);
  if(!room){const c=await store.connect();let row;try{row=(await c.query("SELECT t.user_id FROM fanta.teams t JOIN fanta.auctions a ON a.league_id=t.league_id WHERE t.league_id=$1 AND t.user_id IS NOT NULL AND a.data->>'status' IN('scheduled','running') ORDER BY t.id LIMIT 1",[league])).rows[0];}finally{c.release();}if(!row)return;room=roomFor(league,row.user_id);}
  await refresh(room);
 }
 io.on('connection',socket=>{
  const room=roomFor(socket.data.league,socket.data.user.id);room.sockets.add(socket);socket.join('auction:'+room.league);
  let lastClock=0;
  socket.on('auction:clock',ack=>{if(typeof ack==='function'&&now()-lastClock>=1000){lastClock=now();ack({serverTime:new Date(now()).toISOString()});}});
  socket.on('disconnect',()=>{room.sockets.delete(socket);if(!room.sockets.size&&!['scheduled','running'].includes(room.state?.auction.status)){clearTimeout(room.timer);rooms.delete(room.league);}});
  if(room.state)send(socket,room,now());else void refresh(room);
 });
 const stopListening=subscribe?await subscribe(id=>void changed(id).catch(()=>{})):await listenAuctionChanges(id=>void changed(id).catch(()=>{}),{onUnavailable:()=>{listenerReady=false;for(const socket of io.sockets.sockets.values())socket.emit('auction:unavailable');},onReady:()=>{listenerReady=true;for(const room of rooms.values())void refresh(room);}});
 // Timers run on the server even when no participant has a page open.
 const c=await store.connect();try{const active=(await c.query("SELECT DISTINCT a.league_id,(SELECT user_id FROM fanta.teams WHERE league_id=a.league_id AND user_id IS NOT NULL ORDER BY id LIMIT 1) AS uid FROM fanta.auctions a JOIN fanta.leagues l ON l.id=a.league_id WHERE a.data->>'status' IN('scheduled','running') AND l.rules->>'disabledAt' IS NULL")).rows;for(const row of active)if(row.uid)void refresh(roomFor(row.league_id,row.uid));}finally{c.release();}
 let checking=false;const authTimer=setInterval(async()=>{if(checking||closed)return;checking=true;try{for(const socket of io.sockets.sockets.values())try{await authorize(socket.data.token,socket.data.league);}catch{socket.disconnect(true);}}finally{checking=false;}},60000);
 return {io,changed,stats:()=>[...rooms.values()].map(r=>({league:r.league,version:r.state?.auction.version,devices:r.sockets.size,acknowledged:[...r.sockets].filter(s=>s.data.acked>=r.state?.auction.version).length})),async close(){closed=true;clearInterval(authTimer);for(const r of rooms.values())clearTimeout(r.timer);await stopListening?.();await new Promise(resolve=>io.close(resolve));}};
}
