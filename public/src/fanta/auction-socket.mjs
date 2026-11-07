import {auctionClockOffset} from './auction-watch.mjs';
import {loadSportsClient} from '../sports-push.mjs';

// A shared server snapshot is pushed to every participant; HTTP is recovery only.
export function createAuctionSocket({context,onData,onStatus=()=>{},onPresence=()=>{},onConnection=()=>{},factory=loadSportsClient,setTimer=setInterval,clearTimer=clearInterval}={}){
 let socket=null,league=null,closed=false,opening=false,healthy=false,last=null,offset=null,retryAt=0,roomSent=null;
 function updateRoom(){if(socket?.connected){const inRoom=!!context().inRoom;if(roomSent!==inRoom){roomSent=inRoom;if(!inRoom){last=null;healthy=false;}socket.emit('auction:room',inRoom);}}}
 function disconnect(){healthy=false;last=null;socket?.removeAllListeners();socket?.disconnect();socket=null;league=null;onPresence([]);onConnection(false);}
 function clock(){if(!socket?.connected||!context().inRoom)return;const started=Date.now();socket.timeout(3000).emit('auction:clock',(error,reply)=>{if(error){healthy=false;onConnection(false);return;}offset=auctionClockOffset(reply.serverTime,started);});}
 async function check(){
  if(closed)return;const c=context();
  if(!c.active||!c.league){if(socket)disconnect();return;}
  if(socket&&league===c.league){updateRoom();return;}if(socket)disconnect();
  if(opening||Date.now()<retryAt)return;opening=true;
  try{
   const io=await factory();if(closed||!context().active||context().league!==c.league)return;
   league=c.league;socket=io({path:'/socket.io',transports:['websocket'],withCredentials:true,auth:{league,passive:true},reconnection:true,reconnectionDelay:500,reconnectionDelayMax:5000,timeout:5000});
   socket.on('connect',()=>{healthy=false;roomSent=null;onConnection(false);updateRoom();clock();});
   socket.on('auction:status',message=>{if(!closed&&context().league===league&&message.league===league)onStatus(message.data);});
   socket.on('auction:presence',ids=>{if(Array.isArray(ids)&&context().league===league)onPresence(ids);});
   socket.on('auction:update',(message,ack)=>{
    if(closed||!context().active||!context().inRoom||context().league!==league||message.league!==league)return;
    const data=message.data;if(!data||!Number.isInteger(data.version))return;
    if(last&&data.version<last.version){ack?.({version:data.version,applied:false});return;}
    last=data;healthy=true;onConnection(true);
    try{onData(data,offset);ack?.({version:data.version,applied:true});}catch{ack?.({version:data.version,applied:false});}
   });
   socket.on('disconnect',()=>{healthy=false;onPresence([]);onConnection(false);});
   socket.on('connect_error',()=>{healthy=false;onConnection(false);});
   socket.on('auction:unavailable',()=>{healthy=false;onConnection(false);});
  }catch{retryAt=Date.now()+15000;onConnection(false);}finally{opening=false;}
 }
 const timer=setTimer(check,1000),clockTimer=setTimer(clock,5000);void check();
 return {check,ready:id=>healthy&&league===id&&!!socket?.connected,last:()=>last,offset:()=>offset,async stop(){closed=true;clearTimer(timer);clearTimer(clockTimer);disconnect();}};
}
